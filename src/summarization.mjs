import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { loadHistory, saveHistory } from './lib/history.mjs'
const bedrock = new BedrockRuntimeClient()

const MODEL_ID = process.env.MODEL_ID
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '100')

/**
 * @param {object} event
 * @param {string} event.text
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ text, lang, chat_id }) {
	const purposeContext = 'The user has forwarded you a message they received and your task is to summarize it as concisely as possible'
	const langContext = `Answer using the language code ${lang}`
	const responseContext = 'Reply only with summarized text without prefixes or suffixes that make the text seem unnatural, for example do not append the language code at the end of the message'

	const prompt = {
		'prompt': `System:${[purposeContext, langContext, responseContext].join('. ')}\n\nHuman:${text}\n\nAssistant:`,
		'max_tokens_to_sample': MAX_TOKENS
	}

	let { body, contentType, $metadata } = await bedrock.send(new InvokeModelCommand({
		modelId: MODEL_ID,
		contentType: 'application/json',
		accept: 'application/json',
		body: JSON.stringify(prompt)
	}))

	body = JSON.parse(Buffer.from(body).toString())
	console.log('metadata', JSON.stringify($metadata))
	console.log('output', contentType, JSON.stringify(body))

	const summary =  body.completion.trim()

	const messages = await loadHistory(chat_id)
	messages.push({
		'role': 'user',
		'content': text
	})
	messages.push({
		'role': 'assistant',
		'content': summary
	})
	
	await saveHistory(chat_id, messages)

	return summary
}
