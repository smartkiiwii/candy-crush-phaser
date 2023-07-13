export interface IImageConstructor {
    scene: Phaser.Scene
    x: number
    y: number
    tweenOriginX: number
    tweenOriginY: number
    gridX: number
    gridY: number
    texture: string
    frame?: string | number
}
