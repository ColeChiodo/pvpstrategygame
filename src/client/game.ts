// get inner html of element with id "user"
const user = JSON.parse(document.getElementById('user')!.innerHTML);

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
testUnitImage.src = `/assets/spritesheets/units/test.png`;

let units: Unit[] = [];

let hoveredTile: { x: number, y: number, row: number, col: number } | null = null;
let selectedTile: { x: number, y: number, row: number, col: number } | null = null;
let moveTile: { x: number, y: number, row: number, col: number } | null = null;
let actionTile: { x: number, y: number, row: number, col: number } | null = null;

let isAction = false;

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
    drawUnits();
    drawUI();
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
    isAction = true;
    moveTile = tile;
    console.log(`Unit ${unitID} looking to perform an action`);
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
            
            if (!isAction && !selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {
                // first click
                selectedTile = tile;
            } else if (!isAction && selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {
                // move clicked on the same tile to stay
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Staying on: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-move', unit!.id, tile);
                break;
            } else if (!isAction && selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
                // move clicked on another tile to move
                const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                console.log(`Moving to: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-move', unit!.id, tile);
                selectedTile = null;
            } else if (isAction && hasUnit(tile.row, tile.col)) {
                // action clicked on another unit
                const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
                console.log(`Action on: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-action', unit!.id, tile);
                isAction = false;
                moveTile = null;
            } else if (isAction && hasUnit(tile.row, tile.col)) {
                // action clicked on same tile to cancel
                const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
                isAction = false;
                moveTile = null;
                console.log(`Cancel action on: ${tile.row}, ${tile.col}`);
                window.socket.emit('player-unit-action', unit!.id, tile);
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
            return unit.owner.name === user.username;
        }
    }
    return false;
}

function unitCanBeHealed(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            if (unit.owner.name !== user.username) return false;
            return unit.health < unit.maxHealth;
        }
    }
    return false;
}

function unitCanBeAttacked(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            if (unit.owner.name === user.username) return false;
            return unit.health > 0;
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
    drawMovementTiles();
    drawActionTiles();
    drawHealthBars();
}

function drawHealthBars(){
    for (const unit of units){
        const pos = coordToPosition(unit.row, unit.col);
        if (pos.x === -9999 || pos.y === -9999) return;

        const frameSize = 16;
        const frameX = unitIsTeam(unit.row, unit.col) ? 2 : 4;
        const frameY = 4;

        const sx = frameX * frameSize;
        const sy = frameY * frameSize;

        let gap = 1 * SCALE;
        let totalWidth = unit.maxHealth * (frameSize * SCALE / 4) + (unit.maxHealth - 1) * gap;
        let startX = pos.x - totalWidth / 2;

        for (let i = 0; i < unit.maxHealth; i++) {
            
            let xPosition = startX + i * (frameSize * SCALE / 4 + gap) + frameSize * SCALE;

            if (i < unit.health) {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, xPosition, pos.y - 28 * SCALE, frameSize * SCALE / 4, frameSize * SCALE / 4);
            } else {
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(uiImage, sx + frameSize, sy, frameSize, frameSize, xPosition, pos.y - 28 * SCALE, frameSize * SCALE / 4, frameSize * SCALE / 4);
            }
        }
    }
}

