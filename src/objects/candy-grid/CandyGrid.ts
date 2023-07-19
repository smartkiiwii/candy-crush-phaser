import { GRID_CONFIG } from '@/constants/const'
import Tile from '../tile/Tile'
import DampenedParticleProcessor from '@/classes/DampenedParticle'
import findClearables from '../match-solver/MatchSolver'
import SecondOrderDynamics from '@/classes/SecondOrderDynamics'

export type SpawnConfig = {
    tile: Tile
    emptyTileCount: number
}

export default class CandyGrid extends Phaser.GameObjects.Container {
    private bg: Phaser.GameObjects.NineSlice
    private bgTiles: Phaser.GameObjects.Rectangle[][]
    private tiles: Tile[][]
    private tilePool: Phaser.GameObjects.Group
    private config: GridConfig

    private clearParticles: Phaser.GameObjects.Particles.ParticleEmitter
    private specialParticles: Phaser.GameObjects.Particles.ParticleEmitter
    private explosionParticles: Phaser.GameObjects.Particles.ParticleEmitter

    private lastInteraction: number

    private tileDown: Tile | null
    private tileSwap: Tile | null

    private awaitingTransition: boolean
    private isTransitioning: boolean

    private respawnQueue: SpawnConfig[]

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

        this.respawnQueue = []
        this.awaitingTransition = false
        this.isTransitioning = false

        // add nine slice bg
        this.bg = this.scene.add
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
            .setTintFill(0xff9580)

        this.add(this.bg)

        this.lastInteraction = 0
        this.tilePool = group
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

        // try clear on all tiles after a bit of time had passed to settle the tiles
        scene.time.delayedCall(500, () => {
            this.tiles.forEach((row) => {
                row.forEach((tile) => {
                    tile?.tryClear()
                })
            })
        })

