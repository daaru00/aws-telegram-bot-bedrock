/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function handler ({ toolUseId }) {
	const date = new Date()
  
	return {
		toolUseId,
		content: [{
			json: {
				year: date.getFullYear(),
				month: date.getMonth() + 1,
				day: date.getDate(),
				hour: date.getHours(),
				minute: date.getMinutes(),
				second: date.getSeconds(),
				timezone: 'UTC+0',
			}
		}]
	}
}
