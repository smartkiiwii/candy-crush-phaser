import Vector2 = Phaser.Math.Vector2
import CandyGrid from '../candy-grid/CandyGrid'
import FallState from './animator/state/FallState'
import FocusState from './animator/state/FocusState'
import HintState from './animator/state/HintState'
import IdleState from './animator/state/IdleState'
import AnimationController from '@/classes/AnimationController'
import TileState from './animator/TileState'
import ClearState from './animator/state/ClearState'
import findClearables from '../match-solver/MatchSolver'
import DeadState from './animator/state/DeadState'

export const SpecialType = {
    NONE: 'NONE',
    SMALL_EXPLOSION: 'SMALL_EXPLOSION',
    BIG_EXPLOSION: 'BIG_EXPLOSION',
} as const

export type SpecialType = (typeof SpecialType)[keyof typeof SpecialType]

export interface TileConfig {
    id: string
    grid: CandyGrid
    clearParticles: Phaser.GameObjects.Particles.ParticleEmitter
    specialParticles: Phaser.GameObjects.Particles.ParticleEmitter
    explosionParticles: Phaser.GameObjects.Particles.ParticleEmitter
    x: number
    y: number
    gridX: number
    gridY: number
    texture: string
    frame: string | number
}

export default class Tile extends Phaser.GameObjects.Image {
    public gridCoords: Vector2
    public readonly tileEvents: Phaser.Events.EventEmitter
    public readonly animator: AnimationController

    private grid: CandyGrid | null

    // stateful
    private id: string

    private isFalling: boolean
    private isFocused: boolean
    private isHinting: boolean
    private isClearing: boolean

    private idleState: IdleState
    private clearState: ClearState
    private clearParticles: Phaser.GameObjects.Particles.ParticleEmitter | null
    private specialParticles: Phaser.GameObjects.Particles.ParticleEmitter | null
    private explosionParticles: Phaser.GameObjects.Particles.ParticleEmitter | null

    private specialType: SpecialType
    private specialTileFX: Phaser.GameObjects.Image

