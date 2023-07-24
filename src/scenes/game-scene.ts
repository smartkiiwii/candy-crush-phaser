import ConfettiProcessor from '@/classes/ConfettiParticle'
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
        const levelUpConfetti = this.add.particles(0, 0, 'square', {
            x: this.cameras.main.centerX,
            y: (this.cameras.main.height / 11) * 10,
            scaleY: { start: -0.3, end: 0.3, random: true },
            rotate: { start: 0, end: 180, random: true },
            speedX: { min: -8000, max: 8000 },
            speedY: { min: -8000, max: -4000 },
            alpha: { start: 1, end: 0 },
            gravityY: 3000,
            lifespan: 1500,
            quantity: 100,
            emitting: false,
            emitCallback: (particle: Phaser.GameObjects.Particles.Particle) => {
                // give random colors
                particle.tint = Phaser.Display.Color.RandomRGB(0, 100).color
            },
            blendMode: Phaser.BlendModes.ADD,
        })

        levelUpConfetti.addParticleProcessor(new ConfettiProcessor({ strength: 0.85 }))

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
            this.cameras.main.width * 0.8,
            40,
            0xff9580
        )

        this.progress = this.add.rectangle(
            this.cameras.main.centerX,
            this.cameras.main.height - 30,
            this.cameras.main.width * 0.8,
            40,
            0xeaff80
        )

        this.progress.width = 0

        // progress text
        const progressText = this.add
            .text(
                this.cameras.main.centerX,
                this.cameras.main.height - 30,
                'Level: 1, Progress: 0%',
                {
                    fontFamily: 'Arial',
                    fontStyle: 'bold',
                    fontSize: 24,
                    color: '#3f270f',
                }
            )
            .setOrigin(0.5)

        // subscribe to the grid's events
        candyGrid.on('tile-clearing', (score: number) => {
            this.curProgress += score / this.difficulty
            const percent = this.curProgress / this.maxProgress

            progressText.text = `Level: ${this.difficulty}. Progress: ${Math.floor(percent * 100)}%`

            this.add.tween({
                targets: this.progress,
                duration: 500,
                width: this.cameras.main.width * 0.8 * percent,
                ease: Phaser.Math.Easing.Sine.InOut,
            })

            if (this.curProgress >= this.maxProgress) {
                // reset the progress bar and increase the difficulty
                this.curProgress = 0
                this.difficulty += 1

                candyGrid.awaitTransition(true)
                levelUpConfetti.emitParticle()
            }
        })
    }
}
