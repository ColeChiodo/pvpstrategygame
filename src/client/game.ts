const MIN_SCALE = 1.0;
const MAX_SCALE = 5.0;
let SCALE = 3.125;

let arenaImage: HTMLImageElement | null = null;
let arena: Arena | null = null;

let uiImage = new Image();
uiImage.src = '/assets/spritesheets/UI.png';

let testUnitImage = new Image();
testUnitImage.src = '/assets/spritesheets/units/test.png';

let units: Unit[] = [];

let hoveredTile: { x: number, y: number, row: number, col: number } | null = null;
let selectedTile: { x: number, y: number, row: number, col: number } | null = null;
let moveTile: { x: number, y: number, row: number, col: number } | null = null;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function drawBackground() {
    ctx.fillStyle = '#222034';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawArena() {
    if (arenaImage) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(arenaImage, (canvas.width - arena!.width * SCALE) / 2, (canvas.height - arena!.height * SCALE + 16 * SCALE) / 2, arena!.width * SCALE, arena!.height * SCALE);
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawArena();
    drawUI();
    drawUnits();
    drawInteractionSquares();
}

window.addEventListener('keydown', (e) => {
    console.log('Key pressed:', e.key);
    window.socket.emit('player-action', e.key);

    switch (e.key) {
        case 'z':
            if (SCALE !== MIN_SCALE)
                SCALE -= 0.125;
            break;
        case 'x':
            if (SCALE !== MAX_SCALE) 
                SCALE += 0.125;
            break;
    }
});

function loadUnits(players: Player[]) {
    units = [];
    for (const player of players) {
        for (const unit of player.units) {
            //unit.id = units.length + 1;
            unit.owner = player;
            units.push(unit);
        }
    }
    drawUnits();
}

window.socket.on('gameState', (gameState) => {
    console.log('Game State:', gameState);
    loadArenaImage(gameState.arena); // move to a game start function in the future to only load once
    loadUnits(gameState.players);
});

function gameLoop() {
    draw();
    requestAnimationFrame(gameLoop);
}

gameLoop();

function loadArenaImage(newArena: Arena) {
    if (!arenaImage) { 
        arenaImage = new Image();
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
        arena = newArena;
        arenaImage.onload = () => {
            drawArena();
        };
    }
}

function resizeCanvas() {
    canvas.width = window.outerWidth;
    canvas.height = window.outerHeight;
    draw();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let tiles: { x: number, y: number, row: number, col: number}[] = [];

function drawInteractionSquares() {
    if (!arenaImage) return;
    if (!arena) return;
    const tileWidth = 32 * SCALE; // width of an isometric tile
    const tileHeight = 16 * SCALE; // height of an isometric tile
    const rows = arena.tiles.length;
    const cols = arena.tiles[0].length;

    // get canvas center
    const imgCenterX = canvas.width / 2;
    const imgCenterY = canvas.height / 2;

    // Calculate the total width and height of the grid
    const gridWidth = (cols - 1) * tileWidth / 2;  // Total width of the grid
    const gridHeight = (rows - 1) * tileHeight / 2; // Total height of the grid

    // Calculate the offset to center the grid on the image
    const offsetX = imgCenterX - tileWidth / 2;
    const offsetY = imgCenterY - gridHeight - tileHeight - 8 * SCALE;

    // Draw the tiles
    tiles = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Calculate isometric coordinates
            if(arena!.tiles[row][col] === 0) continue;

            const isoX = (col - row) * tileWidth / 2 + offsetX;
            const isoY = (col + row) * tileHeight / 2 + offsetY;

            tiles.push(drawIsometricTile(isoX, isoY, row, col));
        }
    }
}

function drawIsometricTile(x: number, y: number, row: number, col: number) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 16 * SCALE, y + 8 * SCALE);
    ctx.lineTo(x + 32 * SCALE, y);
    ctx.lineTo(x + 16 * SCALE, y - 8 * SCALE);
    ctx.closePath();
    
    //ctx.stroke();

    return { x, y, row, col };
}

function isPointInsideTile(px: number, py: number, tile: { x: number, y: number }): boolean {
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

canvas.addEventListener('click', function(event) {
    const clickX = event.offsetX;
    const clickY = event.offsetY;

    let found = false;
    for (const tile of tiles) {
        if (!hoveredTile) break;
        if (isPointInsideTile(clickX, clickY, tile)) {
            console.log(`You clicked on: ${tile.row}, ${tile.col}`);

            if (!selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {
                selectedTile = tile;
            } else if (selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {
                break;
            } else if (selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`You moved to: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-move', unit!.id, tile);
                selectedTile = null;
            }
            found = true;
            break;
        }
    }
    if (!found) {
        selectedTile = null;
    }
});

canvas.addEventListener('mousemove', function(event) {
    const clickX = event.offsetX;
    const clickY = event.offsetY;

    for (const tile of tiles) {
        if (isPointInsideTile(clickX, clickY, tile)) {
            console.log(`You hovered on: ${tile.row}, ${tile.col}`);
            hoveredTile = tile;
            break;
        }
        else {
            hoveredTile = null;
        }
    }
});

function hasUnit(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return true;
        }
    }
    return false;
}

function unitIsTeam(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return unit.owner.id === window.socket.id;
        }
    }
    return false;
}

function drawHoveredTile() {
    if (!hoveredTile) return;
    const frameSize = 32;
    const highlightFrameX = hasUnit(hoveredTile.row, hoveredTile.col) ? (unitIsTeam(hoveredTile.row, hoveredTile.col) ? 1 : 2) : 0;
    const highlightFrameY = 0;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, hoveredTile.x, hoveredTile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawSelectedTile() {
    if (!selectedTile) return;
    const frameSize = 32;
    const highlightFrameX = 3;
    const highlightFrameY = 0;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, selectedTile.x, selectedTile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawUI(){
    drawHoveredTile();
    drawSelectedTile();
}

function drawUnits(){
    for (const unit of units){
        const frameSize = 48;
        const frameX = 0;
        const frameY = 0;

        const sx = frameX * frameSize;
        const sy = frameY * frameSize;

        const pos = coordToPosition(unit.row, unit.col);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(testUnitImage, sx, sy, frameSize, frameSize, pos.x - 8 * SCALE, pos.y - frameSize * SCALE + (3 * SCALE), frameSize * SCALE, frameSize * SCALE);
    }
}

function coordToPosition(row: number, col: number): { x: number, y: number } {
    for (const tile of tiles) {
        if (tile.row === row && tile.col === col) {
            return { x: tile.x, y: tile.y };
        }
    }
    return { x: 0, y: 0 };
}