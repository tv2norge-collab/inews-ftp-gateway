// 1. Mock the entire axios module. Jest will automatically handle this before any imports.
import axios from 'axios'
import { HttpInewsClient } from '../HttpInewsClient'
import { ILogger } from '@tv2media/logger'

jest.mock('axios')

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockGet = jest.fn()

const mockLogger: ILogger = {
	debug: jest.fn(),
	error: jest.fn(),
	data: jest.fn().mockReturnThis(),
	tag: jest.fn().mockReturnThis(),
	warn: jest.fn(),
	info: jest.fn(),
	trace: jest.fn(),
	meta: jest.fn().mockReturnThis(),
	setLevel: jest.fn(),
}

const settings = {
	hosts: ['http://localhost:3000'],
}

const mockFTPStory = {
	filetype: 'story',
	file: '10098408:01769D55:684C0F3A',
	identifier: '10098408',
	locator: '01769D55:684C0F3A',
	storyName: 'Pre sending',
	modified: new Date('2025-07-01T07:17:00.000Z'),
	flags: { floated: true },
}

const mockStory = {
	identifier: '10098408',
	locator: '01769D55:684C0F3A',
	fields: {
		title: { value: 'Pre sending', attributes: { uec: false } },
		modifyDate: { value: '1749807840', attributes: { uec: false } },
		audioTime: { value: '0', attributes: { uec: false } },
		totalTime: { value: '0', attributes: { uec: false } },
		runsTime: { value: '0', attributes: { uec: false } },
		pageNumber: undefined,
		tapeTime: undefined,
		cumeTime: undefined,
		backTime: undefined,
		layout: undefined,
		videoId: undefined,
	},
	meta: { rate: '205float=float' },
	cues: [],
	attachments: {},
	id: '10098408:01769d55:684c0f3a',
	body: '\r\n<p><pi>KAM H</pi></p>\r\n<p><pi></pi></p>\r\n',
}

const inewsHttpProxy = { timeoutMs: 1234 }

const clientOptions = {
	settings,
	logger: mockLogger,
	inewsHttpProxy,
}
describe('HttpInewsClient', () => {
	let client: HttpInewsClient

	beforeEach(() => {
		// Reset mocks and setup the mocked return value for axios.create
		jest.clearAllMocks()
		// 3. Ensure axios.create returns our mock instance with the mock 'get' function
		mockedAxios.create.mockReturnValue({ get: mockGet } as any)
		client = new HttpInewsClient(clientOptions)
	})

	describe('listStories', () => {
		it('returns stories on success', async () => {
			// Setup the successful response for this test
			mockGet.mockResolvedValue({ data: [mockFTPStory] })
			const result = await client.listStories('QUEUE')
			expect(result).toEqual([mockFTPStory])
			expect(mockLogger.debug).toHaveBeenCalled()
		})

		it('throws and logs on error', async () => {
			// Setup the rejected promise for this test
			mockGet.mockRejectedValue(new Error('fail'))
			await expect(client.listStories('QUEUE')).rejects.toThrow('Failed to list stories for queue')
			expect(mockLogger.error).toHaveBeenCalled()
		})

		it('handles timeout error', async () => {
			// Setup the specific Axios timeout error
			const timeoutError = {
				isAxiosError: true,
				code: 'ECONNABORTED',
				config: { timeout: inewsHttpProxy.timeoutMs },
			}
			mockGet.mockRejectedValue(timeoutError)
			await expect(client.listStories('QUEUE')).rejects.toThrow(`Failed to list stories for queue 'QUEUE'`)
			expect(mockLogger.error).toHaveBeenCalled()
		})
	})

	describe('getStory', () => {
		it('returns story on success', async () => {
			mockGet.mockResolvedValue({ data: mockStory })
			const result = await client.getStory('QUEUE', '10098408')
			expect(result).toEqual(mockStory)
		})

		it('throws and logs on error', async () => {
			mockGet.mockRejectedValue(new Error('fail'))
			await expect(client.getStory('QUEUE', '10098408')).rejects.toThrow('Failed to get story')
		})
	})

	describe('getHealth', () => {
		it('returns health on success', async () => {
			mockGet.mockResolvedValue({ data: { status: 'ok' } })
			const result = await client.getHealth()
			expect(result).toEqual({ status: 'ok' })
		})

		it('throws and logs on error', async () => {
			mockGet.mockRejectedValue(new Error('fail'))
			await expect(client.getHealth()).rejects.toThrow('Failed to get health')
		})
	})
})
