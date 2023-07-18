import { AnimationState, AnimationStateConfig } from '@/classes/AnimationController'
import CandyGrid from '@/objects/candy-grid/CandyGrid'

export default abstract class GridState extends AnimationState {
    protected grid: CandyGrid

    constructor(grid: CandyGrid, config: AnimationStateConfig) {
        super(config)
        this.grid = grid
    }
}
