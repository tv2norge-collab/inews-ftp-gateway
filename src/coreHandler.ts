import {
	CoreConnection,
	CoreOptions,
	DDPConnectorOptions,
	Observer,
	PeripheralDeviceForDevice,
	StudioId,
} from '@sofie-automation/server-core-integration'
import { ILogger as Logger } from '@tv2media/logger'
import * as fs from 'fs'
import { Process } from './process'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
	StatusObject,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import * as _ from 'underscore'
import { PeripheralDeviceAPIMethods } from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { DeviceConfig } from './connector'
import { InewsFTPHandler } from './inewsHandler'
import { IngestSegmentToRundownSegment } from './mutate'
import { RundownSegment } from './classes/datastructures/Segment'
import { IngestSegment, IngestRundown, IngestPlaylist } from '@sofie-automation/blueprints-integration'
import { INEWS_DEVICE_CONFIG_MANIFEST } from './configManifest'
import { ReflectPromise } from './helpers'
import { ReducedRundown } from './classes/RundownWatcher'
import { VersionIsCompatible } from './version'
import { RundownId, SegmentId } from './helpers/id'
import { protectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'

export interface PeripheralDeviceCommand {
	_id: string

	deviceId: PeripheralDeviceId
	functionName: string
	args: Array<any>

	hasReply: boolean
	reply?: any
	replyError?: any

	time: number // time
}
export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}

const DEVICE_NAME = 'iNews Gateway'

/**
 * Represents a connection between mos-integration and Core
 */
export class CoreHandler {
	public core: CoreConnection

	private logger: Logger
	private _observers: Array<Observer> = []
	private _onConnected?: () => any
	private _subscriptions: Array<any> = []
	private _isInitialized: boolean = false
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process
	private _studioId?: StudioId
	public iNewsHandler?: InewsFTPHandler

	constructor(logger: Logger, deviceOptions: DeviceConfig) {
		this.logger = logger.tag(this.constructor.name)
		this.core = new CoreConnection(this.getCoreConnectionOptions(deviceOptions))
	}

