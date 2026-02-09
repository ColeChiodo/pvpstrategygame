export interface Sprite {
    width: number;
    height: number;
    name: string;
    image: string;
    idleFrames: number;
    walkFrames: number;
    actionFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;
    direction: number;
}

export class SpriteClass implements Sprite {
    width: number;
    height: number;
    name: string;
    image: string;
    idleFrames: number;
    walkFrames: number;
    actionFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;
    direction: number;

    constructor(
        height: number,
        width: number,
        name: string,
        image: string,
        idleFrames: number,
        walkFrames: number,
        actionFrames: number,
        currentFrame: number,
        framesElapsed: number,
        framesHold: number,
        direction: number
    ) {
        this.height = height;
        this.width = width;
        this.name = name;
        this.image = image;
        this.idleFrames = idleFrames;
        this.walkFrames = walkFrames;
        this.actionFrames = actionFrames;
        this.currentFrame = currentFrame;
        this.framesElapsed = framesElapsed;
        this.framesHold = framesHold;
        this.direction = direction;
    }

    copy(): Sprite {
        return new SpriteClass(
            this.height,
            this.width,
            this.name,
            this.image,
            this.idleFrames,
            this.walkFrames,
            this.actionFrames,
            this.currentFrame,
            this.framesElapsed,
            this.framesHold,
            this.direction
        );
    }
}

export const sprites: Sprite[] = [
    new SpriteClass(32, 32, "test", "test", 2, 2, 2, 0, 0, 100, 1),
    new SpriteClass(32, 32, "king", "king", 4, 5, 10, 0, 0, 50, 1),
    new SpriteClass(32, 32, "melee", "melee", 4, 6, 6, 0, 0, 50, 1),
    new SpriteClass(32, 32, "ranged", "ranged", 4, 6, 10, 0, 0, 50, 1),
    new SpriteClass(32, 32, "mage", "mage", 4, 6, 11, 0, 0, 50, 1),
    new SpriteClass(32, 32, "healer", "healer", 4, 6, 9, 0, 0, 50, 1),
    new SpriteClass(32, 32, "cavalry", "cavalry", 8, 6, 7, 0, 0, 50, 1),
    new SpriteClass(32, 32, "scout", "scout", 4, 6, 6, 0, 0, 50, 1),
    new SpriteClass(32, 32, "tank", "tank", 4, 6, 6, 0, 0, 50, 1),
];
