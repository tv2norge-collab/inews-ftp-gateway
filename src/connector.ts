import { InewsHttpHandler, INewsDeviceSettings } from './inewsHandler'
import { CoreHandler, CoreConfig } from './coreHandler'
import * as _ from 'underscore'
import { Process } from './process'
import {
	Observer,
	PeripheralDeviceId,
	PeripheralDeviceForDevice,
	PeripheralDevicePubSubCollectionsNames,
} from '@sofie-automation/server-core-integration'
import { ensureLogLevel, setLogLevel } from './logger'
import { ILogger as Logger } from '@tv2media/logger'
import { InewsHttpProxyConfig } from './proxy/types/HttpInews'

export interface Config {
	process: ProcessConfig
	device: DeviceConfig
	core: CoreConfig
	inewsHttpProxy: InewsHttpProxyConfig
}
export interface ProcessConfig {
	/** Will cause the Node application to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}
export interface DeviceConfig {
	deviceId: string
	deviceToken: string
}
export class Connector {
	private iNewsHTTPHandler: InewsHttpHandler
	private _observers: Array<Observer<PeripheralDeviceForDevice>> = []
	private coreHandler: CoreHandler
	private _config: Config
	private _logger: Logger
	private _process: Process
	private _settings?: INewsDeviceSettings
	private _debug: boolean

	constructor(logger: Logger, config: Config, debug: boolean) {
		this._logger = logger.tag(this.constructor.name)
		this._config = config
		this._debug = debug
		this._process = new Process(this._logger)
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		this.iNewsHTTPHandler = new InewsHttpHandler(this._logger, this.coreHandler, this._config)
		this.coreHandler.iNewsHandler = this.iNewsHTTPHandler
	}

	async init(): Promise<void> {
		try {
			this._logger.info('Initializing Process...')
			await this.initProcess()
			this._logger.info('Process initialized')
			this._logger.info('Initializing Core...')
			await this.initCore()
			this._logger.info('Core is initialized')
			this.setupObserver()
			this._logger.info('Initialization of FTP-monitor done')
		} catch (err) {
			this._logger.data(err).error(`Error during initialization:`)

			this._logger.info('Shutting down in 10 seconds!')
			this.dispose().catch((e) => this._logger.data(e).error('Error during dispose'))

			setTimeout(() => {
				process.exit(0)
			}, 10 * 1000)
		}
	}

	async initProcess(): Promise<void> {
		return this._process.init(this._config.process)
	}

	async initCore(): Promise<void> {
		await this.coreHandler.init(this._config.device, this._config.core, this._process)
	}

	async initInewsHTTPHandler(): Promise<void> {
		await this.iNewsHTTPHandler.init(this.coreHandler)
		this.coreHandler.iNewsHandler = this.iNewsHTTPHandler
	}

	async dispose(): Promise<void> {
		if (this.iNewsHTTPHandler) {
			await this.iNewsHTTPHandler.dispose()
		}
		if (this.coreHandler) {
			await this.coreHandler.dispose()
		}
	}

	setupObserver() {
		// Setup observer.
		let observer = this.coreHandler.core.observe(PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice)
		this._observers.push(observer)

		let addedChanged = (id: PeripheralDeviceId) => {
			// Check that collection exists.
			let devices = this.coreHandler.core.getCollection(
				PeripheralDevicePubSubCollectionsNames.peripheralDeviceForDevice
			)
			if (!devices) throw Error('"peripheralDeviceForDevice" collection not found!')

			// Find studio ID.
			let dev = devices.findOne(id)

			if (dev) {
				let settings = (dev.deviceSettings || {}) as INewsDeviceSettings
				settings.queues = settings.queues?.filter((q) => q !== '')
				if (!this._settings || !_.isEqual(_.omit(settings, 'debug'), _.omit(this._settings, 'debug'))) {
					this.iNewsHTTPHandler
						.dispose()
						.then(() => {
							this.iNewsHTTPHandler = new InewsHttpHandler(this._logger, this.coreHandler, this._config)
							return this.initInewsHTTPHandler()
						})
						.catch((error) => {
							this._logger.data(error).error('Failed to update iNewsFTP settings:')
							throw new Error('Failed to update iNewsFTP settings')
						})
				}

				if (settings.debug !== undefined && settings.debug !== this._debug) {
					this._debug = settings.debug
					const logLevel = this._debug ? 'debug' : ensureLogLevel(process.env.LOG_LEVEL) ?? 'warn'
					setLogLevel(logLevel)
				}

				this._settings = settings
			}
		}

		observer.added = (id: PeripheralDeviceId) => {
			addedChanged(id)
		}
		observer.changed = (id: PeripheralDeviceId) => {
			addedChanged(id)
		}

		addedChanged(this.coreHandler.core.deviceId)
	}
}
