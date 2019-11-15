import { CoreConnection,
	CoreOptions,
	PeripheralDeviceAPI as P,
	DDPConnectorOptions,
  CollectionObj
} from 'tv-automation-server-core-integration'
import * as Winston from 'winston'
import * as fs from 'fs'
import { Process } from './process'

import * as _ from 'underscore'

import { DeviceConfig } from './connector'
import { InewsFTPHandler } from './inewsHandler'
// import { STATUS_CODES } from 'http'
export interface PeripheralDeviceCommand {
	_id: string

	deviceId: string
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any

	time: number // time
}
export interface CoreConfig {
	host: string,
	port: number,
	watchdog: boolean
}
/**
 * Represents a connection between mos-integration and Core
 */
export class CoreHandler {

	public core: CoreConnection

	private logger: Winston.LoggerInstance
	private _observers: Array<any> = []
	private _onConnected?: () => any
	private _subscriptions: Array<any> = []
	private _isInitialized: boolean = false
	private _executedFunctions: {[id: string]: boolean} = {}
	private _coreConfig?: CoreConfig
	private _process?: Process
	private _studioId: string
	public iNewsHandler?: InewsFTPHandler

	constructor (logger: Winston.LoggerInstance, deviceOptions: DeviceConfig) {
		this.logger = logger
		this.core = new CoreConnection(this.getCoreConnectionOptions(deviceOptions, 'iNews Gateway'))
	}

