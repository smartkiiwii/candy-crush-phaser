import StateMachine, { StateMachineEvents } from '@/classes/StateMachine'
import { Tile } from './Tile'
import { GRID_CONFIG } from '@/constants/const'
import DampenedParticleProcessor from '@/classes/DampenedParticle'

export const CandyGridState = {
    IDLE: 'IDLE',
    SWAP_ANIMATE: 'SWAP_ANIMATE',
    CHECK: 'CHECK',
    CLEAR: 'CLEAR',
    BUBBLE: 'BUBBLE',
} as const

export type CandyGridState = (typeof CandyGridState)[keyof typeof CandyGridState]

type Match = {
    target: Tile
    sources: Tile[]
}

export default class CandyGrid extends Phaser.GameObjects.NineSlice implements ICandyGrid {
    private tiles: Tile[][]
    private gridState: StateMachine<CandyGridState>
    private gridConfig: GridConfig
    private tileDown: Tile | null
    private matches: Match[]

    private tileLayer: Phaser.GameObjects.Layer

    private displayingHint: boolean

    private clearParticles: Phaser.GameObjects.Particles.ParticleEmitter

    constructor(scene: Phaser.Scene, gridConfig: GridConfig) {
        const {
            x,
            y,
            gridWidth,
            gridHeight,
            tileWidth,
            tileHeight,
            texture,
            frame,
            leftWidth,
            rightWidth,
            topHeight,
            bottomHeight,
        } = gridConfig

        // offset by padding
        super(
            scene,
            x - gridConfig.padding,
            y - gridConfig.padding,
            texture,
            frame,
            gridWidth * tileWidth + gridConfig.padding * 2,
            gridHeight * tileHeight + gridConfig.padding * 2,
            leftWidth,
            rightWidth,
            topHeight,
            bottomHeight
        )

        this.gridState = new StateMachine<CandyGridState>(CandyGridState.IDLE)
        this.tiles = []
        this.gridConfig = gridConfig
        this.tileDown = null
        this.matches = []
        this.displayingHint = false
        // particle that expands quickly, slows down, and fades out
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

        // create mask to hide tiles outside of grid
        const graphics = scene.make.graphics()

        graphics.fillStyle(0xffffff)
        graphics.fillRect(
            x,
            y,
            gridWidth * tileWidth + gridConfig.padding * 2,
            gridHeight * tileHeight + gridConfig.padding * 2
        )

        const mask = graphics.createGeometryMask()

        this.tileLayer = scene.add.layer().setMask(mask).setDepth(this.depth + 1)

        // subscribe to update event
        // CandyGrid.attachUpdateEvent(scene, this)

        // subscribe to tile down event
        this.scene.input.on('gameobjectdown', this.onTileDown, this)

        // subscribe to state change event
        this.gridState.onStateChange(StateMachineEvents.STATE_CHANGE, (state: CandyGridState) => {
            switch (state) {
                case CandyGridState.IDLE:
                    // safe to try display hint
                    this.displayingHint = false

                    this.handleIdleState()
                    break

                case CandyGridState.CHECK:
                    this.matches = this.getMatches()

                    scene.time.delayedCall(200, () => {
                        if (this.matches.length > 0) {
                            this.gridState.transition(CandyGridState.CLEAR)
                        } else {
                            this.gridState.transition(CandyGridState.IDLE)
                        }
                    })

                    break

                case CandyGridState.CLEAR:
                    scene.tweens.addCounter({
                        from: 0,
                        to: 1,
                        duration: 300,
                        ease: 'Back.in',
                        onUpdate: (tween) => {
                            const value = tween.getValue()

                            this.matches.forEach((match) => {
                                match.sources.forEach((tile) => {
                                    tile.setDisplaySize(
                                        GRID_CONFIG.tileWidth * (1 - value),
                                        GRID_CONFIG.tileHeight * (1 - value)
                                    )
                                })
                            })
                        },
                        onComplete: () => {
                            // clear matches
                            this.clearMatches()

                            this.matches.forEach((match) => {
                                match.sources.forEach((tile) => {
                                    tile.setDisplaySize(
                                        GRID_CONFIG.tileWidth,
                                        GRID_CONFIG.tileHeight
                                    )
                                })
                            })

                            // transition to bubble
                            this.gridState.transition(CandyGridState.BUBBLE)
                        },
                    })

                    break

                case CandyGridState.BUBBLE:
                    // bubble up clear event
                    this.bubbleUp()

                    // fill empty tiles
                    this.fillCleared()

                    // transition to check
                    this.gridState.transition(CandyGridState.CHECK)

                    break
            }
        })

        // unsubscribe from tile down event
        this.scene.events.on('destroy', () => {
            this.scene.input.off('gameobjectdown', this.onTileDown, this)
        })

        // create grid
        this.createGrid()

        // transition to check
        this.gridState.transition(CandyGridState.CHECK)
    }

