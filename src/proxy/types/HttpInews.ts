import type { Logger } from 'pino'
import { INewsDeviceSettings } from '../../inewsHandler'

export interface HttpInewsHealth {
	status: string
	inewsConnected: boolean
	uptime: number
	timestamp: string
	memory: {
		rss: number
		heapTotal: number
		heapUsed: number
		external: number
		arrayBuffers: number
	}
}
export interface InewsHttpProxyConfig {
	timeoutMs: number
}

export interface HttpInewsClientOptions {
	settings: INewsDeviceSettings
	logger?: Logger
	inewsHttpProxy: InewsHttpProxyConfig
}
