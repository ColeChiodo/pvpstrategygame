import { SCALE } from './constants';

export function isPointInsideTile(px: number, py: number, tile: { x: number; y: number; row: number; col: number }): boolean {
    const x1 = tile.x;
    const y1 = tile.y;
    const x2 = tile.x + 16 * SCALE;
    const y2 = tile.y + 8 * SCALE;
    const x3 = tile.x + 32 * SCALE;
    const y3 = tile.y;
    const x4 = tile.x + 16 * SCALE;
    const y4 = tile.y - 8 * SCALE;

    const sign = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number => {
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    };

    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x4, y4);
    const d4 = sign(px, py, x4, y4, x1, y1);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);

    return !(hasNeg && hasPos);
}

export function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');
    return `${formattedMinutes}:${formattedSeconds}`;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) ||
           (Math.abs(row1 - row2) === 1 && col1 === col2) ||
           (Math.abs(col1 - col2) === 1 && row1 === row2);
}