	async init(_deviceOptions: DeviceConfig, config: CoreConfig, process: Process): Promise<void> {
		this._coreConfig = config
		this._process = process

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			if (this._isInitialized) {
				this.onConnectionRestored().catch((error) => this.logger.data(error).error('onConnected error:'))
			}
		})
		this.core.onDisconnected(() => {
			this.logger.info('Core Disconnected!')
		})
		this.core.onError((error) => {
			this.logger.data(error).error('Core Error:')
			this.setStatus(StatusCode.BAD, ['Core error'])
		})

		let ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates,
			}
		}
		await this.core.init(ddpConfig)

		await this.setStatus(StatusCode.UNKNOWN, ['Starting up'])
		await this.setupSubscriptionsAndObservers()

		this._isInitialized = true
	}
	/**
	 * Destroy gateway
	 */
	async dispose(): Promise<void> {
		await this.core.setStatus({
			statusCode: StatusCode.FATAL,
			messages: ['Shutting down'],
		})
		await this.core.destroy()
	}
	/**
	 * Report gateway status to core
	 */
	async setStatus(statusCode: StatusCode, messages: string[]): Promise<StatusObject> {
		try {
			return this.core.setStatus({
				statusCode: statusCode,
				messages: messages,
			})
		} catch (error) {
			this.logger.data(error).warn('Error when setting status:')
			return {
				statusCode: StatusCode.WARNING_MAJOR,
				messages: ['Error when setting status', error as string],
			}
		}
	}
	/**
	 * Get options for connecting to core
	 */
	getCoreConnectionOptions(deviceOptions: DeviceConfig): CoreOptions {
		const deviceId = deviceOptions.deviceId || DEVICE_NAME.replace(/\s/g, '')
		let options: CoreOptions = {
			deviceId: protectString(deviceId),
			deviceToken: deviceOptions.deviceToken,
			deviceCategory: PeripheralDeviceCategory.INGEST,
			deviceType: PeripheralDeviceType.INEWS,

			deviceName: DEVICE_NAME,
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: INEWS_DEVICE_CONFIG_MANIFEST,
			documentationUrl: 'https://github.com/tv2norge/inews-ftp-gateway',
			versions: this._getVersions(),
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		return options
	}
	/**
	 * Called when reconnected to core
	 */
	async onConnectionRestored() {
		// The following command was placed after subscription setup but being
		// executed before it.
		if (this._onConnected) this._onConnected()
		await this.setupSubscriptionsAndObservers().catch((error) => {
			this.logger.data(error).error('setupSubscriptionsAndObservers error:')
		})
		this.iNewsHandler?.restartWatcher()
	}
	/**
	 * Called when connected to core.
	 */
	onConnected(fcn: () => any) {
		this._onConnected = fcn
	}
	/**
	 * Subscribes to events in the core.
	 */
	async setupSubscriptionsAndObservers(): Promise<void> {
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs: Observer) => {
				obs.stop()
			})
			this._observers = []
		}
		this._subscriptions = []

		this.logger.info(`Core: Setting up subscriptions for ${this.core.deviceId}..`)
		let subs = await Promise.all([
			this.core.autoSubscribe('peripheralDeviceForDevice', {
				_id: this.core.deviceId,
			}),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
			this.core.autoSubscribe('ingestDataCache', {}),
		])
		this._subscriptions = this._subscriptions.concat(subs)
		this.setupObserverForPeripheralDeviceCommands() // Sets up observers
		this.executePeripheralDeviceCommands().catch((e) =>
			this.logger.data(e).error('executePeripheralDeviceCommands error:')
		) // Runs any commands async
		this.setupObserverForPeripheralDevices()
	}
	/**
	 * Executes a peripheral device command.
	 */
	async executeFunction(cmd: PeripheralDeviceCommand): Promise<void> {
		if (cmd) {
			if (this._executedFunctions[cmd._id]) return // prevent it from running multiple times
			this.logger
				.data({ functionName: cmd.functionName, args: cmd.args })
				.debug('Executing a peripheral device command:')
			this._executedFunctions[cmd._id] = true
			let success = false

			try {
				switch (cmd.functionName) {
					case 'triggerReloadRundown':
						const reloadRundownResult = await Promise.resolve(this.triggerReloadRundown(cmd.args[0]))
						success = true
						await this.core.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [
							cmd._id,
							null,
							reloadRundownResult,
						])
						break
					case 'pingResponse':
						let pingResponseResult = await Promise.resolve(this.pingResponse(cmd.args[0]))
						success = true
						await this.core.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [cmd._id, null, pingResponseResult])
						break
					case 'retireExecuteFunction':
						let retireExecuteFunctionResult = await Promise.resolve(this.retireExecuteFunction(cmd.args[0]))
						success = true
						await this.core.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [
							cmd._id,
							null,
							retireExecuteFunctionResult,
						])
						break
					case 'killProcess':
						let killProcessFunctionResult = await Promise.resolve(this.killProcess(cmd.args[0]))
						success = true
						await this.core.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [
							cmd._id,
							null,
							killProcessFunctionResult,
						])
						break
					case 'getSnapshot':
						let getSnapshotResult = await Promise.resolve(this.getSnapshot())
						success = true
						await this.core.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [cmd._id, null, getSnapshotResult])
						break
					default:
						throw Error('Function "' + cmd.functionName + '" not found!')
				}
			} catch (error) {
				this.logger.data(error).error(`executeFunction error ${success ? 'during execution' : 'on reply'}:`)
				if (!success) {
					await this.core
						.callMethodRaw(PeripheralDeviceAPIMethods.functionReply, [cmd._id, (error as any).toString(), null])
						.catch((e) => this.logger.data(e).error('executeFunction reply error after execution failure:'))
				}
			}
		}
	}

	retireExecuteFunction(cmdId: string) {
		delete this._executedFunctions[cmdId]
	}

	/**
	 * Listen for commands.
	 */
	// Made async as it does async work ...
	setupObserverForPeripheralDeviceCommands() {
		this.logger.info(`Core: Setting up observers for peripheral device commands on ${this.core.deviceId}..`)
		let observer = this.core.observe('peripheralDeviceCommands')
		this.killProcess(0) // just make sure it exists
		this._observers.push(observer)

		/**
		 * Called when a command is added/changed. Executes that command.
		 * @param {string} id Command id to execute.
		 */
		// Note: Oberver is not expecting a promise.
		let addedChangedCommand = (id: string): void => {
			let cmds = this.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			let cmd = cmds.findOne(id)
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			if (cmd.deviceId === this.core.deviceId) {
				this.executeFunction(cmd).catch((e) => this.logger.data(e).error(`Error executing command recieved from core:`))
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
	}

	/**
	 *  Execute all relevant commands now
	 */
	async executePeripheralDeviceCommands(): Promise<void> {
		this.logger.info(`Core: Execute peripheral device commands on ${this.core.deviceId}..`)
		let cmds = this.core.getCollection('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		await Promise.all(
			cmds.find({}).map((cmd0) => {
				let cmd = cmd0 as PeripheralDeviceCommand
				if (cmd.deviceId === this.core.deviceId) {
					return this.executeFunction(cmd)
				}
				return
			})
		)
	}

	/**
	 * Subscribes to changes to the device to get its associated studio ID.
	 */
	setupObserverForPeripheralDevices() {
		this.logger.info(`Core: Setting up observers for peripheral devices on ${this.core.deviceId}..`)
		// Setup observer.
		let observer = this.core.observe('peripheralDeviceForDevice')
		this.killProcess(0)
		this._observers.push(observer)

		let addedChanged = (id: PeripheralDeviceId) => {
			// Check that collection exists.
			let devices = this.core.getCollection<PeripheralDeviceForDevice>('peripheralDeviceForDevice')
			if (!devices) throw Error('"peripheralDeviceForDevice" collection not found!')

			// Find studio ID.
			let dev = devices.findOne(id)
			if (dev && 'studioId' in dev) {
				if (dev['studioId'] !== this._studioId) {
					this._studioId = dev['studioId']
				}
			} else {
				throw Error('Could not get a studio for iNews-gateway')
			}
		}

		observer.added = (id: string) => {
			addedChanged(protectString<PeripheralDeviceId>(id))
		}
		observer.changed = (id: string) => {
			addedChanged(protectString<PeripheralDeviceId>(id))
		}

		addedChanged(this.core.deviceId)
	}
	/**
	 * Kills the gateway.
	 * @param actually Whether to actually kill the gateway, or just test this function.
	 */
	killProcess(actually: number) {
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
	pingResponse(message: string) {
		this.core.setPingResponse(message)
		return true
	}
	/** Get snapshot of the gateway. */
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		if (this.iNewsHandler?.iNewsWatcher?.playlists) {
			const ret: any = {}
			Object.keys(this.iNewsHandler.iNewsWatcher.playlists).forEach((key) => {
				const rundown = this.iNewsHandler?.iNewsWatcher?.playlists.get(key)
				if (rundown) {
					ret[key] = rundown
				}
			})
			return ret
		}

		return {}
	}

	/**
	 * Called by core to reload a rundown. Returns the requested rundown.
	 * Promise is rejected if the rundown cannot be found, or if the gateway is initialising.
	 * @param rundownId Rundown to reload.
	 */
	async triggerReloadRundown(rundownId: string): Promise<IngestRundown | null> {
		this.logger.info(`Reloading rundown: ${rundownId}`)
		if (this.iNewsHandler?.iNewsWatcher) {
			await this.iNewsHandler.iNewsWatcher.ResyncRundown(rundownId)
		}
		return null
	}

	/**
	 * Get the versions of installed packages.
	 */
	// Allowing sync methods here as only called during initialization
	private _getVersions() {
		let versions: { [packageName: string]: string } = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		let dirNames = ['@sofie-automation/server-core-integration']
		try {
			let nodeModulesDirectories = fs.readdirSync('node_modules')
			_.each(nodeModulesDirectories, (dir) => {
				try {
					if (dirNames.indexOf(dir) !== -1) {
						let file = 'node_modules/' + dir + '/package.json'
						file = fs.readFileSync(file, 'utf8')
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

	public async GetPlaylistCache(playlistExternalIds: string[]): Promise<Array<IngestPlaylist>> {
		this.logger.debug(`Making a call to core (GetPlaylistCache)`)
		const res: IngestPlaylist[] = []

		const ps: Array<Promise<IngestPlaylist>> = []
		for (let id of playlistExternalIds) {
			this.logger.debug(`Getting cache for playlist ${id}`)
			ps.push(this.core.callMethodRaw(PeripheralDeviceAPIMethods.dataPlaylistGet, [id]))
		}

		const results = await Promise.all(ps.map(ReflectPromise))

		results.forEach((result) => {
			if (result.status === 'fulfilled') {
				this.logger.debug(`Found cached playlist ${result.value.externalId}`)
				res.push(result.value)
			}
		})

		return res
	}

	/**
	 * Returns Sofie rundown orders state
	 */
	public async GetRundownCache(rundownExternalIds: string[]): Promise<Array<IngestRundown>> {
		this.logger.debug(`Making a call to core (GetRundownCache)`)
		const res: IngestRundown[] = []

		const ps: Array<Promise<IngestRundown>> = []
		for (let id of rundownExternalIds) {
			this.logger.debug(`Getting cache for rundown ${id}`)
			ps.push(this.core.callMethodRaw(PeripheralDeviceAPIMethods.dataRundownGet, [id]))
		}

		const results = await Promise.all(ps.map(ReflectPromise))

		results.forEach((result) => {
			if (result.status === 'fulfilled') {
				this.logger.debug(`Found cached rundown ${result.value.externalId}`)
				if (VersionIsCompatible((result.value.payload as ReducedRundown | undefined)?.gatewayVersion)) {
					res.push(result.value)
				}
			}
		})

		return res
	}

	public async GetSegmentsCacheById(
		rundownExternalId: RundownId,
		segmentExternalIds: SegmentId[]
	): Promise<Map<SegmentId, RundownSegment>> {
		if (!segmentExternalIds.length) {
			return new Map()
		}

		this.logger.debug(`Making a call to core (GetSegmentsCacheById)`)
		this.logger.debug(`Looking for external IDs ${JSON.stringify(segmentExternalIds)}`)

		const cachedSegments: IngestSegment[] = []
		const ps: Array<Promise<IngestSegment>> = []
		for (let id of segmentExternalIds) {
			ps.push(this.core.callMethodRaw(PeripheralDeviceAPIMethods.dataSegmentGet, [rundownExternalId, id]))
		}

		const results = await Promise.all(ps.map(ReflectPromise))

		results.forEach((result) => {
			if (result.status === 'fulfilled') {
				this.logger.debug(`Found cached segment ${result.value.externalId}`)
				cachedSegments.push(result.value)
			}
		})

		const rundownSegments: Map<SegmentId, RundownSegment> = new Map()
		cachedSegments.forEach((segment) => {
			const parsed = IngestSegmentToRundownSegment(segment)

			if (parsed) {
				rundownSegments.set(segment.externalId, parsed)
			} else {
				this.logger.debug(`Failed to parse segment: ${segment.externalId} (${JSON.stringify(segment)})`)
			}
		})

		return rundownSegments
	}
}
