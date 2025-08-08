import { S3Client, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
const s3 = new S3Client()

const HISTORY_BUCKET = process.env.HISTORY_BUCKET
const MAX_HISTORY_LENGTH = parseInt(process.env.MAX_HISTORY_LENGTH || '10')

/**
 * @param {object} message
 * @returns {boolean}
 */
const isRealUser = (message) => {
	return message?.role === 'user' && !message?.content?.[0]?.toolResult
}

/**
 * @param {object} message
 * @returns {boolean}
 */
const isToolUse = (message) => {
	return message?.role === 'assistant' && !!message?.content?.[0]?.toolUse
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages 
 * @returns {import('@aws-sdk/client-bedrock-runtime').Message[]}
 */
export function limitHistory (messages = []) {
	if (!messages || messages.length <= MAX_HISTORY_LENGTH) {
		return messages
	}

	let limitedMessages = [...messages]
	const userMessageCount = limitedMessages.filter(isRealUser).length

	if (userMessageCount <= 1) {
		const userMessage = limitedMessages[0]
		const assistantMessages = limitedMessages.slice(1)

		while (1 + assistantMessages.length > MAX_HISTORY_LENGTH) {
			if (isToolUse(assistantMessages[0])) {
				assistantMessages.splice(0, 2)
			} else {
				assistantMessages.shift()
			}
		}
		return [userMessage, ...assistantMessages]
	} else {
		while (limitedMessages.length > MAX_HISTORY_LENGTH) {
			const firstTurnEndIndex = limitedMessages.findIndex((msg, index) => index > 0 && isRealUser(msg))

			if (firstTurnEndIndex > 0) {
				limitedMessages.splice(0, firstTurnEndIndex)
			} else {
				break
			}
		}
		return limitedMessages
	}
}

/**
 * @param {number} chatId
 * @returns {Promise<import('@aws-sdk/client-bedrock-runtime').Message[]>}
 */
export async function loadHistory (chatId) {
	/** @type {import('@aws-sdk/client-bedrock-runtime').Message[]} */
	let messages = []
	try {
		const { Body: body } = await s3.send(new GetObjectCommand({
			Bucket: HISTORY_BUCKET,
			Key: chatId.toString() + '.json',
		}))
		const history = await body.transformToString()
		messages = JSON.parse(history) || []
	} catch (error) {
		if (!['NoSuchKey', 'SyntaxError'].includes(error.name)) {
			throw error
		}
	}

	messages = messages.map(message => {
		message.content = message.content.map(content => {
			if (content.image) {
				content.image.source.bytes = new Uint8Array(content.image.source.bytes)
			} else if (content.document) {
				content.document.source.bytes = new Uint8Array(content.document.source.bytes)
			} else if (content.toolResult) {
				content.toolResult.content = content.toolResult.content.map(content => {
					if (content.image) {
						content.image.source.bytes = new Uint8Array(content.image.source.bytes)
					} else if (content.document) {
						content.document.source.bytes = new Uint8Array(content.document.source.bytes)
					}
					return content
				})
			}
			return content
		})
		return message
	})

	return messages
}

/**
 * @param {number} chatId
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages
 * @param {Record<string, string>|undefined} metadata
 * @returns {Promise<void>}
 */
export async function saveHistory (chatId, messages = [], metadata) {
	messages = limitHistory(messages)

	messages = messages.map(message => {
		message.content = message.content.map(content => {
			if (content.image) {
				content.image.source.bytes = Array.from(content.image.source.bytes)
			} else if (content.document) {
				content.document.source.bytes = Array.from(content.document.source.bytes)
			} else if (content.toolResult) {
				content.toolResult.content = content.toolResult.content.map(content => {
					if (content.document) {
						content.document.source.bytes = Array.from(content.document.source.bytes)
					} else if (content.image) {
						content.image.source.bytes = Array.from(content.image.source.bytes)
					}
					return content
				})
			}
			return content
		})
		return message
	})

	await s3.send(new PutObjectCommand({
		Bucket: HISTORY_BUCKET,
		Key: chatId.toString() + '.json',
		Body: JSON.stringify(messages),
		Metadata: metadata
	}))
}

export async function getChatMetadata(chatId) {
	try {
		const { Metadata } = await s3.send(new HeadObjectCommand({
			Bucket: HISTORY_BUCKET,
			Key: chatId.toString() + '.json',
		}))
		return Metadata
	} catch (error) {
		if (error.name === 'NoSuchKey') {
			return {}
		}
		throw error
	}
}
