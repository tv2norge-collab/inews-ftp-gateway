import { EventEmitter } from 'events'
import * as dotenv from 'dotenv'
import { InewsRundown } from './Rundown'
import { RundownManager } from './RundownManager'
import * as _ from 'underscore'
import { RundownSegment } from './Segment'
import { IRundownPart } from './Part'
import * as clone from 'clone'
import { CoreHandler } from '../coreHandler'
import * as inews from '@johnsand/inews'
import * as DEFAULTS from '../DEFAULTS'

dotenv.config()

export class RunningOrderWatcher extends EventEmitter {

	on: ((event: 'info', listener: (message: string) => void) => this) &
		((event: 'error', listener: (error: any, stack?: any) => void) => this) &
		((event: 'warning', listener: (message: string) => void) => this) &

		((event: 'rundown_delete', listener: (runningOrderId: string) => void) => this) &
		((event: 'rundown_create', listener: (runningOrderId: string, runningOrder: InewsRundown) => void) => this) &
		((event: 'rundown_update', listener: (runningOrderId: string, runningOrder: InewsRundown) => void) => this) &

		((event: 'segment_delete', listener: (runningOrderId: string, sectionId: string) => void) => this) &
		((event: 'segment_create', listener: (runningOrderId: string, sectionId: string, newSection: RundownSegment) => void) => this) &
		((event: 'segment_update', listener: (runningOrderId: string, sectionId: string, newSection: RundownSegment) => void) => this) &

		((event: 'part_delete', listener: (runningOrderId: string, sectionId: string, storyId: string) => void) => this) &
		((event: 'part_create', listener: (runningOrderId: string, sectionId: string, storyId: string, newStory: IRundownPart) => void) => this) &
		((event: 'part_update', listener: (runningOrderId: string, sectionId: string, storyId: string, newStory: IRundownPart) => void) => this)

	// Fast = list diffs, Slow = fetch All
	public pollIntervalFast: number = 2 * 1000
	public pollIntervalSlow: number = 10 * 1000
	public pollIntervalMedia: number = 5 * 1000

	private runningOrders: { [runningOrderId: string]: InewsRundown } = {}

	private fastInterval: NodeJS.Timer | undefined
	private slowinterval: NodeJS.Timer | undefined
	private mediaPollInterval: NodeJS.Timer | undefined

	private currentlyChecking: boolean = false
	private rundownManager: RundownManager
	private iNewsConnection: any
	/**
	 * A Running Order watcher which will poll iNews FTP server for changes and emit events
	 * whenever a change occurs.
	 *
	 * @param userName iNews username
	 * @param passWord iNews password
	 * @param coreHandler Handler for Sofie Core
	 * @param gatewayVersion Set version of gateway
	 * @param delayStart (Optional) Set to a falsy value to prevent the watcher to start watching immediately.
	 */
	constructor (
		// IP, Username and Password is taken from the DEFAULTS.ts file until CORE integration is made
		private userName: string,
		private passWord: string,
		private coreHandler: CoreHandler,
		private gatewayVersion: string,
		delayStart?: boolean
	) {
		super()
		this.iNewsConnection = inews({
			'hosts': DEFAULTS.SERVERS,
			'user': this.userName,
			'password': this.passWord
		})

		this.rundownManager = new RundownManager(this.iNewsConnection)
		if (!delayStart) {
			this.startWatcher()
		}
	}

	async checkRunningOrderById (runningOrderId: string): Promise<InewsRundown> {
		const runningOrder = await this.rundownManager.downloadRunningOrder(runningOrderId, this.coreHandler.GetOutputLayers())

		if (runningOrder.gatewayVersion === this.gatewayVersion) {
			this.processUpdatedRunningOrder(runningOrder.externalId, runningOrder)
		}

		return runningOrder
	}

	async checkInewsRundowns (): Promise<InewsRundown[]> {
		return Promise.all(DEFAULTS.INEWS_QUEUE.map(roId => {
			return this.checkRunningOrderById(roId)
		}))
	}

