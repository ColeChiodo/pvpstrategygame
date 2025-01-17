interface Player {
    id: string;
    socket: string;
    name: string;
    units: Unit[];
    time: number;
}

interface Arena {
    width: number;
    height: number;
    name: string;
    tiles: number[][];
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
    currentStatus: string;
    sprite: Sprite;
}

interface Sprite {
    name: string;
    image: string;
    idleFrames: number;
    currentFrame: number;
    framesElapsed: number;
    framesHold: number;
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