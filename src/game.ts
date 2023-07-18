import 'phaser'
import { GameConfig } from './config'
import CandyGrid from './objects/candy-grid/CandyGrid'

export class Game extends Phaser.Game {
    constructor(config: Phaser.Types.Core.GameConfig) {
        super(config)
    }
}

Phaser.GameObjects.GameObjectFactory.register(
    'candyGrid',
    function (this: Phaser.GameObjects.GameObjectFactory, x?: number, y?: number) {
        const candyGrid = new CandyGrid(this.scene, x, y)

        this.displayList.add(candyGrid)
        // this.updateList.add(candyGrid)

        return candyGrid
    }
)

window.addEventListener('load', () => {
    const game = new Game(GameConfig)
})
