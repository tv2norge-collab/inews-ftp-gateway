import { InewsFTPHandler, INewsDeviceSettings } from './inewsHandler'
import { CoreHandler, CoreConfig } from './coreHandler'
import * as Winston from 'winston'
import * as _ from 'underscore'
import { Process } from './process'
import { Observer } from 'tv-automation-server-core-integration'

export interface Config {
	process: ProcessConfig
	device: DeviceConfig
	core: CoreConfig
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
	private iNewsFTPHandler: InewsFTPHandler
	private _observers: Array<Observer> = []
	private coreHandler: CoreHandler
	private _config: Config
	private _logger: Winston.LoggerInstance
	private _process: Process
	private _settings?: INewsDeviceSettings

	constructor(logger: Winston.LoggerInstance, config: Config) {
		this._logger = logger
		this._config = config
		this._process = new Process(this._logger)
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		this.iNewsFTPHandler = new InewsFTPHandler(this._logger, this.coreHandler)
		this.coreHandler.iNewsHandler = this.iNewsFTPHandler
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
			this._logger.error('Error during initialization:', err, err.stack)

			this._logger.info('Shutting down in 10 seconds!')
			this.dispose().catch((e) => this._logger.error(e))

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

	async initInewsFTPHandler(): Promise<void> {
		await this.iNewsFTPHandler.init(this.coreHandler)
		this.coreHandler.iNewsHandler = this.iNewsFTPHandler
	}

	async dispose(): Promise<void> {
		if (this.iNewsFTPHandler) {
			await this.iNewsFTPHandler.dispose()
		}
		if (this.coreHandler) {
			await this.coreHandler.dispose()
		}
	}

	setupObserver() {
		// Setup observer.
		let observer = this.coreHandler.core.observe('peripheralDevices')
		this._observers.push(observer)

		let addedChanged = (id: string) => {
			// Check that collection exists.
			let devices = this.coreHandler.core.getCollection('peripheralDevices')
			if (!devices) throw Error('"peripheralDevices" collection not found!')

			// Find studio ID.
			let dev = devices.findOne({ _id: id })

			if (dev) {
				let settings: INewsDeviceSettings = dev.settings || {}
				settings.queues = settings.queues?.filter((q) => q.queues !== '')
				if (!this._settings || !_.isEqual(settings, this._settings)) {
					this.iNewsFTPHandler
						.dispose()
						.then(() => {
							this.iNewsFTPHandler = new InewsFTPHandler(this._logger, this.coreHandler)
							return this.initInewsFTPHandler()
						})
						.catch((error) => {
							this._logger.error(error)
							throw new Error('Failed to update iNewsFTP settings')
						})
				}
				this._settings = settings
			}
		}

		observer.added = (id: string) => {
			addedChanged(id)
		}
		observer.changed = (id: string) => {
			addedChanged(id)
		}

		addedChanged(this.coreHandler.core.deviceId)
	}
}
