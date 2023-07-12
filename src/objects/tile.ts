import { IImageConstructor } from '@/interfaces/image.interface'

export class Tile extends Phaser.GameObjects.Image {
    public gridX: number
    public gridY: number
    public isCleared: boolean

    constructor(aParams: IImageConstructor) {
        super(aParams.scene, aParams.x, aParams.y, aParams.texture, aParams.frame)

        // set image settings
        this.setOrigin(0, 0)
        this.setInteractive()

        this.scene.add.existing(this)

        this.gridX = aParams.gridX
        this.gridY = aParams.gridY
        this.isCleared = false
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
    }

    public isSameType(tile: Tile) {
        return this.texture.key === tile.texture.key
    }
}
