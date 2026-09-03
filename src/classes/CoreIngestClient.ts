import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { CoreHandler } from '../coreHandler'
import { CoreCall, CoreCallType } from '../helpers/GenerateCoreCalls'
import { assertUnreachable } from '../helpers'

/**
 * Sends a single CoreCall to Sofie Core and awaits the round trip.
 * Failures are not caught here - callers decide what a failed send means for them.
 */
export class CoreIngestClient {
	constructor(private coreHandler: CoreHandler) {}

	async send(call: CoreCall): Promise<void> {
		switch (call.type) {
			case CoreCallType.dataRundownCreate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataRundownCreate, [call.rundown])
				return
			case CoreCallType.dataRundownDelete:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataRundownDelete, [
					call.rundownExternalId,
				])
				return
			case CoreCallType.dataRundownUpdate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataRundownUpdate, [call.rundown])
				return
			case CoreCallType.dataRundownMetaDataUpdate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataRundownMetaDataUpdate, [call.rundown])
				return
			case CoreCallType.dataSegmentCreate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataSegmentCreate, [
					call.rundownExternalId,
					call.segment,
				])
				return
			case CoreCallType.dataSegmentUpdate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataSegmentUpdate, [
					call.rundownExternalId,
					call.segment,
				])
				return
			case CoreCallType.dataSegmentDelete:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataSegmentDelete, [
					call.rundownExternalId,
					call.segmentExternalId,
				])
				return
			case CoreCallType.dataSegmentRanksUpdate:
				await this.coreHandler.core.callMethodRaw(PeripheralDeviceAPIMethods.dataSegmentRanksUpdate, [
					call.rundownExternalId,
					call.ranks,
				])
				return
			default:
				assertUnreachable(call)
		}
	}
}
