import { Tile, Arena } from './types';

export function astarPath(startRow: number, startCol: number, endRow: number, endCol: number, arena: Arena): Tile[] {
    const grid = arena.tiles;
    const openList: Tile[] = [];
    const closedList = new Set<string>();

    const startTile: Tile = {
        x: startCol,
        y: startRow,
        g: 0,
        h: heuristic({ x: startCol, y: startRow, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
        f: 0,
        parent: null
    };

    const endTile: Tile = { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null };
    openList.push(startTile);

    const neighbors = [
        { x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 },
    ];

    while (openList.length > 0) {
        openList.sort((a, b) => (a.f || 0) - (b.f || 0));
        const current = openList.shift()!;

        if (current.x === endTile.x && current.y === endTile.y) {
            const path: Tile[] = [];
            let currentTile: Tile | null = current;
            while (currentTile) {
                path.unshift({ x: currentTile.x, y: currentTile.y, row: currentTile.y, col: currentTile.x });
                currentTile = currentTile.parent || null;
            }
            return path;
        }

        closedList.add(`${current.x},${current.y}`);

        for (const { x: dx, y: dy } of neighbors) {
            const neighborX = current.x + dx;
            const neighborY = current.y + dy;

            if (neighborX >= 0 && neighborX < grid[0].length &&
                neighborY >= 0 && neighborY < grid.length &&
                grid[neighborY][neighborX] !== 0 && grid[neighborY][neighborX] !== 4 &&
                arena.heightMap[neighborY][neighborX] - arena.heightMap[current.y][current.x] <= 1.5) {

                const neighbor: Tile = {
                    x: neighborX,
                    y: neighborY,
                    g: (current.g || 0) + 1,
                    h: heuristic({ x: neighborX, y: neighborY, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
                    f: 0,
                    parent: current
                };

                if (closedList.has(`${neighbor.x},${neighbor.y}`)) continue;

                const existing = openList.find(t => t.x === neighbor.x && t.y === neighbor.y);
                if (!existing || (neighbor.f || 0) < (existing.f || 0)) {
                    neighbor.f = (neighbor.g || 0) + (neighbor.h || 0);
                    const idx = openList.findIndex(t => t.x === neighbor.x && t.y === neighbor.y);
                    if (idx === -1) {
                        openList.push(neighbor);
                    } else {
                        openList[idx] = neighbor;
                    }
                }
            }
        }
    }

    return [];
}

export function bresenhamPath(startRow: number, startCol: number, endRow: number, endCol: number): Tile[] {
    const path: Tile[] = [];
    let x = startCol;
    let y = startRow;
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;

    while (x !== endCol || y !== endRow) {
        path.push({ x, y, row: y, col: x });
        const e2 = err * 2;
        if (e2 > -dy) {
            err -= dy;
            x += sx;
        }
        if (e2 < dx) {
            err += dx;
            y += sy;
        }
    }
    path.push({ x, y, row: y, col: x });
    return path;
}

function heuristic(a: Tile, b: Tile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}
