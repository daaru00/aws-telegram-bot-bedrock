import { BedrockAgentClient, IngestKnowledgeBaseDocumentsCommand } from '@aws-sdk/client-bedrock-agent'
import { BedrockAgentRuntimeClient, RetrieveCommand } from '@aws-sdk/client-bedrock-agent-runtime'
const bedrock = new BedrockAgentClient()
const bedrockRuntime = new BedrockAgentRuntimeClient()

const KNOWLEDGE_BASE_ID = process.env.KNOWLEDGE_BASE_ID
const DATA_SOURCE_ID = process.env.DATA_SOURCE_ID

/**
 * @param {string} text 
 * @param {import('@aws-sdk/client-bedrock-agent').MetadataAttribute[]|undefined} metadata 
 * @returns {Promise<void>}
 */
export async function ingest(text, metadata) {
	text = text.trim()
	if (!text.endsWith('.')) {
		text += '.'
	}

	await bedrock.send(new IngestKnowledgeBaseDocumentsCommand({
		knowledgeBaseId: KNOWLEDGE_BASE_ID,
		dataSourceId: DATA_SOURCE_ID,
		documents: [{
			metadata: metadata ? {
				type: 'IN_LINE_ATTRIBUTE',
				inlineAttributes: metadata
			} : undefined,
			content: {
				dataSourceType: 'CUSTOM',
				custom: {
					sourceType: 'IN_LINE',
					customDocumentIdentifier: {
						id: new Date().getTime().toString()
					},
					inlineContent: {
						type: 'TEXT',
						textContent: {
							data: text,
						}
					}
				}
			}
		}]
	}))
}

/**
 * @param {string} query 
 * @param {import('@aws-sdk/client-bedrock-agent-runtime').RetrievalFilter|undefined} filter 
 * @returns {Promise<string>}
 */
export async function retrieve(query, filter) {
	const response = await bedrockRuntime.send(new RetrieveCommand({
		knowledgeBaseId: KNOWLEDGE_BASE_ID,
		dataSourceId: DATA_SOURCE_ID,
		retrievalQuery: {
			text: query,
		},
		retrievalConfiguration: {
			vectorSearchConfiguration: {
				filter
			}
		}
	}))
	return response.retrievalResults.map(result => result.content.text).join(' ')
}
