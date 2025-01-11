interface Player {
    id: string;
    name: string;
    units: Unit[];
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
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
}