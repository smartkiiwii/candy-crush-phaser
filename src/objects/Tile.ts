import SecondOrderDynamics from '@/classes/SecondOrderDynamics'
import StateMachine, { StateMachineEvents } from '@/classes/StateMachine'
import { IImageConstructor } from '@/interfaces/image.interface'

const TileState = {
    IDLE: 'IDLE',
    FOCUSED: 'FOCUSED',
    CLEARED: 'CLEARED',
} as const

const SpecialTileType = {
    NONE: 'NONE',
    BOMB: 'BOMB',
    SEEKING_BOMB: 'SEEKING_BOMB',
} as const

export type TileState = (typeof TileState)[keyof typeof TileState]
export type SpecialTileType = (typeof SpecialTileType)[keyof typeof SpecialTileType]

export class Tile extends Phaser.GameObjects.Image {
    public gridX: number
    public gridY: number

    private tweener: SecondOrderDynamics
    private targetPosition: Phaser.Math.Vector2

    private isLiveTweening: boolean
    private canBounce: boolean

    private focusTweener: Phaser.Tweens.Tween | undefined
    private hintTweener: Phaser.Tweens.Tween | undefined
    private idleTweener: Phaser.Tweens.Tween | undefined

    private tileState: StateMachine<TileState>

    constructor(aParams: IImageConstructor) {
        super(aParams.scene, aParams.x, aParams.y, aParams.texture, aParams.frame)

        // set image settings
        this.setInteractive()

        this.scene.add.existing(this)

        this.gridX = aParams.gridX
        this.gridY = aParams.gridY

        this.targetPosition = new Phaser.Math.Vector2(aParams.tweenOriginX, aParams.tweenOriginY)
        this.tweener = new SecondOrderDynamics(this.targetPosition, {
            responseRate: 0.002,
            dampening: 0.5,
            eagerness: 2,
        })

        this.isLiveTweening = true
        this.canBounce = true

        this.tileState = new StateMachine<TileState>(TileState.IDLE)

        this.tileState.onStateChange(
            StateMachineEvents.STATE_ENTER,
            this.handleTileStateEnter,
            this
        )
        this.tileState.onStateChange(StateMachineEvents.STATE_EXIT, this.handleTileStateExit, this)
    }

    preUpdate(time: number, delta: number): void {
        if (this.isLiveTweening) {
            const newPos = this.tweener.update(delta, this.targetPosition)

            this.setPosition(
                newPos.x,
                this.canBounce && newPos.y > this.targetPosition.y
                    ? this.targetPosition.y - (newPos.y - this.targetPosition.y)
                    : newPos.y
            )
        }
    }

    private handleTileStateEnter(state: TileState) {
        switch (state) {
            case TileState.IDLE:
                this.setVisible(true)
                this.isLiveTweening = true
                break

            case TileState.FOCUSED:
                this.isLiveTweening = false
                this.idleTweener?.stop()
                this.hintTweener?.stop()
                this.launchFocusAnimation()
                break

            case TileState.CLEARED:
                this.setVisible(false)
                this.isLiveTweening = true
                break
        }
    }

    private launchFocusAnimation() {
        const originalScale = this.scale

        this.focusTweener = this.scene.tweens.addCounter({
            duration: 250,
            repeat: -1,
            yoyo: true,
            onUpdate: (tween) => {
                const value = tween.getValue()

                this.scaleX = originalScale - Phaser.Math.Easing.Linear(value) * originalScale * 0.2
                this.scaleY =
                    originalScale + Phaser.Math.Easing.Linear(value) * originalScale * 0.15

                this.y =
                    this.targetPosition.y - Phaser.Math.Easing.Cubic.InOut((value + 2) % 2) * 20
            },
            onStop: () => {
                this.resetTweenOrigin(this.x, this.y)
                this.scale = originalScale
            },
        })
    }

