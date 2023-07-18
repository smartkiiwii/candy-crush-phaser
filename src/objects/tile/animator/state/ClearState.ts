import { AnimationStateConfig } from '@/classes/AnimationController'
import Tile from '../../Tile'
import TileState from '../TileState'

export default class ClearState extends TileState {
    public clearTarget: Tile

    private completed: boolean
    public emitter: Phaser.GameObjects.Particles.ParticleEmitter | null

    constructor(
        tile: Tile,
        emitter: Phaser.GameObjects.Particles.ParticleEmitter | null,
        config?: Omit<AnimationStateConfig, 'name'>
    ) {
        super(tile, {
            ...config,
            name: 'clear',
            exitCondition: () => {
                return this.completed && (config?.exitCondition?.() ?? true)
            },
            onEnter: (state) => {
                config?.onEnter?.(state)
                tile.tileEvents.emit('clear:start')
            },
            onExit: (state) => {
                config?.onExit?.(state)
                tile.setActive(false)
                tile.tileEvents.emit('clear:stop')
            },
        })

        this.clearTarget = tile
        this.completed = false
        this.emitter = emitter
    }

    enter(): void {
        super.enter()
        if (this.completed) {
            throw new Error('ClearState: cannot enter completed state')
        }

        const ogScale = this.tile.scale
        const ogPosition = new Phaser.Math.Vector2(this.tile.x, this.tile.y)
        const xDistance = this.clearTarget.x - ogPosition.x
        const yDistance = this.clearTarget.y - ogPosition.y

        this.scene.tweens.addCounter({
            duration: 300,
            onStart: () => {
                if (this.clearTarget !== this.tile) {
                    this.emitter?.emitParticleAt(this.tile.getCenter().x, this.tile.getCenter().y)
                }
            },
            onUpdate: (tweener) => {
                const value = tweener.getValue()

                const scaleChange = Phaser.Math.Easing.Back.Out(1 - value) * ogScale
                const tileChangeX = Phaser.Math.Easing.Circular.Out(value) * xDistance
                const tileChangeY = Phaser.Math.Easing.Circular.Out(value) * yDistance

                this.tile.scale = scaleChange
                this.tile.setPosition(ogPosition.x + tileChangeX, ogPosition.y + tileChangeY)
            },
            onComplete: () => {
                if (this.clearTarget === this.tile) {
                    this.emitter?.emitParticleAt(this.tile.getCenter().x, this.tile.getCenter().y)
                }

                this.tile.scale = ogScale
                // this.tile.setPosition(ogPosition.x, ogPosition.y)

                this.completed = true
            },
        })
    }

    exit(): void {
        super.exit()
        this.completed = false
    }
}
