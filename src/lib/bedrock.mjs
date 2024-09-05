import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
const bedrock = new BedrockRuntimeClient()

const MODEL_ID = process.env.MODEL_ID
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '350')
const TEMPERATURE = parseFloat(process.env.TEMPERATURE || '0.8')

/**
 * @param {string} system
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages
 * @param {number} maxToken
 * @returns {Promise<{ response: string, stopReason: string, usage: object, history: import('@aws-sdk/client-bedrock-runtime').Message[] }>}
 */
export async function generateResponse(system, messages) {
	let { output, stopReason, usage } = await bedrock.send(new ConverseCommand({
		modelId: MODEL_ID,
		inferenceConfig: {
			maxTokens: MAX_TOKENS,
			temperature: TEMPERATURE
		},
		messages,
		system: [{
			text: system
		}]
	}))
  
	const response = output.message.content.reduce((acc, item) => acc + item.text, '').trim().replace(/\.$/, '')
	const history = messages.concat({ role: 'assistant', content: [{ type: 'text', text: response }] })

	return {
		response,
		stopReason,
		usage,
		history
	}
}
