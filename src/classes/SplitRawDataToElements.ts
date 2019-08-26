import { IOutputLayer } from 'tv-automation-sofie-blueprints-integration'
import { IParsedElement } from './Rundown'
import { NsmlToJson } from './NsmlToJson'

interface IRundownMetaData {
	version: string
	startTime: number
	endTime: number
}

export class SplitRawDataToElements {

	static convert (rundownNSML: any[], outputLayers: IOutputLayer[]): {elements: IParsedElement[], meta: IRundownMetaData} {

		console.log('DUMMY LOG : ', outputLayers)
		let allElements: IParsedElement[] = []
		rundownNSML.map((story): void => {
			const convertedStory = NsmlToJson.convert(story)
			allElements.push({
				// New section for each element:
				data: {
					id: convertedStory.root.head[0].storyid,
					name: convertedStory.root.story[0].fields[0].f[2]._,
					type: 'SECTION',
					float: 'string',
					script: 'string',
					objectType: 'string',
					objectTime: 'string',
					duration: 'string',
					clipName: 'string',
					feedback: 'string',
					transition: 'string',
					attributes: { ['string']: 'string' }
				}
			})

			// Return elements in section:
			return convertedStory.root.story[0].aeset[0].ae[0].ap.map((field: any, index: number): void => {
				console.log('DUMMY LOG : ', index)

				// Convert body object to script:
				let script = ''
				convertedStory.root.story[0].body[0].p.map((line: any) => {
					if (typeof(line) === 'string') {
						script = script + line + '\n'
					}
				})
				if (field.length > 1) {
					allElements.push({
						data: {
							id: convertedStory.root.head[0].storyid + index,
							name: convertedStory.root.story[0].fields[0].f[2]._,
							type: 'CAM',
							float: 'false',
							script: script,
							objectType: 'camera',
							objectTime: '0',
							duration: '10',
							clipName: 'string',
							feedback: 'string',
							transition: 'string',
							attributes: { ['Name']: 'CAM1' }
						}
					})
				}
			})
		})

		return {
			meta: {
				version: 'v0.2',
				startTime: 0,
				endTime: 1
			},
			elements: allElements
		}
	}

}
