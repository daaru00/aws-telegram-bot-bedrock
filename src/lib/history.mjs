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
 * @param {object[]} messages 
 * @returns {object[]}
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
 * @returns {object[]}
 */
export async function loadHistory (chatId) {
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
	return messages
}

/**
 * @param {number} chatId
 * @param {object[]} messages
 */
export async function saveHistory (chatId, messages = []) {
	messages = limitHistory(messages)

	await s3.send(new PutObjectCommand({
		Bucket: HISTORY_BUCKET,
		Key: chatId.toString(),
		Body: JSON.stringify(messages)
	}))
}