    onUpdate() {
        //
    }

    setPosition(
        x?: number | undefined,
        y?: number | undefined,
        z?: number | undefined,
        w?: number | undefined
    ): this {
        super.setPosition(x, y, z, w)

        // object has not been initialized yet
        if (!this.gridConfig) {
            return this
        }
        
        const { x: gridPosX, y: gridPosY } = this.getTopLeft()

        if (this.tiles) {
            this.tiles.forEach((row) => {
                row.forEach((tile) => {
                    const tileX =
                        (gridPosX ?? 0) +
                        tile.gridY * this.gridConfig.tileWidth +
                        this.gridConfig.padding +
                        this.gridConfig.tileWidth / 2
                    const tileY =
                        (gridPosY ?? 0) +
                        tile.gridX * this.gridConfig.tileHeight +
                        this.gridConfig.padding +
                        this.gridConfig.tileHeight / 2

                    // with padding from config
                    tile.setTargetPosition(tileX, tileY)

                    tile.resetTweenOrigin(tileX, tileY)
                })
            })
        }

        // re-create mask
        const graphics = this.scene.make.graphics()

        graphics.fillStyle(0xffffff)
        graphics.fillRect(
            (gridPosX ?? 0),
            (gridPosY ?? 0),
            this.gridConfig.gridWidth * this.gridConfig.tileWidth +
                this.gridConfig.padding * 2,
            this.gridConfig.gridHeight * this.gridConfig.tileHeight +
                this.gridConfig.padding * 2
        )

        const mask = graphics.createGeometryMask()

        this.tileLayer.setMask(mask)

        return this
    }

    private handleIdleState() {
        // reset tile down
        this.tileDown = null
        this.matches = []

        this.awaitLongIdleState()
    }

    private handleLongIdleState() {
        console.log('long idle')

        // add shine to all tiles
        this.tiles.forEach((row, x) => {
            row.forEach((tile, y) => {
                const delay = x * 100 + y * 100
                tile.playIdleAnimation(delay)
            })
        })

        this.awaitLongIdleState()
    }

    private displayHint() {
        if (this.displayingHint) return

        this.displayingHint = true

        console.log('display hint')

        const solve = this.getFastSolve()

        if (solve) {
            solve[0].playHintAnimation(solve[1])
            solve[1].playHintAnimation(solve[0])

            const fn = () => {
                solve.forEach((s) => {
                    s.stopHintAnimation()
                })
            }

            this.scene.input.once('gameobjectdown', fn)
        }
    }

    private awaitLongIdleState() {
        let stateChanged = false

        this.gridState.onceStateChange(StateMachineEvents.STATE_CHANGE, () => {
            stateChanged = true
        })

        // if waited for too long with no action, handle long idle
        this.scene.time.delayedCall(5000, () => {
            if (!stateChanged) {
                this.handleLongIdleState()
            }
        })

        // if waited for too long with no action, display hint
        this.scene.time.delayedCall(10000, () => {
            if (!stateChanged) {
                this.displayHint()
            }
        })
    }

    private dumpTiles() {
        console.log('dumping tiles')
        this.tiles.forEach((row) => {
            console.log(
                row
                    .map((tile) => `${tile.texture.key[0]}-${(tile.isCleared ? 0 : 1).toString()}`)
                    .join(' ')
            )
        })
    }

    private onTileDown(pointer: Phaser.Input.Pointer, tile: Tile) {
        if (!this.gridState.is(CandyGridState.IDLE)) return

        if (this.tileDown === null) {
            this.tileDown = tile
            this.tileLayer.bringToTop(tile)
            this.tileDown.playFocusAnimation()
            return
        }

        if (this.tileDown === tile) {
            this.tileDown.stopFocusAnimation()
            this.tileDown = null
            return
        }

        const difference = {
            gridX: Math.abs(this.tileDown.gridX - tile.gridX),
            gridY: Math.abs(this.tileDown.gridY - tile.gridY),
        }

        if (difference.gridX + difference.gridY === 1) {
            this.swapTilesAnimate(this.tileDown, tile)
            this.tileDown.stopFocusAnimation()
            this.tileDown = null
        } else {
            this.tileDown.stopFocusAnimation()
            this.tileDown = tile
            this.tileLayer.bringToTop(tile)
            this.tileDown.playFocusAnimation()
        }
    }

