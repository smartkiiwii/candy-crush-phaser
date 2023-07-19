import { AnimationStateConfig } from '@/classes/AnimationController'
import Tile from '../../Tile'
import TileState from '../TileState'

export default class DeadState extends TileState {
    constructor(tile: Tile, config?: Omit<AnimationStateConfig, 'name'>) {
        super(tile, {
            ...config,
            name: 'dead',
        })
    }
}
