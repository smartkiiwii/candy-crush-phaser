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

export interface TileConfig {
    id: string
    grid: CandyGrid
    clearParticles: Phaser.GameObjects.Particles.ParticleEmitter
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

    /**
     * 
     * @param scene The Scene to which this Game Object belongs. A Game Object can only belong to one Scene at a time.
     * @param x The horizontal position of this Game Object in the world.
     * @param y The vertical position of this Game Object in the world.
     * @param texture The key, or instance of the Texture this Game Object will use to render with, as stored in the Texture Manager.
     * @param frame An optional frame from the Texture this Game Object is rendering with.
     */
    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, frame?: string | number) {
        super(scene, x, y, texture, frame)

        this.clearParticles = null
        this.gridCoords = new Vector2()
        this.tileEvents = new Phaser.Events.EventEmitter()
        this.grid = null

        this.id = ''
        this.isFalling = false
        this.isFocused = false
        this.isHinting = false
        this.isClearing = false

        this.idleState = new IdleState(this, {})
        const fallState = new FallState(this, {
            enterCondition: () => this.isFalling,
            onEnter: () => {
                // tell above to fall
                const above = this.grid?.getTileAt(this.gridCoords.x, this.gridCoords.y - 1)
                if (above) {
                    above.setFalling()
                }
            },
            onExit: () => {
                this.isFalling = false
                this.tryClear()

                if (this.grid) {
                    // try clear adjacent tiles
                    const neighbours = this.grid.getNeighboursOf(this)
                    neighbours.forEach(neighbour => {
                        neighbour.tryClear()
                    })
                }
            },
        })

        const focusState = new FocusState(this, {
            enterCondition: () => this.isFocused,
            exitCondition: () => !this.isFocused || this.isClearing,
        })

        const hintState = new HintState(this, {
            enterCondition: () => this.isHinting,
            onExit: () => {
                this.isHinting = false
            },
        })

        const deadState = new DeadState(this)

        this.clearState = new ClearState(this, this.clearParticles, {
            enterCondition: () => this.isClearing,
            onExit: () => {
                this.grid?.clearTileAt(this.gridCoords.x, this.gridCoords.y)
                this.setVisible(false)
                this.isClearing = false

                // set above tiles to fall
                const above = this.grid?.getTileAt(this.gridCoords.x, this.gridCoords.y - 1)
                if (above) {
                    above.setFalling()
                }
            }
        })
        
        const animMap = new Map<TileState, TileState[]>()
        animMap.set(this.idleState, [fallState, focusState, hintState, this.clearState])
        animMap.set(fallState, [this.clearState, this.idleState])
        animMap.set(focusState, [this.clearState, fallState, this.idleState])
        animMap.set(hintState, [focusState, this.idleState])
        animMap.set(this.clearState, [deadState])
        animMap.set(deadState, [])

        this.animator = new AnimationController(this.idleState, animMap)
    }

    reset(config: TileConfig, resetAnimator = false, attemptClear = false) {
        const { id, grid, clearParticles, x, y, gridX, gridY, texture, frame } = config

        this.setVisible(true)

        this.id = id
        this.grid = grid
        this.gridCoords.set(gridX, gridY)

        this.clearParticles = clearParticles

        this.setPosition(x, y)
        
        if (this.texture.key !== texture) {
            this.setTexture(texture)
        }

        if (this.frame.name !== frame) {
            this.setFrame(frame)
        }

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
            neighbours.forEach(neighbour => {
                neighbour.tryClear()
            })
        }
    }

    update(time: number, delta: number) {
        if (this.active) {
            this.animator.update(time, delta)
        }
    }

    setFocused(focused = true) {
        if (!this.active) {
            throw new Error("Tile: cannot set focus on inactive tile")
        }

        this.isFocused = focused
    }

    setFalling() {
        if (!this.active) {
            throw new Error("Tile: cannot set falling on inactive tile")
        }

        this.isFalling = true
    }

    setHinting() {
        if (!this.active) {
            throw new Error("Tile: cannot set hinting on inactive tile")
        }

        this.isHinting = true
    }

    setClearing(clearing = true) {
        if (!this.active) {
            throw new Error("Tile: cannot set clearing on inactive tile")
        }

        if (!this.grid) {
            throw new Error("Tile: cannot clear tile without grid")
        }

        this.clearState.emitter = this.clearParticles
        this.isClearing = clearing

        // TODO: add logic to handle special clears, now only clear itself
    }

    tryClear(): Tile[] {
        if (!this.active) {
            throw new Error("Tile: cannot clear inactive tile")
        }

        if (!this.grid) {
            throw new Error("Tile: cannot clear tile without grid")
        }

        if (!this.isReady()) {
            return []
        }

        const matches = findClearables(this, this.grid)

        if (matches.length > 0) {
            // this.setClearing()

            matches.forEach(match => {
                const size = match.sources.length
                match.sources.forEach(source => {
                    source.clearState.clearTarget = size > 3 ? match.target : source
                    source.setClearing()
                })
            })

            return matches.flatMap(match => match.sources)
        }

        return []
    }

    tryPlayLongIdle(delay: number) {
        if (!this.active) {
            throw new Error("Tile: cannot play long idle on inactive tile")
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
            throw new Error("Tile: cannot swap inactive tile")
        }

        if (!tile.active) {
            throw new Error("Tile: cannot swap with inactive tile")
        }

        if (!this.grid) {
            throw new Error("Tile: cannot swap tile without grid")
        }

        if (!tile.grid) {
            throw new Error("Tile: cannot swap tile without grid")
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
                    Phaser.Math.Interpolation.Bezier([thisPos.y, tilePos.y], value),
                )

                tile.setPosition(
                    Phaser.Math.Interpolation.Bezier([tilePos.x, thisPos.x], value),
                    Phaser.Math.Interpolation.Bezier([tilePos.y, thisPos.y], value),
                )
            },
            onComplete: () => {
                if (!this.grid) {
                    throw new Error("Tile: cannot swap tile without grid")
                }
                
                this.grid.swapTilesInternal(this, tile)

                const temp = this.gridCoords.clone()
                this.gridCoords.copy(tile.gridCoords)
                tile.gridCoords.copy(temp)

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
                                Phaser.Math.Interpolation.Bezier([tilePos.y, thisPos.y], value),
                            )
    
                            tile.setPosition(
                                Phaser.Math.Interpolation.Bezier([thisPos.x, tilePos.x], value),
                                Phaser.Math.Interpolation.Bezier([thisPos.y, tilePos.y], value),
                            )
                        }
                    })
                }
            }
        })


        // return []
    }

    isSameAs(tile: Tile) {
        return this.id === tile.id
    }

    isReady() {
        return !this.isClearing && !this.isFalling
    }
}
