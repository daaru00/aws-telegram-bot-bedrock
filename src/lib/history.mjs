import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
const s3 = new S3Client()

const HISTORY_BUCKET = process.env.HISTORY_BUCKET
const MAX_HISTORY_LENGTH = parseInt(process.env.MAX_HISTORY_LENGTH || '10')

/**
 * @param {import('http').IncomingMessage} response 
 * @returns {string}
 */
async function readIncomingMessage (response) {
	return new Promise((resolve, reject) => {
		const data = []
		response.on('data', (chunk) => {
			data.push(chunk)
		}).on('end', () => {
			resolve(Buffer.concat(data).toString())
		}).on('error', (err) => {
			reject(err)
		})
	})
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').Message[]} messages 
 * @returns {import('@aws-sdk/client-bedrock-runtime').Message[]}
 */
export function limitHistory (messages = []) {
	if (messages.length > MAX_HISTORY_LENGTH) {
		messages.shift()
		while (messages[0].role !== 'user') {
			messages.shift()
		}
	}
	return messages
}

/**
 * @param {number} chatId
 * @returns {import('@aws-sdk/client-bedrock-runtime').Message[]}
 */
export async function loadHistory (chatId) {
	/** @type {import('@aws-sdk/client-bedrock-runtime').Message[]} */
	let messages = []
	try {
		const { Body: body } = await s3.send(new GetObjectCommand({
			Bucket: HISTORY_BUCKET,
			Key: chatId.toString(),
		}))
		const history = await readIncomingMessage(body)
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
 */
export async function saveHistory (chatId, messages = [], metadata) {
	messages = limitHistory(messages)

	messages = messages.map(message => {
		message.content = message.content.map(content => {
			if (content.image) {
				content.image.source.bytes = Array.from(content.image.source.bytes)
			} else if (content.document) {
				content.document.source.bytes = Array.from(content.document.source.bytes)
			}
			return content
		})
		return message
	})

	await s3.send(new PutObjectCommand({
		Bucket: HISTORY_BUCKET,
		Key: chatId.toString(),
		Body: JSON.stringify(messages),
		Metadata: metadata
	}))
}
