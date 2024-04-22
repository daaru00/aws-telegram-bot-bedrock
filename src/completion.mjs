import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
const bedrock = new BedrockRuntimeClient()

const MODEL_ID = process.env.MODEL_ID
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '100')

/**
 * @param {object} event
 * @param {string} event.text
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ text, lang }) {
	const langContext = `Answer using the language code ${lang}`
	const text = [text, langContext].join('. ')
	
	const prompt = {
    "prompt": `\n\nHuman:${text}\n\nAssistant:`,
    "max_tokens_to_sample": MAX_TOKENS
	}

	let { body, contentType, $metadata } = await bedrock.send(new InvokeModelCommand({
		modelId: MODEL_ID,
		contentType: 'application/json',
		accept: 'application/json',
		body: JSON.stringify(prompt)
	}))

	body = JSON.parse(Buffer.from(body).toString())
	console.log(`Metadata: ${JSON.stringify($metadata)}`)
	console.log(`Output ${contentType}: ${JSON.stringify(body)}`)

	return body.content.reduce((acc, content) => acc + ' ' +content.text, '').trim()
}
