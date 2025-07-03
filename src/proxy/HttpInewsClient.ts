import axios, { AxiosInstance, isAxiosError } from 'axios'
import { INewsStory, INewsFTPStory } from '@tv2media/inews'
import { logger as defaultLogger } from '../logger'
import { ILogger as Logger } from '@tv2media/logger'
import { HttpInewsClientOptions, HttpInewsHealth, InewsHttpProxyConfig } from './types/HttpInews'

/**
 * An HTTP client for interacting with the iNews Gateway API.
 * This class handles all communication with the iNews server,
 * including fetching stories, listing queues, and checking system health.
 */
export class HttpInewsClient {
	private readonly _baseUrl: string
	private readonly _logger: Logger
	private readonly _http: AxiosInstance

	/**
	 * Initializes a new instance of the HttpInewsClient.
	 * @param options - The configuration options for the client.
	 */
	constructor(options: HttpInewsClientOptions) {
		if (!options.settings.hosts?.length) {
			throw new Error('INewsDeviceSettings must include at least one host.')
		}

		this._baseUrl = options.settings.hosts[0]
		this._logger = options.logger?.tag(this.constructor.name) ?? defaultLogger.tag(this.constructor.name)
		this._http = this.createHttpInstance(options.inewsHttpProxy)
	}

	/**
	 * Creates and configures a new Axios instance for iNews requests.
	 * This method is private and internal to the client's operation.
	 * @param config - The proxy configuration containing the timeout.
	 * @returns A configured AxiosInstance.
	 */
	private createHttpInstance(config: InewsHttpProxyConfig): AxiosInstance {
		return axios.create({
			timeout: config.timeoutMs,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json',
			},
		})
	}

	/**
	 * Lists all stories in a specific queue.
	 * @param queueName - The name of the queue to retrieve stories from.
	 * @returns A promise that resolves to an array of INewsFTPStory objects.
	 */
	async listStories(queueName: string): Promise<INewsFTPStory[]> {
		const url = `${this._baseUrl}/queues/${encodeURIComponent(queueName)}`
		this._logger.debug(`GET ${url}`)

		try {
			const response = await this._http.get<INewsFTPStory[]>(url)
			return response.data
		} catch (error) {
			this.handleError(error, `Failed to list stories for queue '${queueName}'`)
		}
	}

	/**
	 * Retrieves a single story by its ID from a specific queue.
	 * @param queueName - The name of the queue where the story resides.
	 * @param storyId - The unique identifier of the story to retrieve.
	 * @returns A promise that resolves to the INewsStory object.
	 */
	async getStory(queueName: string, storyId: string): Promise<INewsStory> {
		const url = `${this._baseUrl}/queues/${encodeURIComponent(queueName)}/stories/${storyId}`
		this._logger.debug(`GET ${url}`)

		try {
			const response = await this._http.get<INewsStory>(url)
			return response.data
		} catch (error) {
			this.handleError(error, `Failed to get story '${storyId}' in queue '${queueName}'`)
		}
	}

	/**
	 * Fetches the health status of the iNews API.
	 * @returns A promise that resolves to the HttpInewsHealth status object.
	 */
	async getHealth(): Promise<HttpInewsHealth> {
		const url = `${this._baseUrl}/health`
		this._logger.debug(`GET ${url}`)

		try {
			const response = await this._http.get<HttpInewsHealth>(url)
			return response.data
		} catch (error) {
			this.handleError(error, `Failed to get health from ${url}`)
		}
	}

	/**
	 * A centralized error handler for Axios requests.
	 * @param error - The error object caught in the try-catch block.
	 * @param message - A descriptive message of what action failed.
	 * @throws An error with a detailed message.
	 */
	private handleError(error: unknown, message: string): never {
		let errorMessage = message

		if (isAxiosError(error)) {
			if (error.code === 'ECONNABORTED') {
				errorMessage = `${message}: Request timed out after ${error.config?.timeout}ms.`
			} else if (error.response) {
				errorMessage = `${message}: Server responded with status code ${error.response.status}.`
			} else if (error.request) {
				errorMessage = `${message}: No response received from the server.`
			}
		}

		this._logger.data(error).error(errorMessage)
		throw new Error(errorMessage)
	}
}
