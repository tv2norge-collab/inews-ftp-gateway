import { RundownManager } from '../RundownManager'
import { INewsStoryGW } from '../datastructures/Segment'
import { makeINewsStory } from './__mocks__/mockSegments'
import { HttpInewsClient } from '../../proxy/HttpInewsClient'
import { mock, MockProxy } from 'jest-mock-extended'
import { literal } from '../../helpers'
import { INewsFTPStory } from '@tv2media/inews'
import type { Logger } from 'pino'

const LAYOUT: string = 'n'

let mockHttpClient: MockProxy<HttpInewsClient>
let testee: RundownManager

describe('RundownManager', () => {
	beforeEach(() => {
		mockHttpClient = mock<HttpInewsClient>()
		testee = new RundownManager(mock<Logger>(), mockHttpClient)
	})

	describe('downloadINewsRundown', () => {
		it('propagates a listing failure instead of returning an empty rundown', async () => {
			mockHttpClient.listStories.mockRejectedValue(new Error('Server responded with status code 500'))

			await expect(testee.downloadINewsRundown('QUEUE')).rejects.toThrow('Server responded with status code 500')
		})
	})

	describe('fetchINewsStoriesById', () => {
		const dirList: INewsFTPStory[] = [
			literal<INewsFTPStory>({
				filetype: 'story',
				file: 's1:0A:0B',
				identifier: 's1',
				locator: '0A:0B',
				storyName: 'Story 1',
				modified: new Date(0),
			}),
		]

		it('retries a failed story download once', async () => {
			mockHttpClient.listStories.mockResolvedValue(dirList)
			mockHttpClient.getStory
				.mockRejectedValueOnce(new Error('Server responded with status code 500'))
				.mockResolvedValueOnce(makeINewsStory('s1'))

			const stories = await testee.fetchINewsStoriesById('QUEUE', ['s1'])

			expect(stories.has('s1')).toBe(true)
			expect(mockHttpClient.getStory).toHaveBeenCalledTimes(2)
			// Re-listed so the retry uses the story's current locator.
			expect(mockHttpClient.listStories).toHaveBeenCalledTimes(2)
		})

		it('gives up after the retry also fails', async () => {
			mockHttpClient.listStories.mockResolvedValue(dirList)
			mockHttpClient.getStory.mockRejectedValue(new Error('Server responded with status code 500'))

			const stories = await testee.fetchINewsStoriesById('QUEUE', ['s1'])

			expect(stories.size).toBe(0)
			expect(mockHttpClient.getStory).toHaveBeenCalledTimes(2)
		})

		it('does not list the queue when there is nothing to fetch', async () => {
			const stories = await testee.fetchINewsStoriesById('QUEUE', [])

			expect(stories.size).toBe(0)
			expect(mockHttpClient.listStories).not.toHaveBeenCalled()
		})
	})

	describe('generateCuesFromLayoutField', () => {
		it('has no layout, dont generate anything', () => {
			const story: INewsStoryGW = createStory()

			const before = { ...story }
			testee.generateCuesFromLayoutField(story)
			expect(story).toEqual(before)
		})

		it('has a layout, designLayout cue is added', () => {
			const story = createStory(LAYOUT)

			expect(story.cues.some((cue) => cue!.some((line) => line.match(/DESIGN_LAYOUT=/i)))).toBeFalsy()
			testee.generateCuesFromLayoutField(story)
			expect(story.cues.some((cue) => cue!.some((line) => line.match(/DESIGN_LAYOUT=/i)))).toBeTruthy()
		})

		it('has the upper cased layout value in the design cue', () => {
			const story: INewsStoryGW = createStory(LAYOUT)

			testee.generateCuesFromLayoutField(story)

			expect(story.cues[0]![0]).toBe(`DESIGN_LAYOUT=${LAYOUT.toUpperCase()}`)
		})

		it('has a layout, link to cue is generated in body', () => {
			const story: INewsStoryGW = createStory(LAYOUT)

			testee.generateCuesFromLayoutField(story)
			expect(story.body).toMatch(/<a(.*?)<\/a>/i)
		})

		it('has one cue already, new cue link references index 1', () => {
			testCorrectCueReferenceInLink(1)
		})

		it('has two cues already, new cue link references index 2', () => {
			testCorrectCueReferenceInLink(2)
		})

		it('has fourteen cues already, new cue link references index 14', () => {
			testCorrectCueReferenceInLink(14)
		})

		it('inserts the cue link right after the first <pi> tag', () => {
			const body: string = `<p><pi></pi></p>\r\n<p></p>\r\n`
			const story = createStory('n', body)

			testee.generateCuesFromLayoutField(story)

			const lines = story.body!.split('\r\n')
			const index = lines.findIndex((line) => line.match('<pi>'))
			expect(lines[index + 1]).toMatch(/<a(.*?)<\/a>/i)
		})

		it('adds a DESIGN_BG to cues', () => {
			const story = createStory(LAYOUT)

			expect(story.cues.some((cue) => cue!.some((line) => line.match(/DESIGN_BG=/i)))).toBeFalsy()
			testee.generateCuesFromLayoutField(story)
			expect(story.cues.some((cue) => cue!.some((line) => line.match(/DESIGN_BG=/i)))).toBeTruthy()
		})

		it('assigns the upper cased layout value to the DESIGN_BG cue', () => {
			const story = createStory(LAYOUT)

			testee.generateCuesFromLayoutField(story)

			expect(
				story.cues.some((cue) => cue!.some((line) => line.match(`DESIGN_BG=${LAYOUT.toUpperCase()}`)))
			).toBeTruthy()
		})

		it('adds link to DESIGN_BG cue', () => {
			const story = createStory(LAYOUT)

			testee.generateCuesFromLayoutField(story)

			const cueIndex = story.cues!.findIndex((cue) => cue!.some((line) => line.match(/DESIGN_BG=/i)))
			expect(story.body!.match(`<a idref="${cueIndex}"><\\/a>`)).toBeTruthy()
		})
	})
})

function createStory(layout?: string, body?: string): INewsStoryGW {
	return makeINewsStory('', {
		body: body ?? '<p></p>',
		fields: { layout: { value: layout ?? '', attributes: {} } },
	})
}

function testCorrectCueReferenceInLink(numberOfExistingCues: number): void {
	const story: INewsStoryGW = createStory(LAYOUT)
	for (let i = 0; i < numberOfExistingCues; i++) {
		story.cues.push([`cue${i}`])
	}

	testee.generateCuesFromLayoutField(story)
	expect(story.body!.match(`<a idref="${numberOfExistingCues}"><\\/a>`)).toBeTruthy()
}
