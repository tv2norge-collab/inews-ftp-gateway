import { RundownWatcher, ReducedRundown, UnrankedSegment } from '../RundownWatcher'
import { RundownManager } from '../RundownManager'
import { CoreCallDispatcher } from '../CoreCallDispatcher'
import { CoreHandler } from '../../coreHandler'
import { InewsHttpHandler } from '../../inewsHandler'
import { CoreCall, CoreCallRundownCreate, CoreCallType } from '../../helpers/GenerateCoreCalls'
import { makeINewsStory } from './__mocks__/mockSegments'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'
import type { Logger } from 'pino'

const GATEWAY_VERSION = 'version'
const QUEUE = 'QUEUE'

function createWatcher() {
	const logger = mockDeep<Logger>()
	const rundownManager = mock<RundownManager>()
	const coreCallDispatcher = mock<CoreCallDispatcher>()
	const coreHandler = mock<CoreHandler>()

	rundownManager.fetchINewsStoriesById.mockResolvedValue(new Map())
	coreCallDispatcher.dispatchAll.mockResolvedValue(undefined)
	coreHandler.GetSegmentsCacheById.mockResolvedValue(new Map())

	// delayStart=true so the poll timer never fires; the tests drive the watcher directly.
	const watcher = new RundownWatcher(
		logger,
		coreHandler,
		rundownManager,
		coreCallDispatcher,
		[QUEUE],
		GATEWAY_VERSION,
		mock<InewsHttpHandler>(),
		true
	)

	return { watcher, logger, rundownManager, coreCallDispatcher, coreHandler }
}

function makeRundown(segments: Array<{ externalId: string; locator: string }>): ReducedRundown {
	return {
		externalId: QUEUE,
		name: QUEUE,
		gatewayVersion: GATEWAY_VERSION,
		segments: segments.map((segment, rank) => ({
			externalId: segment.externalId,
			name: `Story ${segment.externalId}`,
			modified: new Date(0),
			locator: segment.locator,
			rank,
		})),
	}
}

function makeStories(segments: Array<{ externalId: string; locator: string }>): Map<string, UnrankedSegment> {
	return new Map(
		segments.map((segment) => [
			segment.externalId,
			{
				externalId: segment.externalId,
				name: `Story ${segment.externalId}`,
				modified: new Date(0),
				locator: segment.locator,
				rundownId: QUEUE,
				iNewsStory: makeINewsStory(segment.externalId),
			},
		])
	)
}

function isRundownCreate(call: CoreCall): call is CoreCallRundownCreate {
	return call.type === CoreCallType.dataRundownCreate
}

function dispatchedCalls(coreCallDispatcher: MockProxy<CoreCallDispatcher>, nthCall = 0): CoreCall[] {
	return coreCallDispatcher.dispatchAll.mock.calls[nthCall][0]
}

