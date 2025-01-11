interface Player {
    x: number;
    y: number;
    color: string;
    height: number;
    width: number;
}

interface Arena {
    width: number;
    height: number;
    image: string;
    tiles: number[][];
}

interface Unit {
    x: number; // x grid position
    y: number; // y grid position
    
    name: string;
    health: number;
    maxHealth: number;
    attack: number;
    defense: number;
    range: number;
    mobility: number;
}