        scene.events.on('update', this.onUpdate, this)
    }

    onUpdate(): void {
        if (!this.isTransitioning) {
            // TODO: implement this inside the tiles themselves
            // this.bubbleUp()
            this.fillCleared()

            if (this.scene.time.now - this.lastInteraction > 8000) {
                this.playLongIdle()
                this.playHint()
                this.lastInteraction = this.scene.time.now
            }
        }

        // checks if all tiles are ready
        if (this.awaitingTransition) {
            const allReady = this.tiles.every((row) => {
                return row.every((tile) => {
                    return tile?.isReady()
                })
            })

            if (allReady) {
                this.playTransition()
            }
        }
    }

    private fillCleared() {
        const { gridWidth, gridHeight, tileWidth, tileHeight, padding } = this.config

        let emptyTileCount = 0
        for (let y = 0; y < gridWidth; y++) {
            // only valid if the first tile is inactive
            if (this.tiles[0][y]?.active) {
                continue
            }

            emptyTileCount = 0
            let foundActive = false
            for (let x = 0; x < gridHeight; x++) {
                if (this.tiles[x][y]?.active) {
                    foundActive = true
                    continue
                }

                // invalid if inactive tiles are seperated
                if (foundActive) {
                    emptyTileCount = 0
                    break
                }

                emptyTileCount++
            }

            for (let x = 0; x < emptyTileCount; x++) {
                const tile = this.tiles[x][y] as Tile

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

                tile.setActive(true)
                tile.setInteractive()

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
        tile.setVisible(true)
        tile.setActive(true)
        tile.setInteractive()

        if (tile.parentContainer !== this) {
            tile.parentContainer?.remove(tile)

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
    private genGrid(): Tile[][] {
        const grid: Tile[][] = []
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
        // this.tiles[x][y] = null

        // this.remove(tile)

        return true
    }

    /**
     * Get the grid
     * @returns The grid
     */
    public getTiles(): Tile[][] {
        return this.tiles
    }

    /**
     * React to tile down event
     */
    private onTileDown(pointer: Phaser.Input.Pointer, tile: Tile): void {
        // is already swapping
        if (this.tileSwap !== null) {
            return
        }

        // is idling and nothing is down
        if (this.tileDown === null) {
            this.tileDown = tile
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
    }

    /**
     * Get the tile at the given coordinates, returns null if out of bounds or tile is null
     * @param x the x coordinate of the tile
     * @param y the y coordinate of the tile
     */
    public getTileAt(x: number, y: number): Tile | null {
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

        return [top, bottom, left, right].filter((tile) => tile !== null)
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

    private playTransition() {
        const shuffledTiles = this.tiles.flat().filter((tile) => tile !== null)

        // shuffle tiles
        // Phaser.Utils.Array.Shuffle(shuffledTiles)

        const tiles = shuffledTiles.map((tile, idx) => {
            if (!(tile instanceof Tile)) {
                throw new Error('tile is not a Tile object')
            }

            tile.setFocused(false)
            tile.disableInteractive()

            const targetPosition = new Phaser.Math.Vector2(tile.x, tile.y)
            return {
                order: idx,
                targetPosition,
                tweener: new SecondOrderDynamics(targetPosition, {
                    responseRate: 0.0005,
                    dampening: 0.7,
                    eagerness: 2,
                }),
                tile,
            }
        })

        this.awaitingTransition = false
        this.isTransitioning = true

        const radius = Math.min(this.bg.width, this.bg.height) / 3
        const duration = 1000

        const shape = new Phaser.Curves.Ellipse(
            this.bg.getCenter().x ?? 0,
            this.bg.getCenter().y ?? 0,
            radius,
            radius
        )

        this.scene.tweens.add({
            targets: shape,
            xRadius: -radius,
            duration,
            ease: Phaser.Math.Easing.Linear,
            repeat: 4,
            yoyo: true,
            onComplete: () => {
                this.isTransitioning = false
            },
        })

        this.scene.tweens.add({
            targets: shape,
            angle: 360,
            duration: duration,
            ease: Phaser.Math.Easing.Linear,
            repeat: 8,
        })

        const fn = (time: number, delta: number) => {
            if (this.isTransitioning) {
                tiles.forEach((tile) => {
                    const point = shape.getPoint(tile.order / tiles.length)

                    // offset from this container's center
                    tile.targetPosition.copy(point)

                    const newPos = tile.tweener.update(delta, tile.targetPosition)

                    tile.tile.x = newPos.x
                    tile.tile.y = newPos.y

                    tile.order = (tile.order + 1) % tiles.length
                })
            } else {
                this.scene.events.off('update', fn)

                tiles.forEach((tile, index) => {
                    // calculate shuffled coords based on order
                    // const x = Math.floor(index / this.config.gridWidth)
                    // const y = index % this.config.gridWidth

                    const { x, y } = tile.tile.gridCoords

                    tile.tile.gridCoords.set(x, y)

                    tile.targetPosition.x =
                        y * this.config.tileWidth + this.config.padding + this.config.tileWidth / 2
                    tile.targetPosition.y =
                        x * this.config.tileHeight +
                        this.config.padding +
                        this.config.tileHeight / 2

                    const frame = this.getRandomTileFrame()

                    tile.tile.reset({
                        x: tile.tile.x,
                        y: tile.tile.y,
                        grid: this,
                        clearParticles: this.clearParticles,
                        specialParticles: this.specialParticles,
                        explosionParticles: this.explosionParticles,
                        texture: 'candies',
                        frame,
                        gridX: x,
                        gridY: y,
                        id: frame,
                    })

                    // tween back to original position
                    this.scene.tweens.add({
                        targets: tile.tile,
                        x: tile.targetPosition.x,
                        y: tile.targetPosition.y,
                        duration: 500,
                        ease: 'Sine.easeInOut',
                        onComplete: () => {
                            tile.tile.setInteractive()
                            // tile.tile.setFalling()
                            tile.tile.tryClear()
                        },
                    })
                })
            }
        }

        this.scene.events.on('update', fn)
    }

    public awaitTransition(value: boolean) {
        this.awaitingTransition = value
        // this.awaitingTransition = false
    }

    public spawnTileAt(gridX: number, gridY: number, emptyTileCount: number) {
        const { tileWidth, tileHeight, padding } = this.config

        const tile = this.createTile()
        const frameName = this.getRandomTileFrame()

        tile.reset(
            {
                id: frameName,
                x: gridY * tileWidth + padding + tileWidth / 2,
                y:
                    gridX * tileHeight +
                    padding +
                    tileHeight / 2 -
                    emptyTileCount * GRID_CONFIG.tileHeight,
                grid: this,
                clearParticles: this.clearParticles,
                specialParticles: this.specialParticles,
                explosionParticles: this.explosionParticles,
                texture: 'candies',
                frame: frameName,
                gridX: gridX,
                gridY: gridY,
            },
            true,
            true
        )

        this.tiles[gridX][gridY] = tile
        this.lastInteraction = this.scene.time.now
    }

    public queueRespawn(tile: Tile, emptyTileCount: number) {
        this.respawnQueue.push({
            tile,
            emptyTileCount,
        })
    }
}
