export class GameScene extends Phaser.Scene {
    constructor() {
        super({
            key: 'GameScene',
        })
    }

    create(): void {
        this.add.candyGrid(0, 0)
    }
}
