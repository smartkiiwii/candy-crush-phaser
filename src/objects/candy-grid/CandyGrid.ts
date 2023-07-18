import { GRID_CONFIG } from '@/constants/const'
import Tile from '../tile/Tile'
import DampenedParticleProcessor from '@/classes/DampenedParticle'
import findClearables from '../match-solver/MatchSolver'

export type GridTile = Tile | null

export default class CandyGrid extends Phaser.GameObjects.Container {
    private bgTiles: Phaser.GameObjects.Rectangle[][]
    private tiles: GridTile[][]
    private tilePool: Phaser.GameObjects.Group
    private tileLayer: Phaser.GameObjects.Layer
    private config: GridConfig

    private clearParticles: Phaser.GameObjects.Particles.ParticleEmitter
    private specialParticles: Phaser.GameObjects.Particles.ParticleEmitter
    private explosionParticles: Phaser.GameObjects.Particles.ParticleEmitter

    private lastInteraction: number

    private tileDown: Tile | null
    private tileSwap: Tile | null

    /**
     *
     * @param scene The Scene to which this Game Object belongs. A Game Object can only belong to one Scene at a time.
     * @param x The horizontal position of this Game Object in the world. Default 0.
     * @param y The vertical position of this Game Object in the world. Default 0.
     * @param children An optional array of Game Objects to add to this Container.
     */
    constructor(scene: Phaser.Scene, x?: number, y?: number) {
        const group = scene.add.group([], {
            classType: Tile,
            key: 'tile',
            maxSize: GRID_CONFIG.gridHeight * GRID_CONFIG.gridWidth * 2,
            createCallback: (obj: Phaser.GameObjects.GameObject) => {
                const tile = obj as Tile
                tile.setActive(false)
                tile.setVisible(false)
            },
            runChildUpdate: true,
        })

        group.createMultiple({
            key: 'tile',
            repeat: GRID_CONFIG.gridHeight * GRID_CONFIG.gridWidth,
        })

        super(scene, x, y, [])

        // add nine slice bg
        const bg = this.scene.add
            .nineslice(
                0,
                0,
                'ui',
                'candy-grid',
                GRID_CONFIG.gridWidth * GRID_CONFIG.tileWidth + GRID_CONFIG.padding * 2,
                GRID_CONFIG.gridHeight * GRID_CONFIG.tileHeight + GRID_CONFIG.padding * 2,
                GRID_CONFIG.leftWidth,
                GRID_CONFIG.rightWidth,
                GRID_CONFIG.topHeight,
                GRID_CONFIG.bottomHeight
            )
            .setOrigin(0)

        this.add(bg)

        this.lastInteraction = 0
        this.tilePool = group
        this.tileLayer = scene.add.layer(group.getChildren())
        this.config = GRID_CONFIG
        this.clearParticles = scene.add
            .particles(0, 0, 'circle', {
                emitting: false,
                speed: 500,
                scale: { start: 1.5, end: 0, random: true },
                blendMode: Phaser.BlendModes.NORMAL,
                lifespan: 500,
                quantity: [3, 4],
            })
            .setDepth(10)

        this.clearParticles.addParticleProcessor(
            new DampenedParticleProcessor({
                strength: 0.7,
            })
        )

        this.specialParticles = scene.add
            .particles(0, 0, 'star', {
                emitting: false,
                speed: 500,
                scale: { start: 0.8, end: 0 },
                lifespan: 500,
                quantity: [1, 2],
            })
            .setDepth(10)

        this.specialParticles.addParticleProcessor(
            new DampenedParticleProcessor({
                strength: 0.8,
            })
        )

        this.explosionParticles = scene.add.particles(0, 0, 'candies', {
            frame: GRID_CONFIG.candies,
            lifespan: 1000,
            speed: 1000,
            maxVelocityX: 700,
            maxVelocityY: 700,
            scale: { start: 2, end: 0, random: true },
            rotate: { start: 0, end: 360, random: true },
            accelerationY: 1000,
            blendMode: Phaser.BlendModes.SCREEN,
            particleBringToTop: false,
            emitting: false,
        })

        this.explosionParticles.addParticleProcessor(
            new DampenedParticleProcessor({
                strength: 0.9,
            })
        )

        this.add(this.clearParticles)
        this.add(this.specialParticles)
        this.add(this.explosionParticles)

        this.tileDown = null
        this.tileSwap = null

        // subscribe to tile events
        scene.input.on('gameobjectdown', this.onTileDown, this)

        // create background grid
        this.bgTiles = this.genBgGrid()

        // create grid
        this.tiles = this.genGrid()

        // try clear on all tiles
        this.tiles.forEach((row) => {
            row.forEach((tile) => {
                tile?.tryClear()
            })
        })

        scene.events.on('update', this.onUpdate, this)
    }

