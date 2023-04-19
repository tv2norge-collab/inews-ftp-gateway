import {
	DeviceConfigManifest,
	JSONBlobStringify,
	JSONSchema,
} from '@sofie-automation/server-core-integration'

import ConfigSchema = require('./$schemas/options.json')

export const INEWS_DEVICE_CONFIG_MANIFEST: DeviceConfigManifest = {
	deviceConfigSchema: JSONBlobStringify<JSONSchema>(ConfigSchema as any),
	subdeviceManifest: {}
}
