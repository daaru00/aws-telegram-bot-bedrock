import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const ddbDocClient = DynamoDBDocumentClient.from(new DynamoDBClient())

/**
 * @param {number} chatId 
 * @param {string} entity 
 * @param {object} data 
 * @return {Promise<void>}
 */
export async function saveData (chatId, entity, data) {
	await ddbDocClient.send(new PutCommand({
		TableName: process.env.DATA_TABLE_NAME,
		Item: {
			chat_id: parseInt(chatId),
			entity,
			data
		}
	}))
}

/**
 * @param {number} chatId 
 * @param {string} entity 
 * @returns {Promise<object|null>}
 */
export async function getData (chatId, entity) {
	const result = await ddbDocClient.send(new GetCommand({
		TableName: process.env.DATA_TABLE_NAME,
		Key: {
			chat_id: parseInt(chatId),
			entity: entity
		}
	}))
	return result.Item?.data || null
}
