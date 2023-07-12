export const StateMachineEvents = {
    STATE_CHANGE: 'stateChange',
    STATE_RESET: 'stateReset',
} as const

export type StateMachineEvents = typeof StateMachineEvents[keyof typeof StateMachineEvents]

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
        this.emitter.emit('stateChange', state, prev)
    }

    public trasitionNext(): void {
        if (this.stateMap.has(this.state)) {
            const nextState = this.stateMap.get(this.state) as T
            this.transition(nextState)
        }
    }

    public resetState(): void {
        this.state = this.initialState

        this.emitter.emit('stateChange', this.state)
        this.emitter.emit('stateReset', this.state)

        this.emitter.removeAllListeners()
    }

    public is(state: T): boolean {
        return this.state === state
    }

    public canTransitionTo(state: T): boolean {
        return this.stateMap.has(state)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public onStateChange(event: StateMachineEvents, callback: (state: T, prev: T) => void, context?: any): void {
        this.emitter.on(event, callback, context)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public offStateChange(event: StateMachineEvents, callback: (state: T, prev: T) => void, context?: any): void {
        this.emitter.off(event, callback, context)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public onceStateChange(event: StateMachineEvents, callback: (state: T, prev: T) => void, context?: any): void {
        this.emitter.once(event, callback, context)
    }
}