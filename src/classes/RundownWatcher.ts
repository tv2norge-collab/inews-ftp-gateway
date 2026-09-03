import { EventEmitter } from 'events'
import * as dotenv from 'dotenv'
import { INewsRundown } from './datastructures/Rundown'
import { RundownManager } from './RundownManager'
import { RundownSegment, ISegment } from './datastructures/Segment'
import { InewsHttpHandler } from '../inewsHandler'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { CoreHandler } from '../coreHandler'
import { SegmentRankings, SegmentRankingsInner } from './ParsedINewsToSegments'
import { IngestPlaylist } from '@sofie-automation/blueprints-integration'
import { ResolvedPlaylist, ResolveRundownIntoPlaylist } from '../helpers/ResolveRundownIntoPlaylist'
import { DiffPlaylist } from '../helpers/DiffPlaylist'
import { PlaylistId, RundownId, SegmentId } from '../helpers/id'
import { Mutex } from 'async-mutex'
import { AssignRanksToSegments } from '../helpers/AssignRanksToSegments'
import { GenerateCoreCalls } from '../helpers/GenerateCoreCalls'
import type { Logger } from 'pino'
import { CoreCallDispatcher } from './CoreCallDispatcher'

dotenv.config()

export enum RundownChangeType {
	RUNDOWN_CREATE,
	RUNDOWN_UPDATE,
	RUNDOWN_DELETE,
	SEGMENT_UPDATE,
	SEGMENT_DELETE,
	SEGMENT_CREATE,
	SEGMENT_RANK_UPDATE,
}

export interface RundownChangeBase {
	type: RundownChangeType
	rundownExternalId: string
}

export interface RundownChangeRundownCreate extends RundownChangeBase {
	type: RundownChangeType.RUNDOWN_CREATE
}

export interface RundownChangeRundownDelete extends RundownChangeBase {
	type: RundownChangeType.RUNDOWN_DELETE
}

export interface RundownChangeRundownUpdate extends RundownChangeBase {
	type: RundownChangeType.RUNDOWN_UPDATE
}

export interface RundownChangeSegmentBase extends RundownChangeBase {
	segmentExternalId: string
}

export interface RundownChangeSegmentUpdate extends RundownChangeSegmentBase {
	type: RundownChangeType.SEGMENT_UPDATE
}

export interface RundownChangeSegmentDelete extends RundownChangeSegmentBase {
	type: RundownChangeType.SEGMENT_DELETE
}

export interface RundownChangeSegmentCreate extends RundownChangeSegmentBase {
	type: RundownChangeType.SEGMENT_CREATE
	/** For cases e.g. reload iNews data where cache should be ignored */
	skipCache?: true
}

export interface RundownChangeSegmentRankUpdate extends RundownChangeSegmentBase {
	type: RundownChangeType.SEGMENT_RANK_UPDATE
	rank: number
}

export type RundownChange = RundownChangeRundown | RundownChangeSegment

export type RundownChangeRundown = RundownChangeRundownCreate | RundownChangeRundownDelete | RundownChangeRundownUpdate

export type RundownChangeSegment =
	| RundownChangeSegmentCreate
	| RundownChangeSegmentDelete
	| RundownChangeSegmentUpdate
	| RundownChangeSegmentRankUpdate

export interface RundownChangeMap {
	rundown: {
		change?: RundownChangeRundownDelete | RundownChangeRundownCreate | RundownChangeRundownUpdate
	}
	segments: RundownChangeSegment[]
}

export function IsRundownChangeRundownCreate(change: RundownChange): change is RundownChangeRundownCreate {
	return change.type === RundownChangeType.RUNDOWN_CREATE
}

export function IsRundownChangeRundownDelete(change: RundownChange): change is RundownChangeRundownDelete {
	return change.type === RundownChangeType.RUNDOWN_DELETE
}

export function IsRundownChangeRundownUpdate(change: RundownChange): change is RundownChangeRundownUpdate {
	return change.type === RundownChangeType.RUNDOWN_UPDATE
}

export function IsRundownChangeSegmentCreate(change: RundownChange): change is RundownChangeSegmentCreate {
	return change.type === RundownChangeType.SEGMENT_CREATE
}

