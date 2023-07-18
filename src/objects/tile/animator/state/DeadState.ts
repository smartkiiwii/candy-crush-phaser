import Tile from "../../Tile"
import TileState from "../TileState"

export default class DeadState extends TileState {
    constructor(tile: Tile) {
        super(tile, {
            name: "dead",
        })
    }
}