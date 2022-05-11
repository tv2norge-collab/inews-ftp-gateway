import { UnparsedCue } from 'inews'
import { UnrankedSegment } from '../classes/RundownWatcher'
import { SegmentId } from './id'

export type ResolvedPlaylist = Array<ResolvedPlaylistRundown>
export type ResolvedPlaylistRundown = {
	rundownId: string
	segments: string[]
	backTime?: string
	payload?: { [key: string]: any }
}

export function ResolveRundownIntoPlaylist(
	playlistExternalId: string,
	segments: Array<UnrankedSegment>
): { resolvedPlaylist: ResolvedPlaylist; untimedSegments: Set<SegmentId> } {
	const resolvedPlaylist: ResolvedPlaylist = []
	const untimedSegments: Set<SegmentId> = new Set()

	let rundownIndex = 0
	let currentRundown: ResolvedPlaylistRundown = {
		rundownId: `${playlistExternalId}_${rundownIndex + 1}`, // 1-index for users
		segments: [],
	}

	const splitRundown = () => {
		if (currentRundown.segments.length === 0) return
		resolvedPlaylist.push(currentRundown)
		rundownIndex++
		currentRundown = {
			rundownId: `${playlistExternalId}_${rundownIndex + 1}`,
			segments: [],
		}
	}

	let continuityStoryFound = false
	let klarOnAirStoryFound = false

	for (const segment of segments) {
		if (shouldLookForShowstyleVariant(segment, currentRundown)) {
			const showstyleVariants = getOrderedShowstyleVariants(segment)
			if (showstyleVariants.length > 0) {
				splitRundown()
				const showstyleVariant = showstyleVariants[0]
				setShowstyleVariant(currentRundown, showstyleVariant)
			}
		}

		currentRundown.segments.push(segment.externalId)

		const isFloated = segment.iNewsStory.meta.float ?? false
		if (!isFloated && !klarOnAirStoryFound && isKlarOnAir(segment)) {
			klarOnAirStoryFound = true
			untimedSegments.add(segment.externalId)
		}

		// TODO: Not relevant for breaks
		if (!continuityStoryFound && segment.name?.match(/^\s*continuity\s*$/i)) {
			continuityStoryFound = true
			if (segment.iNewsStory.fields.backTime?.match(/^@\d+$/)) {
				currentRundown.backTime = segment.iNewsStory.fields.backTime
			}
		}
		if (continuityStoryFound) {
			untimedSegments.add(segment.externalId)
		}
	}

	if (currentRundown.segments.length) {
		resolvedPlaylist.push(currentRundown)
	}

	return { resolvedPlaylist, untimedSegments }
}

function isKlarOnAir(segment: UnrankedSegment): boolean {
	const klarOnAirPattern = /klar[\s-]*on[\s-]*air/im
	return !!segment.name?.match(klarOnAirPattern)
}

function setShowstyleVariant(rundown: ResolvedPlaylistRundown, showstyleVariant: string) {
	rundown.payload = {
		...(rundown.payload ?? null),
		showstyleVariant,
	}
}

function shouldLookForShowstyleVariant(segment: UnrankedSegment, _rundown: ResolvedPlaylistRundown): boolean {
	const isFloated = segment.iNewsStory.meta.float ?? false
	return !isFloated
}

function getOrderedShowstyleVariants(segment: UnrankedSegment): string[] {
	const cueOrder = getCueOrder(segment)
	const orderedShowstyleVariants: string[] = []
	cueOrder.forEach((cueIndex: number) => {
		const parsedProfile = parseShowstyleVariant(segment.iNewsStory.cues[cueIndex])
		if (parsedProfile) {
			orderedShowstyleVariants.push(parsedProfile)
		}
	})
	return orderedShowstyleVariants
}

function parseShowstyleVariant(cue: UnparsedCue | undefined): string | null {
	const numberOfCueLines = !!cue ? cue.length : -1

	// Kommando cue (ignoring timing)
	const showstyleVariantPattern = /^\s*SOFIE\s*=\s*SHOWSTYLEVARIANT/i
	if (numberOfCueLines >= 2 && showstyleVariantPattern.test(cue![0])) {
		return cue![1].trim()
	}
	return null
}

/**
 *
 * @param segment The segment for which the cue order should be retrieved
 * @returns A list of indicies representing the cue order.
 */
function getCueOrder(segment: UnrankedSegment): number[] {
	const body = segment.iNewsStory.body ?? ''
	const refPattern = /<a\s+idref="(?<id>\d+)"\s*\/?>/gi
	const order: number[] = []
	let match: RegExpExecArray | null
	while ((match = refPattern.exec(body))) {
		let id = parseInt(match.groups!.id, 10)
		order.push(id)
	}
	return order
}
