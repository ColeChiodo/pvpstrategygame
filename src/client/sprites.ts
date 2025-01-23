class SpriteClass implements Sprite {
    width: number;
    height: number;
    name: string;
    image: string;
    idleFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;

    constructor(height: number, width: number, name: string, image: string, idleFrames: number, currentFrame: number, framesElapsed: number, framesHold: number) {
        this.height = height;
        this.width = width;
        this.name = name;
        this.image = image;
        this.idleFrames = idleFrames;
        this.currentFrame = currentFrame;
        this.framesElapsed = framesElapsed;
        this.framesHold = framesHold;
    }

    copy(): Sprite {
        return new SpriteClass(
            this.height,
            this.width,
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
    new SpriteClass(32, 32, "test", "test", 2, 0, 0, 100),
]; 