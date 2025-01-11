const MIN_SCALE = 1.0;
const MAX_SCALE = 5.0;
let SCALE = 3.125;

let cameraOffsetX = 0;
let cameraOffsetY = 0;

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
        ctx.drawImage(arenaImage, (canvas.width - arena!.width * SCALE) / 2 + cameraOffsetX, (canvas.height - arena!.height * SCALE + 16 * SCALE) / 2 + cameraOffsetY, arena!.width * SCALE, arena!.height * SCALE);
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
    //console.log('Key pressed:', e.key);
    //window.socket.emit('player-action', e.key);

    switch (e.key) {
        case 'z':
            if (SCALE !== MIN_SCALE)
                SCALE -= 0.125;
            if (SCALE < MIN_SCALE)
                SCALE = MIN_SCALE;
            break;
        case 'x':
            if (SCALE !== MAX_SCALE) 
                SCALE += 0.125;
            if (SCALE > MAX_SCALE)
                SCALE = MAX_SCALE;
            break;
        case "ArrowUp":
        case "w":
            cameraOffsetY += 8 * SCALE;
            break;
        case "ArrowDown":
        case "s":
            cameraOffsetY -= 8 * SCALE;
            break;
        case "ArrowLeft":
        case "a":
            cameraOffsetX += 8 * SCALE;
            break;
        case "ArrowRight":
        case "d":
            cameraOffsetX -= 8 * SCALE;
            break;
    }
});

function loadUnits(players: Player[]) {
    units = [];
    for (const player of players) {
        for (const unit of player.units) {
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
    const offsetX = imgCenterX - tileWidth / 2 + cameraOffsetX;
    const offsetY = imgCenterY - gridHeight - tileHeight - 8 * SCALE + cameraOffsetY;

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

window.socket.on('player-unit-moved', (unitID: number, tile: { x: number, y: number, row: number, col: number }) => {
    // display action menu
    console.log(`Unit ${unitID} is performing an action on tile (${tile.row}, ${tile.col})`);
});

let isDragging = false;
let startX = 0;
let startY = 0;

canvas.addEventListener('click', function(event) {
    const clickX = event.offsetX;
    const clickY = event.offsetY;

    let found = false;
    for (const tile of tiles) {
        if (!hoveredTile) break;
        if (isPointInsideTile(clickX, clickY, tile)) {
            //console.log(`You clicked on: ${tile.row}, ${tile.col}`);

            if (!selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {
                selectedTile = tile;
            } else if (selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Moving to: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-move', unit!.id, tile);
                break;
            } else if (selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Moving to: ${tile.row}, ${tile.col}`);
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

canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;
    isDragging = true;
    startX = e.clientX - cameraOffsetX;
    startY = e.clientY - cameraOffsetY;
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    if (e.deltaY < 0) {
      if (SCALE !== MAX_SCALE)
        SCALE *= 1.1;
      if (SCALE > MAX_SCALE)
        SCALE = MAX_SCALE;
    } else if (e.deltaY > 0) {
      if (SCALE !== MIN_SCALE)
        SCALE *= 0.9;
    if (SCALE < MIN_SCALE)
        SCALE = MIN_SCALE;
    }
});

canvas.addEventListener('mousemove', function(event) {
    const clickX = event.offsetX;
    const clickY = event.offsetY;

    for (const tile of tiles) {
        if (isPointInsideTile(clickX, clickY, tile)) {
            //console.log(`You hovered on: ${tile.row}, ${tile.col}`);
            hoveredTile = tile;
            break;
        }
        else {
            hoveredTile = null;
        }
    }

    if (isDragging) {
        cameraOffsetX = event.clientX - startX;
        cameraOffsetY = event.clientY - startY;
    }
});

let touchStartTime = 0;
const TAP_THRESHOLD = 200;

canvas.addEventListener('touchstart', function(e) {
    e.preventDefault(); // Prevent default touch behavior (like scrolling)

    if (e.touches.length !== 1) return; // Ensure it's a single touch
    touchStartTime = Date.now();

    isDragging = true;
    startX = e.touches[0].clientX - cameraOffsetX;
    startY = e.touches[0].clientY - cameraOffsetY;

    const touch = e.changedTouches[0];
    const clickX = touch.clientX - canvas.offsetLeft;
    const clickY = touch.clientY - canvas.offsetTop;

    let found = false;
    for (const tile of tiles) {
        if (!hoveredTile) break;
        if (isPointInsideTile(clickX, clickY, tile)) {
            //console.log(`You clicked on: ${tile.row}, ${tile.col}`);

            if (!selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {
                selectedTile = tile;
            } else if (selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Moving to: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-move', unit!.id, tile);
                break;
            } else if (selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Moving to: ${tile.row}, ${tile.col}`);
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

let prevTouchDistance: number | null = null;

canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();

    if (e.touches.length === 1) {
        if (!isDragging) return;

        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;

        cameraOffsetX = touchX - startX;
        cameraOffsetY = touchY - startY;

        // Update hovered tile (similar to mousemove)
        const clickX = touchX - canvas.offsetLeft;
        const clickY = touchY - canvas.offsetTop;

        for (const tile of tiles) {
            if (isPointInsideTile(clickX, clickY, tile)) {
                hoveredTile = tile;
                break;
            }
            else {
                hoveredTile = null;
            }
        }
    }

    if (e.touches.length === 2) {
        // Get the coordinates of the two touch points
        const touch1X = e.touches[0].clientX;
        const touch1Y = e.touches[0].clientY;
        const touch2X = e.touches[1].clientX;
        const touch2Y = e.touches[1].clientY;

        // Calculate the current distance between the two touch points
        const currentDistance = Math.sqrt(
            (touch2X - touch1X) ** 2 + (touch2Y - touch1Y) ** 2
        );

        if (prevTouchDistance !== null) {
            // Calculate the scale factor based on the distance change
            const scaleChange = currentDistance / prevTouchDistance;

            // Apply the zoom (scale) adjustment
            if (scaleChange > 1) {
                // Zoom in (scale up)
                if (SCALE !== MAX_SCALE) SCALE *= 1.05;
                if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
            } else {
                // Zoom out (scale down)
                if (SCALE !== MIN_SCALE) SCALE *= 0.95;
                if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
            }
        }

        // Update the previous touch distance for the next move event
        prevTouchDistance = currentDistance;
    }
});

canvas.addEventListener('touchend', function(e) {
    isDragging = false;
    if (e.touches.length < 2) {
        prevTouchDistance = null;
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
    drawActionTiles();
}

function drawActionTiles(){
    if (selectedTile){
        const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
        if (unit){
            const mobility = unit.mobility;
            const row = selectedTile.row;
            const col = selectedTile.col;

            for (let i = -mobility; i <= mobility; i++){
                for (let j = -mobility; j <= mobility; j++){
                    if (Math.abs(i) + Math.abs(j) <= mobility){
                        if (i === 0 && j === 0) continue;
                        drawMoveTile(row + i, col + j);
                    }
                }
            }
        }
    }
}

function drawMoveTile(row: number, col: number){
    if (!selectedTile) return;
    const frameSize = 32;
    const highlightFrameX = 3;
    const highlightFrameY = 1;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    const pos = coordToPosition(row, col);
    if (pos.x === -9999 || pos.y === -9999) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawUnits(){
    for (const unit of units){
        const frameSize = 48; // change to 32
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
    return { x: -9999, y: -9999 };
}