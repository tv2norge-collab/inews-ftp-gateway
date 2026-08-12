import { CoreCallDispatcher } from '../CoreCallDispatcher'
import { CoreCall, CoreCallType } from '../../helpers/GenerateCoreCalls'

const mockLogger = {
	error: jest.fn(),
} as any

function makeRundownDeleteCall(rundownExternalId: string): CoreCall {
	return {
		type: CoreCallType.dataRundownDelete,
		rundownExternalId,
	}
}

describe('CoreCallDispatcher', () => {
	beforeEach(() => {
		mockLogger.error.mockClear()
	})

	it('sends calls one at a time, in order', async () => {
		const order: string[] = []
		const client = {
			send: jest.fn(async (call: CoreCall) => {
				order.push(call.rundownExternalId)
			}),
		} as any

		const calls = [makeRundownDeleteCall('a'), makeRundownDeleteCall('b'), makeRundownDeleteCall('c')]
		const dispatcher = new CoreCallDispatcher(client, mockLogger)

		await dispatcher.dispatchAll(calls)

		expect(order).toEqual(['a', 'b', 'c'])
		expect(client.send).toHaveBeenCalledTimes(3)
	})

	it('stops on the first failure and rejects, without sending the remaining calls', async () => {
		const sent: string[] = []
		const client = {
			send: jest.fn(async (call: CoreCall) => {
				if (call.rundownExternalId === 'b') {
					throw new Error('Timeout when calling method')
				}
				sent.push(call.rundownExternalId)
			}),
		} as any

		const calls = [makeRundownDeleteCall('a'), makeRundownDeleteCall('b'), makeRundownDeleteCall('c')]
		const dispatcher = new CoreCallDispatcher(client, mockLogger)

		await expect(dispatcher.dispatchAll(calls)).rejects.toThrow('Timeout when calling method')

		expect(sent).toEqual(['a'])
		expect(client.send).toHaveBeenCalledTimes(2)
		expect(mockLogger.error).toHaveBeenCalledTimes(1)
	})
})