  // REFACTOR - async/await
	init (_deviceOptions: DeviceConfig, config: CoreConfig, process: Process): Promise<void> {
		// this.logger.info('========')

		this._coreConfig = config
		this._process = process

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			if (this._isInitialized) this.onConnectionRestored()
		})
		this.core.onDisconnected(() => {
			this.logger.info('Core Disconnected!')
		})
		this.core.onError((err) => {
			this.logger.error('Core Error: ' + (err.message || err.toString() || err))
		})

		let ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates
			}
		}
		return this.core.init(ddpConfig).then((id: string) => {
			id = id // tsignore

			this.core.setStatus({
				statusCode: P.StatusCode.UNKNOWN,
				messages: ['Starting up']
			})
			.catch(e => this.logger.warn('Error when setting status:' + e))
			// nothing
		})
		.then(() => {
			return this.setupSubscriptionsAndObservers()
		})
		.then(() => {
			this._isInitialized = true
		})
	}
	/**
	 * Destroy gateway
	 */
	 // REFACTOR - async / await
	dispose (): Promise<void> {
		return this.core.setStatus({
			statusCode: P.StatusCode.FATAL,
			messages: ['Shutting down']
		})
		.then(() => {
			return this.core.destroy()
		})
		.then(() => {
			// nothing
		})
	}
	/**
	 * Report gateway status to core
	 */
	// REFACTOR - hidden async operation
	setStatus (statusCode: P.StatusCode, messages: string[]) {
		this.core.setStatus({
			statusCode: statusCode,
			messages: messages
		})
		.catch(e => this.logger.warn('Error when setting status:' + e))
	}
	/**
	 * Get options for connecting to core
	 */
	getCoreConnectionOptions (deviceOptions: DeviceConfig, name: string): CoreOptions {
		let credentials: {
			deviceId: string
			deviceToken: string
		}

		if (deviceOptions.deviceId && deviceOptions.deviceToken) {
			credentials = {
				deviceId: deviceOptions.deviceId,
				deviceToken: deviceOptions.deviceToken
			}
		} else if (deviceOptions.deviceId) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			credentials = {
				deviceId: deviceOptions.deviceId + name,
				deviceToken: 'unsecureToken'
			}
		} else {
			credentials = CoreConnection.getCredentials(name.replace(/ /g,''))
		}
		let options: CoreOptions = {
			...credentials,

			deviceCategory: P.DeviceCategory.INGEST,
			deviceType: P.DeviceType.INEWS,
			deviceSubType: P.SUBTYPE_PROCESS,

			deviceName: name,
			watchDog: (this._coreConfig ? this._coreConfig.watchdog : true)
		}
		options.versions = this._getVersions()
		return options
	}
	/**
	 * Called when reconnected to core
	 */
	// REFACTOR - hidden async work
	onConnectionRestored () {
		this.setupSubscriptionsAndObservers()
		.catch((e) => {
			this.logger.error(e)
		})
		// REFACTOR - should this wait for previous to complete?
		if (this._onConnected) this._onConnected()
	}
	/**
	 * Called when connected to core.
	 */
	onConnected (fcn: () => any) {
		this._onConnected = fcn
	}
	/**
	 * Subscribes to events in the core.
	 */
	// REFACTOR - async/await
	setupSubscriptionsAndObservers (): Promise<void> {
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._subscriptions = []

		this.logger.info('Core: Setting up subscriptions for ' + this.core.deviceId + '..')
		return Promise.all([
			this.core.autoSubscribe('peripheralDevices', {
				_id: this.core.deviceId
			}),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
			this.core.autoSubscribe('peripheralDevices', this.core.deviceId),
			this.core.autoSubscribe('ingestDataCache', {}),
			this.core.autoSubscribe('rundowns', {})
		])
		.then((subs) => {
			this._subscriptions = this._subscriptions.concat(subs)
		})
		.then(() => {
			this.setupObserverForPeripheralDeviceCommands()
			this.setupObserverForPeripheralDevices()

			return
		})
	}
	/**
	 * Executes a peripheral device command.
	 */
	// RERACTOR - hidden async work
	executeFunction (cmd: PeripheralDeviceCommand, fcnObject: any) {
		if (cmd) {
			if (this._executedFunctions[cmd._id]) return // prevent it from running multiple times
			this.logger.debug(cmd.functionName, cmd.args)
			this._executedFunctions[cmd._id] = true
			let cb = (err: any, res?: any) => {
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}
				this.core.callMethod(P.methods.functionReply, [cmd._id, err, res])
				.catch((e) => {
					this.logger.error(e)
				})
			}
			// @ts-ignore - REFACTOR - why?
			let fcn: Function = fcnObject[cmd.functionName]
			try {
				if (!fcn) throw Error('Function "' + cmd.functionName + '" not found!')

				Promise.resolve(fcn.apply(fcnObject, cmd.args))
				.then((result) => {
					cb(null, result)
				})
				.catch((e) => {
					cb(e.toString(), null)
				})
			} catch (e) {
				cb(e.toString(), null)
			}
		}
	}
	retireExecuteFunction (cmdId: string) {
		delete this._executedFunctions[cmdId]
	}

	/**
	 * Listen for commands and execute.
	 */
	// REFACTOR - hidden async work
	setupObserverForPeripheralDeviceCommands () {
		let observer = this.core.observe('peripheralDeviceCommands')
		this.killProcess(0) // just make sure it exists
		this._observers.push(observer)

		/**
		 * Called when a command is added/changed. Executes that command.
		 * @param {string} id Command id to execute.
		 */
		let addedChangedCommand = (id: string) => {
			let cmds = this.core.getCollection('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			let cmd = cmds.findOne(id) as PeripheralDeviceCommand
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			if (cmd.deviceId === this.core.deviceId) {
				this.executeFunction(cmd, this)
			}
		}
		observer.added = (id: string) => {
			addedChangedCommand(id)
		}
		observer.changed = (id: string) => {
			addedChangedCommand(id)
		}
		observer.removed = (id: string) => {
			this.retireExecuteFunction(id)
		}
		let cmds = this.core.getCollection('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		cmds.find({}).forEach((cmd0) => {
			let cmd = cmd0 as PeripheralDeviceCommand
			if (cmd.deviceId === this.core.deviceId) {
				this.executeFunction(cmd, this)
			}
		})
	}
	/**
	 * Subscribes to changes to the device to get its associated studio ID.
	 */
	setupObserverForPeripheralDevices () {
		// Setup observer.
		let observer = this.core.observe('peripheralDevices')
		this.killProcess(0)
		this._observers.push(observer)

		let addedChanged = (id: string) => {
			// Check that collection exists.
			let devices = this.core.getCollection('peripheralDevices')
			if (!devices) throw Error('"peripheralDevices" collection not found!')

			// Find studio ID.
			let dev = devices.findOne({ _id: id })
			if ('studioId' in dev) {
				if (dev['studioId'] !== this._studioId) {
					this._studioId = dev['studioId']
				}
			} else {
				throw Error('Could not get a studio for iNews-gateway')
			}
		}

		observer.added = (id: string) => {
			addedChanged(id)
		}
		observer.changed = (id: string) => {
			addedChanged(id)
		}

		addedChanged(this.core.deviceId)
	}
	/**
	 * Kills the gateway.
	 * @param actually Whether to actually kill the gateway, or just test this function.
	 */
	killProcess (actually: number) {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				process.exit(0)
			}, 1000)
			return true
		}
		return 0
	}
	/**
	 * Respond to ping from core.
	 * @param message Response.
	 */
	pingResponse (message: string) {
		this.core.setPingResponse(message)
		return true
	}
	/** Get snapshot of the gateway. */
	getSnapshot (): any {
		this.logger.info('getSnapshot')
		return {} // TODO: send some snapshot data?
	}
	/** Reload a running order */
	// REFACTOR - what calls this?
	triggerGetRunningOrder (roId: string): Promise<any> {

		// INSTEAD OF RETRIGGERING WE SHOULD RE-INITIALISE runnigOrders[roId]
		// If empty it should automatically reload in the setInterval timer.

		// PROMISE should be removed - only here so we do not change the Core
		// A return statement or errorhandling?
		// IT WILL ALSO GIVE A WRONG MESSAGE IN THE GUI RIGHT NOW
		console.log('DUMMMY - roId :', roId)
		return new Promise((resolve: any) => {
			if (this.iNewsHandler) {
				if (this.iNewsHandler.iNewsWatcher) {
					delete this.iNewsHandler.iNewsWatcher.runningOrders[roId]
				}
			}
			return resolve('iNews is updated')
		})
	}
	/**
	 * Get the versions of installed packages.
	 */
	private _getVersions () {
		let versions: {[packageName: string]: string} = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		let dirNames = [
			'tv-automation-server-core-integration'
		]
		try {
			let nodeModulesDirectories = fs.readdirSync('node_modules') // REFACTOR - sync FS code
			_.each(nodeModulesDirectories, (dir) => {
				try {
					if (dirNames.indexOf(dir) !== -1) {
						let file = 'node_modules/' + dir + '/package.json'
						file = fs.readFileSync(file, 'utf8') // REFACTOR - more sync FS code
						let json = JSON.parse(file)
						versions[dir] = json.version || 'N/A'
					}
				} catch (e) {
					this.logger.error(e)
				}
			})
		} catch (e) {
			this.logger.error(e)
		}
		return versions
	}

	/**
	 * Returns the ID of the currently active rundown.
	 */
	public GetLiveRundown (): string | undefined {
		let rundowns = this.core.getCollection('rundowns')
		if (!rundowns) throw Error('"rundowns" collection not found!')

		let activeRundown = rundowns.findOne({ studioId: this._studioId, active: true })
		return activeRundown.externalId
	}

	/**
	 * Returns Sofie rundown orders state
	 */
	public GetRundownCache (): Array<CollectionObj> {
		let rundowns = this.core.getCollection('ingestDataCache')
		if (!rundowns) throw Error('"ingestDataCache" collection not found!')

		let fullIngestCache = rundowns.find({})
		return fullIngestCache
	}

	/**
	 * Checks if a rundown is active.
	 * @param externalId External ID of the active rundown.
	 */
	public IsRundownLive (externalId: string): boolean {
		let rundowns = this.core.getCollection('rundowns')
		if (!rundowns) throw Error('"rundowns" collection not found!')

		let rundown = rundowns.findOne({ studioId: this._studioId, externalId: externalId })
		return rundown.active
	}
}
