import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
const bedrock = new BedrockRuntimeClient()
const s3 = new S3Client()

const LINE_END = '\n'
const INSTRUCTIONS = process.env.INSTRUCTIONS
const HISTORY_BUCKET = process.env.HISTORY_BUCKET
const MODEL_ID = process.env.MODEL_ID

/**
 * Read response stream and convert to string
 * 
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
 * Get Bedrock model request payload based of model id name
 * 
 * @param {string} prompt
 * @returns {object}
 */
function getModelRequest(prompt) {
	if (MODEL_ID.startsWith('ai21')) {
		return {
			'prompt': prompt,
			'maxTokens': 200,
			'temperature': 0.7,
			'topP': 1,
			'stopSequences': [],
			'countPenalty': { 'scale': 0 },
			'presencePenalty': { 'scale': 0 }, 
			'frequencyPenalty': { 'scale': 0 }
		}
	}
	
	if (MODEL_ID.startsWith('cohere')) {
		return {
			'prompt': prompt,
			'max_tokens': 200,
			'temperature': 0.7,
			'p': 0.01,
			'k': 0,
			'stop_sequences': [],
			'return_likelihoods': 'NONE'
		}
	}

	return {
		'prompt': prompt
	}
}

/**
 * Get Bedrock model response based of model id name
 * 
 * @param {object} response
 * @returns {object}
 */
function getModelResponse(response) {
	if (MODEL_ID.startsWith('ai21')) {
		return response.completions.reduce((acc, completion) => acc + ' ' +completion.data.text, '').trim()
	}
	
	if (MODEL_ID.startsWith('cohere')) {
		return response.generations.reduce((acc, generation) => acc + ' ' +generation.text, '').trim()
	}

	return response
}

/**
 * @param {object} event
 * @param {string} event.text
 * @param {number} event.chat_id
 * @param {string} event.user
 */
export async function handler ({ text, chat_id, user }) {
	let history = ''
	if (text !== '/start') {
		try {
			const { Body: body } = await s3.send(new GetObjectCommand({
				Bucket: HISTORY_BUCKET,
				Key: chat_id.toString(),
			}))
			history = await readIncomingMessage(body)
			console.log(`HistoryLength: ${history.length}`)
		} catch (error) {
			if (error.Code !== 'NoSuchKey') {
				throw error
			}
		}
	} else {
		text = 'Present yourself'
	}

	console.log(`Instructions: ${INSTRUCTIONS}`)
	console.log(`Input: ${text}`)

	const userContext = `The person you are interacting with is called ${user}.`
	const dateTimeContext = `Now is ${new Date()}`

	const prompt = [
		history,
		`Instructions: ${INSTRUCTIONS}. ${userContext}. ${dateTimeContext}.`,
		LINE_END,
		`Question: ${text}`,
		LINE_END,
		LINE_END,
		'Answer: ',
	].join('')

	let { body, contentType, $metadata } = await bedrock.send(new InvokeModelCommand({
		modelId: MODEL_ID,
		contentType: 'application/json',
		accept: 'application/json',
		body: JSON.stringify(getModelRequest(prompt))
	}))

	body = JSON.parse(Buffer.from(body).toString())
	const response = getModelResponse(body)

	console.log(`Metadata: ${JSON.stringify($metadata)}`)
	console.log(`Output: ${contentType} ${JSON.stringify(body)}`)

	history = [
		history,
		`Question: ${text}`, 
		LINE_END,
		LINE_END,
		`Answer: ${response}`,
		LINE_END,
	].join('')

	await s3.send(new PutObjectCommand({
		Bucket: HISTORY_BUCKET,
		Key: chat_id.toString(),
		Body: history
	}))

	return response
}
