class SpriteClass implements Sprite {
    name: string;
    image: string;
    idleFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;

    constructor(name: string, image: string, idleFrames: number, currentFrame: number, framesElapsed: number, framesHold: number) {
        this.name = name;
        this.image = image;
        this.idleFrames = idleFrames;
        this.currentFrame = currentFrame;
        this.framesElapsed = framesElapsed;
        this.framesHold = framesHold;
    }

    copy(): Sprite {
        return new SpriteClass(
            this.name,
            this.image,
            this.idleFrames,
            this.currentFrame,
            this.framesElapsed,
            this.framesHold
        );
    }
}

export const sprites: SpriteClass[] = [
    new SpriteClass("test", "test", 2, 0, 0, 100),
]; 