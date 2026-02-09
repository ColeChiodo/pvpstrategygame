export interface TileType {
    id: number;
    name: string;
    movement: number;
}

export const tileTypes: TileType[] = [
    { id: 0, name: 'VOID', movement: 0 },
    { id: 1, name: 'GROUND', movement: 1 },
    { id: 2, name: 'SLOW', movement: 2 },
    { id: 3, name: 'HIDING SPOT', movement: 1 },
    { id: 4, name: 'OBSTACLE', movement: 0 },
];