export function IsRundownChangeSegmentDelete(change: RundownChange): change is RundownChangeSegmentDelete {
	return change.type === RundownChangeType.SEGMENT_DELETE
}

export function IsRundownChangeSegmentUpdate(change: RundownChange): change is RundownChangeSegmentUpdate {
	return change.type === RundownChangeType.SEGMENT_UPDATE
}

export function IsRundownChangeSegmentRankUpdate(change: RundownChange): change is RundownChangeSegmentRankUpdate {
	return change.type === RundownChangeType.SEGMENT_RANK_UPDATE
}

export type ReducedPlaylist = Omit<IngestPlaylist, 'rundowns'> & { rundowns: ReducedRundown[] }
export type ReducedRundown = Pick<INewsRundown, 'externalId' | 'name' | 'gatewayVersion'> & {
	segments: ReducedSegment[]
}
export type ReducedSegment = Pick<ISegment, 'externalId' | 'modified' | 'rank' | 'name' | 'locator'>
export type UnrankedSegment = Omit<ISegment, 'rank' | 'float' | 'untimed'>

export type PlaylistMap = Map<PlaylistId, { externalId: string; rundowns: RundownId[] }>
export type RundownMap = Map<RundownId, ReducedRundown>

export type PlaylistCache = Map<PlaylistId, RundownId[]>
export type RundownCache = Map<RundownId, SegmentId[]>
export type SegmentCache = Map<SegmentId, ReducedSegment>

export function IsReducedSegment(segment: any): segment is ReducedSegment {
	return Object.keys(segment).includes('locator') && !Object.keys(segment).includes('iNewsStory')
}

export class RundownWatcher extends EventEmitter {
	on!: ((event: 'info', listener: (message: string) => void) => this) &
		((event: 'error', listener: (error: any, stack?: any) => void) => this) &
		((event: 'warning', listener: (message: string) => void) => this)

	emit!: ((event: 'info', message: string) => boolean) &
		((event: 'error', message: string) => boolean) &
		((event: 'warning', message: string) => boolean)

	public pollInterval: number = 2000
	private pollTimer: NodeJS.Timeout | undefined

	private _logger: Logger
	private previousRanks: SegmentRankings = new Map()
	private lastForcedRankRecalculation: Map<RundownId, number> = new Map()

	private cachedINewsData: Map<SegmentId, UnrankedSegment> = new Map()
	private cachedPlaylistAssignments: Map<PlaylistId, ResolvedPlaylist> = new Map()
	private cachedAssignedRundowns: Map<PlaylistId, Array<INewsRundown>> = new Map()
	private skipCacheForRundown: Set<RundownId> = new Set()
	/** Segments left out of the last cycle because iNews would not serve them. */
	private segmentsFailedToFetch: Map<PlaylistId, Set<SegmentId>> = new Map()

	public playlists: PlaylistCache = new Map()
	public rundowns: RundownCache = new Map()
	public segments: SegmentCache = new Map()

	private processingRundown: Mutex = new Mutex()

	/**
	 * A Rundown watcher which will poll iNews FTP server for changes and emit events
	 * whenever a change occurs.
	 *
	 * @param coreHandler Handler for Sofie Core
	 * @param gatewayVersion Set version of gateway
	 * @param delayStart (Optional) Set to a falsy value to prevent the watcher to start watching immediately.
	 */
	constructor(
		private logger: Logger,
		private coreHandler: CoreHandler,
		private rundownManager: RundownManager,
		private coreCallDispatcher: CoreCallDispatcher,
		private iNewsQueue: Array<string>,
		private gatewayVersion: string,
		private handler: InewsHttpHandler,
		delayStart?: boolean
	) {
		super()
		this._logger = this.logger.child({ tag: this.constructor.name })

		if (!delayStart) {
			this.startWatcher()
		}
	}

	/**
	 * Start the watcher
	 */
	startWatcher() {
		this.logger.info('Clear all watchers')
		this.stopWatcher()
		this.logger.info('Start watchers')

		// Subsequent runs
		this.startPollTimer()
	}

