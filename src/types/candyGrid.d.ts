interface ICandyGrid extends Phaser.GameObjects.NineSlice {
    update(time: number, delta: number): void
}

type GridConfig = {
    x: number
    y: number
    gridWidth: number
    gridHeight: number
    tileWidth: number
    tileHeight: number
    padding: number
    candies: string[]
    texture: string | Phaser.Textures.Texture
    frame?: string | number
    leftWidth?: number
    rightWidth?: number
    topHeight?: number
    bottomHeight?: number
}
