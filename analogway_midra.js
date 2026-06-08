const { InstanceBase, Regex, runEntrypoint, InstanceStatus, TCPHelper, combineRgb } = require('@companion-module/base')

const MODEL_NAMES = {
	250: 'Eikos / EKS-500',
	257: 'Eikos2',
	258: 'Saphyr',
	259: 'Pulse2',
	260: 'SmartMatriX2',
	261: 'QuickMatriX',
	262: 'QuickVu',
	282: 'Saphyr - H',
	283: 'Pulse2 - H',
	284: 'SmartMatriX2 - H',
	285: 'QuickMatriX - H',
}

const MIDRA_SCREEN_CHOICES = [
	{ id: '0', label: 'S1' },
	{ id: '1', label: 'S2' },
]

const MIDRA_LAYER_CHOICES = [
	{ id: '0', label: 'Background' },
	{ id: '1', label: 'PiP Layer 1' },
	{ id: '2', label: 'PiP Layer 2' },
	{ id: '3', label: 'PiP Layer 3' },
	{ id: '4', label: 'PiP Layer 4' },
	{ id: '5', label: 'Logo Layer 1' },
	{ id: '6', label: 'Logo Layer 2' },
	{ id: '7', label: 'Audio Layer' },
]

const MIDRA_INPUT_CHOICES = [
	{ id: '0', label: 'No Input' },
	{ id: '1', label: 'Input/Frame 1' },
	{ id: '2', label: 'Input/Frame 2' },
	{ id: '3', label: 'Input/Frame 3' },
	{ id: '4', label: 'Input/Frame 4' },
	{ id: '5', label: 'Input/Frame 5' },
	{ id: '6', label: 'Input/Frame 6' },
	{ id: '7', label: 'Input/Frame 7' },
	{ id: '8', label: 'Input/Frame 8' },
	{ id: '9', label: 'Input/Frame 9' },
	{ id: '10', label: 'Input/Frame 10' },
	{ id: '11', label: 'Matte' },
]

const EKS_INPUT_CHOICES = [
	{ id: '0', label: 'Black / Logo' },
	{ id: '1', label: 'Input 1' },
	{ id: '2', label: 'Input 2' },
	{ id: '3', label: 'Input 3' },
	{ id: '4', label: 'Input 4' },
	{ id: '5', label: 'Input 5' },
	{ id: '6', label: 'Input 6' },
	{ id: '9', label: 'DVI 1' },
	{ id: '10', label: 'DVI 2' },
	{ id: '11', label: 'SDI 1' },
	{ id: '12', label: 'SDI 2' },
	{ id: '13', label: 'SDI 3' },
	{ id: '14', label: 'SDI 4' },
]

const EKS_LAYER_CHOICES = [
	{ id: '2', label: 'Background Live' },
	{ id: '3', label: 'PIP 2' },
	{ id: '4', label: 'PIP 3' },
]

const EKS_FRAME_LAYER_CHOICES = [
	{ id: '0', label: 'Background Frame' },
	{ id: '6', label: 'Logo 1' },
	{ id: '7', label: 'Logo 2' },
]

const EKS_FRAME_CHOICES = [
	{ id: '0', label: 'None' },
	{ id: '1', label: 'Frame/Logo 1' },
	{ id: '2', label: 'Frame/Logo 2' },
	{ id: '3', label: 'Frame/Logo 3' },
	{ id: '4', label: 'Frame/Logo 4' },
	{ id: '5', label: 'Frame/Logo 5' },
	{ id: '6', label: 'Frame/Logo 6' },
	{ id: '7', label: 'Frame/Logo 7' },
	{ id: '8', label: 'Frame/Logo 8' },
]

const COLORS = {
	white: combineRgb(255, 255, 255),
	black: combineRgb(0, 0, 0),
	blue: combineRgb(0, 96, 180),
	darkBlue: combineRgb(0, 38, 76),
	green: combineRgb(0, 150, 60),
	amber: combineRgb(210, 126, 0),
	red: combineRgb(180, 0, 0),
	purple: combineRgb(80, 48, 150),
}

class MidraInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	init(config) {
		let self = this

		self.config = config

		this.firmwareVersion = "0"
		this.numOutputs = 0
		this.numInputs = 0
		this.modelnum
		this.modelname = ''
		this.trackedState = {
			layerInputs: {},
			memories: {},
			freezeScreens: {},
			freezeAll: undefined,
			quickFrameScreens: {},
			quickFrameAll: undefined,
		}

