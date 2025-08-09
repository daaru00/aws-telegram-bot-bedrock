import { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand, ListSchedulesCommand, GetScheduleCommand } from '@aws-sdk/client-scheduler'
const scheduler = new SchedulerClient()

const STEP_FUNCTION_ARN = process.env.STEP_FUNCTION_ARN
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function create ({ toolUseId, input }) {
	const id = new Date().getTime()
	try {
		await scheduler.send(new CreateScheduleCommand({
			Name: `${input.chat_id}-${id}`,
			ScheduleExpression: input.expression,
			ActionAfterCompletion: input.recurring ? 'NONE' : 'DELETE',
			FlexibleTimeWindow: {
				Mode: 'OFF',
			},
			Target: {
				Arn: STEP_FUNCTION_ARN,
				RoleArn: SCHEDULER_ROLE_ARN,
				Input: JSON.stringify({
					'detail': {
						'message': {
							'from': {
								'first_name': null,
								'language_code': null
							},
							'chat': {
								'id': parseInt(input.chat_id),
							},
							'text': `[SCHEDULE ${id}]: ${input.text}`,
						}
					}
				})
			}
		}))
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to create schedule: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			text: `Message scheduled successfully with id ${id}.`,
		}]
	}
}

/**
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function list ({ toolUseId, input }) {
	try {
		const { Schedules: schedules } = await scheduler.send(new ListSchedulesCommand({
			NamePrefix: `${input.chat_id}-`,
			MaxResults: 100
		}))
		if (schedules.length === 0) {
			return {
				toolUseId,
				content: [{
					text: 'No scheduled messages found.'
				}],
				status: 'success'
			}
		}

		const scheduleDetails = await Promise.all(schedules.map(schedule => scheduler.send(new GetScheduleCommand({
			Name: schedule.Name
		}))))

		return {
			toolUseId,
			content: [{
				json: scheduleDetails.map(scheduleData => ({
					id: scheduleData.Name.split('-')[1],
					expression: scheduleData.ScheduleExpression,
					text: JSON.parse(scheduleData.Target.Input).detail.message.text,
					recurring: scheduleData.ActionAfterCompletion === 'NONE',
					createdAt: scheduleData.CreatedAt,
				}))
			}],
			status: 'success'
		}
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `Failed to list scheduled messages: ${err.message}`
			}],
			status: 'error'
		}
	}
}

/** 
 * @param {import('@aws-sdk/client-bedrock-runtime').ToolUseBlock} toolUse
 * @returns {import('@aws-sdk/client-bedrock-runtime').ToolResultBlock}
 */
export async function remove ({ toolUseId, input }) {
	try {
		await scheduler.send(new DeleteScheduleCommand({
			Name: `${input.chat_id}-${input.id}`,
		}))
	} catch (err) {
		return {
			toolUseId,
			content: [{
				text: `failed to remove schedule: ${err.message}`
			}],
			status: 'error'
		}
	}

	return {
		toolUseId,
		content: [{
			text: 'Scheduled message removed successfully.',
		}]
	}
}
