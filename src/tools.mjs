/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function bunny ({ toolUseId, input }) {
	console.log('bunny', input)

	let deep
	switch (input.color) {
	case 'gold':
	case 'oro':
		deep = 5.2
		break
	case 'black':
	case 'nero':
		deep = 7
		break
	default:
		deep = 3.5
	}

	return {
		toolUseId,
		content: [{
			text: `the rabbit hole is ${deep} meters deep`
		}]
	}
}
