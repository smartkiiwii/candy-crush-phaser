import SecondOrderDynamics from '@/classes/SecondOrderDynamics'
import { IImageConstructor } from '@/interfaces/image.interface'

export class Tile extends Phaser.GameObjects.Image {
    public gridX: number
    public gridY: number
    public isCleared: boolean

    private tweener: SecondOrderDynamics
    private targetPosition: Phaser.Math.Vector2

    constructor(aParams: IImageConstructor) {
        super(aParams.scene, aParams.x, aParams.y, aParams.texture, aParams.frame)

        // set image settings
        this.setOrigin(0, 0)
        this.setInteractive()

        this.scene.add.existing(this)

        this.gridX = aParams.gridX
        this.gridY = aParams.gridY
        this.isCleared = false
        this.targetPosition = new Phaser.Math.Vector2(aParams.tweenOriginX, aParams.tweenOriginY)
        this.tweener = new SecondOrderDynamics(this.targetPosition, {
            responseRate: 0.002,
            dampening: 0.5,
            eagerness: 2,
        })
    }

    preUpdate(time: number, delta: number): void {
        const newPos = this.tweener.update(delta, this.targetPosition)

        this.setPosition(
            newPos.x,
            newPos.y > this.targetPosition.y
                ? this.targetPosition.y - (newPos.y - this.targetPosition.y)
                : newPos.y
        )
    }

    public clearTile() {
        this.isCleared = true
        this.setVisible(false)
    }

    public resetTile(aParams: Partial<IImageConstructor>) {
        if (aParams.gridX !== undefined) this.gridX = aParams.gridX
        if (aParams.gridY !== undefined) this.gridY = aParams.gridY

        if (aParams.x !== undefined && aParams.y !== undefined)
            this.setPosition(aParams.x, aParams.y)

        if (aParams.texture !== undefined && aParams.frame !== undefined)
            this.setTexture(aParams.texture, aParams.frame)

        if (aParams.texture !== undefined && aParams.frame === undefined)
            this.setTexture(aParams.texture)

        if (aParams.frame !== undefined) this.setFrame(aParams.frame)

        this.isCleared = false
        this.setVisible(true)

        if (aParams.tweenOriginX !== undefined && aParams.tweenOriginY !== undefined) {
            this.resetTweenOrigin(aParams.tweenOriginX, aParams.tweenOriginY)
        } else {
            this.resetTweenOrigin(this.targetPosition.x, this.targetPosition.y)
        }
    }

    public resetTweenOrigin(x: number, y: number) {
        this.tweener.reset(new Phaser.Math.Vector2(x, y))
    }

    public isSameType(tile: Tile) {
        return this.texture.key === tile.texture.key
    }

    public setTargetPosition(x: number, y: number) {
        this.targetPosition.set(x, y)
    }

    public getTargetPosition() {
        return this.targetPosition
    }
}