    onUpdate(): void {
        // TODO: implement this inside the tiles themselves
        this.bubbleUp()
        this.fillCleared()

        if (this.scene.time.now - this.lastInteraction > 8000) {
            this.playLongIdle()
            this.playHint()
            this.lastInteraction = this.scene.time.now
        }
    }

    private bubbleUp() {
        const { gridWidth, gridHeight } = this.config

        for (let y = 0; y < gridWidth; y++) {
            let emptyTileCount = 0

            for (let x = gridHeight - 1; x >= 0; x--) {
                const tile = this.tiles[x][y]

                if (!tile) {
                    emptyTileCount++
                } else if (emptyTileCount > 0) {
                    tile.gridCoords.set(x + emptyTileCount, y)
                    tile.setFalling()

                    this.tiles[x + emptyTileCount][y] = tile
                    this.tiles[x][y] = null
                }
            }
        }
    }

    private fillCleared() {
        const { gridWidth, tileWidth, tileHeight, padding } = this.config

        for (let y = 0; y < gridWidth; y++) {
            const emptyTileCount = this.tiles.reduce((acc, row) => {
                return acc + (row[y] ? 0 : 1)
            }, 0)

            for (let x = 0; x < emptyTileCount; x++) {
                const tile = this.createTile()
                const frameName = this.getRandomTileFrame()

                tile.reset(
                    {
                        id: frameName,
                        x: y * tileWidth + padding + tileWidth / 2,
                        y:
                            x * tileHeight +
                            padding +
                            tileHeight / 2 -
                            emptyTileCount * GRID_CONFIG.tileHeight,
                        grid: this,
                        clearParticles: this.clearParticles,
                        specialParticles: this.specialParticles,
                        explosionParticles: this.explosionParticles,
                        texture: 'candies',
                        frame: frameName,
                        gridX: x,
                        gridY: y,
                    },
                    true,
                    true
                )

                this.tiles[x][y] = tile
                this.lastInteraction = this.scene.time.now
            }
        }
    }

    /**
     * Get a new tile from the pool
     * @returns The Tile
     */
    private createTile(): Tile {
        const tile = this.tilePool.getFirstDead(true) as Tile
        tile.setActive(true)
        tile.setVisible(true)
        tile.setInteractive()

        if (tile.parentContainer !== this) {
            tile.parentContainer?.remove(tile)

            this.tileLayer.add(tile)
            this.add(tile)
            this.bringToTop(this.clearParticles)
            this.bringToTop(this.specialParticles)
            this.bringToTop(this.explosionParticles)
        }

        return tile
    }