    /**
     *
     * @param scene The Scene to which this Game Object belongs. A Game Object can only belong to one Scene at a time.
     * @param x The horizontal position of this Game Object in the world.
     * @param y The vertical position of this Game Object in the world.
     * @param texture The key, or instance of the Texture this Game Object will use to render with, as stored in the Texture Manager.
     * @param frame An optional frame from the Texture this Game Object is rendering with.
     */
    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        texture: string,
        frame?: string | number
    ) {
        super(scene, x, y, texture, frame)

        this.clearParticles = null
        this.specialParticles = null
        this.explosionParticles = null
        this.gridCoords = new Vector2()
        this.tileEvents = new Phaser.Events.EventEmitter()
        this.grid = null

        this.id = ''
        this.isFalling = false
        this.isFocused = false
        this.isHinting = false
        this.isClearing = false

        this.idleState = new IdleState(this, {})

        let hasEmptyTileBelow = false
        const fallState = new FallState(this, {
            enterCondition: () => this.isFalling,
            exitCondition: () => !hasEmptyTileBelow,
            onEnter: () => {
                if (!this.grid) {
                    throw new Error('Tile: cannot fall without grid')
                }

                hasEmptyTileBelow = true

                // tell above to fall
                const above = getNearestAbove(
                    this.grid.getTiles(),
                    this.gridCoords.x,
                    this.gridCoords.y
                )
                if (above) {
                    above.setFalling()
                }
            },
            onUpdate: () => {
                if (!this.grid) {
                    throw new Error('Tile: cannot fall without grid')
                }

                hasEmptyTileBelow = hasClearedBelow(
                    this.grid.getTiles(),
                    this.gridCoords.x,
                    this.gridCoords.y
                )

                const immediateBelow = this.grid.getTileAt(this.gridCoords.x + 1, this.gridCoords.y)
                if (hasEmptyTileBelow && immediateBelow && !immediateBelow.active) {
                    // swap tiles
                    this.grid.swapTilesInternal(this, immediateBelow)

                    // swap coords with it
                    const temp = this.gridCoords.clone()
                    this.gridCoords.copy(immediateBelow.gridCoords)
                    immediateBelow.gridCoords.copy(temp)
                }

                // if still have empty tile below, but can't be swapped yet, suspense
                if (hasEmptyTileBelow && immediateBelow && immediateBelow.active) {
                    fallState.suspense()
                }
            },
            onExit: () => {
                if (!this.grid) {
                    throw new Error('Tile: cannot fall without grid')
                }

                this.isFalling = false

                if (this.active) {
                    this.tryClear()
                }

                // try clear adjacent tiles
                const neighbours = this.grid.getNeighboursOf(this)
                neighbours.forEach((neighbour) => {
                    neighbour?.tryClear()
                })
            },
        })

        const focusState = new FocusState(this, {
            enterCondition: () => this.isFocused,
            exitCondition: () => !this.isFocused || this.isClearing || this.isFalling,
        })

        const hintState = new HintState(this, {
            enterCondition: () => this.isHinting,
            onExit: () => {
                this.isHinting = false
            },
        })

        const deadState = new DeadState(this)

        this.clearState = new ClearState(this, {
            enterCondition: () => this.isClearing,
            onExit: () => {
                this.isClearing = false

                if (!this.grid) {
                    throw new Error('Tile: cannot clear tile without grid')
                }

                this.setActive(false)
                this.setVisible(false)

                this.grid.clearTileAt(this.gridCoords.x, this.gridCoords.y)

                const above = getNearestAbove(
                    this.grid.getTiles(),
                    this.gridCoords.x,
                    this.gridCoords.y
                )

                if (above) {
                    above.setFalling()
                }

                // queue respawn
                // const hasEmptyTileBelow = hasClearedBelow(this.grid.getTiles(), this.gridCoords.x, this.gridCoords.y)

                // if (!hasEmptyTileBelow) {
                //     // must be at the bottom of the block of empty tiles,
                //     this.grid.queueRespawn(this, this.gridCoords.x + 1)
                // }
            },
        })

        const animMap = new Map<TileState, TileState[]>()
        animMap.set(this.idleState, [fallState, focusState, hintState, this.clearState])
        animMap.set(fallState, [this.clearState, this.idleState])
        animMap.set(focusState, [this.clearState, fallState, this.idleState])
        animMap.set(hintState, [focusState, this.idleState])
        animMap.set(this.clearState, [deadState])
        animMap.set(deadState, [])

        this.animator = new AnimationController(this.idleState, animMap)

        this.specialType = SpecialType.NONE
        this.specialTileFX = scene.add
            .image(0, 0, 'shine')
            .setScale(1.3)
            .setTint(0xffff00)
            .setVisible(false)

        scene.add.tween({
            targets: this.specialTileFX,
            duration: 20000,
            repeat: -1,
            angle: 360,
        })

        scene.add.tween({
            targets: this.specialTileFX,
            duration: 2000,
            repeat: -1,
            yoyo: true,
            alpha: 0.9,
            scale: 1.1,
        })
    }

    reset(config: TileConfig, resetAnimator = false, attemptClear = false) {
        const {
            id,
            grid,
            clearParticles,
            specialParticles,
            explosionParticles,
            x,
            y,
            gridX,
            gridY,
            texture,
            frame,
        } = config

        this.setVisible(true)

        this.specialType = SpecialType.NONE
        this.specialTileFX.setVisible(false)

        this.id = id
        this.grid = grid
        this.gridCoords.set(gridX, gridY)

        if (this.specialTileFX.parentContainer) {
            this.specialTileFX.parentContainer.remove(this.specialTileFX)
        }

        this.grid.add(this.specialTileFX).moveBelow(this.specialTileFX, this)

        this.clearParticles = clearParticles
        this.specialParticles = specialParticles
        this.explosionParticles = explosionParticles

        this.setPosition(x, y)

        if (this.texture.key !== texture) {
            this.setTexture(texture)
        }

        this.setCandyType(frame)

        this.isFalling = true
        this.isFocused = false
        this.isHinting = false
        this.isClearing = false

        if (resetAnimator) {
            this.animator.reset()
        }

        if (attemptClear) {
            this.tryClear()

            // try clear adjacent tiles
            const neighbours = this.grid.getNeighboursOf(this)
            neighbours.forEach((neighbour) => {
                neighbour?.tryClear()
            })
        }
    }

    setId(id: string) {
        this.id = id
    }

    setCandyType(frame: string | number) {
        if (this.frame.name !== frame) {
            this.setFrame(frame)
        }
    }

    update(time: number, delta: number) {
        this.animator.update(time, delta)

        // move special tile fx to the center of the tile
        this.specialTileFX.setPosition(
            this.getCenter().x ?? 0 * (this.parentContainer?.scaleX ?? 1),
            this.getCenter().y ?? 0 * (this.parentContainer?.scaleY ?? 1)
        )
    }

    setFocused(focused = true) {
        if (!this.active) {
            throw new Error('Tile: cannot set focus on inactive tile')
        }

        this.isFocused = focused
    }

    setFalling() {
        if (!this.active) {
            throw new Error('Tile: cannot set falling on inactive tile')
        }

        this.isFalling = true
    }

    setHinting() {
        if (!this.active) {
            throw new Error('Tile: cannot set hinting on inactive tile')
        }

        this.isHinting = true
    }

    setClearing(clearing = true) {
        if (!this.active) {
            throw new Error('Tile: cannot set clearing on inactive tile')
        }

        if (!this.grid) {
            throw new Error('Tile: cannot clear tile without grid')
        }

        if (this.isClearing) {
            return
        }

        this.grid?.emit('tile-clearing', 1)

        this.clearState.clearEmitter = this.clearParticles
        this.clearState.specialClearEmitter = this.specialParticles
        this.clearState.explosionEmitter = this.explosionParticles
        this.isClearing = clearing

        switch (this.specialType) {
            case SpecialType.SMALL_EXPLOSION:
                // erase all tiles in a 3x3 grid
                this.grid.getSurroundingTilesOf(this, 1).forEach((neighbour) => {
                    if (neighbour.active) {
                        neighbour.setClearing()
                    }
                })

                break

            case SpecialType.BIG_EXPLOSION:
                // erase all tiles in a 5x5 grid
                this.grid.getSurroundingTilesOf(this, 3).forEach((neighbour) => {
                    if (neighbour.active) {
                        neighbour.setClearing()
                    }
                })

                break

            default:
                break
        }
    }

    tryClear(): Tile[] {
        if (!this.active) {
            return []
        }

        if (!this.grid) {
            throw new Error('Tile: cannot clear tile without grid')
        }

        if (!this.isReady()) {
            return []
        }

        const matches = findClearables(this, this.grid.getTiles())

        matches.forEach((match) => {
            const size = match.sources.length
            match.sources.forEach((source) => {
                if (source === match.target && size > 4) {
                    source.specialType = SpecialType.BIG_EXPLOSION
                    source.specialTileFX.setVisible(true)
                    source.setFrame('box')
                    return
                }

                if (source === match.target && size > 3) {
                    source.specialType = SpecialType.SMALL_EXPLOSION
                    source.specialTileFX.setVisible(true)
                    return
                }

                source.clearState.clearTarget = size > 3 ? match.target : source
                source.setClearing()
            })
        })

        return matches.flatMap((match) => match.sources)
    }

    tryPlayLongIdle(delay: number) {
        if (!this.active) {
            throw new Error('Tile: cannot play long idle on inactive tile')
        }

        if (this.animator.getState().name === 'idle') {
            this.idleState.playLongIdle(delay)
        }
    }

    getGrid() {
        return this.grid
    }

    trySwapClear(tile: Tile) {
        if (!this.active) {
            throw new Error('Tile: cannot swap inactive tile')
        }

        if (!tile.active) {
            throw new Error('Tile: cannot swap with inactive tile')
        }

        if (!this.grid) {
            throw new Error('Tile: cannot swap tile without grid')
        }

        if (!tile.grid) {
            throw new Error('Tile: cannot swap tile without grid')
        }

        const thisPos = new Vector2(this.x, this.y)
        const tilePos = new Vector2(tile.x, tile.y)

        this.scene.tweens.addCounter({
            delay: 0, // run in next update
            duration: 200,
            ease: Phaser.Math.Easing.Sine.InOut,
            onStart: () => {
                thisPos.set(this.x, this.y)
                tilePos.set(tile.x, tile.y)

                this.isFocused = false
                tile.isFocused = false
            },
            onUpdate: (tween) => {
                const value = tween.getValue()

                this.setPosition(
                    Phaser.Math.Interpolation.Bezier([thisPos.x, tilePos.x], value),
                    Phaser.Math.Interpolation.Bezier([thisPos.y, tilePos.y], value)
                )

                tile.setPosition(
                    Phaser.Math.Interpolation.Bezier([tilePos.x, thisPos.x], value),
                    Phaser.Math.Interpolation.Bezier([tilePos.y, thisPos.y], value)
                )
            },
            onComplete: () => {
                if (!this.grid) {
                    throw new Error('Tile: cannot swap tile without grid')
                }

                this.grid.swapTilesInternal(this, tile)

                const temp = this.gridCoords.clone()
                this.gridCoords.copy(tile.gridCoords)
                tile.gridCoords.copy(temp)

                // if either is a special type of big explosion, clear it without having to check for clearables
                if (this.specialType === SpecialType.BIG_EXPLOSION) {
                    this.setClearing()
                }

                if (tile.specialType === SpecialType.BIG_EXPLOSION) {
                    tile.setClearing()
                }

                const clears = [...this.tryClear(), ...tile.tryClear()]

                if (clears.length === 0) {
                    // revert swap
                    this.grid.swapTilesInternal(this, tile)

                    temp.copy(this.gridCoords)
                    this.gridCoords.copy(tile.gridCoords)
                    tile.gridCoords.copy(temp)

                    // play swap animation
                    this.scene.tweens.addCounter({
                        duration: 200,
                        ease: Phaser.Math.Easing.Sine.InOut,
                        onUpdate: (tween) => {
                            const value = tween.getValue()

                            this.setPosition(
                                Phaser.Math.Interpolation.Bezier([tilePos.x, thisPos.x], value),
                                Phaser.Math.Interpolation.Bezier([tilePos.y, thisPos.y], value)
                            )

                            tile.setPosition(
                                Phaser.Math.Interpolation.Bezier([thisPos.x, tilePos.x], value),
                                Phaser.Math.Interpolation.Bezier([thisPos.y, tilePos.y], value)
                            )
                        },
                    })
                }
            },
        })

        // return []
    }

    isSameAs(tile: Tile) {
        return this.id === tile.id
    }

    isReady() {
        return !this.isClearing && !this.isFalling && this.active
    }

    getSpecialType() {
        return this.specialType
    }

    canRespawn(): boolean {
        if (!this.grid) {
            throw new Error('Tile: cannot fall without grid')
        }

        return (
            !getNearestAbove(this.grid.getTiles(), this.gridCoords.x, this.gridCoords.y) &&
            !hasClearedBelow(this.grid.getTiles(), this.gridCoords.x, this.gridCoords.y)
        )

        // the following is deprecated
        // const nearestAbove = getNearestAbove(this.grid.getTiles(), this.gridCoords.x, this.gridCoords.y)
        // const hasEmptyTileBelow = hasClearedBelow(this.grid.getTiles(), this.gridCoords.x, this.gridCoords.y)

        /**
         * if there is no tile above and no empty tile below,
         * must be at the bottom of the block of empty tiles,
         * reset all tiles by calling spawnTileAt() on the grid
         * the x coord of this is the amount of empty tiles above it
         */
        // the following is deprecated
        // if (!nearestAbove && !hasEmptyTileBelow) {
        //     const emptyTiles = this.gridCoords.x + 1
        //     for (let i = 0; i <= this.gridCoords.x; i++) {
        //         this.grid.spawnTileAt(i, this.gridCoords.y, emptyTiles)
        //     }
        // }
    }
}

/**
 * Get the nearest tile above the given tile
 * @param grid The grid to check
 * @param x Row index
 * @param y Column index
 * @returns The tile if found a tile above, null if has reached the top
 */
function getNearestAbove(grid: Tile[][], x: number, y: number) {
    let above = x - 1

    while (above >= 0 && !grid[above][y]?.active) {
        above--
    }

    if (above >= 0) {
        return grid[above][y]
    } else {
        return null
    }
}

/**
 * Check if there is a null tile below the given tile
 * @param grid The grid to check
 * @param x Row index
 * @param y Column index
 * @returns
 */
function hasClearedBelow(grid: Tile[][], x: number, y: number) {
    let below = x + 1

    while (below < grid.length && grid[below][y]?.active) {
        below++
    }

    return below < grid.length
}
