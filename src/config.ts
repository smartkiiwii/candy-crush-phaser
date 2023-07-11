import { BootScene } from './scenes/boot-scene'
import { GameScene } from './scenes/game-scene'
import TweenScene from './scenes/tween-scene'

export const GameConfig: Phaser.Types.Core.GameConfig = {
    title: 'Candy crush',
    url: 'https://github.com/digitsensitive/phaser3-typescript',
    version: '2.0',
    width: 520,
    height: 700,
    scale: {
        mode: Phaser.Scale.RESIZE,
    },
    type: Phaser.AUTO,
    parent: 'game',
    scene: [BootScene, GameScene],
    // scene: [TweenScene],
    backgroundColor: '#eeeeee',
    render: { pixelArt: false, antialias: true },
    dom: {
        createContainer: true,
    }
}