    /**
     * Generate a new grid
     * @returns The grid
     */
    private genGrid(): GridTile[][] {
        const grid: GridTile[][] = []
        const { tileWidth, tileHeight, padding } = this.config

        for (let x = 0; x < this.config.gridHeight; x++) {
            grid.push([])
            for (let y = 0; y < this.config.gridWidth; y++) {
                const tile = this.createTile()
                const frameName = this.getRandomTileFrame()

                tile.reset({
                    id: frameName,
                    x: y * tileWidth + padding + tileWidth / 2,
                    y: x * tileHeight + padding + tileHeight / 2,
                    grid: this,
                    clearParticles: this.clearParticles,
                    specialParticles: this.specialParticles,
                    explosionParticles: this.explosionParticles,
                    texture: 'candies',
                    frame: frameName,
                    gridX: x,
                    gridY: y,
                })

                grid[x].push(tile)
            }
        }

        return grid
    }

    /**
     * Generate the background grid of rectangular tiles with alpha = 0
     */
    private genBgGrid(): Phaser.GameObjects.Rectangle[][] {
        const grid: Phaser.GameObjects.Rectangle[][] = []
        const { tileWidth, tileHeight, padding } = this.config

        for (let x = 0; x < this.config.gridHeight; x++) {
            grid.push([])
            for (let y = 0; y < this.config.gridWidth; y++) {
                const rect = this.scene.add
                    .rectangle(
                        y * tileWidth + padding + tileWidth / 2,
                        x * tileHeight + padding + tileHeight / 2,
                        tileWidth,
                        tileHeight,
                        0xffffff,
                        1
                    )
                    .setAlpha(0)

                this.add(rect)
                grid[x].push(rect)
            }
        }

        return grid
    }

    /**
     * Get a random tile frame
     * @returns The frame of a random tile
     */
    private getRandomTileFrame(): string {
        const index = Phaser.Math.Between(0, this.config.candies.length - 1)
        return GRID_CONFIG.candies[index]
    }

    /**
     * Try to clear the tile from grid. Do nothing if failed or tile was already cleared
     * @param x The x coordinate of the tile
     * @param y The y coordinate of the tile
     * @returns Whether the tile was cleared
     */
    public clearTileAt(x: number, y: number): boolean {
        const tile = this.tiles[x][y]

        if (!tile) {
            return false
        }

        if (tile === this.tileDown) {
            this.tileDown = null
        }

        tile.disableInteractive()
        this.tiles[x][y] = null

        this.remove(tile)
        this.tileLayer.remove(tile)

        return true
    }

    /**
     * Get the grid
     * @returns The grid
     */
    public getTiles(): GridTile[][] {
        return this.tiles
    }

    /**
     * React to tile down event
     */
    private onTileDown(pointer: Phaser.Input.Pointer, tile: Tile): void {
        if (!tile.isReady()) {
            return
        }

        // is already swapping
        if (this.tileSwap !== null) {
            return
        }

        // is idling and nothing is down
        if (this.tileDown === null) {
            this.tileDown = tile
            this.tileLayer.bringToTop(tile)
            tile.setFocused()
            return
        }

        // is idling and something is down
        if (this.tileDown === tile) {
            this.tileDown = null
            tile.setFocused(false)
            return
        }

        const difference = {
            x: Math.abs(tile.gridCoords.x - this.tileDown.gridCoords.x),
            y: Math.abs(tile.gridCoords.y - this.tileDown.gridCoords.y),
        }

        // two downs are adjacent
        if (difference.x + difference.y === 1) {
            const tileDown = this.tileDown

            this.tileDown.setFocused(false)

            // TODO: change if want to implement swap animation
            this.tileDown = null
            this.tileSwap = null

            tileDown.trySwapClear(tile)
            return
        }

        // two downs are not adjacent
        this.tileDown.setFocused(false)
        tile.setFocused()
        this.tileDown = tile
        this.tileLayer.bringToTop(tile)
    }

    /**
     * Get the tile at the given coordinates, returns null if out of bounds or tile is null
     * @param x the x coordinate of the tile
     * @param y the y coordinate of the tile
     */
    public getTileAt(x: number, y: number): GridTile {
        if (x < 0 || x >= this.config.gridHeight || y < 0 || y >= this.config.gridWidth) {
            return null
        }

        return this.tiles[x][y]
    }

