import { BedrockRuntimeClient, ConverseCommand, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime'
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
 * @returns {Promise<{ response: string, stopReason: string, usage: object, toolUses: import('@aws-sdk/client-bedrock-runtime').ToolUseBlock[] }>}
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
	let toolUses = output.message.content.filter(item => item.toolUse).map(item => item.toolUse)

	if (toolUses.length > 0) {
		toolUses = toolUses.map(toolUse => {
			if (typeof toolUse.input === 'string') {
				toolUse.input = JSON.parse(toolUse.input || '{}')
			}
			return toolUse
		})
	}

	return {
		response,
		stopReason,
		usage,
		toolUses,
	}
}

/**
 * @param {string} system
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages
 * @param {import('@aws-sdk/client-bedrock-runtime').Tool[]} tools
 * @param {function} onWriting
 * @returns {Promise<{ response: string, stopReason: string, usage: object, toolUses: import('@aws-sdk/client-bedrock-runtime').ToolUseBlock[] }>}
 */
export async function generateResponseStream(system, messages, tools = [], onWriting) {
	let { stream } = await bedrock.send(new ConverseStreamCommand({
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

	let stopReason
	let usage

	let response = ''
	let toolUses = []

	for await (const item of stream) {
		if (item.contentBlockStart) {
			if (item.contentBlockStart.start?.toolUse) {
				toolUses.push({
					toolUseId: item.contentBlockStart.start?.toolUse.toolUseId,
					name: item.contentBlockStart.start?.toolUse.name,
					input: ''
				})
			}
		} else if (item.contentBlockDelta) {
			if (item.contentBlockDelta.delta?.text) {
				const text = item.contentBlockDelta.delta?.text
				response += text
				if (typeof onWriting === 'function') {
					onWriting(text)
				}
			} else if (item.contentBlockDelta.delta?.toolUse) {
				toolUses[toolUses.length-1].input += item.contentBlockDelta.delta?.toolUse.input
			}
		} else if (item.metadata) {
			usage = item.metadata.usage
		} else if (item.messageStop) {
			stopReason = item.messageStop.stopReason
		}
	}

	if (toolUses.length > 0) {
		toolUses = toolUses.map(toolUse => {
			if (typeof toolUse.input === 'string') {
				toolUse.input = JSON.parse(toolUse.input || '{}')
			}
			return toolUse
		})
	}

	return {
		response,
		stopReason,
		usage,
		toolUses,
	}
}
