import SecondOrderDynamics, { DynamicConfig } from "@/classes/SecondOrderDynamics"
import Vector2 = Phaser.Math.Vector2

const DEFAULT_CONFIG: DynamicConfig = {
    responseRate: 0.001,
    dampening: 0.5,
    eagerness: 1,
} as const

export default class TweenScene extends Phaser.Scene {
    private targetHandle!: Phaser.GameObjects.Ellipse
    private followHandle!: Phaser.GameObjects.Ellipse
    private line!: Phaser.GameObjects.Line

    private targetPosition!: Vector2
    private tweener!: SecondOrderDynamics
    private config!: DynamicConfig

    constructor() {
        super('TweenScene')
    }

    preload() {
        this.load.html('tweenform', './assets/dom/tweenform.html')
    }

    create() {
        // create draggable start and end handle
        this.targetHandle = this.add.ellipse(this.cameras.main.centerX, this.cameras.main.centerY, 50, 50, 0x000000, 0).setStrokeStyle(1, 0x000000).setInteractive()
        this.followHandle = this.add.ellipse(this.cameras.main.centerX, this.cameras.main.centerY, 40, 40, 0x000000)
        this.targetPosition = new Vector2(this.targetHandle.x, this.targetHandle.y)
        
        // create tweener
        this.config = {...DEFAULT_CONFIG}
        this.tweener = new SecondOrderDynamics(this.targetPosition, this.config)

        // make start and end handle draggable
        this.input.setDraggable(this.targetHandle)

        // add drag event listeners
        this.input.on('drag', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Ellipse, dragX: number, dragY: number) => {
            gameObject.x = dragX
            gameObject.y = dragY
        })

        // create line
        this.line = this.add.line(0, 0, 0, 0, 0, 0).setStrokeStyle(1, 0x000000)

        this.createForm()
    }

    update(time: number, delta: number) {
        // update target position
        this.targetPosition.set(this.targetHandle.x, this.targetHandle.y)
        
        // update tweener
        const newPos = this.tweener.update(delta, this.targetPosition)
        
        // update follow handle
        this.followHandle.setPosition(newPos.x, newPos.y)
        
        // update line
        this.line.setTo(this.targetHandle.x, this.targetHandle.y, this.followHandle.x, this.followHandle.y)
    }

    private createForm() {
        // create form
        const form = this.add.dom(10, 10).createFromCache('tweenform').setOrigin(0)

        // preset form values
        const responseElement = form.getChildByName('responseRate') as HTMLInputElement
        const dampeningElement = form.getChildByName('dampening') as HTMLInputElement
        const eagernessElement = form.getChildByName('eagerness') as HTMLInputElement
        const resetButton = form.getChildByName('reset') as HTMLInputElement

        if (!responseElement || !dampeningElement || !eagernessElement || !resetButton) throw new Error('Could not find form elements')

        responseElement.value = this.config.responseRate.toString()
        dampeningElement.value = this.config.dampening.toString()
        eagernessElement.value = this.config.eagerness.toString()

        responseElement.addEventListener('change', (event: Event) => {
            if (!(event.target instanceof HTMLInputElement)) return
            const value = parseFloat(event.target.value)
            this.config.responseRate = value

            if (Number.isNaN(value)) {
                this.config.responseRate = DEFAULT_CONFIG.responseRate
            }

            responseElement.value = this.config.responseRate.toString()
            this.tweener.setDynamics(this.config)
        })

        dampeningElement.addEventListener('change', (event: Event) => {
            if (!(event.target instanceof HTMLInputElement)) return
            const value = parseFloat(event.target.value)
            this.config.dampening = value

            if (Number.isNaN(value)) {
                this.config.dampening = DEFAULT_CONFIG.dampening
            }

            dampeningElement.value = this.config.dampening.toString()
            this.tweener.setDynamics(this.config)
        })

        eagernessElement.addEventListener('change', (event: Event) => {
            if (!(event.target instanceof HTMLInputElement)) return
            const value = parseFloat(event.target.value)
            this.config.eagerness = value

            if (Number.isNaN(value)) {
                this.config.eagerness = DEFAULT_CONFIG.eagerness
            }

            eagernessElement.value = this.config.eagerness.toString()
            this.tweener.setDynamics(this.config)
        })

        resetButton.addEventListener('click', () => {
            this.targetHandle.setPosition(this.cameras.main.centerX, this.cameras.main.centerY)
            this.followHandle.setPosition(this.cameras.main.centerX, this.cameras.main.centerY)
            this.targetPosition.set(this.targetHandle.x, this.targetHandle.y)

            // reset element
            responseElement.value = DEFAULT_CONFIG.responseRate.toString()
            dampeningElement.value = DEFAULT_CONFIG.dampening.toString()
            eagernessElement.value = DEFAULT_CONFIG.eagerness.toString()

            this.config = DEFAULT_CONFIG

            this.tweener.setDynamics(this.config)
        })
    }
}