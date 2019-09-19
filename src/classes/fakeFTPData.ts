let ftpData = [
	{
		'storyName': 'testmanus bede',
		'story': {
			'fields': {
				'title': 'TESTMANUS BEDE',
				'var2': 'INDSL',
				'tapeTime': '0',
				'audioTime': '2',
				'totalTime': '2',
				'modifyDate': '1567408371',
				'modifyBy': 'bede',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ON-AIR',
				'typecode': 'nyx',
				'programtitle': '.',
				'noarchive': '.'
			},
			'meta': {
				'words': '4',
				'rate': '140'
			},
			'cues': [],
			'id': '2e1d3ecb:00d210ee:5d6cc0f3',
			'body': '\r\n<p></p>\r\n<p><a idref=\'0\'></a></p>\r\n<p><pi>CAMERA 1</pi></p>\r\n<p>Her står em masse tekst</p>\r\n'
		}
	},
	{
		'storyName': 'vm badminton - basel',
		'story': {
			'fields': {
				'title': 'VM BADMINTON - BASEL 22 aug 2019',
				'var2': ' ',
				'tapeTime': '0',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1567082686',
				'modifyBy': 'bede',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ON-AIR',
				'typecode': 'nyx',
				'programtitle': '.',
				'noarchive': '.'
			},
			'meta': {
				'rate': '140',
				'break': 'break'
			},
			'cues': [],
			'id': '191f009e:00cb28c8:5d67c8be',
			'body': '\r\n<p></p>\r\n<p><a idref=\'0\'></a></p>\r\n<p><pi></pi></p>\r\n'
		}
	},
	{
		'storyName': 'setup studie',
		'story': {
			'fields': {
				'pageNumber': '01',
				'title': 'SETUP STUDIE',
				'var2': 'INDSL',
				'tapeTime': '0',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'tmon',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ON-AIR',
				'typecode': 'spx',
				'programtitle': 'NBA',
				'noarchive': '.'
			},
			'meta': {
				'rate': '140',
				'float': 'float'
			},
			'cues': [
				[
					'WATCHOUT=WO RESET',
					';0.00'
				],
				[
					'WATCHOUT=WO loop EVENT 1',
					';0.01'
				]
			],
			'id': '1a1f009e:00bd0dd8:5d5e54a3',
			'body': '\r\n<p><cc>Her ligger alle Mosart koder til setup af studiet</cc></p>\r\n<p></p>\r\n<p><pi>KAM 1</pi></p>\r\n<p><cc>----reset Watchout----></cc><a idref=\'0\'><cc><--------</cc></a></p>\r\n<p><cc>---Watchout standard loop----></cc><a idref=\'1\'><cc><--------</cc></a></p>\r\n<p></p>\r\n<p></p>\r\n<p><cc>WO loop EVENT 1</cc></p>\r\n<p><cc>WO loop EVENT 2</cc></p>\r\n<p><cc>WO loop EVENT 3</cc></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'klar on air',
		'story': {
			'fields': {
				'pageNumber': '02',
				'title': 'KLAR ON AIR',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'flow',
				'ready': 'KLAR',
				'runsTime': '0',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300'
			},
			'meta': {
				'rate': '165'
			},
			'cues': [
				[
					'STUDIOSETUP=afvikling C',
					';0.00'
				],
				[
					'STUDIE=ST2p',
					';0.01'
				],
				[
					'STUDIE=ST4s',
					';0.02'
				],
				[
					'kg ovl-all-out',
					'CLEAR OVERLAY',
					';0.00'
				],
				[
					'KG=DESIGN_BADMINTON',
					';0.00.01'
				],
				[
					'kg tema_out',
					'TEMA OUT',
					';0:1x'
				],
				[
					'VIZ=dve-triopage',
					'GRAFIK=BG_LOADER_BAD_DVE',
					';0.00.03'
				],
				[
					'VIZ=full-triopage',
					'GRAFIK=BG_LOADER_BAD',
					';0.00.05'
				],
				[
					'STUDIE=MIC ON OFF',
					'ST2vrt1=OFF',
					'ST2vrt2=OFF',
					'ST2gst1=OFF',
					'ST2gst2=OFF',
					'ST4vrt=OFF',
					'ST4gst=OFF',
					';0.00'
				],
				[
					'WATCHOUT=WO INPUT',
					'inp1=LIVE 1',
					'inp2=LIVE 2',
					'inp3=EVS 1',
					'inp4=EVS 2',
					';0.00'
				]
			],
			'id': '1b1f009e:00bd0dd7:5d5e54a3',
			'body': '\r\n<p><pi>KAM CS 3</pi></p>\r\n<p><a idref=\'0\'></a></p>\r\n<p></p>\r\n<p></p>\r\n<p><cc>---VALG AF STUDIE PRIMÆR--></cc><a idref=\'1\'><cc><--(ST4p, ST2p)</cc></a></p>\r\n<p><cc>--VALG AF STUDIE SEKUNDÆR--></cc><a idref=\'2\'><cc><---(ST4s, ST2s)</cc></a></p>\r\n<p><cc>----all out overlay--></cc><a idref=\'3\'><cc><---</cc></a></p>\r\n<p><cc>---grafik design på overlay------></cc><a idref=\'4\'><cc><------</cc></a></p>\r\n<p></p>\r\n<p><a idref=\'5\'></a></p>\r\n<p><cc>---load background on DVE------></cc><a idref=\'6\'><cc><------</cc></a></p>\r\n<p><cc>---load background on FULL------></cc><a idref=\'7\'><cc><------</cc></a></p>\r\n<p></p>\r\n<p></p>\r\n<p><cc>-----tænder mikrofoner--></cc><a idref=\'8\'><cc><-----</cc><tab><tab><tab><tab></tab></tab></tab></tab></a></p>\r\n<p><cc>-----Watchout input--></cc><a idref=\'9\'><cc><-----</cc></a></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p><tab><tab><tab><tab></tab></tab></tab></tab></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'studie velkommen',
		'story': {
			'fields': {
				'chekfelt': ' ',
				'pageNumber': '03',
				'title': 'STUDIE VELKOMMEN',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'nyhl',
				'ready': 'KLAR',
				'runsTime': '0',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300',
				'bookStatus': 'KLAR'
			},
			'meta': {
				'rate': '165'
			},
			'cues': [
				null,
				null,
				[
					'kg bund JAN Ø. JØRGENSEN',
					'Badmintonspiller',
					';x.xx'
				],
				[
					'kg bund HANS-KRISTIAN VITTINGHUS',
					'Badmintonspiller',
					';x.xx'
				],
				[
					'kg bund KENNETH JONASSEN',
					'Cheflandstræner, Danmark',
					';x.xx'
				],
				[
					'kg bund MORTEN ANKERDAL',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund DENNIS BOSTRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JIM LAUGESEN',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund KRISTOFFER MØLDRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JOACHIM FISCHER',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JAN Ø. JØRGENSEN',
					'Badmintonspiller',
					';x.xx'
				]
			],
			'id': '1c1f009e:00bd0dd5:5d5e54a3',
			'body': '\r\n<p><pi>KAM 1</pi><tab><tab><tab></tab></tab></tab></p>\r\n<p><a idref=\'2\'><a idref=\'3\'><a idref=\'4\'></a></a></a></p>\r\n<p><a idref=\'5\'></a></p>\r\n<p><a idref=\'6\'></a></p>\r\n<p><cc>der skal altid skrives en goddag!</cc></p>\r\n<p><a idref=\'7\'></a></p>\r\n<p><a idref=\'8\'><a idref=\'9\'><a idref=\'10\'></a></a></a></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'swinger - antonsen f',
		'story': {
			'fields': {
				'chekfelt': 'A',
				'title': 'Swinger - Antonsen Forste Kamp',
				'var2': 'ATTACK',
				'var3': 'kriv',
				'videoId': '1249335A',
				'tapeTime': '29',
				'audioTime': '0',
				'totalTime': '29',
				'modifyDate': '1566463139',
				'modifyBy': 'mema',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'redOk': ' ',
				'onair': 'ONAIR',
				'typecode': 'spx',
				'noarchive': '.'
			},
			'meta': {
				'rate': '140'
			},
			'cues': [],
			'id': '1d1f009e:00bd0dd3:5d5e54a3',
			'body': '\r\n<p></p>\r\n<p></p>\r\n<p><a idref=\'0\'></a></p>\r\n<p></p>\r\n<p><pi>***SERVER*** </pi></p>\r\n<p></p>\r\n<p><cc>---<b>BUNDTER HERUNDER</b> ---></cc></p>\r\n<p></p>\r\n<p></p>\r\n<p><pi>SLUTORD:UD PÅ TID</pi></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'studie',
		'story': {
			'fields': {
				'pageNumber': '04',
				'title': 'STUDIE',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'mema',
				'ready': 'KLAR',
				'runsTime': '0',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300',
				'bookStatus': 'KLAR'
			},
			'meta': {
				'rate': '165'
			},
			'cues': [
				[
					'kg bund AMALIE MAGELUND',
					'Badmintonspiller',
					';x.xx'
				],
				[
					'kg bund FREJA RAVN',
					'Badmintonspiller',
					';x.xx'
				],
				[
					'kg bund MORTEN ANKERDAL',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund ANDERS ANTONSEN',
					'Badmintonspiller',
					';x.xx'
				],
				[
					'kg bund DENNIS BOSTRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JIM LAUGESEN',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund KRISTOFFER MØLDRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JOACHIM FISCHER',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				]
			],
			'id': '1e1f009e:00bd0dd2:5d5e54a3',
			'body': '\r\n<p><pi>KAM 1</pi><tab><tab></tab></tab></p>\r\n<p></p>\r\n<p><a idref=\'0\'><a idref=\'1\'></a></a></p>\r\n<p><a idref=\'2\'><a idref=\'3\'></a></a></p>\r\n<p><a idref=\'4\'></a></p>\r\n<p><cc>der skal altid skrives en goddag!</cc></p>\r\n<p><a idref=\'5\'></a></p>\r\n<p><a idref=\'6\'><a idref=\'7\'></a></a></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'skilt 100 % danskere',
		'story': {
			'fields': {
				'title': 'SKILT 100 % Danskere torsdag ',
				'var2': 'SKILT',
				'tapeTime': '0',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'mema',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ON-AIR',
				'typecode': 'spx',
				'programtitle': 'NBA',
				'noarchive': '.'
			},
			'meta': {
				'rate': '140'
			},
			'cues': [
				[
					'GRAFIK=FULL'
				],
				[
					']] S3.0 M 0 [[',
					'cg4 ]] 1 YNYAB 0 [[ pilotdata',
					'Senderplan/22-08-2019',
					'VCPID=2547785',
					'ContinueCount=-1',
					'Senderplan/22-08-2019'
				]
			],
			'id': '1f1f009e:00bd0dd0:5d5e54a3',
			'body': '\r\n<p><pi>***100% GRAFIK***</pi></p>\r\n<p><cc>START MUSIK MED Directtake 53</cc></p>\r\n<p><cc>Fade musik ud med Directtake 59</cc><a idref=\'0\'></a></p>\r\n<p><cc>Indsæt viz-pilot koden her --></cc><a idref=\'1\'><cc><---.</cc></a></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'skaarup/astrup sync',
		'story': {
			'fields': {
				'title': 'Skaarup/Astrup sync',
				'var2': 'INDSL',
				'videoId': '1249621A',
				'tapeTime': '20',
				'audioTime': '6',
				'totalTime': '26',
				'modifyDate': '1566463139',
				'modifyBy': 'jobb',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ONAIR',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300',
				'noarchive': '.'
			},
			'meta': {
				'words': '14',
				'rate': '140'
			},
			'cues': [
				[
					'SS=SC-STILLS',
					';0.00.01'
				],
				[
					'SS=SC-LOOP',
					';0.00.01'
				],
				[
					'kg bund KIM ASTRUP',
					'Badmintonspiller',
					';0.01'
				]
			],
			'id': '001f009f:00bd0dce:5d5e54a3',
			'body': '\r\n<p><pi>KAM 1</pi><a idref=\'0\'></a></p>\r\n<p><cc>DIGI----vcp her--><----</cc></p>\r\n<p></p>\r\n<p>Lad os lige høre, hvordan den danske herredouble selv ser frem til den her kamp.</p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p><pi>***SERVER*** </pi></p>\r\n<p><a idref=\'1\'><a idref=\'2\'></a></a></p>\r\n<p><cc>---<b>BUNDTER HERUNDER</b> ---></cc></p>\r\n<p></p>\r\n<p><pi>SLUTORD: Slå dem</pi></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'studie',
		'story': {
			'fields': {
				'pageNumber': ' ',
				'title': 'STUDIE',
				'audioTime': '0',
				'totalTime': '0',
				'modifyDate': '1566463139',
				'modifyBy': 'mema',
				'ready': 'KLAR',
				'runsTime': '0',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300',
				'bookStatus': 'KLAR'
			},
			'meta': {
				'rate': '165'
			},
			'cues': [
				[
					'kg bund MORTEN ANKERDAL',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund DENNIS BOSTRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JIM LAUGESEN',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund KRISTOFFER MØLDRUP',
					'TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund JOACHIM FISCHER',
					'Badmintonekspert, TV 2 SPORT',
					';x.xx'
				],
				[
					'kg bund ANDERS ANTONSEN',
					'Badmintonspiller',
					';x.xx'
				]
			],
			'id': '011f009f:00bd0dde:5d5e54a3',
			'body': '\r\n<p><pi>KAM 1</pi><tab><tab></tab></tab></p>\r\n<p></p>\r\n<p></p>\r\n<p><a idref=\'0\'><a idref=\'5\'></a></a></p>\r\n<p><a idref=\'1\'></a></p>\r\n<p><cc>der skal altid skrives en goddag!</cc></p>\r\n<p><a idref=\'2\'></a></p>\r\n<p><a idref=\'3\'><a idref=\'4\'></a></a></p>\r\n<p></p>\r\n'
		}
	},
	{
		'storyName': 'menneskelig momota',
		'story': {
			'fields': {
				'title': 'Menneskelig Momota',
				'tjekSport': '1',
				'var2': 'INDSL',
				'var3': 'jobn',
				'videoId': '1248681A',
				'tapeTime': '121',
				'audioTime': '10',
				'totalTime': '131',
				'modifyDate': '1566463139',
				'modifyBy': 'flow',
				'var16': 'ååmmdd',
				'ready': 'KLAR',
				'runsTime': '0',
				'onair': 'ONAIR',
				'typecode': 'spx',
				'programtitle': 'Sportscenter: 2300',
				'noarchive': '.'
			},
			'meta': {
				'words': '24',
				'rate': '140'
			},
			'cues': [
				[
					'SS=SC-STILLS',
					';0.00.01'
				],
				[
					'SS=SC-LOOP',
					';0.00.01'
				],
				[
					'kg bund KENNETH JONASSEN',
					'Landstræner',
					';0.01-0.03'
				],
				[
					'kg bund PETER GADE',
					'Tidligere verdensetter',
					';0.07-0.07'
				],
				[
					'kg bund JONAS BO NIELSEN',
					'jobn@tv2.dk',
					';0.25-0.28'
				],
				[
					'kg tlftopt ANDERS ANTONSEN',
					'Badmintonspiller',
					';1.46-2.01'
				],
				[
					'kg bund MORTEN FROST',
					'Tidligere verdensetter',
					';1.02'
				]
			],
			'id': '021f009f:00bd29ac:5d5e54a3',
			'body': '\r\n<p><a idref=\'0\'></a></p>\r\n<p><cc>DIGI----vcp her--><----</cc></p>\r\n<p></p>\r\n<p>Kento Momota har vist overmenneskelig styrke, efter sit comecack til sporten i 2018, men måske er konkurrenterne ved at hale ind på ham igen.</p>\r\n<p></p>\r\n<p></p>\r\n<p></p>\r\n<p><pi>***SERVER*** </pi></p>\r\n<p><a idref=\'1\'><a idref=\'2\'><a idref=\'3\'><a idref=\'4\'><a idref=\'5\'></a></a></a></a></a></p>\r\n<p><cc>---<b>BUNDTER HERUNDER</b> ---></cc></p>\r\n<p></p>\r\n<p><pi>SLUTORD: Krafedeme vannvittigt.</pi></p>\r\n<p><a idref=\'6\'></a></p>\r\n<p></p>\r\n'
		}
	}
]

export default ftpData