describe('RundownWatcher', () => {
	it('skips the cycle when the rundown listing fails', async () => {
		const { watcher, logger, rundownManager, coreCallDispatcher } = createWatcher()
		rundownManager.downloadRundown.mockRejectedValue(new Error('Server responded with status code 500'))

		await watcher.checkINewsRundownById(QUEUE)

		expect(coreCallDispatcher.dispatchAll).not.toHaveBeenCalled()
		expect(logger.error).toHaveBeenCalled()
	})

	it('sends the rundown without a segment that could not be downloaded', async () => {
		const { watcher, rundownManager, coreCallDispatcher } = createWatcher()
		rundownManager.downloadRundown.mockResolvedValue(
			makeRundown([
				{ externalId: 'seg1', locator: 'L1' },
				{ externalId: 'seg2', locator: 'L2' },
			])
		)
		// Only seg1 downloads.
		rundownManager.fetchINewsStoriesById.mockResolvedValue(makeStories([{ externalId: 'seg1', locator: 'L1' }]))

		await watcher.checkINewsRundownById(QUEUE)

		const created = dispatchedCalls(coreCallDispatcher).find(isRundownCreate)
		expect(created).toBeDefined()
		expect(created!.rundown.segments).toHaveLength(1)
		// seg2 stays out of the cache so the next cycle re-fetches it.
		expect(watcher.segments.has('seg1')).toBe(true)
		expect(watcher.segments.has('seg2')).toBe(false)
	})

	it('re-fetches an edited segment whose download failed, instead of trusting its new locator', async () => {
		const { watcher, rundownManager } = createWatcher()

		// Cycle 1: the segment downloads cleanly at locator OLD.
		rundownManager.downloadRundown.mockResolvedValue(makeRundown([{ externalId: 'seg1', locator: 'OLD' }]))
		rundownManager.fetchINewsStoriesById.mockResolvedValue(makeStories([{ externalId: 'seg1', locator: 'OLD' }]))
		await watcher.checkINewsRundownById(QUEUE)
		expect(watcher.segments.get('seg1')!.locator).toBe('OLD')

		// Cycle 2: the story was edited (locator NEW) but downloading it fails.
		rundownManager.downloadRundown.mockResolvedValue(makeRundown([{ externalId: 'seg1', locator: 'NEW' }]))
		rundownManager.fetchINewsStoriesById.mockResolvedValue(new Map())
		await watcher.checkINewsRundownById(QUEUE)

		expect(rundownManager.fetchINewsStoriesById).toHaveBeenLastCalledWith(QUEUE, ['seg1'])
		// Storing NEW would make the locator look current and stop the retry.
		expect(watcher.segments.get('seg1')!.locator).toBe('OLD')
	})

	it('commits nothing when the Core dispatch fails', async () => {
		const { watcher, rundownManager, coreCallDispatcher } = createWatcher()
		rundownManager.downloadRundown.mockResolvedValue(makeRundown([{ externalId: 'seg1', locator: 'L1' }]))
		rundownManager.fetchINewsStoriesById.mockResolvedValue(makeStories([{ externalId: 'seg1', locator: 'L1' }]))
		coreCallDispatcher.dispatchAll.mockRejectedValue(new Error('Timeout'))

		await watcher.checkINewsRundownById(QUEUE)

		expect(watcher.segments.has('seg1')).toBe(false)
		expect(watcher.rundowns.size).toBe(0)
	})

	it("keeps skipping Core's segment cache until a resync actually gets through", async () => {
		const { watcher, rundownManager, coreCallDispatcher, coreHandler } = createWatcher()
		rundownManager.downloadRundown.mockResolvedValue(makeRundown([{ externalId: 'seg1', locator: 'L1' }]))
		rundownManager.fetchINewsStoriesById.mockResolvedValue(makeStories([{ externalId: 'seg1', locator: 'L1' }]))

		// Establish the rundown, then ask for a reload of iNews data.
		await watcher.checkINewsRundownById(QUEUE)
		await watcher.ResyncRundown(`${QUEUE}_1`)
		coreHandler.GetSegmentsCacheById.mockClear()

		// The resync attempt fails on the way to Core.
		coreCallDispatcher.dispatchAll.mockRejectedValue(new Error('Timeout'))
		await watcher.checkINewsRundownById(QUEUE)
		expect(coreHandler.GetSegmentsCacheById).not.toHaveBeenCalled()

		// Retry: the resync is still pending, so Core's cache must still be ignored.
		coreCallDispatcher.dispatchAll.mockResolvedValue(undefined)
		await watcher.checkINewsRundownById(QUEUE)
		expect(coreHandler.GetSegmentsCacheById).not.toHaveBeenCalled()

		// Resync is done now, so later cycles go back to consulting Core.
		await watcher.checkINewsRundownById(QUEUE)
		expect(coreHandler.GetSegmentsCacheById).toHaveBeenCalledWith(`${QUEUE}_1`, [])
	})
})