    private handleTileStateExit(state: TileState) {
        switch (state) {
            case TileState.IDLE:
                this.idleTweener?.stop()
                this.hintTweener?.stop()
                break

            case TileState.FOCUSED:
                this.focusTweener?.stop()
                break
        }
    }

    public clearTile() {
        this.tileState.transition(TileState.CLEARED)
    }

    public get isCleared(): boolean {
        return this.tileState.getState() === TileState.CLEARED
    }

    public resetTile(aParams: Partial<IImageConstructor>) {
        if (aParams.gridX !== undefined) this.gridX = aParams.gridX
        if (aParams.gridY !== undefined) this.gridY = aParams.gridY

        if (aParams.x !== undefined && aParams.y !== undefined)
            this.setPosition(aParams.x, aParams.y)

        if (aParams.texture !== undefined && aParams.frame !== undefined)
            this.setTexture(aParams.texture, aParams.frame)

        if (aParams.texture !== undefined && aParams.frame === undefined)
            this.setTexture(aParams.texture)

        if (aParams.frame !== undefined) this.setFrame(aParams.frame)

        if (aParams.tweenOriginX !== undefined && aParams.tweenOriginY !== undefined) {
            this.resetTweenOrigin(aParams.tweenOriginX, aParams.tweenOriginY)
        } else {
            this.resetTweenOrigin(this.targetPosition.x, this.targetPosition.y)
        }

        this.tileState.transition(TileState.IDLE)
    }

    public resetTweenOrigin(x: number, y: number) {
        this.tweener.reset(new Phaser.Math.Vector2(x, y))
    }

    public isSameType(tile: Tile) {
        return this.texture.key === tile.texture.key && this.frame.name === tile.frame.name
    }

    public setTargetPosition(x: number, y: number) {
        this.targetPosition.set(x, y)
    }

    public getTargetPosition() {
        return this.targetPosition
    }

    public playLongIdleAnimation(delay: number) {
        if (this.idleTweener?.isPlaying()) {
            return
        }

        const originalScale = this.scale

        // can only play idle in idle state, else ignore
        if (this.tileState.getState() === TileState.IDLE) {
            this.idleTweener = this.scene.tweens.add({
                delay,
                targets: this,
                duration: 200,
                scale: this.scale * 0.8,
                ease: 'Sine.easeInOut',
                yoyo: true,
                onStop: () => {
                    this.scale = originalScale
                },
            })
        }
    }

    public playFocusAnimation() {
        this.tileState.transition(TileState.FOCUSED)
    }

    public stopFocusAnimation() {
        if (this.tileState.getState() !== TileState.FOCUSED) {
            console.warn('Tile is not in focus state')
        }

        this.tileState.transition(TileState.IDLE)
    }

    public playHintAnimation(other: Tile) {
        if (this.hintTweener?.isPlaying()) {
            console.warn('Hint animation is already playing')
        }

        // can only play hint in idle state, else ignore
        if (this.tileState.getState() === TileState.IDLE) {
            const originalTargetPosition = this.targetPosition.clone()
            const originalCanBounce = this.canBounce

            // gently push the tile towards the other tile
            const targetPosition = new Phaser.Math.Vector2(
                this.x + (other.x - this.x) * 0.1,
                this.y + (other.y - this.y) * 0.1
            )

            this.hintTweener = this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                duration: 300,
                yoyo: true,
                repeat: -1,
                onStart: () => {
                    this.canBounce = false
                },
                onUpdate: (tween) => {
                    const value = tween.getValue()

                    if (value > 0.5) {
                        this.setTargetPosition(targetPosition.x, targetPosition.y)
                    } else {
                        this.setTargetPosition(originalTargetPosition.x, originalTargetPosition.y)
                    }
                },
                onStop: () => {
                    this.canBounce = originalCanBounce
                    this.setTargetPosition(originalTargetPosition.x, originalTargetPosition.y)
                },
            })
        }
    }

    public stopHintAnimation() {
        this.hintTweener?.stop()
    }
}
