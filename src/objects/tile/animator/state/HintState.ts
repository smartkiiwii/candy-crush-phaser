import { AnimationStateConfig } from '@/classes/AnimationController'
import Tile from '../../Tile'
import TileState from '../TileState'

export default class HintState extends TileState {
    private completed: boolean

    constructor(tile: Tile, config?: Omit<AnimationStateConfig, 'name'>) {
        super(tile, {
            ...config,
            name: 'hint',
            onEnter: (state) => {
                tile.tileEvents.emit('hint:start')
                config?.onEnter?.(state)
            },
            onExit: (state) => {
                tile.tileEvents.emit('hint:stop')
                config?.onExit?.(state)
            },
            exitCondition: () => this.completed && (config?.exitCondition?.() ?? true),
        })

        this.completed = false
    }

    enter(): void {
        super.enter()

        if (this.completed) {
            throw new Error('HintState: cannot enter completed state')
        }

        this.createTween()
    }

    exit(): void {
        super.exit()
        this.completed = false
    }

    private createTween() {
        return this.scene.add.tween({
            targets: this,
            rotation: ['-=0.1', '0', '+=0.1'],
            duration: 500,
            ease: Phaser.Math.Easing.Expo.InOut,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                this.completed = true
            },
        })
    }
}
