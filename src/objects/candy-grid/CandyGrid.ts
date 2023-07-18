import { GRID_CONFIG } from "@/constants/const"
import Tile from "../tile/Tile"
import DampenedParticleProcessor from "@/classes/DampenedParticle"

type GridTile = Tile | null

export default class CandyGrid extends Phaser.GameObjects.Container {
    private tiles: GridTile[][]
    private tilePool: Phaser.GameObjects.Group
    private tileLayer: Phaser.GameObjects.Layer
    private config: GridConfig
    private clearParticles: Phaser.GameObjects.Particles.ParticleEmitter

    private tileDown: Tile | null
    private tileSwap: Tile | null

    private longIdleFX!: Phaser.FX.Shine

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
            key: "tile",
            maxSize: GRID_CONFIG.gridHeight * GRID_CONFIG.gridWidth * 2,
            createCallback: (obj: Phaser.GameObjects.GameObject) => {
                const tile = obj as Tile
                tile.setActive(false)
                tile.setVisible(false)
            },
            runChildUpdate: true
        })

        group.createMultiple({
            key: "tile",
            repeat: GRID_CONFIG.gridHeight * GRID_CONFIG.gridWidth,
        })

        super(scene, x, y, [])

        this.tilePool = group
        this.tileLayer = scene.add.layer(group.getChildren())
        this.tiles = []
        this.config = GRID_CONFIG
        this.clearParticles = scene.add
            .particles(0, 0, 'star', {
                emitting: false,
                speed: 500,
                scale: { start: 0.8, end: 0 },
                blendMode: Phaser.BlendModes.NORMAL,
                lifespan: 500,
                quantity: [1, 2],
            })
            .setDepth(10)

        this.clearParticles.addParticleProcessor(
            new DampenedParticleProcessor({
                strength: 0.7,
            })
        )

        this.add(this.clearParticles)

        this.tileDown = null
        this.tileSwap = null

        // subscribe to tile events
        scene.input.on('gameobjectdown', this.onTileDown, this)

        // create grid
        this.tiles = this.genGrid()

        // try clear on all tiles
        this.tiles.forEach((row) => {
            row.forEach((tile) => {
                tile?.tryClear()
            })
        })

        // this.postFX.addColorMatrix().brightness(2)

        scene.events.on('update', this.onUpdate, this)
    }

    onUpdate(): void {
        // TODO: implement this inside the tiles themselves
        this.bubbleUp()
        this.fillCleared()
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

                tile.reset({
                    id: frameName,
                    x: y * tileWidth + padding + tileWidth / 2,
                    y: x * tileHeight + padding + tileHeight / 2 - emptyTileCount * GRID_CONFIG.tileHeight,
                    grid: this,
                    clearParticles: this.clearParticles,
                    texture: 'candies',
                    frame: frameName,
                    gridX: x,
                    gridY: y,
                }, true, true)

                this.tiles[x][y] = tile
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
    
        return [top, bottom, left, right].filter(tile => tile !== null) as Tile[]
    }

    public swapTilesInternal(tile1: Tile, tile2: Tile) {
        const { gridCoords: coords1 } = tile1
        const { gridCoords: coords2 } = tile2

        this.tiles[coords1.x][coords1.y] = tile2
        this.tiles[coords2.x][coords2.y] = tile1
    }

    private setLongIdle(isLongIdle: boolean) {
        this.longIdleFX.setActive(isLongIdle)
    }
}