    private static attachUpdateEvent(scene: Phaser.Scene, candyGrid: CandyGrid) {
        scene.events.on('update', candyGrid.update, candyGrid)

        // unsubscribe from event when this object is destroyed
        scene.events.on('destroy', () => {
            scene.events.off('update', candyGrid.update, candyGrid)
        })
    }

    private addTile(x: number, y: number, tile: Tile) {
        if (!this.tiles[x]) {
            this.tiles[x] = []
        }

        // flip because js array is [y][x]
        this.tiles[x][y] = tile
    }

    private createTile(x: number, y: number, tileType: string) {
        const { tileWidth, tileHeight } = this.gridConfig

        const { x: gridX, y: gridY } = this.getTopLeft()

        const posX = y * tileWidth + (gridX ?? 0) + this.gridConfig.padding + tileWidth / 2
        const posY = x * tileHeight + (gridY ?? 0) + this.gridConfig.padding + tileHeight / 2

        // flip x and y because js array is [y][x] while phaser positioning is [x][y]
        const tile = new Tile({
            scene: this.scene,
            x: posX,
            y: posY,
            tweenOriginX: posX,
            tweenOriginY: posY,
            gridX: x,
            gridY: y,
            texture: tileType,
        })

        this.tileLayer.add(tile)

        this.addTile(x, y, tile)
    }

    private getRandTileType() {
        const { candies } = this.gridConfig

        return candies[Math.floor(Math.random() * candies.length)]
    }

    private createGrid() {
        const { gridWidth, gridHeight } = this.gridConfig

        for (let x = 0; x < gridHeight; x++) {
            for (let y = 0; y < gridWidth; y++) {
                this.createTile(x, y, this.getRandTileType())
            }
        }
    }

    private swapTilesImmediate(tileA: Tile, tileB: Tile) {
        this.swapTilesInternal(tileA, tileB)
        this.swapTilesGraphics(tileA, tileB)
    }

    private swapTilesInternal(tileA: Tile, tileB: Tile) {
        const tileAGridX = tileA.gridX
        const tileAGridY = tileA.gridY
        const tileBGridX = tileB.gridX
        const tileBGridY = tileB.gridY

        tileA.gridX = tileBGridX
        tileA.gridY = tileBGridY
        tileB.gridX = tileAGridX
        tileB.gridY = tileAGridY

        this.tiles[tileBGridX][tileBGridY] = tileA
        this.tiles[tileAGridX][tileAGridY] = tileB
    }

    private swapTilesGraphics(tileA: Tile, tileB: Tile) {
        const { x: tileAX, y: tileAY } = tileA.getTargetPosition()
        const { x: tileBX, y: tileBY } = tileB.getTargetPosition()

        tileA.setTargetPosition(tileBX, tileBY)
        tileB.setTargetPosition(tileAX, tileAY)
    }

