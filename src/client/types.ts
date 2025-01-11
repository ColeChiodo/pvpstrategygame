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