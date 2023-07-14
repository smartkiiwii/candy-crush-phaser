export const StateMachineEvents = {
    STATE_CHANGE: 'stateChange',
    STATE_ENTER: 'stateEnter',
    STATE_EXIT: 'stateExit',
    STATE_RESET: 'stateReset',
} as const

export type StateMachineEvents = (typeof StateMachineEvents)[keyof typeof StateMachineEvents]

export default class StateMachine<T> {
    private initialState: T
    private state: T
    private emitter: Phaser.Events.EventEmitter
    private stateMap: Map<T, T>

    constructor(initialState: T) {
        this.initialState = initialState
        this.state = initialState
        this.emitter = new Phaser.Events.EventEmitter()
        this.stateMap = new Map<T, T>()

        this.stateMap.set(initialState, initialState)
    }

    public getState(): T {
        return this.state
    }

    public transition(state: T): void {
        const prev = this.state
        this.state = state
        this.emitter.emit(StateMachineEvents.STATE_CHANGE, state, prev)
        this.emitter.emit(StateMachineEvents.STATE_EXIT, prev, undefined)
        this.emitter.emit(StateMachineEvents.STATE_ENTER, state, undefined)
    }

    public trasitionNext(): void {
        if (this.stateMap.has(this.state)) {
            const nextState = this.stateMap.get(this.state) as T
            this.transition(nextState)
        }
    }

    public resetState(): void {
        this.state = this.initialState

        this.emitter.emit(StateMachineEvents.STATE_CHANGE, this.state)
        this.emitter.emit(StateMachineEvents.STATE_RESET, this.state)

        this.emitter.removeAllListeners()
    }

    public is(state: T): boolean {
        return this.state === state
    }

    public canTransitionTo(state: T): boolean {
        return this.stateMap.has(state)
    }

    // TODO: mark prev as can be undefined and handle it
    public onStateChange(
        event: StateMachineEvents,
        callback: (state: T, prev: T) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: any
    ): void {
        this.emitter.on(event, callback, context)
    }

    public offStateChange(
        event: StateMachineEvents,
        callback: (state: T, prev: T) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: any
    ): void {
        this.emitter.off(event, callback, context)
    }

    public onceStateChange(
        event: StateMachineEvents,
        callback: (state: T, prev: T) => void,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        context?: any
    ): void {
        this.emitter.once(event, callback, context)
    }
}
