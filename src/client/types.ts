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
    p1Start: { row: number, col: number };
    p2Start: { row: number, col: number };
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
    name: string;
    image: string;
    idleFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;

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