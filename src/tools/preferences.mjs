import { saveData, getData } from '../lib/data.mjs'

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function save ({ toolUseId, input }) {
	console.debug('preferences save', input)

	try {
		let preferences = await getData(input.chat_id, 'preferences')
		if (!preferences) {
			preferences = {}
		}

		preferences[input.key] = input.value
		await saveData(input.chat_id, 'preferences', preferences)
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to save preferences: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			text: 'preferences saved successfully'
		}],
		status: 'success'
	}
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function get ({ toolUseId, input }) {
	console.debug('preferences get', input)

	let result = ''
	try {
		result = await getData(input.chat_id, 'preferences')
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to retrieve preferences: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			json: result || {}
		}],
		status: 'success'
	}
}