	/**
 	* Will add all currently available Running Orders from the first drive folder
 	* matching the provided name
 	*
 	* @param iNewsQueues Name of folder to add Running Orders from. Eg. "My Running Orders"
	 */
	async setInewsQueues (iNewsQueues: string): Promise<InewsRundown[]> {
		console.log('DUMMY LOG : ', iNewsQueues)
		return this.checkInewsRundowns()
	}

	/**
	 * Start the watcher
	 */
	startWatcher () {
		console.log('Starting Watcher')
		this.stopWatcher()

		this.mediaPollInterval = setInterval(() => {
			if (this.currentlyChecking) {
				return
			}
			console.log('Running check')
			this.currentlyChecking = true

			this.checkInewsRundowns()
			.catch(error => {
				console.error('Something went wrong during check', error, error.stack)
			})
			.then(() => {
				// console.log('slow check done')
				this.currentlyChecking = false
			}).catch(console.error)

		}, this.pollIntervalMedia)
	}

	/**
	 * Stop the watcher
	 */
	stopWatcher () {
		if (this.fastInterval) {
			clearInterval(this.fastInterval)
			this.fastInterval = undefined
		}
		if (this.slowinterval) {
			clearInterval(this.slowinterval)
			this.slowinterval = undefined
		}
		if (this.mediaPollInterval) {
			clearInterval(this.mediaPollInterval)
			this.mediaPollInterval = undefined
		}
	}
	dispose () {
		this.stopWatcher()
	}

	private processUpdatedRunningOrder (rundownId: string, rundown: InewsRundown | null) {

		/*
		const oldRundown = this.runningOrders[rundownId]

		// Check if runningOrders have changed:
		if (!rundown && oldRundown) {
			this.emit('rundown_delete', rundownId)

		} else if (rundown && !oldRundown) {
			this.emit('rundown_create', rundownId, rundown)
		} else if (rundown && oldRundown) {

			if (!_.isEqual(rundown.serialize(), oldRundown.serialize())) {

				console.log(rundown.serialize()) // debug

				this.emit('rundown_update', rundownId, rundown)
			} else {
				const newRundown: InewsRundown = rundown

				// Go through the sections for changes:
				_.uniq(
					oldRundown.segments.map(segment => segment.externalId).concat(
					newRundown.segments.map(segment => segment.externalId))
				).forEach((segmentId: string) => {
					const oldSection: RundownSegment = oldRundown.segments.find(segment => segment.externalId === segmentId) as RundownSegment // TODO: handle better
					const newSection: RundownSegment = rundown.segments.find(segment => segment.externalId === segmentId) as RundownSegment

					if (!newSection && oldSection) {
						this.emit('segment_delete', rundownId, segmentId)
					} else if (newSection && !oldSection) {
						this.emit('segment_create', rundownId, segmentId, newSection)
					} else if (newSection && oldSection) {

						if (!_.isEqual(newSection.serialize(), oldSection.serialize())) {
							console.log(newSection.serialize(), oldSection.serialize()) // debug
							this.emit('segment_update', rundownId, segmentId, newSection)
						} else {

							// Go through the stories for changes:
							_.uniq(
								oldSection.parts.map(part => part.externalId).concat(
								newSection.parts.map(part => part.externalId))
							).forEach((storyId: string) => {

								const oldStory: IRundownPart = oldSection.parts.find(part => part.externalId === storyId) as IRundownPart // TODO handle the possibility of a missing id better
								const newStory: IRundownPart = newSection.parts.find(part => part.externalId === storyId) as IRundownPart

								if (!newStory && oldStory) {
									this.emit('part_delete', rundownId, segmentId, storyId)
								} else if (newStory && !oldStory) {
									this.emit('part_create', rundownId, segmentId, storyId, newStory)
								} else if (newStory && oldStory) {

									if (!_.isEqual(newStory.serialize(), oldStory.serialize())) {
										console.log(newStory.serialize(), oldStory.serialize()) // debug
										this.emit('part_update', rundownId, segmentId, storyId, newStory)
									} else {

										// At this point, we've determined that there are no changes.
										// Do nothing
									}
								}
							})
						}
					}
				})
			}
		}
*/
		// Update the stored data:
		if (rundown) {
			this.runningOrders[rundownId] = clone(rundown)
		} else {
			delete this.runningOrders[rundownId]
		}
	}

}