    public getNeighboursOf(tile: Tile) {
        const top = this.getTileAt(tile.gridCoords.x - 1, tile.gridCoords.y)
        const bottom = this.getTileAt(tile.gridCoords.x + 1, tile.gridCoords.y)
        const left = this.getTileAt(tile.gridCoords.x, tile.gridCoords.y - 1)
        const right = this.getTileAt(tile.gridCoords.x, tile.gridCoords.y + 1)

        return [top, bottom, left, right].filter((tile) => tile !== null) as Tile[]
    }

    public getSurroundingTilesOf(tile: Tile, distance: number) {
        const tiles: Tile[] = []

        for (let x = tile.gridCoords.x - distance; x <= tile.gridCoords.x + distance; x++) {
            for (let y = tile.gridCoords.y - distance; y <= tile.gridCoords.y + distance; y++) {
                const t = this.getTileAt(x, y)

                if (t) {
                    tiles.push(t)
                }
            }
        }

        return tiles
    }

    public swapTilesInternal(tile1: Tile, tile2: Tile) {
        const { gridCoords: coords1 } = tile1
        const { gridCoords: coords2 } = tile2

        this.tiles[coords1.x][coords1.y] = tile2
        this.tiles[coords2.x][coords2.y] = tile1
    }

    /**
     * Tween stagger alpha of bg tiles
     */
    private playLongIdle() {
        console.log('play long idle')
        this.bgTiles.forEach((row, x) => {
            row.forEach((tile, y) => {
                this.scene.tweens.add({
                    targets: tile,
                    alpha: 1,
                    scale: 0.5,
                    duration: 500,
                    ease: 'Sine.easeInOut',
                    delay: x * 100 + y * 100,
                    yoyo: true,
                })
            })
        })
    }

    private playHint() {
        // first pass: start finding solve at random pos
        const startX = Phaser.Math.Between(0, this.config.gridHeight - 1)
        const startY = Phaser.Math.Between(0, this.config.gridWidth - 1)

        let solve = this.findSolve(startX, startY)

        if (!solve) {
            // second pass: start finding solve at 0
            solve = this.findSolve(0, 0)
        }

        if (!solve) {
            console.warn('no solve found')
            return
        }

        const [tile1, tile2] = solve

        // tween alpha of bg tiles at same position
        this.scene.tweens.add({
            targets: [
                this.bgTiles[tile1.gridCoords.x][tile1.gridCoords.y],
                this.bgTiles[tile2.gridCoords.x][tile2.gridCoords.y],
            ],
            alpha: 0.5,
            scale: 0.9,
            ease: 'Sine.easeInOut',
            duration: 500,
            yoyo: true,
            repeat: 2,
            loop: 1,
            loopDelay: 300,
        })
    }

    private findSolve(startX: number, startY: number): [Tile, Tile] | null {
        // clone the grid
        const grid = this.tiles.map((row) => row.map((tile) => tile))

        // swap 2 tiles and check if there is a match
        for (let x = startX; x < this.config.gridHeight; x++) {
            for (let y = startY; y < this.config.gridWidth; y++) {
                const tile1 = grid[x][y]
                const tile2 = grid[x][y + 1]

                if (tile1 && tile2) {
                    this.swapTilesInternal(tile1, tile2)

                    const temp = tile1.gridCoords.clone()
                    tile1.gridCoords.copy(tile2.gridCoords)
                    tile2.gridCoords.copy(temp)

                    const matches = [...findClearables(tile1, grid), ...findClearables(tile2, grid)]

                    this.swapTilesInternal(tile1, tile2)

                    temp.copy(tile1.gridCoords)
                    tile1.gridCoords.copy(tile2.gridCoords)
                    tile2.gridCoords.copy(temp)

                    if (matches.length > 0) {
                        return [tile1, tile2]
                    }
                }
            }
        }

        return null
    }
}
