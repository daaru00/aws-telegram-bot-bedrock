import { ingest, retrieveAndGenerate } from '../lib/knowledge.mjs'

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function save ({ toolUseId, input }) {
	if (!Array.isArray(input.text)) {
		input.text = [input.text]
	}

	try {
		for (const text of input.text) {
			await ingest(text, [{
				key: 'chat_id',
				value: {
					type: 'STRING',
					stringValue: input.chat_id.toString()
				}
			}])
		}
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to ingest text: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			text: 'text ingested successfully'
		}],
		status: 'success'
	}
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function search ({ toolUseId, input }) {
	let result = ''
	try {
		result = await retrieveAndGenerate(input.query, {
			equals: {
				key: 'chat_id',
				value: input.chat_id
			}
		})
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to retrieve search results: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			text: result
		}],
		status: 'success'
	}
}
