import { downloadFile } from './lib/telegram.mjs'
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
const s3 = new S3Client()

const BUCKET_NAME = process.env.BUCKET_NAME

/**
 * @param {object} event
 * @param {object} event.voice
 * @param {string} event.voice.file_id
 * @param {string} event.voice.mime_type
 * @param {object} event.audio
 * @param {string} event.audio.file_id
 * @param {string} event.audio.file_name
 * @param {string} event.audio.mime_type
 */
export async function handler (event) {
	let fileInput = null
	if (event.voice) {
		fileInput = event.voice
	} else if (event.audio) {
		fileInput = event.audio
	} else {
		throw new Error('No file found')
	}

	const key = `input/${fileInput.file_id}`
	let alreadyDownloaded = false
	try {
		await s3.send(new HeadObjectCommand({
			Bucket: BUCKET_NAME,
			Key: key
		}))
		alreadyDownloaded = true
	} catch (e) {
		if (e.name !== 'NotFound') {
			throw e
		}
	}

	if (alreadyDownloaded) {
		console.log(`File ${fileInput.file_id} already downloaded`)
	} else {
		const file = await downloadFile(fileInput)

		await s3.send(new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: key,
			Body: file,
			ContentType: fileInput.mime_type
		}))
	}

	return {
		file_unique_id: fileInput.file_id,
		s3_uri: `s3://${BUCKET_NAME}/${key}`
	}
}
