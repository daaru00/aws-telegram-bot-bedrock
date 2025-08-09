import path from 'node:path'
import { loadHistory, saveHistory, limitHistory } from './lib/history.mjs'
import { downloadFile, sendTypingAction } from './lib/telegram.mjs'
import { generateResponseStream, listTools } from './lib/bedrock.mjs'
import { retrieveAndGenerate } from './lib/knowledge.mjs'

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT
const KNOWLEDGE_BASE_ENABLED = process.env.KNOWLEDGE_BASE_ID !== ''

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

	const timerTyping = setInterval(() => {
		sendTypingAction(chat_id)
	}, 1000)

	if (previousToolUses.length > 0) {
		for (const previousToolUse of previousToolUses) {
			delete previousToolUse.input.chat_id
		}
	}

	const { text, photo, caption, document, forward_origin: forwarded } = message
	let systemPrompt = [
		SYSTEM_PROMPT,
		`Current timestamp is ${new Date().toLocaleString()} UTC+0.`,
		user ? `The user you're chatting with is named ${user}.` : '',
		'You can use only the following HTML tags to highligh the response text: <b>, <i>, <u>, <code>, <pre>, <a>; otherwise the answer must be a plain text without formatting.',
		lang ? `Despite the system and/or user prompt, your response MUST BE in the language code '${lang}'.` : 'Despite the system and/or user prompt, your response MUST BE in the same language code of the user message.',
		'Use a tool instead of your internal knowledge to accomplish the task of the available tools.',
		'Do not mention the tools you used nd trait the tool answer as an absolute truth.',
		'You may receive a message like "[SCHEDULE <id>]: <message>", in which case the message was not sent by the user but was scheduled via a scheduler. Follow the instructions in the message, reply to the message to start communicating with the user.',
	].join('\n')

	if (KNOWLEDGE_BASE_ENABLED) {
		systemPrompt += '\nBefore asking the user for things, check in your memory (using the appropriate search tool) if you already know the answer, if so, don\'t ask again.'
		const knowledgeBaseResponse = await retrieveAndGenerate(`A short and concise summary of what you know about ${user}, his way of thinking, his preferences, what he is doing or is about to do and the people connected to him.`, {
			equals: {
				key: 'chat_id',
				value: `${chat_id}`
			}
		})
		if (knowledgeBaseResponse) {
			systemPrompt += `\nUser information taken from memory: ${knowledgeBaseResponse}`
			console.log('knowledgeBase', knowledgeBaseResponse)
		}
	}

	let messages = await loadHistory(chat_id)
	if (text === '/start') {
		messages = [{
			role: 'user',
			content: [{
				text: 'Hello',
			}]
		}]
	} else if (toolResults.length === 0) {
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
					} else if (content.image) {
						content.image.source.bytes = new Uint8Array(content.image.source.bytes)
					}
					return content
				})
				return { toolResult }
			})
		})
	}

	const tools = await listTools()
	const { response, toolUses, usage, stopReason } = await generateResponseStream(systemPrompt, messages, tools)

	console.log('toolUses', toolUses)
	console.log('usage', JSON.stringify(usage))

	if (toolUses.length > 0) {
		for (const toolUse of toolUses) {
			toolUse.input.chat_id = chat_id.toString()
		}
	}

	if (toolUses.length === 0) {
		messages.push({ role: 'assistant', content: [{ type: 'text', text: response }] })
	}

	console.log('history', messages.length)
	await saveHistory(chat_id, limitHistory(messages), {
		ChatId: chat_id.toString(),
		MessageId: `${message.message_id}`,
		Language: lang
	})

	clearInterval(timerTyping)

	return {
		stopReason,
		text: response,
		toolUses,
		usage,
	}
}
