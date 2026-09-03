import { CoreCallDispatcher } from '../CoreCallDispatcher'
import { CoreIngestClient } from '../CoreIngestClient'
import { CoreCall, CoreCallType } from '../../helpers/GenerateCoreCalls'
import { mock } from 'jest-mock-extended'
import type { Logger } from 'pino'

function makeRundownDeleteCall(rundownExternalId: string): CoreCall {
	return {
		type: CoreCallType.dataRundownDelete,
		rundownExternalId,
	}
}

function createDispatcher() {
	const client = mock<CoreIngestClient>()
	const logger = mock<Logger>()
	return { client, logger, dispatcher: new CoreCallDispatcher(client, logger) }
}

describe('CoreCallDispatcher', () => {
	it('sends calls one at a time, in order', async () => {
		const { client, dispatcher } = createDispatcher()
		const order: string[] = []
		client.send.mockImplementation(async (call: CoreCall) => {
			order.push(call.rundownExternalId)
		})

		await dispatcher.dispatchAll([makeRundownDeleteCall('a'), makeRundownDeleteCall('b'), makeRundownDeleteCall('c')])

		expect(order).toEqual(['a', 'b', 'c'])
		expect(client.send).toHaveBeenCalledTimes(3)
	})

	it('stops on the first failure and rejects, without sending the remaining calls', async () => {
		const { client, logger, dispatcher } = createDispatcher()
		const sent: string[] = []
		client.send.mockImplementation(async (call: CoreCall) => {
			if (call.rundownExternalId === 'b') {
				throw new Error('Timeout when calling method')
			}
			sent.push(call.rundownExternalId)
		})

		await expect(
			dispatcher.dispatchAll([makeRundownDeleteCall('a'), makeRundownDeleteCall('b'), makeRundownDeleteCall('c')])
		).rejects.toThrow('Timeout when calling method')

		expect(sent).toEqual(['a'])
		expect(client.send).toHaveBeenCalledTimes(2)
		expect(logger.error).toHaveBeenCalledTimes(1)
	})
})
