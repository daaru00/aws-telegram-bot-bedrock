import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

const USER_AGENT = process.env.USER_AGENT || 'curl/7.81.0'

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function http ({ toolUseId, input }) {
	console.log('http', input)

	let res
	try {
		console.log('http executing..')
		res = await fetch(input.url, {
			method: 'GET',
			headers: {
				'User-Agent': USER_AGENT
			}
		})
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to fetch '${input.url}' website`
			}],
			status: 'error'
		}
	}

	console.log('http response', res.status, res.statusText)
	if (!res.ok) {
		return {
			toolUseId,
			content: [{
				text: `failed to fetch '${input.url}' body content`
			}],
			status: 'error'
		}
	}

	console.log('http loading..')
	const buffer = await res.arrayBuffer()
	const doc = new JSDOM(buffer, { url: input.url })
	console.log('http parsing..')
	const reader = new Readability(doc.window.document)
	const article = reader.parse()
	console.log('http parsed', article)

	return {
		toolUseId,
		content: [{
			document: {
				format: 'html',
				name: `${new Date().getTime()}.html`,
				source: {
					bytes: Array.from(new TextEncoder().encode(article.content))
				}
			}
		}]
	}
}
