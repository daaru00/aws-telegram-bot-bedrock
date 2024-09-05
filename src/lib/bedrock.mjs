import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { SSMClient, GetParametersByPathCommand } from '@aws-sdk/client-ssm'
const bedrock = new BedrockRuntimeClient()
const ssm = new SSMClient()

const MODEL_ID = process.env.MODEL_ID
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '350')
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.8')
const TOOLS_SSM_PREFIX = process.env.TOOLS_SSM_PREFIX

/**
 * @returns {Promise<import('@aws-sdk/client-bedrock-runtime').Tool[]>}
 */
export async function listTools() {
	/** @type {import('@aws-sdk/client-bedrock-runtime').Tool[]} */
	let tools = []
		
	if (!TOOLS_SSM_PREFIX) {
		return tools
	}

	const { Parameters: parameters } = await ssm.send(new GetParametersByPathCommand({
		Path: TOOLS_SSM_PREFIX,
		Recursive: true
	}))

	for (const parameter of parameters) {
		try {
			const toolSpec = JSON.parse(parameter.Value)
			tools.push({
				toolSpec
			})	
		} catch (error) {
			console.error('Error parsing tool', parameter.Name, error)
		}
	}

	return tools
}

/**
 * @param {string} system
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages
 * @param {import('@aws-sdk/client-bedrock-runtime').Tool[]} tools
 * @returns {Promise<{ response: string, stopReason: string, usage: object, history: import('@aws-sdk/client-bedrock-runtime').Message[], tools: import('@aws-sdk/client-bedrock-runtime').ToolUseBlock[] }>}
 */
export async function generateResponse(system, messages, tools = []) {
	let { output, stopReason, usage } = await bedrock.send(new ConverseCommand({
		modelId: MODEL_ID,
		inferenceConfig: {
			maxTokens: MAX_TOKENS,
			temperature: TEMPERATURE
		},
		messages,
		system: [{
			text: system
		}],
		toolConfig: tools.length > 0 ? {
			tools
		} : undefined
	}))
  
	const response = output.message.content.reduce((acc, item) => acc + item.text, '').trim().replace(/\.$/, '')
	const toolUses = output.message.content.filter(item => item.toolUse).map(item => item.toolUse)
	const history = messages.concat({ role: 'assistant', content: [{ type: 'text', text: response }] })

	return {
		response,
		toolUses,
		stopReason,
		usage,
		history
	}
}
