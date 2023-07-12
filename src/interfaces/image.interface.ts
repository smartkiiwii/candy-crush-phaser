export interface IImageConstructor {
    scene: Phaser.Scene
    x: number
    y: number
    gridX: number
    gridY: number
    texture: string
    frame?: string | number
}