		self.init_actions() // export actions
		self.init_feedbacks()
		self.init_presets()
		self.init_tcp()
	}

	init_tcp() {
		let self = this
		let receivebuffer = ''
		self.updateStatus(InstanceStatus.Connecting)

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		if (self.config.host) {
			self.socket = new TCPHelper(self.config.host, 10500)

			self.socket.on('status_change', (status, message) => {
				self.updateStatus(status, message)
			})

			self.socket.on('error', (err) => {
				self.log('debug', "Network error "+ err)
				self.log('error',"Network error: " + err.message)
			})

			self.socket.on('connect', () => {
				self.log('debug', "Connected")
				self.updateStatus(InstanceStatus.Ok)
				self.sendcmd("*")
			})

			// separate buffered stream into lines with responses
			self.socket.on('data', (chunk) => {
				let i = 0, line = '', offset = 0
				receivebuffer += chunk
				while ( (i = receivebuffer.indexOf('\r\n', offset)) !== -1) {
					line = receivebuffer.substring(offset, i - offset)
					offset = i + 1
					self.socket.emit('receiveline', line.toString())
				}
				receivebuffer = receivebuffer.substring(offset)
			})

			self.socket.on('receiveline', (line) => {
				self.log('debug', "Received line from Midra: " + line)

				if (line.match(/\*1/)) {
					self.log('info',"Ethernet connection to "+ self.config.label +" established. Device ready.")
					self.sendcmd("?")
				}
				if (line.match(/DEV\d+/)) {
					this.model = parseInt(line.match(/DEV(\d+)/)[1])
					this.modelname = MODEL_NAMES[this.model] || 'unknown'
					self.log('info', self.config.label +" Type is "+ this.modelname)
					self.sendcmd("VEvar")
				}

				if (line.match(/VEvar\d+/)) {
					let commandSetVersion = parseInt(line.match(/VEvar(\d+)/)[1])
					self.log('info', "Command set version of " + self.config.label +" is " + commandSetVersion)
				}

				if (line.match(/#0/)) {
					//There is no parameter readback runnning, it can be started now
				}


				if (line.match(/E\d{2}/)) {
					switch (parseInt(line.match(/E(\d{2})/)[1])) {
						case 10: self.log('error',"Received command name error from "+ self.config.label +": "+ line); break
						case 11: self.log('error',"Received index value out of range error from "+ self.config.label +": "+ line); break
						case 12: self.log('error',"Received index count (too few or too much) error from "+ self.config.label +": "+ line); break
						case 13: self.log('error',"Received value out of range error from "+ self.config.label +": "+ line); break
						default: self.log('error',"Received unspecified error from Midra "+ self.config.label +": "+ line)
					}
				}

			})

		}
	}

	configUpdated(config) {
		const self = this
		if (
			(config.host && config.host !== self.config.host) ||
			(config.variant && config.variant !== self.config.variant)
		) {
			self.log('debug', 'Config updated, destroying and reiniting..')
			self.config = config
			self.destroy()
			self.init(self.config)
		} else {
			self.config = config
			self.init_presets()
		}
	}

	// Return config fields for web config
	getConfigFields() {
		let self = this

		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'IP-Adress of Midra Unit',
				width: 6,
				default: '192.168.2.140',
				regex: Regex.IP,
				tooltip: 'Enter the IP-adress of the Midra unit you want to control. The IP of the unit can be found on the frontpanel LCD.'
			},{
				type: 'dropdown',
				label: 'Variant',
				id: 'variant',
				default: '259',
				choices: [
					{id:'250' , label:"Eikos / EKS-500"},
					{id:'257' , label:"Eikos2"},
					{id:'258' , label:"Saphyr"},
					{id:'282' , label:"Saphyr - H"},
					{id:'259' , label:"Pulse2"},
					{id:'283' , label:"Pulse2 - H"},
					{id:'260' , label:"SmartMatriX2"},
					{id:'284' , label:"SmartMatriX2 - H"},
					{id:'261' , label:"QuickMatriX"},
					{id:'285' , label:"QuickMatriX - H"},
					{id:'262' , label:"QuickVu"}
				]
			}
		]
	}

	// When module gets deleted
	destroy() {
		let self = this

		if (self.socket !== undefined) {
			self.socket.destroy()
		}

		self.log('debug', "destroy " + self.id);
	}

	getLayerKey(screen, pvwpgm, layer) {
		return `${screen}:${pvwpgm}:${layer}`
	}

	getMemoryKey(screen, pvwpgm) {
		return `${screen}:${pvwpgm}`
	}

	trackLayerInput(screen, pvwpgm, layer, input) {
		this.trackedState.layerInputs[this.getLayerKey(screen, pvwpgm, layer)] = String(input)
		this.checkFeedbacks('layer_input')
	}

	trackMemory(screen, pvwpgm, memory) {
		this.trackedState.memories[this.getMemoryKey(screen, pvwpgm)] = String(memory)
		this.checkFeedbacks('memory_loaded')
	}

	trackFreeze(screen, value) {
		this.trackedState.freezeScreens[String(screen)] = String(value)
		this.checkFeedbacks('screen_freeze')
	}

	trackFreezeAll(value) {
		this.trackedState.freezeAll = String(value)
		this.checkFeedbacks('all_screens_freeze')
	}

	trackQuickFrame(screen, value) {
		this.trackedState.quickFrameScreens[String(screen)] = String(value)
		this.checkFeedbacks('quick_frame_screen')
	}

	trackQuickFrameAll(value) {
		this.trackedState.quickFrameAll = String(value)
		this.checkFeedbacks('quick_frame_all')
	}

	init_feedbacks() {
		let self = this

		self.setFeedbackDefinitions({
			layer_input: {
				type: 'boolean',
				name: 'Layer input matches last Companion selection',
				description: 'Changes button style when Companion last selected the configured input for a layer',
				defaultStyle: {
					bgcolor: COLORS.green,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Screen',
						id: 'screen',
						default: '0',
						choices: MIDRA_SCREEN_CHOICES,
					},
					{
						type: 'dropdown',
						label: 'Preview/Program',
						id: 'pvwpgm',
						default: '1',
						choices: [
							{ id: '1', label: 'Preview' },
							{ id: '0', label: 'Program' },
						],
					},
					{
						type: 'dropdown',
						label: 'Layer',
						id: 'layer',
						default: '0',
						choices: MIDRA_LAYER_CHOICES.concat(EKS_LAYER_CHOICES, EKS_FRAME_LAYER_CHOICES),
					},
					{
						type: 'textinput',
						label: 'Input',
						id: 'input',
						default: '1',
					},
				],
				callback: (feedback) => {
					const key = self.getLayerKey(feedback.options.screen, feedback.options.pvwpgm, feedback.options.layer)
					return self.trackedState.layerInputs[key] === String(feedback.options.input)
				},
			},
			memory_loaded: {
				type: 'boolean',
				name: 'Memory matches last Companion recall',
				description: 'Changes button style when Companion last recalled the configured memory',
				defaultStyle: {
					bgcolor: COLORS.purple,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Screen',
						id: 'screen',
						default: '0',
						choices: MIDRA_SCREEN_CHOICES,
					},
					{
						type: 'dropdown',
						label: 'Preview/Program',
						id: 'pvwpgm',
						default: '1',
						choices: [
							{ id: '1', label: 'Preview' },
							{ id: '0', label: 'Program' },
						],
					},
					{
						type: 'textinput',
						label: 'Memory',
						id: 'memory',
						default: '1',
					},
				],
				callback: (feedback) => {
					const key = self.getMemoryKey(feedback.options.screen, feedback.options.pvwpgm)
					return self.trackedState.memories[key] === String(feedback.options.memory)
				},
			},
			screen_freeze: {
				type: 'boolean',
				name: 'Screen freeze matches last Companion state',
				defaultStyle: {
					bgcolor: COLORS.red,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Screen',
						id: 'screen',
						default: '0',
						choices: MIDRA_SCREEN_CHOICES,
					},
					{
						type: 'dropdown',
						label: 'Status',
						id: 'value',
						default: '1',
						choices: [
							{ id: '0', label: 'Unfrozen' },
							{ id: '1', label: 'Frozen' },
						],
					},
				],
				callback: (feedback) => self.trackedState.freezeScreens[String(feedback.options.screen)] === String(feedback.options.value),
			},
			all_screens_freeze: {
				type: 'boolean',
				name: 'All screens freeze matches last Companion state',
				defaultStyle: {
					bgcolor: COLORS.red,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Status',
						id: 'value',
						default: '1',
						choices: [
							{ id: '0', label: 'Unfrozen' },
							{ id: '1', label: 'Frozen' },
						],
					},
				],
				callback: (feedback) => self.trackedState.freezeAll === String(feedback.options.value),
			},
			quick_frame_screen: {
				type: 'boolean',
				name: 'Screen quick frame matches last Companion state',
				defaultStyle: {
					bgcolor: COLORS.amber,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Screen',
						id: 'screen',
						default: '0',
						choices: MIDRA_SCREEN_CHOICES,
					},
					{
						type: 'dropdown',
						label: 'Status',
						id: 'value',
						default: '1',
						choices: [
							{ id: '0', label: 'Off' },
							{ id: '1', label: 'On' },
						],
					},
				],
				callback: (feedback) => self.trackedState.quickFrameScreens[String(feedback.options.screen)] === String(feedback.options.value),
			},
			quick_frame_all: {
				type: 'boolean',
				name: 'All screens quick frame matches last Companion state',
				defaultStyle: {
					bgcolor: COLORS.amber,
					color: COLORS.white,
				},
				options: [
					{
						type: 'dropdown',
						label: 'Status',
						id: 'value',
						default: '1',
						choices: [
							{ id: '0', label: 'Off' },
							{ id: '1', label: 'On' },
						],
					},
				],
				callback: (feedback) => self.trackedState.quickFrameAll === String(feedback.options.value),
			},
		})
	}

	init_actions() {
		let self = this

		const actionCallback = (action) => {
			let self = this
			let cmd = ''
	
			if (action.options) {
				for (let i = 0; i<= 5; i++) {
					if (action.options.hasOwnProperty(i) && action.options[i] != '') {
						cmd += action.options[i] + ','
					}
				}
				if (action.options.hasOwnProperty('value') && action.options['value'] != '') {
					cmd += action.options['value']
				}
			}
			cmd += action.actionId
	
			self.sendcmd(cmd)
			switch (action.actionId) {
				case 'GCfsc':
					self.trackFreeze(action.options[0], action.options.value)
					break
				case 'GCfra':
					self.trackFreezeAll(action.options.value)
					break
				case 'CTqfa':
					self.trackQuickFrame(action.options[0], action.options.value)
					break
				case 'CTqfl':
					self.trackQuickFrameAll(action.options.value)
					break
			}
		}
	
		self.setActionDefinitions({
					/*
						Note: For self generating commands use option ids 0,1,...,5 and 'value'.
						The command will be of the form [valueof0],[valueof1],...[valueof5],[valueofvalue][CommandID]
						for set-commands you need a value, for get-commands you mustn't have a value
						for simple commands the value can be hardcoded in the CommandID, like "1SPtsl".
					*/
			'1GCtal': {
				name: 'Take all',
				options: [],
				callback: actionCallback
			},
			'takescreen': {
				name: 'Take single screen',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: (action) => {
					const cmd = '' + action.options.screen + ',1GCtak'
					self.sendcmd(cmd)
				}
			},
			'loadpreset': {
				name: 'Load Memory',
				options: [{
					type: 'textinput',
					label: 'Memory to load',
					id: 'memory',
					default: '1',
					tooltip: 'Enter the number of the memory you want to load from 1 to 8',
					regex: '/^0*[1-8]$/'
				},{
					type: 'dropdown',
					label: 'Screen to load to',
					id: 'destscreen',
					default: '0',
					tooltip: 'Select the screen where you want the memory to be recalled to.',
					choices: [ { id: '0', label: 'S1' }, { id: '1', label: 'S2' }]
				},{
					type: 'dropdown',
					label: 'PGM/PVW',
					id: 'pvwpgm',
					default: '1',
					tooltip: 'Select wether the memory schould be loaded into the preview or program of the screen',
					choices: [ { id: '0', label: 'Program' }, { id: '1', label: 'Preview' }]
				},{
					type: 'dropdown',
					label: 'Screen to load from',
					id: 'sourcescreen',
					default: '0',
					tooltip: 'Select the screen where the memory to be recalled has been saved.',
					choices: [ { id: '0', label: 'S1' }, { id: '1', label: 'S2' }]
				},{
					type: 'dropdown',
					label: 'Scale enable',
					id: 'filter1',
					default: '0',
					tooltip: 'Select wether the layers in the memory should be scaled according to the size of the screen if it is different from the size of the screens which the memory has been saved from.',
					choices: [ { id: '0', label: 'Enable scale' }, { id: '1', label: 'Do not scale' }]
				},{
					type: 'dropdown',
					label: 'Filter Source',
					id: 'filter2',
					default: '0',
					tooltip: 'Select wether the layer source should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Source' }, { id: '1', label: 'Exclude Source' }]
				},{
					type: 'dropdown',
					label: 'Filter Position and Size',
					id: 'filter4',
					default: '0',
					tooltip: 'Select wether the layer position and size should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Pos/Size' }, { id: '1', label: 'Exclude Pos/Size' }]
				},{
					type: 'dropdown',
					label: 'Filter Trancparency',
					id: 'filter8',
					default: '0',
					tooltip: 'Select wether the layer transparency should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Transparency' }, { id: '1', label: 'Exclude Transparency' }]
				},{
					type: 'dropdown',
					label: 'Filter Cropping',
					id: 'filter16',
					default: '0',
					tooltip: 'Select wether the layer cropping should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Cropping' }, { id: '1', label: 'Exclude Cropping' }]
				},{
					type: 'dropdown',
					label: 'Filter Border',
					id: 'filter32',
					default: '0',
					tooltip: 'Select wether the layer border should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Border' }, { id: '1', label: 'Exclude Border' }]
				},{
					type: 'dropdown',
					label: 'Filter Transition',
					id: 'filter64',
					default: '0',
					tooltip: 'Select wether the layer transition should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Transition' }, { id: '1', label: 'Exclude Transition' }]
				},{
					type: 'dropdown',
					label: 'Filter Timing',
					id: 'filter128',
					default: '0',
					tooltip: 'Select wether the layer timing should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Timing' }, { id: '1', label: 'Exclude Timing' }]
				},{
					type: 'dropdown',
					label: 'Filter Effects',
					id: 'filter256',
					default: '0',
					tooltip: 'Select wether the layer effects should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Effects' }, { id: '1', label: 'Exclude Effects' }]
				},{
					type: 'dropdown',
					label: 'Filter Audio',
					id: 'filter512',
					default: '0',
					tooltip: 'Select wether the audio layer should be included in the memory recall.',
					choices: [ { id: '0', label: 'Include Audio' }, { id: '1', label: 'Exclude Audio' }]
				}],
				callback: (action) => {
					let cmd = ''
					if (action.options.sourcescreen == '0') {
						cmd = '0,'
					} else {
						cmd = '1,'
					}
		
					cmd += '' + (parseInt(action.options.memory)-1) + ','
		
					if (action.options.destscreen == '0') {
						cmd += '0,'
					} else {
						cmd += '1,'
					}
		
					if (action.options.pvwpgm == '0') {
						cmd += '0,'
					} else {
						cmd += '1,'
					}
		
					let filterval = 0
					if (action.options.filter1 == '1') filterval += 1
					if (action.options.filter2 == '1') filterval += 2
					if (action.options.filter4 == '1') filterval += 4
					if (action.options.filter8 == '1') filterval += 8
					if (action.options.filter16 == '1') filterval += 16
					if (action.options.filter32 == '1') filterval += 32
					if (action.options.filter64 == '1') filterval += 64
					if (action.options.filter128 == '1') filterval += 128
					if (action.options.filter256 == '1') filterval += 256
					if (action.options.filter512 == '1') filterval += 512
		
					cmd += filterval + ',1GClrq'

					self.sendcmd(cmd)
					self.trackMemory(action.options.destscreen, action.options.pvwpgm, action.options.memory)
				}
			},
			'switchlayerinput': {
				name: 'Switch Layer Input',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: 'screen',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Preview/Program',
					id: 'pvwpgm',
					default: '1',
					choices: [
						{ id: '1', label: 'Preview' },
						{ id: '0', label: 'Program' }
					]
				},{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				},{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: '0',
					tooltip: "Choose the Input for background, PiPs and audio or choose the frame number for logo layers.",
					choices: [
						{ id: '0', label: 'No Input' },
						{ id: '1', label: 'In/Frame 1' },
						{ id: '2', label: 'In/Frame 2' },
						{ id: '3', label: 'In/Frame 3' },
						{ id: '4', label: 'In/Frame 4' },
						{ id: '5', label: 'In/Frame 5' },
						{ id: '6', label: 'In/Frame 6' },
						{ id: '7', label: 'In/Frame 7' },
						{ id: '8', label: 'In/Frame 8' },
						{ id: '9', label: 'In/Frame 9' },
						{ id: '10', label: 'In/Frame 10' },
						{ id: '11', label: 'Matte' }
					]
				}],
				callback: (action) => {
					const cmd = action.options.screen + ','
						+ action.options.pvwpgm + ','
						+ action.options.layer + ','
						+ action.options.input + 'PRinp\n'
						+ action.options.screen + ',1PUscu'
					self.sendcmd(cmd)
					self.trackLayerInput(action.options.screen, action.options.pvwpgm, action.options.layer, action.options.input)
				}
			},
			'eks_take': {
				name: 'Eikos/EKS-500: Take',
				options: [],
				callback: () => {
					self.sendcmd('1TK\r\n1TK')
				}
			},
			'eks_switch_layer_input': {
				name: 'Eikos/EKS-500: Switch live layer input',
				options: [{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: '2',
					choices: EKS_LAYER_CHOICES
				},{
					type: 'dropdown',
					label: 'Input',
					id: 'input',
					default: '1',
					choices: EKS_INPUT_CHOICES
				}],
				callback: (action) => {
					const cmd = `1,${action.options.layer},${action.options.input}IN\r\n1,${action.options.layer},${action.options.input}IN`
					self.sendcmd(cmd)
					self.trackLayerInput('0', '1', action.options.layer, action.options.input)
				}
			},
			'eks_switch_frame_logo': {
				name: 'Eikos/EKS-500: Switch background frame or logo',
				options: [{
					type: 'dropdown',
					label: 'Layer',
					id: 'layer',
					default: '0',
					choices: EKS_FRAME_LAYER_CHOICES
				},{
					type: 'dropdown',
					label: 'Frame/Logo',
					id: 'frame',
					default: '0',
					choices: EKS_FRAME_CHOICES
				}],
				callback: (action) => {
					const cmd = `1,${action.options.layer},${action.options.frame}IN\r\n1,${action.options.layer},${action.options.frame}IN`
					self.sendcmd(cmd)
					self.trackLayerInput('0', '1', action.options.layer, action.options.frame)
				}
			},
			'eks_load_preset': {
				name: 'Eikos/EKS-500: Load user preset',
				options: [{
					type: 'dropdown',
					label: 'Preset',
					id: 'preset',
					default: '3',
					choices: [
						{ id: '3', label: 'Preset 1' },
						{ id: '4', label: 'Preset 2' },
						{ id: '5', label: 'Preset 3' },
						{ id: '6', label: 'Preset 4' },
						{ id: '7', label: 'Preset 5' },
						{ id: '8', label: 'Preset 6' },
						{ id: '9', label: 'Preset 7' },
						{ id: '10', label: 'Preset 8' },
					]
				}],
				callback: (action) => {
					const cmd = `${action.options.preset}Nf\r\n1Nt1Nc\r\n${action.options.preset}Nf\r\n1Nt1Nc`
					self.sendcmd(cmd)
					self.trackMemory('0', '1', parseInt(action.options.preset) - 2)
				}
			},
			'1GCsba': {
				name: 'Reload last Preset',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: actionCallback
			},
			'1GCrpr': {
				name: 'Reload Program to Preview',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				}],
				callback: actionCallback
			},
			'GCfsc': {
				name: 'Freeze Screen (all layers)',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'GCfra': {
				name: 'Freeze all screens (all layers)',
				options: [{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'INfrz': {
				name: 'Freeze Input',
				options: [{
					type: 'dropdown',
					label: 'Input',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: '1' },
						{ id: '1', label: '2' },
						{ id: '2', label: '3' },
						{ id: '3', label: '4' },
						{ id: '4', label: '5' },
						{ id: '5', label: '6' },
						{ id: '6', label: '7' },
						{ id: '7', label: '8' },
						{ id: '8', label: '9' },
						{ id: '9', label: '10' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'GCfrl': {
				name: 'Freeze Layer',
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Layer',
					id: '1',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Unfrozen' },
						{ id: '1', label: 'Frozen' }
					]
				}],
				callback: actionCallback
			},
			'INplg': {
				name: 'Switch Input Plug',
				options: [{
					type: 'dropdown',
					label: 'Input',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: '1' },
						{ id: '1', label: '2' },
						{ id: '2', label: '3' },
						{ id: '3', label: '4' },
						{ id: '4', label: '5' },
						{ id: '5', label: '6' },
						{ id: '6', label: '7' },
						{ id: '7', label: '8' },
						{ id: '8', label: '9' },
						{ id: '9', label: '10' }
					]
				},{
					type: 'dropdown',
					label: 'Plug',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Analog (HD-15)' },
						{ id: '1', label: 'DVI' },
						{ id: '2', label: 'SDI' },
						{ id: '3', label: 'HDMI' },
						{ id: '4', label: 'HDBaseT' }
					]
				}],
				callback: actionCallback
			},
			'CTqfa': {
				name: 'Quick Frame single screen',
				tooltip: "This command doesn't sync with Quick frame for all screens!",
				options: [{
					type: 'dropdown',
					label: 'Screen',
					id: '0',
					default: '0',
					choices: [
						{ id: '0', label: 'S1' },
						{ id: '1', label: 'S2' }
					]
				},{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Quick Frame Off' },
						{ id: '1', label: 'Quick Frame On' }
					]
				}],
				callback: actionCallback
			},
			'CTqfl': {
				name: 'Quick Frame all screens',
				tooltip: "This command doesn't sync with Quick frame for a single screen!",
				options: [{
					type: 'dropdown',
					label: 'Status',
					id: 'value',
					default: '0',
					choices: [
						{ id: '0', label: 'Quick Frame Off' },
						{ id: '1', label: 'Quick Frame On' }
					]
				}],
				callback: actionCallback
			},
			'GCply': {
				name: 'Preview Layer',
				tooltip: 'Midra devices can only show one layer with the correct source. Here you can select which one.',
				options: [{
					type: 'dropdown',
					label: 'Layer',
					id: 'value',
					default: '1',
					choices: [
						{ id: '0', label: 'Background' },
						{ id: '1', label: 'PiP Layer 1' },
						{ id: '2', label: 'PiP Layer 2' },
						{ id: '3', label: 'PiP Layer 3' },
						{ id: '4', label: 'PiP Layer 4' },
						{ id: '5', label: 'Logo Layer 1' },
						{ id: '6', label: 'Logo Layer 2' },
						{ id: '7', label: 'Audio Layer' }
					]
				}],
				callback: actionCallback
			}
		})
	}

	makeButtonPreset(category, name, text, bgcolor, actionId, options, feedbacks = []) {
		return {
			type: 'button',
			category,
			name,
			style: {
				text,
				size: 'auto',
				color: COLORS.white,
				bgcolor,
			},
			steps: [
				{
					down: [
						{
							actionId,
							options,
						},
					],
					up: [],
				},
			],
			feedbacks,
		}
	}

	getPresetId(category, name, index) {
		const id = `${category}_${name}`
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_+|_+$/g, '')
		return `${id}_${index}`
	}

	init_presets() {
		const presets = []
		const isEikos = String(this.config?.variant) === '250'
		const addTakePresets = () => {
			if (isEikos) {
				presets.push(this.makeButtonPreset('Program', 'Eikos Take', 'TAKE', COLORS.green, 'eks_take', {}))
				return
			}

			presets.push(this.makeButtonPreset('Program', 'Take All', 'TAKE\\nALL', COLORS.green, '1GCtal', {}))
			for (const screen of MIDRA_SCREEN_CHOICES) {
				presets.push(this.makeButtonPreset('Program', `Take ${screen.label}`, `TAKE\\n${screen.label}`, COLORS.green, 'takescreen', {
					screen: screen.id,
				}))
			}
		}

		const addMidraMemoryPresets = () => {
			for (const screen of MIDRA_SCREEN_CHOICES) {
				for (let memory = 1; memory <= 8; memory++) {
					presets.push(this.makeButtonPreset('Memories', `${screen.label} Preview Memory ${memory}`, `${screen.label}\\nMEM ${memory}\\nPVW`, COLORS.purple, 'loadpreset', {
						memory: String(memory),
						destscreen: screen.id,
						pvwpgm: '1',
						sourcescreen: screen.id,
						filter1: '0',
						filter2: '0',
						filter4: '0',
						filter8: '0',
						filter16: '0',
						filter32: '0',
						filter64: '0',
						filter128: '0',
						filter256: '0',
						filter512: '0',
					}, [
						{
							feedbackId: 'memory_loaded',
							options: {
								screen: screen.id,
								pvwpgm: '1',
								memory: String(memory),
							},
						},
					]))
				}
			}
		}

		const addMidraLayerPresets = () => {
			for (const screen of MIDRA_SCREEN_CHOICES) {
				for (const layer of MIDRA_LAYER_CHOICES.slice(0, 5)) {
					for (const input of MIDRA_INPUT_CHOICES.slice(0, 11)) {
						presets.push(this.makeButtonPreset('Preview Inputs', `${screen.label} ${layer.label} ${input.label}`, `${screen.label}\\n${layer.label.replace(' Layer ', ' ')}\\n${input.label.replace('Input/Frame ', 'In ')}`, COLORS.blue, 'switchlayerinput', {
							screen: screen.id,
							pvwpgm: '1',
							layer: layer.id,
							input: input.id,
						}, [
							{
								feedbackId: 'layer_input',
								options: {
									screen: screen.id,
									pvwpgm: '1',
									layer: layer.id,
									input: input.id,
								},
							},
						]))
					}
				}
			}
		}

		const addMidraUtilityPresets = () => {
			presets.push(this.makeButtonPreset('Utilities', 'Freeze All Screens', 'FREEZE\\nALL', COLORS.red, 'GCfra', {
				value: '1',
			}, [
				{
					feedbackId: 'all_screens_freeze',
					options: {
						value: '1',
					},
				},
			]))
			presets.push(this.makeButtonPreset('Utilities', 'Unfreeze All Screens', 'UNFREEZE\\nALL', COLORS.darkBlue, 'GCfra', {
				value: '0',
			}, [
				{
					feedbackId: 'all_screens_freeze',
					options: {
						value: '0',
					},
				},
			]))

			for (const screen of MIDRA_SCREEN_CHOICES) {
				presets.push(this.makeButtonPreset('Utilities', `Quick Frame ${screen.label}`, `${screen.label}\\nQUICK\\nFRAME`, COLORS.amber, 'CTqfa', {
					0: screen.id,
					value: '1',
				}, [
					{
						feedbackId: 'quick_frame_screen',
						options: {
							screen: screen.id,
							value: '1',
						},
					},
				]))
				presets.push(this.makeButtonPreset('Utilities', `Freeze ${screen.label}`, `${screen.label}\\nFREEZE`, COLORS.red, 'GCfsc', {
					0: screen.id,
					value: '1',
				}, [
					{
						feedbackId: 'screen_freeze',
						options: {
							screen: screen.id,
							value: '1',
						},
					},
				]))
			}
		}

		const addEikosPresets = () => {
			for (const layer of EKS_LAYER_CHOICES) {
				for (const input of EKS_INPUT_CHOICES) {
					presets.push(this.makeButtonPreset('Eikos Inputs', `${layer.label} ${input.label}`, `${layer.label}\\n${input.label}`, COLORS.blue, 'eks_switch_layer_input', {
						layer: layer.id,
						input: input.id,
					}, [
						{
							feedbackId: 'layer_input',
							options: {
								screen: '0',
								pvwpgm: '1',
								layer: layer.id,
								input: input.id,
							},
						},
					]))
				}
			}

			for (const layer of EKS_FRAME_LAYER_CHOICES) {
				for (const frame of EKS_FRAME_CHOICES) {
					presets.push(this.makeButtonPreset('Eikos Frames and Logos', `${layer.label} ${frame.label}`, `${layer.label}\\n${frame.label}`, COLORS.amber, 'eks_switch_frame_logo', {
						layer: layer.id,
						frame: frame.id,
					}, [
						{
							feedbackId: 'layer_input',
							options: {
								screen: '0',
								pvwpgm: '1',
								layer: layer.id,
								input: frame.id,
							},
						},
					]))
				}
			}

			for (let memory = 1; memory <= 8; memory++) {
				presets.push(this.makeButtonPreset('Eikos Memories', `Eikos User Preset ${memory}`, `USER\\nPRESET\\n${memory}`, COLORS.purple, 'eks_load_preset', {
					preset: String(memory + 2),
				}, [
					{
						feedbackId: 'memory_loaded',
						options: {
							screen: '0',
							pvwpgm: '1',
							memory: String(memory),
						},
					},
				]))
			}
		}

		addTakePresets()
		if (isEikos) {
			addEikosPresets()
		} else {
			addMidraMemoryPresets()
			addMidraLayerPresets()
			addMidraUtilityPresets()
		}

		this.setPresetDefinitions(Object.fromEntries(presets.map((preset, index) => [this.getPresetId(preset.category, preset.name, index), preset])))
	}

	sendcmd(cmd) {
		let self = this

		if (cmd !== undefined) {

			if (self.socket === undefined) {
				self.init_tcp()
			}

			self.log('debug', 'sending tcp ' + cmd + " to " + self.config.host)

			if (self.socket !== undefined && self.socket.isConnected) {
				self.socket.send(cmd)
			} else {
				self.log('debug', 'Socket not connected :(')
			}

		}
	}
}

runEntrypoint(MidraInstance, [])
