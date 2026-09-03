import type { Logger } from 'pino'
import { CoreCall } from '../helpers/GenerateCoreCalls'
import { CoreIngestClient } from './CoreIngestClient'

/**
 * Sends a batch of CoreCalls to Sofie Core, strictly in order, awaiting each one.
 * Fails fast: the first rejection stops the batch and rejects the whole dispatch,
 * so the caller can decide not to commit any local state for a partially-delivered batch.
 */
export class CoreCallDispatcher {
	constructor(private client: CoreIngestClient, private logger: Logger) {}

	async dispatchAll(calls: CoreCall[]): Promise<void> {
		for (const call of calls) {
			try {
				await this.client.send(call)
			} catch (err) {
				this.logger.error({ err, call }, `Failed to send ${call.type} to Core`)
				throw err
			}
		}
	}
}
