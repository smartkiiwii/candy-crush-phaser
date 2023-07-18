import { AnimationState, AnimationStateConfig } from "@/classes/AnimationController"
import Tile from "../Tile"

export default class TileState extends AnimationState {
    protected tile: Tile
    protected scene: Phaser.Scene

    constructor(tile: Tile, config: AnimationStateConfig) {
        super(config)
        this.tile = tile
        this.scene = tile.scene
    }
}
