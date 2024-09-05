import { generateResponse } from './lib/bedrock.mjs'

/**
 * @param {object} event
 * @param {string} event.text
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ text, lang }) {
	const systemPrompt = [
		'You are a bot that help to generate error messages',
		`Despite the system and/or user prompt, your response MUST BE in the language code '${lang}'`,
		'Reply only with the requested text'
	].join('. ')

	let { response } = await generateResponse(systemPrompt, [{
		role: 'user',
		content: [{ 
			text,
		}]
	}])

	return response
}
