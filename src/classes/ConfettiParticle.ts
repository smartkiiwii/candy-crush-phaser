export default class ConfettiProcessor extends Phaser.GameObjects.Particles
    .ParticleProcessor {
    private strength: number

    /**
     *
     * @param config.x The x coordinate of the Particle Processor, in world space. Default 0.
     * @param config.y The y coordinate of the Particle Processor, in world space. Default 0.
     * @param config.active The active state of this Particle Processor. Default true.
     */
    constructor(config: {
        strength?: number
        x?: number
        y?: number
        active?: boolean
    }) {
        super(config.x, config.y, config.active)
        this.strength = config.strength ?? 0.95
    }

    update(particle: Phaser.GameObjects.Particles.Particle): void {
        particle.velocityX *= this.strength
        particle.velocityY *= this.strength
        particle.scaleX = ((particle.rotation / 180 * 20) % 3 - 1) * 0.3
    }
}
