import { GRID_CONFIG } from '../constants/const'
import { Tile } from '../objects/tile'

type GridTile = Tile | undefined

export class GameScene extends Phaser.Scene {
    // Variables
    private canMove!: boolean

    // Grid with tiles
    private grid!: GridTile[][]

    // Selected Tiles
    private firstSelectedTile!: GridTile
    private secondSelectedTile!: GridTile

    constructor() {
        super({
            key: 'GameScene',
        })
    }

    init(): void {
        // Init variables
        this.canMove = true

        // set background color
        this.cameras.main.setBackgroundColor(0x78aade)

        // Init grid with tiles
        this.grid = []
        for (let y = 0; y < GRID_CONFIG.gridHeight; y++) {
            this.grid[y] = []
            for (let x = 0; x < GRID_CONFIG.gridWidth; x++) {
                this.addTile(x, y)
            }
        }

        // Selected Tiles
        this.firstSelectedTile = undefined
        this.secondSelectedTile = undefined

        // Input
        this.input.on('gameobjectdown', this.tileDown, this)

        // Check for matches when 'gridTransitionComplete' is fired
        this.events.on('tilegrid.transitioncomplete', () => {
            this.checkMatches()
        })
        
        // Check if matches on the start
        this.events.emit('tilegrid.transitioncomplete')
    }

    /**
     * Add a new random tile at the specified position.
     * @param x
     * @param y
     */
    private addTile(x: number, y: number, offsetY = 0): Tile {
        // Get a random tile
        const randomTileType: string =
            GRID_CONFIG.candyTypes[Phaser.Math.RND.between(0, GRID_CONFIG.candyTypes.length - 1)]

        // Return the created tile
        const tile = new Tile({
            scene: this,
            x: x * GRID_CONFIG.tileWidth,
            y: y * GRID_CONFIG.tileHeight + offsetY,
            texture: randomTileType,
        })

        // y, x because the grid is row first
        this.grid[y][x] = tile

        return tile
    }

    /**
     * This function gets called, as soon as a tile has been pressed or clicked.
     * It will check, if a move can be done at first.
     * Then it will check if a tile was already selected before or not (if -> else)
     * @param pointer
     * @param gameobject
     * @param event
     */
    private tileDown(pointer: Phaser.Input.Pointer, gameobject: Tile): void {
        if (this.canMove) {
            if (!this.firstSelectedTile) {
                this.firstSelectedTile = gameobject
            } else {
                // So if we are here, we must have selected a second tile
                this.secondSelectedTile = gameobject

                const dx =
                    Math.abs(this.firstSelectedTile.x - this.secondSelectedTile.x) /
                    GRID_CONFIG.tileWidth
                const dy =
                    Math.abs(this.firstSelectedTile.y - this.secondSelectedTile.y) /
                    GRID_CONFIG.tileHeight

                // Check if the selected tiles are both in range to make a move
                if ((dx === 1 && dy === 0) || (dx === 0 && dy === 1)) {
                    this.canMove = false
                    this.swapTiles()
                }
            }
        }
    }

