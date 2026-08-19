import axios, { AxiosInstance, AxiosRequestHeaders, AxiosResponse, isAxiosError } from 'axios'
import { HttpInewsClient } from '../HttpInewsClient'
import { mock, mockDeep, MockProxy } from 'jest-mock-extended'
import { INewsFTPStory } from '@tv2media/inews'
import { literal } from '../../helpers'
import { makeINewsStory } from '../../classes/__tests__/__mocks__/mockSegments'
import type { Logger } from 'pino'

jest.mock('axios')

const mockedAxios = axios as jest.Mocked<typeof axios>
const mockedIsAxiosError = isAxiosError as jest.MockedFunction<typeof isAxiosError>

const TIMEOUT_MS = 1234
const settings = { hosts: ['http://localhost:3000'] }

const mockFTPStory = literal<INewsFTPStory>({
	filetype: 'story',
	file: '10098408:01769D55:684C0F3A',
	identifier: '10098408',
	locator: '01769D55:684C0F3A',
	storyName: 'Pre sending',
	modified: new Date('2025-07-01T07:17:00.000Z'),
	flags: { floated: true },
})

const mockStory = makeINewsStory('10098408', { locator: '01769D55:684C0F3A' })

function axiosResponse<T>(data: T): AxiosResponse<T> {
	return {
		data,
		status: 200,
		statusText: 'OK',
		headers: {},
		config: { headers: {} as AxiosRequestHeaders },
	}
}

/** Shaped like a real AxiosError so the client's own `isAxiosError` narrowing applies. */
function axiosError(properties: { code?: string; status?: number; data?: unknown }) {
	return {
		isAxiosError: true,
		code: properties.code,
		config: { timeout: TIMEOUT_MS },
		response: properties.status === undefined ? undefined : { status: properties.status, data: properties.data },
	}
}

describe('HttpInewsClient', () => {
	let client: HttpInewsClient
	let http: MockProxy<AxiosInstance>
	let logger: MockProxy<Logger>

	beforeEach(() => {
		jest.clearAllMocks()

		// The real implementation, so tests exercise the client's actual branching.
		mockedIsAxiosError.mockImplementation((error: unknown): error is never => {
			return !!(error as { isAxiosError?: boolean } | undefined)?.isAxiosError
		})

		http = mock<AxiosInstance>()
		mockedAxios.create.mockReturnValue(http)

		// The client logs through logger.child(...). pino declares child() as a
		// differently instantiated Logger that no mock can satisfy structurally, so
		// point it back at the same mock and assert on that one object.
		logger = mockDeep<Logger>()
		logger.child.mockReturnValue((logger as unknown) as ReturnType<Logger['child']>)

		client = new HttpInewsClient({ settings, logger, inewsHttpProxy: { timeoutMs: TIMEOUT_MS } })
	})

	describe('listStories', () => {
		it('returns stories on success', async () => {
			http.get.mockResolvedValue(axiosResponse([mockFTPStory]))

			await expect(client.listStories('QUEUE')).resolves.toEqual([mockFTPStory])
			expect(logger.debug).toHaveBeenCalled()
		})

		it('throws and logs on a non-Axios error', async () => {
			http.get.mockRejectedValue(new Error('fail'))

			await expect(client.listStories('QUEUE')).rejects.toThrow("Failed to list stories for queue 'QUEUE'")
			expect(logger.error).toHaveBeenCalled()
		})

		it('reports the configured timeout when the request times out', async () => {
			http.get.mockRejectedValue(axiosError({ code: 'ECONNABORTED' }))

			await expect(client.listStories('QUEUE')).rejects.toThrow(
				`Failed to list stories for queue 'QUEUE': Request timed out after ${TIMEOUT_MS}ms.`
			)
			expect(logger.error).toHaveBeenCalled()
		})

		it('reports the status code when the server responds with an error', async () => {
			http.get.mockRejectedValue(axiosError({ status: 503 }))

			await expect(client.listStories('QUEUE')).rejects.toThrow(
				"Failed to list stories for queue 'QUEUE': Server responded with status code 503."
			)
		})

		it('returns an empty array when the proxy reports the queue does not exist', async () => {
			http.get.mockRejectedValue(axiosError({ status: 404, data: { code: 'QUEUE_NOT_FOUND' } }))

			await expect(client.listStories('QUEUE')).resolves.toEqual([])
			expect(logger.warn).toHaveBeenCalled()
			expect(logger.error).not.toHaveBeenCalled()
		})

		it('throws on a 404 that did not come from the proxy, rather than emptying the rundown', async () => {
			// e.g. a wrong base URL or an ingress/router 404: we never reached iNews, so we
			// know nothing about the queue and must not report it as empty.
			http.get.mockRejectedValue(axiosError({ status: 404, data: { message: 'Route GET:/nope not found' } }))

			await expect(client.listStories('QUEUE')).rejects.toThrow(
				"Failed to list stories for queue 'QUEUE': Server responded with status code 404."
			)
		})
	})

	describe('getStory', () => {
		it('returns story on success', async () => {
			http.get.mockResolvedValue(axiosResponse(mockStory))

			await expect(client.getStory('QUEUE', '10098408')).resolves.toEqual(mockStory)
		})

		it('throws and logs on error', async () => {
			http.get.mockRejectedValue(new Error('fail'))

			await expect(client.getStory('QUEUE', '10098408')).rejects.toThrow('Failed to get story')
		})

		it('throws on a 404, unlike listStories', async () => {
			http.get.mockRejectedValue(axiosError({ status: 404 }))

			await expect(client.getStory('QUEUE', 'missing')).rejects.toThrow(
				"Failed to get story 'missing' in queue 'QUEUE': Server responded with status code 404."
			)
		})
	})

	describe('request concurrency', () => {
		it('never has more than 5 requests in flight at once', async () => {
			let inFlight = 0
			let maxInFlight = 0
			const release: Array<() => void> = []

			http.get.mockImplementation(() => {
				inFlight++
				maxInFlight = Math.max(maxInFlight, inFlight)
				return new Promise((resolve) => {
					release.push(() => {
						inFlight--
						resolve(axiosResponse(mockStory))
					})
				})
			})

			const calls = Array.from({ length: 12 }, (_, i) => client.getStory('QUEUE', `story${i}`))

			await new Promise((resolve) => setImmediate(resolve))
			expect(maxInFlight).toBe(5)

			while (release.length) {
				release.shift()!()
				await new Promise((resolve) => setImmediate(resolve))
			}

			await Promise.all(calls)
			expect(maxInFlight).toBe(5)
			expect(http.get).toHaveBeenCalledTimes(12)
		})
	})

	describe('getHealth', () => {
		it('returns health on success', async () => {
			const health = {
				status: 'ok',
				inewsConnected: true,
				uptime: 1,
				timestamp: '',
				memory: { rss: 0, heapTotal: 0, heapUsed: 0, external: 0, arrayBuffers: 0 },
			}
			http.get.mockResolvedValue(axiosResponse(health))

			await expect(client.getHealth()).resolves.toEqual(health)
		})

		it('throws and logs on error', async () => {
			http.get.mockRejectedValue(new Error('fail'))

			await expect(client.getHealth()).rejects.toThrow('Failed to get health')
		})
	})
})
