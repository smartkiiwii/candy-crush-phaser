import { GRID_CONFIG } from '@/constants/const'

export class GameScene extends Phaser.Scene {
    private curProgress: number
    private maxProgress: number

    private progress!: Phaser.GameObjects.Rectangle

    private difficulty: number

    constructor() {
        super({
            key: 'GameScene',
        })

        this.curProgress = 0
        this.maxProgress = 100

        this.difficulty = 1
    }

    create(): void {
        const candyGrid = this.add.candyGrid(0, 0)

        const gridWidth = GRID_CONFIG.gridWidth * GRID_CONFIG.tileWidth
        const gridHeight = GRID_CONFIG.gridHeight * GRID_CONFIG.tileHeight

        // scale the grid to fit some percentage of the screen
        candyGrid.scale = Math.min(
            (this.cameras.main.width / gridWidth) * 0.8,
            (this.cameras.main.height / gridHeight) * 0.8
        )

        // center it
        candyGrid.x =
            this.cameras.main.width / 2 - (gridWidth * candyGrid.scale) / 2 - GRID_CONFIG.padding
        candyGrid.y =
            this.cameras.main.height / 2 - (gridHeight * candyGrid.scale) / 2 - GRID_CONFIG.padding

        // create a progress bar
        const progressBar = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.height - 30,
            gridWidth,
            20,
            0xff9580
        )

        this.progress = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.height - 30,
            gridWidth,
            20,
            0xeaff80
        )

        this.progress.width = 0

        // subscribe to the grid's events
        candyGrid.on('tile-clearing', (score: number) => {
            this.curProgress += score / this.difficulty
            const percent = this.curProgress / this.maxProgress

            this.add.tween({
                targets: this.progress,
                duration: 500,
                width: gridWidth * percent,
                ease: Phaser.Math.Easing.Back.Out,
            })

            if (this.curProgress >= this.maxProgress) {
                // reset the progress bar and increase the difficulty
                this.curProgress = 0
                this.difficulty += 1

                candyGrid.awaitTransition(true)
            }
        })
    }
}
