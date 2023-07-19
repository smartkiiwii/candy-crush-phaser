import StateMachine from './StateMachine'

export interface AnimationStateConfig {
    name: string
    onEnter?: ((state: AnimationState) => void) | null
    onUpdate?: ((state: AnimationState, time: number, delta: number) => void) | null
    onExit?: ((state: AnimationState) => void) | null
    enterCondition?: () => boolean
    exitCondition?: () => boolean
}

export abstract class AnimationState {
    readonly name: string

    constructor(config: AnimationStateConfig) {
        this.name = config.name

        this.onEnter = config.onEnter ?? null
        this.onUpdate = config.onUpdate ?? null
        this.onExit = config.onExit ?? null

        this.enterCondition = config.enterCondition ?? null
        this.exitCondition = config.exitCondition ?? null
    }

    enter() {
        if (this.onEnter) {
            this.onEnter(this)
        }
    }

    update(time: number, delta: number) {
        if (this.onUpdate) {
            this.onUpdate(this, time, delta)
        }
    }

    exit() {
        if (this.onExit) {
            this.onExit(this)
        }
    }

    canEnter() {
        return this.enterCondition?.() ?? true
    }

    canExit() {
        return this.exitCondition?.() ?? true
    }

    private onEnter: ((state: AnimationState) => void) | null
    private onUpdate: ((state: AnimationState, time: number, delta: number) => void) | null
    private onExit: ((state: AnimationState) => void) | null

    private enterCondition: (() => boolean) | null
    private exitCondition: (() => boolean) | null
}
export default class AnimationController extends StateMachine<AnimationState> {
    constructor(
        initialState: AnimationState,
        directedGraph: Map<AnimationState, AnimationState[]>
    ) {
        AnimationController.validateDirectedGraph(initialState, directedGraph)
        super(initialState, directedGraph)

        // enter initial state
        this.getState().enter()
    }

    public transition(state: AnimationState): void {
        this.getState().exit()

        super.transition(state)

        this.getState().enter()
    }

    public update(time: number, delta: number): void {
        // checks if the state can exit
        if (this.getState().canExit()) {
            const next = this.getNextStates()?.find((state) => state.canEnter())

            // checks if there are next states and
            // get first state that can enter
            if (next) {
                this.transition(next)
                return
            }
        }

        this.getState().update(time, delta)
    }

    public reset() {
        this.getState().exit()

        this.resetState()

        this.getState().enter()
    }

    private static validateDirectedGraph(
        initialState: AnimationState,
        directedGraph: Map<AnimationState, AnimationState[]>
    ) {
        // all state have to have a unique name
        const states = Array.from(directedGraph.keys())
        const names = states.map((state) => state.name)
        if (new Set(names).size !== names.length) {
            throw new Error('All states have to have a unique name')
        }

        // all states have to be in the directed graph
        if (!states.includes(initialState)) {
            throw new Error('Initial state has to be in the directed graph')
        }

        for (const state of states) {
            const nextStates = directedGraph.get(state)
            if (nextStates) {
                for (const nextState of nextStates) {
                    if (!states.includes(nextState)) {
                        throw new Error('All states have to be in the directed graph')
                    }
                }
            }
        }
    }
}
