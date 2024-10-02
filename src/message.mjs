import path from 'node:path'
import { loadHistory, saveHistory, limitHistory } from './lib/history.mjs'
import { downloadFile, sendTypingAction } from './lib/telegram.mjs'
import { generateResponseStream, listTools } from './lib/bedrock.mjs'

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT

/**
 * @param {object} event
 * @param {object} event.message
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock[]} event.toolUses
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock[]} event.toolResults
 * @param {string|undefined} event.message.text
 * @param {object[]} event.message.photo
 * @param {string|undefined} event.message.caption
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ message, toolUses: previousToolUses = [], toolResults = [], chat_id, user, lang }) {
	console.log('message', JSON.stringify(message))
	console.log('toolResults', JSON.stringify(toolResults))

	const { text, photo, caption, document, forward_origin: forwarded } = message
	const systemPrompt = [
		SYSTEM_PROMPT,
		`Current timestamp is ${new Date().toLocaleString()} UTC+0`,
		`The user you're chatting with is named ${user}`,
		'You can use only the following HTML tags to highligh the response text: <b>, <i>, <u>, <code>, <pre>, <a>; otherwise the answer must be a plain text without formatting',
		`Despite the system and/or user prompt, your response MUST BE in the language code '${lang}'`,
		'Use a tool instead of your internal knowledge to accomplish the task of the available tools',
		'Do not mention the tools you used nd trait the tool answer as an absolute truth',
	].join('. ')

	let messages = []
	if (text === '/start') {
		messages = [{
			role: 'user',
			content: [{
				text: 'Hello',
			}]
		}]
	} else {
		messages = await loadHistory(chat_id)
		if (photo) {
			const bytes = await downloadFile(photo.pop())
			messages.push({
				role: 'user',
				content: [{
					image: {
						format: 'jpeg',
						source: {
							bytes
						}
					}
				}, {
					text: text || caption || 'analyze the image content'
				}]
			})
		} else if (document) {
			let ext = path.extname(document.file_name).replace('.', '')

			let isTypeImage = [
				'gif', 'jpg', 'jpeg', 'png', 'webp'
			].includes(ext)

			const isTypeVideo = [
				'mp4'
			].includes(ext)

			if (!isTypeImage && !isTypeVideo && ![
				'pdf', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'html', 'txt', 'md'
			].includes(ext)) {
				throw new Error(`Unsupported document type: ${ext}`)
			}

			let bytes
			if (isTypeVideo) {
				// download the thumbnail image instead
				bytes = await downloadFile(document.thumb)
				// force image processing instead of document
				isTypeImage = true
				ext = 'jpeg'
			} else {
				bytes = await downloadFile(document)
			}

			if (isTypeImage) {
				messages.push({
					role: 'user',
					content: [{
						image: {
							format: ext === 'jpg' ? 'jpeg' : ext,
							name: `${message.message_id}`,
							source: {
								bytes
							}
						}
					}, {
						text: isTypeVideo ?
							`analyze the image content, this is a thumbnail of a video (the original video file name is '${document.file_name}')` :
							`analyze the image content (the original file name is '${document.file_name}')`
					}]
				})
			} else {
				messages.push({
					role: 'user',
					content: [{
						document: {
							format: ext,
							name: `${message.message_id}`,
							source: {
								bytes
							}
						}
					}, {
						text: `extract essential information from file content (the original file name is '${document.file_name}')`
					}]
				})
			}
		} else if (forwarded) {
			messages.push({
				role: 'user',
				content: [{
					document: {
						format: 'txt',
						name: `${message.message_id}`,
						source: {
							bytes: Uint8Array.from(Array.from(text).map(letter => letter.charCodeAt(0)))
						}
					}
				}, {
					text: [
						`this is a forwarded message, the original sender is '${forwarded.sender_name}', was sent on '${new Date(forwarded.date * 1000).toDateString()}'`,
						'Summarize the content of the message as concisely as possible, use a maximum of two sentences, do not use lists'
					].join('. ')
				}]
			})
		} else {
			messages.push({
				role: 'user',
				content: [{
					text
				}]
			})
		}
	}

	if (toolResults.length > 0) {
		messages.push({
			role: 'assistant',
			content: previousToolUses.map(toolUse => ({ toolUse }))
		})
		messages.push({
			role: 'user',
			content: toolResults.map(toolResult => {
				toolResult.content = toolResult.content.map(content => {
					if (content.document) {
						content.document.source.bytes = new Uint8Array(content.document.source.bytes)
					}
					return content
				})
				return { toolResult }
			})
		})
	}

	const timerTyping = setInterval(() => {
		sendTypingAction(chat_id)
	}, 1000)

	const tools = await listTools()
	const { response, toolUses, usage, stopReason } = await generateResponseStream(systemPrompt, messages, tools)

	console.log('toolUses', toolUses)
	console.log('usage', JSON.stringify(usage))

	if (toolUses.length === 0 || previousToolUses.length > 0) {
		let history = messages.concat({ role: 'assistant', content: [{ type: 'text', text: response }] })
		await saveHistory(chat_id, limitHistory(history), {
			ChatId: chat_id.toString(),
			MessageId: `${message.message_id}`,
			Language: lang
		})
		console.log('history', history.length)
	}

	clearInterval(timerTyping)

	return {
		stopReason,
		text: response,
		toolUses,
		usage,
	}
}
