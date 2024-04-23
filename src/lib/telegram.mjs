const TELEGRAM_API_ENDPOINT = process.env.TELEGRAM_API_ENDPOINT
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

/**
 * @param {object} photo 
 * @returns {string}
 */
export async function downloadImage (photo) {
	const fileRes = await fetch(`${TELEGRAM_API_ENDPOINT}/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${photo.file_id}`)
	if (!fileRes.ok) {
		throw new Error(fileRes.statusText)
	}
	const file = await fileRes.json()
	console.log('file', JSON.stringify(file))

	const fileContestRes = await fetch(`${TELEGRAM_API_ENDPOINT}/file/bot${TELEGRAM_BOT_TOKEN}/${file.result.file_path}`)
	if (!fileContestRes.ok) {
		throw new Error(fileContestRes.statusText)
	}

	const body = await fileContestRes.arrayBuffer()
	return Buffer.from(body).toString('base64')
}
