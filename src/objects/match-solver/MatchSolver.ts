import CandyGrid from '../candy-grid/CandyGrid'
import Tile from '../tile/Tile'

type Match = {
    target: Tile
    sources: Tile[]
}

function getNeighboursOf(tile: Tile, grid: CandyGrid) {
    const top = grid.getTileAt(tile.gridCoords.x - 1, tile.gridCoords.y)
    const bottom = grid.getTileAt(tile.gridCoords.x + 1, tile.gridCoords.y)
    const left = grid.getTileAt(tile.gridCoords.x, tile.gridCoords.y - 1)
    const right = grid.getTileAt(tile.gridCoords.x, tile.gridCoords.y + 1)

    return [top, bottom, left, right].filter((tile) => tile !== null) as Tile[]
}

function getTileInArray(x: number, y: number, array: Tile[]) {
    return array.find((tile) => tile.gridCoords.x === x && tile.gridCoords.y === y)
}

function findLongestHorizontal(at: Tile, array: Tile[]): Match {
    const match: Match = {
        target: at,
        sources: [at],
    }

    let left = getTileInArray(at.gridCoords.x, at.gridCoords.y - 1, array)
    let right = getTileInArray(at.gridCoords.x, at.gridCoords.y + 1, array)

    // try to expand left
    while (left?.isSameAs(at)) {
        match.sources.push(left)
        left = getTileInArray(left.gridCoords.x, left.gridCoords.y - 1, array)
    }

    // try to expand right
    while (right?.isSameAs(at)) {
        match.sources.push(right)
        right = getTileInArray(right.gridCoords.x, right.gridCoords.y + 1, array)
    }

    return match
}

/**
 * Find horizontals matches where there are at least 3 in a row
 * @param array
 */
function findHorizontalMatchIn(array: Tile[]): Match[] {
    const matches: Match[] = []
    const visited: Tile[] = []

    array.forEach((tile) => {
        if (visited.includes(tile)) {
            return
        }

        const match = findLongestHorizontal(tile, array)

        if (match.sources.length >= 3) {
            matches.push(match)
        }

        visited.push(...match.sources)
    })

    return matches
}

function findLongestVertical(at: Tile, array: Tile[]): Match {
    const match: Match = {
        target: at,
        sources: [at],
    }

    let above = getTileInArray(at.gridCoords.x - 1, at.gridCoords.y, array)
    let below = getTileInArray(at.gridCoords.x + 1, at.gridCoords.y, array)

    // try to expand above
    while (above?.isSameAs(at)) {
        match.sources.push(above)
        above = getTileInArray(above.gridCoords.x - 1, above.gridCoords.y, array)
    }

    // try to expand below
    while (below?.isSameAs(at)) {
        match.sources.push(below)
        below = getTileInArray(below.gridCoords.x + 1, below.gridCoords.y, array)
    }

    return match
}

function findVerticalMatchIn(array: Tile[]): Match[] {
    const matches: Match[] = []
    const visited: Tile[] = []

    array.forEach((tile) => {
        if (visited.includes(tile)) {
            return
        }

        const match = findLongestVertical(tile, array)

        if (match.sources.length >= 3) {
            matches.push(match)
        }

        visited.push(...match.sources)
    })

    return matches
}

export default function findClearables(at: Tile, grid: CandyGrid) {
    // breadth first search to find all tiles where .isSameAs() is true
    const queue: Tile[] = [at]
    const visited: Tile[] = []
    const flood: Tile[] = [at]

    // cancel if any affiliated tile is not ready
    let hasNotReadyTile = false

    while (queue.length > 0) {
        const tile = queue.shift() as Tile
        visited.push(tile)

        const neighbours = getNeighboursOf(tile, grid)
        const sameNeighbours = neighbours.filter((neighbour) => {
            if (!neighbour.isReady()) {
                hasNotReadyTile = true
            }

            return !visited.includes(neighbour) && tile.isSameAs(neighbour) && neighbour.isReady()
        })

        if (sameNeighbours.length > 0) {
            queue.push(...sameNeighbours)
            flood.push(...sameNeighbours)
        }
    }

    if (hasNotReadyTile) {
        // return []
    }

    // find horizontal matches
    const horizontalMatches = findHorizontalMatchIn(flood)

    // find vertical matches
    const verticalMatches = findVerticalMatchIn(flood)

    // combine matches
    const matches = [...horizontalMatches, ...verticalMatches]

    return matches
}
