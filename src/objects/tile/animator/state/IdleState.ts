import { AnimationStateConfig } from '@/classes/AnimationController'
import Tile from '../../Tile'
import TileState from '../TileState'

export default class IdleState extends TileState {
    private longIdleTweener: Phaser.Tweens.Tween | null

    constructor(tile: Tile, config?: Omit<AnimationStateConfig, 'name'>) {
        super(tile, {
            ...config,
            name: 'idle',
            onEnter: (state) => {
                tile.tileEvents.emit('idle:start')
                config?.onEnter?.(state)
            },
            onExit: (state) => {
                tile.tileEvents.emit('idle:stop')
                config?.onExit?.(state)
            },
            exitCondition: () =>
                !this.longIdleTweener?.isPlaying() && (config?.exitCondition?.() ?? true),
        })

        this.longIdleTweener = null
    }

    playLongIdle(delay: number) {
        this.longIdleTweener = this.scene.add.tween({
            delay: delay,
            targets: this,
            rotation: ['-=0.1', '0', '+=0.1'],
            duration: 500,
            ease: Phaser.Math.Easing.Expo.InOut,
            yoyo: true,
            repeat: 1,
        })
    }
}
