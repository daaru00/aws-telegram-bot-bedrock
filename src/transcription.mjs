import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
const s3 = new S3Client()

const BUCKET_NAME = process.env.BUCKET_NAME

/**
 * @param {object} event
 * @param {string} event.bucket
 * @param {string} event.key
 */
export async function handler (event) {
	const res = await s3.send(new GetObjectCommand({
		Bucket: event.bucket || BUCKET_NAME,
		Key: event.key,
	}))
	const content = await res.Body.transformToString()

	const { results } = JSON.parse(content)
	const text = results.transcripts.reduce((acc, transcript) => acc + ' ' + transcript.transcript, '').trim()

	return text
}