function drawMovementTiles(){
    if (selectedTile){
        const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
        if (unit){
            const mobility = unit.mobility;
            const range = unit.range;
            const row = selectedTile.row;
            const col = selectedTile.col;

            let mobilityTiles = [];
            for (let i = -mobility; i <= mobility; i++) {
                for (let j = -mobility; j <= mobility; j++) {
                    if (Math.abs(i) + Math.abs(j) <= mobility) {
                        if (i === 0 && j === 0) continue;
                        if (hasUnit(row + i, col + j)) continue;

                        mobilityTiles.push({ x: row + i, y: col + j });
                        drawMoveTile(row + i, col + j);
                    }
                }
            }

            // Second loop: Draw attack range borders
            for (let tile of mobilityTiles) {
                const mobilityTileRow = tile.x;
                const mobilityTileCol = tile.y;

                for (let i = -range; i <= range; i++) {
                    for (let j = -range; j <= range; j++) {
                        if (Math.abs(i) + Math.abs(j) <= range) {
                            let action = unit.action;
                            const attackRow = mobilityTileRow + i;
                            const attackCol = mobilityTileCol + j;

                            if (attackRow < 0 || attackRow >= arena!.tiles.length) continue;
                            if (attackCol < 0 || attackCol >= arena!.tiles[0].length) continue;

                            if (attackRow === row && attackCol === col) continue;
                            if (mobilityTiles.find(tile => tile.x === attackRow && tile.y === attackCol)) continue;
                            if (hasUnit(attackRow, attackCol)) continue;
                            
                            drawActionTile(attackRow, attackCol, action);
                        }
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

function drawActionTiles(){
    if (isAction){
        if (moveTile){
            const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
            if (unit){
                const range = unit.range;
                const row = moveTile.row;
                const col = moveTile.col;

                let actionPerformed = false;
                for (let i = -range; i <= range; i++){
                    for (let j = -range; j <= range; j++){
                        if (Math.abs(i) + Math.abs(j) <= range){
                            if (i === 0 && j === 0) continue;
                            if (!hasUnit(row + i, col + j)) continue;
                            let action = unit.action;
                            if (action === 'heal' && !unitIsTeam(row + i, col + j)) continue;
                            if (action === 'heal' && !unitCanBeHealed(row + i, col + j)) continue;
                            if (action === 'attack' && !unitCanBeAttacked(row + i, col + j)) continue;
                            if (action === 'attack' && unitIsTeam(row + i, col + j)) continue;
                            drawActionTile(row + i, col + j, action);
                            actionPerformed = true;
                        }
                    }
                }
                if (!actionPerformed){
                    console.log(`Unit ${unit.id} has no valid actions`);
                    isAction = false;
                    moveTile = null;
                    window.socket.emit('force-unit-end-turn', unit.id);
                }
            }
        }
    }
}

function drawActionTile(row: number, col: number, action: string){
    const frameSize = 32;
    const highlightFrameX = action === 'attack' ? 2 : 1;
    const highlightFrameY = 1;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    const pos = coordToPosition(row, col);
    if (pos.x === -9999 || pos.y === -9999) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawUnits(){
    units.sort((a, b) => {
        const posA = coordToPosition(a.row, a.col);
        const posB = coordToPosition(b.row, b.col);
        return posA.y - posB.y;
    });

    for (const unit of units){
        const frameSize = 32;

        const frameX = 0;
        const frameY = unit.name === 'attack_guy' ? 0 : 1;

        const sx = frameX * frameSize;
        const sy = frameY * frameSize;

        const pos = coordToPosition(unit.row, unit.col);

        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(testUnitImage, sx, sy, frameSize, frameSize, pos.x, pos.y - frameSize * SCALE + (8 * SCALE), frameSize * SCALE, frameSize * SCALE);
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


// -----------Touch Screen Logic---------------------------

// let touchStartTime = 0;
// const TAP_THRESHOLD = 200;

// canvas.addEventListener('touchstart', function(e) {
//     e.preventDefault(); // Prevent default touch behavior (like scrolling)

//     if (e.touches.length !== 1) return; // Ensure it's a single touch
//     touchStartTime = Date.now();

//     isDragging = true;
//     startX = e.touches[0].clientX - cameraOffsetX;
//     startY = e.touches[0].clientY - cameraOffsetY;

//     const touch = e.changedTouches[0];
//     const clickX = touch.clientX - canvas.offsetLeft;
//     const clickY = touch.clientY - canvas.offsetTop;

//     let found = false;
//     for (const tile of tiles) {
//         if (!hoveredTile) break;
//         if (isPointInsideTile(clickX, clickY, tile)) {
//             //console.log(`You clicked on: ${tile.row}, ${tile.col}`);

//             if (!selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {
//                 selectedTile = tile;
//             } else if (selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {
//                 const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
//                 console.log(`Moving to: ${tile.row}, ${tile.col}`);
//                 window.socket.emit('player-unit-move', unit!.id, tile);
//                 break;
//             } else if (selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
//                 const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
//                 console.log(`Moving to: ${tile.row}, ${tile.col}`);
//                 window.socket.emit('player-unit-move', unit!.id, tile);
//                 selectedTile = null;
//             }
//             found = true;
//             break;
//         }
//     }
//     if (!found) {
//         selectedTile = null;
//     }
// });

// let prevTouchDistance: number | null = null;

// canvas.addEventListener('touchmove', function(e) {
//     e.preventDefault();

//     if (e.touches.length === 1) {
//         if (!isDragging) return;

//         const touchX = e.touches[0].clientX;
//         const touchY = e.touches[0].clientY;

//         cameraOffsetX = touchX - startX;
//         cameraOffsetY = touchY - startY;

//         // Update hovered tile (similar to mousemove)
//         const clickX = touchX - canvas.offsetLeft;
//         const clickY = touchY - canvas.offsetTop;

//         for (const tile of tiles) {
//             if (isPointInsideTile(clickX, clickY, tile)) {
//                 hoveredTile = tile;
//                 break;
//             }
//             else {
//                 hoveredTile = null;
//             }
//         }
//     }

//     if (e.touches.length === 2) {
//         // Get the coordinates of the two touch points
//         const touch1X = e.touches[0].clientX;
//         const touch1Y = e.touches[0].clientY;
//         const touch2X = e.touches[1].clientX;
//         const touch2Y = e.touches[1].clientY;

//         // Calculate the current distance between the two touch points
//         const currentDistance = Math.sqrt(
//             (touch2X - touch1X) ** 2 + (touch2Y - touch1Y) ** 2
//         );

//         if (prevTouchDistance !== null) {
//             // Calculate the scale factor based on the distance change
//             const scaleChange = currentDistance / prevTouchDistance;

//             // Apply the zoom (scale) adjustment
//             if (scaleChange > 1) {
//                 // Zoom in (scale up)
//                 if (SCALE !== MAX_SCALE) SCALE *= 1.05;
//                 if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
//             } else {
//                 // Zoom out (scale down)
//                 if (SCALE !== MIN_SCALE) SCALE *= 0.95;
//                 if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
//             }
//         }

//         // Update the previous touch distance for the next move event
//         prevTouchDistance = currentDistance;
//     }
// });

// canvas.addEventListener('touchend', function(e) {
//     isDragging = false;
//     if (e.touches.length < 2) {
//         prevTouchDistance = null;
//     }
// });