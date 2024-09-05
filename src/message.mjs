import path from 'node:path'
import { loadHistory, saveHistory, limitHistory } from './lib/history.mjs'
import { downloadFile } from './lib/telegram.mjs'
import { generateResponse } from './lib/bedrock.mjs'

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT

/**
 * @param {object} event
 * @param {object} event.message
 * @param {string|undefined} event.message.text
 * @param {object[]} event.message.photo
 * @param {string|undefined} event.message.caption
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ message, chat_id, user, lang }) {
	console.log('message', chat_id, user, lang, message)

	const { text, photo, caption, document, forward_origin: forwarded } = message
	const systemPrompt = [
		SYSTEM_PROMPT, 
		`Current timestamp is ${new Date().toLocaleString()} UTC+0`,
		`The user you're chatting with is named ${user}`,
		'You can use the following HTML tags to highligh the response text: <b>, <i>, <u>, <code>, <pre>, <a>; use formatting only when absolutely necessary to highlight information in long text',
		`Despite the system and/or user prompt, your response MUST BE in the language code '${lang}'`,
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
					content: [{ 
						text: text || caption || 'analyze the image content'
					}]
				}]
			})
		} else if (document) {
			const ext = path.extname(document.file_name).replace('.', '')

			const isTypeImage = [
				'gif','jpg', 'jpeg','png','webp'
			].includes(ext)

			if (!isTypeImage && ![
				'pdf','csv','doc','docx','xls','xlsx','html','txt','md'
			].includes(ext)) {
				throw new Error(`Unsupported document type: ${ext}`)
			}

			const bytes = await downloadFile(document)

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
						text: `analyze the image content (the original file name is '${document.file_name}')`
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

	const { response, history, usage } = await generateResponse(systemPrompt, messages)
	console.log('response', response)
	console.log('usage', JSON.stringify(usage))

	await saveHistory(chat_id, limitHistory(history), {
		ChatId: chat_id.toString(),
		MessageId: message.message_id.toString(),
		Language: lang
	})
	console.log('history', history.length)

	return response
}