    /**
     * This function will take care of the swapping of the two selected tiles.
     * It will only work, if two tiles have been selected.
     */
    private swapTiles(): void {
        if (this.firstSelectedTile && this.secondSelectedTile) {
            // Get the position of the two tiles
            const firstTilePosition = {
                x: this.firstSelectedTile.x,
                y: this.firstSelectedTile.y,
            }

            const secondTilePosition = {
                x: this.secondSelectedTile.x,
                y: this.secondSelectedTile.y,
            }

            // Swap them in our grid with the tiles
            this.grid[firstTilePosition.y / GRID_CONFIG.tileHeight][
                firstTilePosition.x / GRID_CONFIG.tileWidth
            ] = this.secondSelectedTile
            this.grid[secondTilePosition.y / GRID_CONFIG.tileHeight][
                secondTilePosition.x / GRID_CONFIG.tileWidth
            ] = this.firstSelectedTile

            // Move them on the screen with tweens
            this.add.tween({
                targets: this.firstSelectedTile,
                x: this.secondSelectedTile.x,
                y: this.secondSelectedTile.y,
                ease: 'Linear',
                duration: 200,
                repeat: 0,
                yoyo: false,
            })

            this.add.tween({
                targets: this.secondSelectedTile,
                x: this.firstSelectedTile.x,
                y: this.firstSelectedTile.y,
                ease: 'Linear',
                duration: 200,
                repeat: 0,
                yoyo: false,
                onComplete: () => {
                    // this.checkMatches()

                    this.events.emit('tilegrid.transitioncomplete')
                },
            })

            this.firstSelectedTile =
                this.grid[firstTilePosition.y / GRID_CONFIG.tileHeight][
                    firstTilePosition.x / GRID_CONFIG.tileWidth
                ]
            this.secondSelectedTile =
                this.grid[secondTilePosition.y / GRID_CONFIG.tileHeight][
                    secondTilePosition.x / GRID_CONFIG.tileWidth
                ]
        }
    }

    private checkMatches(): void {
        //Call the getMatches function to check for spots where there is
        //a run of three or more tiles in a row
        const matches = this.getMatches(this.grid)

        //If there are matches, remove them
        if (matches.length > 0) {
            //Remove the tiles
            this.removeTileGroups(matches)
            // Move the tiles currently on the board into their new positions
            this.resetTile()
            //Fill the board with new tiles wherever there is an empty spot
            this.fillTile()
            this.tileUp()
            // this.checkMatches()
        } else {
            // No match so just swap the tiles back to their original position and reset
            this.swapTiles()
            this.tileUp()
            this.canMove = true
        }
    }

    private resetTile(): void {
        // Loop through each row starting from the bottom
        let y = this.grid.length - 1
        while (y > 0) {
            // Loop through each tile in column from right to left
            let x = this.grid[y].length - 1
            const yp = y

            while (x >= 0) {
                // If this space is blank, but the one above it is not, move the one above down
                if (this.grid[yp][x] === undefined && this.grid[yp - 1][x] !== undefined) {
                    // Move the tile above down one
                    const tempTile = this.grid[yp - 1][x]
                    this.grid[yp][x] = tempTile
                    this.grid[yp - 1][x] = undefined

                    this.add.tween({
                        targets: tempTile,
                        y: GRID_CONFIG.tileHeight * yp,
                        ease: Phaser.Math.Easing.Bounce.Out,
                        duration: 400,
                        repeat: 0,
                        yoyo: false,
                        onComplete: () => {
                            // this.checkMatches()

                            this.events.emit('tilegrid.transitioncomplete')
                        }
                    })

                    x = this.grid[yp].length - 1
                    y = this.grid.length - 1
                } else {
                    x--
                }
            }
            y--
        }
    }

    private fillTile(): void {
        //Check for blank spaces in the grid and add new tiles at that position
        for (let y = 0; y < this.grid.length; y++) {
            for (let x = 0; x < this.grid[y].length; x++) {
                if (this.grid[y][x] === undefined) {
                    //Found a blank spot so lets add animate a tile there
                    const tile = this.addTile(x, y, -GRID_CONFIG.tileHeight).setAlpha(0)

                    //And also update our "theoretical" grid
                    this.grid[y][x] = tile
                    
                    // tween the tile into place
                    this.add.tween({
                        targets: tile,
                        y: GRID_CONFIG.tileHeight * y,
                        ease: Phaser.Math.Easing.Bounce.Out,
                        duration: 400,
                        onStart: () => {
                            tile.setAlpha(1)
                        },
                    })
                }
            }
        }
    }

    private tileUp(): void {
        // Reset active tiles
        this.firstSelectedTile = undefined
        this.secondSelectedTile = undefined
    }

    private removeTileGroups(matches: Tile[][]): void {
        // Loop through all the matches and remove the associated tiles
        for (const match of matches) {
            for (const tile of match) {
                const warn = this.removeTile(tile)
                if (!warn) {
                    console.warn('Tile not found in grid')
                }
            }
        }
    }