    private swapTilesAnimate(tileA: Tile, tileB: Tile) {
        if (!this.gridState.is(CandyGridState.IDLE)) return

        this.gridState.transition(CandyGridState.SWAP_ANIMATE)

        const { x: tileAX, y: tileAY } = tileA.getTargetPosition()
        const { x: tileBX, y: tileBY } = tileB.getTargetPosition()

        this.swapTilesInternal(tileA, tileB)
        this.matches = this.getMatches()

        if (this.matches.length === 0) {
            this.swapTilesInternal(tileA, tileB)
        }

        // swaps A and B
        this.scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration: 300,
            ease: 'Sine.easeInOut',
            repeat: 0,
            yoyo: this.matches.length === 0,
            onUpdate: (tween) => {
                const value = tween.getValue()

                tileA.setTargetPosition(
                    tileAX + (tileBX - tileAX) * value,
                    tileAY + (tileBY - tileAY) * value
                )
                tileB.setTargetPosition(
                    tileBX + (tileAX - tileBX) * value,
                    tileBY + (tileAY - tileBY) * value
                )
            },
            onComplete: () => {
                if (this.matches.length > 0) {
                    this.gridState.transition(CandyGridState.CLEAR)
                } else {
                    this.gridState.transition(CandyGridState.IDLE)
                }
            },
        })
    }

    private bubbleUp() {
        const { gridWidth, gridHeight } = this.gridConfig

        for (let y = 0; y < gridWidth; y++) {
            let emptyTileCount = 0

            for (let x = gridHeight - 1; x >= 0; x--) {
                const tile = this.tiles[x][y]

                if (tile.isCleared) {
                    emptyTileCount++
                } else if (emptyTileCount > 0) {
                    this.swapTilesImmediate(tile, this.tiles[x + emptyTileCount][y])
                }
            }
        }
    }

    private fillCleared() {
        const { gridWidth } = this.gridConfig

        for (let y = 0; y < gridWidth; y++) {
            const emptyTileCount = this.tiles.reduce((acc, row) => {
                return acc + (row[y].isCleared ? 1 : 0)
            }, 0)

            for (let x = 0; x < emptyTileCount; x++) {
                const tile = this.tiles[x][y]

                tile.resetTile({
                    texture: this.getRandTileType(),
                    tweenOriginX: tile.getTargetPosition().x,
                    tweenOriginY:
                        tile.getTargetPosition().y - emptyTileCount * GRID_CONFIG.tileHeight,
                })
            }
        }

        this.gridState.transition(CandyGridState.IDLE)
    }

    private clearMatches() {
        this.matches.forEach((match) => {
            match.sources.forEach((tile) => {
                tile.clearTile()

                // emit particle
                this.clearParticles.emitParticleAt(tile.getCenter().x, tile.getCenter().y)
            })
        })
    }

    private getVerticalMatches() {
        const { gridWidth, gridHeight } = this.gridConfig
        const matches: Match[] = []

        for (let b = 0; b < gridWidth; b++) {
            let match: Match | null = null

            for (let a = 0; a < gridHeight; a++) {
                const tile = this.tiles[a][b]

                if (!match) {
                    match = {
                        target: tile,
                        sources: [tile],
                    }
                } else if (match.target.isSameType(tile)) {
                    match.sources.push(tile)
                } else {
                    if (match.sources.length >= 3) {
                        matches.push(match)
                    }

                    match = {
                        target: tile,
                        sources: [tile],
                    }
                }
            }

            if (match && match.sources.length >= 3) {
                matches.push(match)
            }
        }

        return matches
    }

    private getHorizontalMatches() {
        const { gridWidth, gridHeight } = this.gridConfig
        const matches: Match[] = []

        for (let x = 0; x < gridHeight; x++) {
            let match: Match | null = null

            for (let y = 0; y < gridWidth; y++) {
                const tile = this.tiles[x][y]

                if (!match) {
                    match = {
                        target: tile,
                        sources: [tile],
                    }
                } else if (match.target.isSameType(tile)) {
                    match.sources.push(tile)
                } else {
                    if (match.sources.length >= 3) {
                        matches.push(match)
                    }

                    match = {
                        target: tile,
                        sources: [tile],
                    }
                }
            }

            if (match && match.sources.length >= 3) {
                matches.push(match)
            }
        }

        return matches
    }

    private getMatches() {
        return [...this.getHorizontalMatches(), ...this.getVerticalMatches()]
    }

    private getFastSolve(): [Tile, Tile] | null {
        // quickly find a solve where there is two adjacent tiles and swapping them will result in a match
        const { gridWidth, gridHeight } = this.gridConfig

        for (let x = 0; x < gridHeight; x++) {
            for (let y = 0; y < gridWidth; y++) {
                const tile = this.tiles[x][y]

                if (x + 1 < gridHeight) {
                    const tileRight = this.tiles[x + 1][y]

                    this.swapTilesInternal(tile, tileRight)

                    const matches = this.getMatches()

                    this.swapTilesInternal(tile, tileRight)

                    if (matches.length > 0) {
                        return [tile, tileRight]
                    }
                }

                if (y + 1 < gridWidth) {
                    const tileDown = this.tiles[x][y + 1]

                    this.swapTilesInternal(tile, tileDown)

                    const matches = this.getMatches()

                    this.swapTilesInternal(tile, tileDown)

                    if (matches.length > 0) {
                        return [tile, tileDown]
                    }
                }
            }
        }

        return null
    }
}
