const SERPAPI_KEY = process.env.SERPAPI_KEY
const SERPAPI_URL = 'https://serpapi.com/search.json'

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function classic ({ toolUseId, input }) {
	console.debug('websearch classic', input)

	let res
	try {
		res = await fetch(`${SERPAPI_URL}?engine=google&q=${encodeURIComponent(input.query)}&api_key=${SERPAPI_KEY}`, {
			method: 'GET'
		})
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to search '${input.query}' on the web`
			}],
			status: 'error'
		}
	}

	console.log('websearch response', res.status, res.statusText)
	if (!res.ok) {
		return {
			toolUseId,
			content: [{
				text: `failed to search '${input.query}' on the web`
			}],
			status: 'error'
		}
	}

	const data = await res.json()
	const results = data.organic_results || []

	return {
		toolUseId,
		content: [{
			json: results.map(result => ({
				title: result.title,
				snippet: result.snippet,
				source: result.source,
				link: result.link
			}))
		}]
	}
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function aimode ({ toolUseId, input }) {
	console.debug('websearch aimode', input)  

	let res
	try {
		res = await fetch(`${SERPAPI_URL}?engine=google_ai_mode&q=${encodeURIComponent(input.query)}&api_key=${SERPAPI_KEY}`, {
			method: 'GET'
		})
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to search '${input.query}' on the web`
			}],
			status: 'error'
		}
	}

	console.log('websearch response', res.status, res.statusText)
	if (!res.ok) {
		return {
			toolUseId,
			content: [{
				text: `failed to search '${input.query}' on the web`
			}],
			status: 'error'
		}
	}

	const data = await res.json()

	return {
		toolUseId,
		content: [{
			text: data.reconstructed_markdown
		}]
	}
}