	private watch() {
		this.stopPollTimer()
		this.logger.debug('Checking rundowns for updates')

		this.checkINewsRundowns()
			.then(
				async () => {
					if (this.handler.isConnected) {
						await this.coreHandler.setStatus(StatusCode.GOOD, [])
					}
				},
				async (error) => {
					this.logger.error({ err: error }, 'Something went wrong during check')
					await this.coreHandler.setStatus(StatusCode.WARNING_MAJOR, ['INews rundowns check failed'])
				}
			)
			.catch((e) => this._logger.error({ err: e }, 'Unexpected error after rundown check'))
			.finally(() => this.startPollTimer())
	}

	/**
	 * Stop the watcher
	 */
	stopWatcher() {
		this.stopPollTimer()
	}

	private startPollTimer() {
		this.stopPollTimer()
		this.pollTimer = setTimeout(() => this.watch(), this.pollInterval)
	}

	private stopPollTimer() {
		if (this.pollTimer) {
			clearInterval(this.pollTimer)
			this.pollTimer = undefined
		}
	}

	dispose() {
		this.stopWatcher()
	}

	public async ResyncRundown(rundownExternalId: string) {
		const release = await this.processingRundown.acquire()
		const playlistExternalId = rundownExternalId.replace(/_\d+$/, '')
		const playlist = this.playlists.get(playlistExternalId)
		const rundown = this.rundowns.get(rundownExternalId)

		if (!playlist || !rundown) {
			this.logger.error(`Rundown ${rundownExternalId} does not exist in playlist ${playlistExternalId}`)
			release()
			return
		}

		// Delete cached data for this rundown
		for (const segmentId of rundown) {
			this.segments.delete(segmentId)
			this.cachedINewsData.delete(segmentId)
		}
		this.rundowns.delete(rundownExternalId)
		this.playlists.set(
			playlistExternalId,
			playlist.filter((r) => r !== rundownExternalId)
		)

		const cachedPlaylist = this.cachedPlaylistAssignments.get(playlistExternalId)
		if (cachedPlaylist) {
			this.cachedPlaylistAssignments.set(
				playlistExternalId,
				cachedPlaylist.filter((p) => p.rundownId !== rundownExternalId)
			)
		}
		const cachedAssignedRundown = this.cachedAssignedRundowns.get(playlistExternalId)
		if (cachedAssignedRundown) {
			this.cachedAssignedRundowns.set(
				playlistExternalId,
				cachedAssignedRundown.filter((p) => p.externalId !== rundownExternalId)
			)
		}
		this.lastForcedRankRecalculation.delete(rundownExternalId)
		this.skipCacheForRundown.add(rundownExternalId)
		release()
	}

	async checkINewsRundowns(): Promise<void> {
		const connected = await this.handler.checkHealthAndUpdateStatus()
		if (!connected) return

		for (let queue of this.iNewsQueue) {
			await this.checkINewsRundownById(queue)
		}
	}

	async checkINewsRundownById(rundownId: string): Promise<void> {
		let rundown: ReducedRundown
		try {
			rundown = await this.rundownManager.downloadRundown(rundownId)
		} catch (e) {
			this.logger.error({ err: e }, `Failed to download rundown ${rundownId}, skipping this poll cycle`)
			return
		}
		if (rundown.gatewayVersion === this.gatewayVersion) {
			const release = await this.processingRundown.acquire()
			try {
				await this.processUpdatedRundown(rundown.externalId, rundown)
			} catch (e) {
				this.logger.error({ err: e }, 'Error processing updated rundown')
			}
			release()
		}
	}

