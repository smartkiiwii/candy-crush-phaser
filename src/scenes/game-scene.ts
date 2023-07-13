import { GRID_CONFIG } from '../constants/const'

export class GameScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'GameScene',
        })
    }

    create(): void {
        this.add
            .candyGrid(GRID_CONFIG)
            .setPosition(this.cameras.main.centerX, this.cameras.main.centerY)
    }
}
