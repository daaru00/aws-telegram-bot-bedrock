const TELEGRAM_API_ENDPOINT = process.env.TELEGRAM_API_ENDPOINT
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN

/**
 * @param {object} fileObject
 * @param {string} fileObject.file_id
 * @returns {Uint8Array}
 */
export async function downloadFile (fileObject) {
	const fileRes = await fetch(`${TELEGRAM_API_ENDPOINT}/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileObject.file_id}`)
	if (!fileRes.ok) {
		throw new Error(fileRes.statusText)
	}
	const file = await fileRes.json()
	console.log('file', JSON.stringify(file))

	const url = `${TELEGRAM_API_ENDPOINT}/file/bot${TELEGRAM_BOT_TOKEN}/${file.result.file_path}`
	console.log('url', url)

	const fileContestRes = await fetch(url)
	if (!fileContestRes.ok) {
		throw new Error(fileContestRes.statusText)
	}

	const body = await fileContestRes.arrayBuffer()
	return new Uint8Array(body)
}