	private async processUpdatedRundown(playlistId: string, playlist: ReducedRundown) {
		const uncachedINewsData: Set<SegmentId> = new Set()
		playlist.segments.forEach((s) => {
			if (!this.cachedINewsData.has(s.externalId)) {
				uncachedINewsData.add(s.externalId)
			}
		})

		const cachedPlaylist = this.playlists.get(playlistId)

		if (cachedPlaylist) {
			const cachedRundowns: Array<{ externalId: RundownId; segmentIds: SegmentId[] }> = []
			for (const rundownId of cachedPlaylist) {
				let cachedRundown = this.rundowns.get(rundownId)
				if (!cachedRundown) continue
				cachedRundowns.push({ externalId: rundownId, segmentIds: cachedRundown })
			}

			// Fetch any segments that may have changed
			for (const segment of playlist.segments) {
				const cachedSegment = this.segments.get(segment.externalId)

				if (!cachedSegment) {
					uncachedINewsData.add(segment.externalId)
					continue
				}

				if (cachedSegment.locator !== segment.locator) {
					uncachedINewsData.add(segment.externalId)
				}
			}
		}

		const iNewsDataPs: Promise<Map<SegmentId, UnrankedSegment>> = this.rundownManager.fetchINewsStoriesById(
			playlistId,
			Array.from(uncachedINewsData)
		)

		const iNewsData = await iNewsDataPs

		// Build a pending cache combining existing data with newly fetched data.
		// We only commit this to this.cachedINewsData after all processing succeeds,
		// so a failure mid-way leaves the cache in a clean last-known-good state
		// and the next poll cycle will naturally re-fetch and retry.
		const pendingINewsData: Map<SegmentId, UnrankedSegment> = new Map(this.cachedINewsData)
		for (let [externalId, data] of iNewsData.entries()) {
			pendingINewsData.set(externalId, data)
		}

		// Segments we wanted but couldn't download. Their listing entry must not be
		// committed below, otherwise the locator would look up-to-date next cycle and
		// we'd never re-fetch the content we're still missing.
		const failedToFetch: Set<SegmentId> = new Set()
		for (const segmentId of uncachedINewsData) {
			if (!iNewsData.has(segmentId)) {
				failedToFetch.add(segmentId)
			}
		}

		const recovered = Array.from(this.segmentsFailedToFetch.get(playlistId) ?? []).filter((segmentId) =>
			iNewsData.has(segmentId)
		)

		const segmentsToResolve: Array<UnrankedSegment> = []

		playlist.segments.forEach((s) => {
			const cachedData = pendingINewsData.get(s.externalId)

			if (!cachedData) {
				// Shouldn't be possible.
				this.logger.error(
					`Could not find iNews data for segment ${s.externalId} in rundown ${playlistId}. Segment will appear out of order.`
				)
			} else {
				segmentsToResolve.push(cachedData)
			}
		})

		const { resolvedPlaylist: playlistAssignments, untimedSegments } = ResolveRundownIntoPlaylist(
			playlistId,
			segmentsToResolve
		)
		if (!playlistAssignments.length) {
			playlistAssignments.push({
				rundownId: `${playlistId}_1`,
				segments: [],
			})
		}

		// Fetch ingestDataCache for segments that have been modified
		const ingestDataPromises: Array<Promise<Map<SegmentId, RundownSegment>>> = []

		// Cleared on commit, not here - an abandoned cycle must leave the flag in place
		// so the retry still skips the cache.
		const skipCacheConsumed: RundownId[] = []

		for (const rundown of playlistAssignments) {
			if (this.skipCacheForRundown.has(rundown.rundownId)) {
				skipCacheConsumed.push(rundown.rundownId)
				continue
			}

			const segmentsToFetch: SegmentId[] = []
			for (const segmentId of rundown.segments) {
				if (uncachedINewsData.has(segmentId)) {
					segmentsToFetch.push(segmentId)
				}
			}

			ingestDataPromises.push(this.coreHandler.GetSegmentsCacheById(rundown.rundownId, segmentsToFetch))
		}

		const ingestCacheList = await Promise.all(ingestDataPromises)

		const ingestCacheData: Map<SegmentId, RundownSegment> = new Map()

		for (let cache of ingestCacheList) {
			for (let [segmentId, data] of cache) {
				ingestCacheData.set(segmentId, data)
			}
		}

		const assignedRundowns: INewsRundown[] = []

		for (const playlistRundown of playlistAssignments) {
			const rundownSegments: RundownSegment[] = []

			for (const segmentId of playlistRundown.segments) {
				const iNewsData = pendingINewsData.get(segmentId)

				if (!iNewsData) {
					this.logger.error(
						`Failed to assign segment ${segmentId} to rundown ${playlistRundown.rundownId}. Could not find cached iNews data`
					)
					continue
				}

				const rundownSegment = new RundownSegment(
					playlistRundown.rundownId,
					iNewsData.iNewsStory,
					iNewsData.modified,
					iNewsData.locator,
					segmentId,
					0,
					iNewsData?.name,
					untimedSegments.has(segmentId)
				)
				rundownSegments.push(rundownSegment)
			}

			const iNewsRundown: INewsRundown = new INewsRundown(
				playlistRundown.rundownId,
				playlistRundown.rundownId,
				this.gatewayVersion,
				rundownSegments,
				playlistRundown.payload
			)

			assignedRundowns.push(iNewsRundown)
		}

		const { changes, segmentChanges } = DiffPlaylist(
			assignedRundowns,
			this.cachedAssignedRundowns.get(playlistId) ?? []
		)

		if (failedToFetch.size) {
			this.logger.error(
				`Sending ${playlistId} without ${failedToFetch.size} segment(s) that could not be downloaded after a retry. They will be restored once iNews serves them again.`
			)
		}

		let segmentRanks = AssignRanksToSegments(
			playlistAssignments,
			changes,
			segmentChanges,
			this.previousRanks,
			this.lastForcedRankRecalculation
		)
		const assignedRanks: Map<SegmentId, number> = new Map()
		const pendingForcedRankRecalculation: Map<RundownId, number> = new Map()
		const pendingPreviousRanks: Array<{ rundownId: RundownId; assignedRanks: Map<SegmentId, number> }> = []
		for (const rundown of segmentRanks) {
			if (rundown.recalculatedAsIntegers) {
				pendingForcedRankRecalculation.set(rundown.rundownId, Date.now())
			}
			for (const [segmentId, rank] of rundown.assignedRanks) {
				assignedRanks.set(segmentId, rank)
			}
			pendingPreviousRanks.push({ rundownId: rundown.rundownId, assignedRanks: rundown.assignedRanks })
		}

		const coreCalls = GenerateCoreCalls(
			playlistId,
			changes,
			playlistAssignments,
			assignedRanks,
			pendingINewsData,
			ingestCacheData,
			untimedSegments
		)

		try {
			await this.coreCallDispatcher.dispatchAll(coreCalls)
		} catch {
			// Already logged inside dispatchAll. Bail out without committing local
			// cache, so the next poll cycle re-diffs from last-known-good state and
			// retries the whole batch instead of silently drifting out of sync with Core.
			return
		}

		// All Core calls landed — commit local state atomically.
		// Nothing above this line mutates instance state, so any throw or rejection above
		// leaves the cache at last-known-good and the next poll retries cleanly.
		this.cachedINewsData = pendingINewsData
		this.cachedPlaylistAssignments.set(playlistId, playlistAssignments)
		this.cachedAssignedRundowns.set(playlistId, assignedRundowns)
		this.segmentsFailedToFetch.set(playlistId, failedToFetch)
		if (recovered.length) {
			this.logger.info(
				`Restored ${recovered.length} previously undownloadable segment(s) in ${playlistId}: ${recovered.join(', ')}`
			)
		}
		for (const rundownId of skipCacheConsumed) {
			this.skipCacheForRundown.delete(rundownId)
		}
		for (const { rundownId, assignedRanks: ranks } of pendingPreviousRanks) {
			this.updatePreviousRanks(rundownId, ranks)
		}
		for (const [rundownId, timestamp] of pendingForcedRankRecalculation) {
			this.lastForcedRankRecalculation.set(rundownId, timestamp)
		}
		for (const segment of playlist.segments) {
			if (failedToFetch.has(segment.externalId)) continue
			this.segments.set(segment.externalId, segment)
		}
		for (const rundown of playlistAssignments) {
			this.rundowns.set(rundown.rundownId, rundown.segments)
		}
		this.playlists.set(
			playlistId,
			playlistAssignments.map((r) => r.rundownId)
		)
	}

	private updatePreviousRanks(rundownId: RundownId, segments: Map<SegmentId, number>) {
		const ranksMap: Map<SegmentId, SegmentRankingsInner> = new Map()
		for (let [segmentId, rank] of segments) {
			ranksMap.set(segmentId, {
				rank,
			})
		}
		this.previousRanks.set(rundownId, ranksMap)
	}
}