    private removeTile(tile: Tile): boolean {
        //Find where this tile lives in the theoretical grid
        const { x, y } = this.getTilePos(this.grid, tile)

        if (x === -1 || y === -1) return false

        // Remove the tile from the theoretical grid
        tile.destroy()
        this.grid[y][x] = undefined

        return true
    }

    private getTilePos(tileGrid: GridTile[][], tile: Tile): { x: number; y: number } {
        // Find the position of a specific tile in the grid
        for (let y = 0; y < tileGrid.length; y++) {
            for (let x = 0; x < tileGrid[y].length; x++) {
                //There is a match at this position so return the grid coords
                if (tile === tileGrid[y][x]) {
                    return { x, y }
                }
            }
        }

        return { x: -1, y: -1 }
    }

    private getMatches(tileGrid: GridTile[][]): Tile[][] {
        // replace with reduce
        // return [...this.getHorizontalMatches(tileGrid), ...this.getVerticalMatches(tileGrid)]

        const matches = []

        matches.push(...this.getHorizontalMatches(tileGrid))
        matches.push(...this.getVerticalMatches(tileGrid))

        return matches
    }

    private getHorizontalMatches(tileGrid: GridTile[][]): Tile[][] {
        return tileGrid.reduce((prev, row) => {
            return [...prev, ...this.getRowMatches(row)]
        }, [] as Tile[][])
    }

    private getRowMatches(row: GridTile[]): Tile[][] {
        let groups = []
        const size = row.length
        const matches = []

        for (let x = 0; x < size - 2; x++) {
            const curr = row[x]
            const right = row[x + 1]
            const right2 = row[x + 2]

            if (
                !curr ||
                !right ||
                !right2 ||
                curr.texture.key !== right.texture.key ||
                right.texture.key !== right2.texture.key
            )
                continue

            const indexOfCurr = groups.indexOf(curr)
            const indexOfRight = groups.indexOf(right)
            const indexOfRight2 = groups.indexOf(right2)

            // if the group is full and this is the first match
            // must be new group
            if (groups.length > 0 && indexOfCurr === -1) {
                matches.push(groups)
                groups = []
            }

            if (indexOfCurr === -1) {
                groups.push(curr)
            }

            if (indexOfRight === -1) {
                groups.push(right)
            }

            if (indexOfRight2 === -1) {
                groups.push(right2)
            }
        }

        if (groups.length > 0) {
            matches.push(groups)
        }

        return matches
    }

    private getVerticalMatches(tileGrid: GridTile[][]): Tile[][] {
        const size = tileGrid[0].length

        const matches = []

        for (let x = 0; x < size; x++) {
            const col = this.getColMatches(tileGrid, x)
            matches.push(...col)
        }

        // change to reduce
        return matches
    }

    private getColMatches(grid: GridTile[][], colIndex: number): Tile[][] {
        let groups = []
        const size = grid[0].length
        const matches = []

        for (let y = 0; y < size - 2; y++) {
            const curr = grid[y][colIndex]
            const below = grid[y + 1][colIndex]
            const below2 = grid[y + 2][colIndex]

            if (
                !curr ||
                !below ||
                !below2 ||
                curr.texture.key !== below.texture.key ||
                below.texture.key !== below2.texture.key
            )
                continue

            const indexOfCurr = groups.indexOf(curr)
            const indexOfBelow = groups.indexOf(below)
            const indexOfBelow2 = groups.indexOf(below2)

            // if the group is full and this is the first match
            // must be new group
            if (groups.length > 0 && indexOfCurr === -1) {
                matches.push(groups)
                groups = []
            }

            if (indexOfCurr === -1) {
                groups.push(curr)
            }

            if (indexOfBelow === -1) {
                groups.push(below)
            }

            if (indexOfBelow2 === -1) {
                groups.push(below2)
            }
        }

        if (groups.length > 0) {
            matches.push(groups)
        }

        return matches
    }
}
