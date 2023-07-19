import Tile from '@/objects/tile/Tile'
import TileState from '../TileState'
import { GRID_CONFIG } from '@/constants/const'
import { AnimationStateConfig } from '@/classes/AnimationController'
import SecondOrderDynamics from '@/classes/SecondOrderDynamics'

import Vector2 = Phaser.Math.Vector2

export default class FallState extends TileState {
    private tweener: SecondOrderDynamics
    private targetPos: Vector2
    private maxTargetReachedTime: number

    constructor(tile: Tile, config?: Omit<AnimationStateConfig, 'name'>) {
        super(tile, {
            ...config,
            name: 'fall',
            onEnter: (state) => {
                config?.onEnter?.(state)
                tile.tileEvents.emit('fall:start')
            },
            onExit: (state) => {
                config?.onExit?.(state)
                tile.tileEvents.emit('fall:stop')
            },
            exitCondition: () =>
                this.maxTargetReachedTime > 100 && (config?.exitCondition?.() ?? true),
        })

        this.targetPos = new Vector2(tile.x, tile.y)

        this.tweener = new SecondOrderDynamics(this.targetPos, {
            responseRate: 0.002,
            dampening: 0.5,
            eagerness: 2,
        })

        this.maxTargetReachedTime = 0
    }

    enter(): void {
        super.enter()
        this.maxTargetReachedTime = 0
        this.targetPos.set(this.tile.x, this.tile.y)
        this.tweener.reset(this.targetPos.clone())
    }

    update(time: number, delta: number): void {
        super.update(time, delta)

        this.targetPos.set(
            this.tile.gridCoords.y * GRID_CONFIG.tileWidth +
                GRID_CONFIG.padding +
                GRID_CONFIG.tileWidth / 2,
            this.tile.gridCoords.x * GRID_CONFIG.tileHeight +
                GRID_CONFIG.padding +
                GRID_CONFIG.tileHeight / 2
        )

        const newPos = this.tweener.update(delta, this.targetPos)
        this.tile.setPosition(
            newPos.x,
            newPos.y > this.targetPos.y
                ? this.targetPos.y - (newPos.y - this.targetPos.y)
                : newPos.y
        )

        // check if target reached
        if (this.targetPos.distance(this.tile) < 1) {
            this.maxTargetReachedTime += delta
        }
    }

    suspense(): void {
        this.maxTargetReachedTime = 0
    }
}
