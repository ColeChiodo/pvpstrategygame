interface Player {
    id: string;
    socket: string;
    name: string;
    profileimage: string;
    units: Unit[];
    time: number;
}

interface Arena {
    width: number;
    height: number;
    name: string;
    tiles: number[][];
    heightMap: number[][];
    obstacles: Obstacle[];
    p1Start: { row: number, col: number };
    p2Start: { row: number, col: number };
}

interface Obstacle {
    name: string;
    row: number;
    col: number;
    sprite: Sprite;
    currentStatus: number;
}

interface Unit {
    id: number;
    row: number;
    col: number;
    owner: Player;
    name: string;
    action: string;
    canMove: boolean;
    canAct: boolean;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
    currentStatus: number;
    sprite: Sprite;
}

interface Sprite {
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

    copy(): Sprite;
}

interface Tile {
    x: number;
    y: number;
    g: number;
    h: number;
    f: number;
    parent: Tile | null;
}

interface TileType {
    id: number;
    name: string;
    movement: number;
}