const USER_AGENT = process.env.USER_AGENT || 'Amazon Bedrock'

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function http ({ toolUseId, input }) {
	console.log('http', input)

	const res = await fetch(input.url, {
		method: 'GET',
		headers: {
			'User-Agent': USER_AGENT
		}
	})

	if (!res.ok) {
		return {
			toolUseId,
			content: [{
				text: `failed to fetch '${input.url}' HTML body content`
			}],
			status: 'error'
		}
	}

	const buffer = await res.arrayBuffer()
	const bytes = new Uint8Array(buffer)

	return {
		toolUseId,
		content: [{
			document: {
				format: 'html',
				name: 'HTML body content at ' + Math.floor(new Date().getTime() / 1000).toString(),
				source: {
					bytes: Array.from(bytes)
				}
			}
		}]
	}
}
