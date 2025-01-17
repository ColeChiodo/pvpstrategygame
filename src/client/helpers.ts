import { SCALE } from './game';

export function isPointInsideTile(px: number, py: number, tile: { x: number, y: number }): boolean {
    // Vertices of the tile
    const x1 = tile.x, y1 = tile.y;
    const x2 = tile.x + 16 * SCALE, y2 = tile.y + 8 * SCALE;
    const x3 = tile.x + 32 * SCALE, y3 = tile.y;
    const x4 = tile.x + 16 * SCALE, y4 = tile.y - 8 * SCALE;

    // Helper function to calculate the area of a triangle given by three points
    const sign = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): number => {
        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
    };

    // Check if the point is inside the tile (diamond shape)
    const d1 = sign(px, py, x1, y1, x2, y2);
    const d2 = sign(px, py, x2, y2, x3, y3);
    const d3 = sign(px, py, x3, y3, x4, y4);
    const d4 = sign(px, py, x4, y4, x1, y1);

    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);
    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);

    // Point is inside the tile if all signs are the same (either all positive or all negative)
    return !(hasNeg && hasPos);
}