import { AnimationStateConfig } from "@/classes/AnimationController"
import Tile from "../../Tile"
import TileState from "../TileState"
import { GRID_CONFIG } from "@/constants/const"
import SecondOrderDynamics from "@/classes/SecondOrderDynamics"

import Vector2 = Phaser.Math.Vector2

export default class FocusState extends TileState {
    private tweener: Phaser.Tweens.Tween
    private secondOrderTweener: SecondOrderDynamics
    private targetPos: Vector2
    private maxTargetReachedTime: number
    private tweenedYDistance: number

    private ogScale: number
    private ogHeight: number
    private ogY: number

    constructor(tile: Tile, config?: Omit<AnimationStateConfig, "name">) {
        super(tile, {
            ...config,
            name: "focus",
            onEnter: (state) => {
                tile.tileEvents.emit('focus:start')
                config?.onEnter?.(state)
            },
            onExit: (state) => {
                tile.tileEvents.emit('focus:stop')
                config?.onExit?.(state)
            },
            exitCondition: () => (config?.exitCondition?.() ?? true)
        })

        this.targetPos = new Vector2(tile.x, tile.y)
        this.maxTargetReachedTime = 0
        this.tweenedYDistance = 0
        this.secondOrderTweener = new SecondOrderDynamics(this.targetPos, {
            responseRate: 0.002,
            dampening: 0.5,
            eagerness: 2,
        })

        this.ogScale = this.tile.scale
        this.ogHeight = GRID_CONFIG.tileHeight
        this.ogY = this.tile.y

        this.tweener = this.scene.tweens.addCounter({
            duration: 200,
            repeat: -1,
            yoyo: true,
            paused: true,
            onUpdate: (tween) => {
                const value = tween.getValue()

                const scaleChangeX = Phaser.Math.Easing.Linear(value) * this.ogScale * 0.2
                const scaleChangeY = Phaser.Math.Easing.Linear(value) * this.ogScale * 0.15
                const tileChangeY = Phaser.Math.Easing.Cubic.InOut((value + 2) % 2) * this.ogHeight * 0.3

                this.tile.scaleX = this.ogScale - scaleChangeX
                this.tile.scaleY = this.ogScale + scaleChangeY

                this.tweenedYDistance = tileChangeY
            },
            onPause: () => {
                this.tile.scale = this.ogScale
                this.tweenedYDistance = this.ogY
            }
        })
    }

    enter(): void {
        super.enter()

        this.maxTargetReachedTime = 0
        this.tweenedYDistance = 0
        this.targetPos.set(this.tile.x, this.tile.y)
        this.secondOrderTweener.reset(this.targetPos.clone())

        this.ogScale = this.tile.scale
        this.ogHeight = GRID_CONFIG.tileHeight
        this.ogY = this.tile.y
        
        this.tweener.restart()
    }

    update(time: number, delta: number): void {
        super.update(time, delta)

        this.targetPos.set(
            this.tile.gridCoords.y * GRID_CONFIG.tileWidth + GRID_CONFIG.padding + GRID_CONFIG.tileWidth / 2,
            this.tile.gridCoords.x * GRID_CONFIG.tileHeight + GRID_CONFIG.padding + GRID_CONFIG.tileHeight / 2
        )

        const newPos = this.secondOrderTweener.update(delta, this.targetPos)
        this.tile.setPosition(
            newPos.x,
            newPos.y > this.targetPos.y ? this.targetPos.y - (newPos.y - this.targetPos.y) - this.tweenedYDistance : newPos.y - this.tweenedYDistance
        )

        // check if target reached
        if (this.targetPos.distance(this.tile) < 1) {
            this.maxTargetReachedTime += delta
        }
    }

    exit(): void {
        super.exit()
        this.tweener.pause()

        this.tile.scale = this.ogScale
        this.tile.y = this.targetPos.y
    }
}