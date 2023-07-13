export default class DampenedParticleProcessor extends Phaser.GameObjects.Particles.ParticleProcessor {
    private strength: number
    private snapAt: number

    /**
     * 
     * @param config.x The x coordinate of the Particle Processor, in world space. Default 0.
     * @param config.y The y coordinate of the Particle Processor, in world space. Default 0.
     * @param config.active The active state of this Particle Processor. Default true.
     */
    constructor(config: {strength?: number, snapAt?: number, x?: number, y?: number, active?: boolean}) {
        super(config.x, config.y, config.active)

        this.strength = config.strength ?? 0.95
        this.snapAt = config.snapAt ?? 0
    }

    update(particle: Phaser.GameObjects.Particles.Particle, delta: number, step: number, t: number): void {
        particle.velocityX *= this.strength
        particle.velocityY *= this.strength

        if (Math.abs(particle.velocityX) < this.snapAt) {
            particle.velocityX = 0
        }
    }
}
