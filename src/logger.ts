import pino = require('pino')
import { ecsFormat } from '@elastic/ecs-pino-format'

export type Logger = pino.Logger

const PINO_LEVELS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'] as const
type PinoLevel = typeof PINO_LEVELS[number]

const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev'

function createLogger(): pino.Logger {
	const level: PinoLevel = ensureLogLevel(process.env.LOG_LEVEL) ?? 'warn'

	if (isDevelopment) {
		return pino({
			level,
			transport: {
				target: 'pino-pretty',
				options: {
					colorize: true,
					translateTime: 'HH:MM:ss',
					ignore: 'pid,hostname',
				},
			},
		})
	}

	return pino({
		level,
		...ecsFormat({
			convertErr: true,
			serviceName: 'inews-gateway',
		}),
	})
}

export let logger = createLogger()

export function setupLogger(): void {
	// Hijack console.log:
	// @ts-ignore
	if (!process.env.DEV) {
		let orgConsoleLog = console.log
		console.log = function (...args: any[]) {
			if (args.length >= 1) {
				try {
					// @ts-ignore one or more arguments
					logger.debug(args)
				} catch (e) {
					orgConsoleLog('CATCH')
					orgConsoleLog(...args)
					throw e
				}
			}
		}
	}
}

export function setLogLevel(level: PinoLevel): void {
	logger.level = level
}

export function ensureLogLevel(level?: string): PinoLevel | undefined {
	return PINO_LEVELS.find((l) => l === level)
}
