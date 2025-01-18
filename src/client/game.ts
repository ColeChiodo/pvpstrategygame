import * as helpers from './helpers';
import { sprites } from './sprites';

const user = JSON.parse(document.getElementById('user')!.innerHTML);

const MIN_SCALE = 1.0; 
const MAX_SCALE = 5.0;
export let SCALE = 3.125;

let cameraOffsetX = 0;
let cameraOffsetY = 0;

let arenaImage: HTMLImageElement | null = null;
let arena: Arena | null = null;

const tileTypes: TileType[] = [
    {id: 1, name: 'PLAINS', movement: 1},
    {id: 2, name: 'HILLS', movement: 2},
    {id: 3, name: 'FOREST', movement: 1},
    {id: 4, name: 'WALL', movement: 0},
]

let uiImage = new Image();
uiImage.src = '/assets/spritesheets/UI.png';

let testUnitImage = new Image();
testUnitImage.src = `/assets/spritesheets/units/test.png`;

let players: Player[] = [];
let units: Unit[] = [];
let visibleTiles: { row: number, col: number }[] = [];

let hoveredTile: { x: number, y: number, row: number, col: number } | null = null;
let selectedTile: { x: number, y: number, row: number, col: number } | null = null;
let moveTile: { x: number, y: number, row: number, col: number } | null = null;
let validMoveTiles: { row: number, col: number }[] = [];
let actionTile: { x: number, y: number, row: number, col: number } | null = null;
let validActionTiles: { row: number, col: number }[] = [];

let currentRound = 0;
let player1Time = 0;
let player2Time = 0;
let isAction = false;

const endTurnBtn = document.getElementById('endTurnBtn') as HTMLButtonElement;
const gameOverUI = document.getElementById('gameOver') as HTMLDivElement;
let gameOver = false;
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
    if (!gameOver) gameOverUI.style.display = 'none';
    else gameOverUI.style.display = 'flex';
    const loading = document.getElementById('loading');
    if (loading && players.length === 2) loading.style.display = 'none';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawArena();
    drawFogOfWarTiles();
    drawUnits();
    drawUI();
    drawInteractionSquares();
    editHTML();
}

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60); 
    const remainingSeconds = seconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

function editHTML() {
    if (players.length < 2) return;
    const player1Name = document.getElementById('player1Name') as HTMLDivElement;
    const player2Name = document.getElementById('player2Name') as HTMLDivElement;

    player1Name.innerHTML = players[0].name;
    player2Name.innerHTML = players[1].name;

    const player1Timer = document.getElementById('player1Time') as HTMLDivElement;
    const player2Timer = document.getElementById('player2Time') as HTMLDivElement;

    const player1FormattedTime = formatTime(player1Time);
    const player2FormattedTime = formatTime(player2Time);

    player1Timer.innerHTML = player1FormattedTime;
    player2Timer.innerHTML = player2FormattedTime;
}

window.addEventListener('keydown', (e) => {
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
        case "Enter":
            window.socket.emit('force-end-turn');
            selectedTile = null;
            isAction = false;
            moveTile = null;
            break;
    }
});

function loadUnits(players: Player[]) {
    if (!isAnimating) {
        units = [];
        for (const player of players) {
            for (const unit of player.units) {
                unit.owner = player;
                unit.sprite = sprites.find(sprite => sprite.name === unit.name) || sprites[0];
                unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                units.push(unit);
            }
        }
    } else {
        if (!animatingUnit) return;
        units = [];
        units.push(animatingUnit);
        for (const player of players) {
            for (const unit of player.units) {
                if (unit.id === animatingUnit.id) continue;
                unit.owner = player;
                unit.sprite = sprites.find(sprite => sprite.name === unit.name) || sprites[0];
                unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                units.push(unit);
            }
        }
    }
}

function loadPlayers(newPlayers: Player[]) {
    players = [];
    players = newPlayers;

    if (players.length === 2){
        if (isTurn()) endTurnBtn.disabled = false;
        else endTurnBtn.disabled = true;
    }
}
    
window.socket.on('gameState', (gameState) => {
    loadArenaImage(gameState.arena); // move to a game start function in the future to only load once
    loadPlayers(gameState.players);
    loadUnits(gameState.players);
    visibleTiles = gameState.visibleTiles;
    currentRound = gameState.round;
    player1Time = gameState.player1Time;
    player2Time = gameState.player2Time;
});

window.socket.on('gameOver', (player) => {
    const gameOverMsg = document.getElementById('gameOverMsg');
    if (!gameOverMsg) return;

    if (player.socket !== window.socket.id){
        
        gameOverMsg.innerHTML = "YOU LOSE...";
    } else {
        gameOverMsg.innerHTML = "YOU WIN!";
    }

    gameOver = true;
});

window.socket.on('nextRound', (player) => {
    const nextRoundMsg = document.getElementById('nextRoundMsg');
    if (!nextRoundMsg) return;
    const nextTurnBG = document.getElementById('nextTurnBG');
    if(!nextTurnBG) return;

    if (player.socket !== window.socket.id){
        nextRoundMsg.innerHTML = "ENEMY TURN";
        nextTurnBG.classList.add("border-red-500");
        nextTurnBG.classList.remove("border-blue-500");
    } else {
        nextRoundMsg.innerHTML = "YOUR TURN";
        nextTurnBG.classList.add("border-blue-500");
        nextTurnBG.classList.remove("border-red-500");
    }

    const nextTurnDiv = document.getElementById("nextTurn") as HTMLDivElement;
    nextTurnDiv.classList.toggle("top-full");
    nextTurnDiv.classList.toggle("top-0");
    setTimeout(() => {
        nextTurnDiv.classList.toggle("top-full");
        nextTurnDiv.classList.toggle("top-0");
    }, 4000);
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
    canvas.height = window.innerHeight;
    draw();
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);

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

window.socket.on('player-unit-moving', (unit: Unit, origin: {row: number, col: number}, target: { x: number, y: number, row: number, col: number }) => {
    isAction = true;
    animateMove(unit, origin, target);
    moveTile = target;
    console.log(`Unit ${unit.id} looking to perform an action`);
});

let isAnimating = false;
let animatingUnit: Unit | null;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function animateMove(tempUnit: Unit, origin: { row: number, col: number }, target: { x: number, y: number, row: number, col: number }) {
    isAnimating = true;
    const path = astarPath(origin.row, origin.col, target.row, target.col);
    const realUnit = units.find(unit => unit.row === tempUnit.row && unit.col === tempUnit.col);
    if (!realUnit) return;
    
    for (const tile of path) {
        if (!isAnimating) break;
        animatingUnit = realUnit;
        realUnit.currentStatus = 2;
        realUnit.sprite.currentFrame = 0;
        // play footstep sound
        realUnit.row = tile.y;
        realUnit.col = tile.x;
        await sleep(100);
    }

    isAnimating = false;
    animatingUnit = null;
    realUnit.currentStatus = 0;
    realUnit.sprite.currentFrame = 0;
}

function isTurn(){
    return players[currentRound % 2].name === user.username;
}

function unitCanMove(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return unit.canMove;
        }
    }
    return false;
}

let isDragging = false;
let startX = 0;
let startY = 0;

canvas.addEventListener('click', function(event) {
    if (isAnimating) isAnimating = false;
    if (!isTurn()) return;

    if (players.length != 2) return;

    const clickX = event.offsetX;
    const clickY = event.offsetY;

    let found = false;
    for (const tile of tiles) {
        if (!hoveredTile) break;
        if (helpers.isPointInsideTile(clickX, clickY, tile)) {
            
            if (!isAction && !selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col) && unitCanMove(hoveredTile.row, hoveredTile.col)) {
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
                if (validMoveTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {
                    const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                    console.log(`Moving to: ${tile.row}, ${tile.col}`);
                    window.socket.emit('player-unit-move', unit!.id, tile);
                }
                selectedTile = null;
            } else if (isAction && hasUnit(tile.row, tile.col)) {
                // action clicked on another unit
                if (validActionTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {
                    const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
                    console.log(`Action on: ${tile.row}, ${tile.col}`);
                    window.socket.emit('player-unit-action', unit!.id, tile);
                }
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
        if (helpers.isPointInsideTile(clickX, clickY, tile)) {
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

    const col = selectedTile.col;
    const row = selectedTile.row;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    const pos = coordToPosition(row, col);


    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawUI(){
    drawHoveredTile();
    drawSelectedTile();
    drawMovementTiles();
    drawActionTiles();
    drawPath();
    drawHealthBars();
    drawTileInfo();
    drawHoveredUnitName();
}

function drawTileInfo() {
    if (!arena) return;
    if (!hoveredTile) return;
    const bgWidth = 256;
    const bgHeight = 64;
    const margin = 10;
    const padding = 10;
    const squareX = 0;
    const squareY = margin;

    const terrain: number = arena.tiles[hoveredTile.row][hoveredTile.col];
    const terrainType = tileTypes.find(tile => tile.id === terrain);
    if (!terrainType) return;

    ctx.fillStyle = '#45283c';
    ctx.fillRect(squareX, squareY, bgWidth, bgHeight); // replace with tile info ui back image

    ctx.fillStyle = 'white';
    ctx.font = '24px "Press Start 2P"';
    ctx.fillText(terrainType.name, squareX + padding, squareY + padding + 34);
}

function drawHoveredUnitName() {
    if (!arena) return;
    if (!hoveredTile) return;
    if (!hasUnit(hoveredTile.row, hoveredTile.col)) return;

    const bgHeight = 64;
    const margin = 10;
    const padding = 10;
    const squareX = 0;
    const squareY = canvas.height - bgHeight - margin - (64 * 4);

    const hoveredUnit = units.find(unit => unit.row === hoveredTile!.row && unit.col === hoveredTile!.col);
    if (!hoveredUnit) return;

    const bgWidth = hoveredUnit.name.length * 24 + 6 * padding;

    ctx.fillStyle = '#45283c';
    ctx.fillRect(squareX, squareY, bgWidth, bgHeight); // replace with tile info ui back image

    ctx.fillStyle = 'white';
    ctx.font = '24px "Press Start 2P"';
    ctx.fillText(hoveredUnit.name.toUpperCase(), squareX + padding, squareY + padding + 34);
}

function drawFogOfWarTiles() {
    if (!arena) return;

    for (let row = 0; row < arena.tiles.length; row++){
        for (let col = 0; col < arena.tiles[row].length; col++){
            if (arena.tiles[row][col] === 0) continue;
            if (isVisibleTile(row, col)) continue;
            drawFogOfWarTile(row, col);
        }
    }
}

function isVisibleTile(row: number, col: number): boolean {
    const tile = visibleTiles.find(visibleTiles => visibleTiles.row === row && visibleTiles.col === col);
    if (tile) return true;
    return false;
}

function drawFogOfWarTile(row: number, col: number){
    const frameSize = 32;
    const highlightFrameX = 4;
    const highlightFrameY = 1;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    const pos = coordToPosition(row, col);
    if (pos.x === -9999 || pos.y === -9999) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
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
    if (!arena) return;
    if (selectedTile){
        const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
        if (unit){
            validMoveTiles = [];
            const mobility = unit.mobility;
            const range = unit.range;
            const row = selectedTile.row;
            const col = selectedTile.col;

            let mobilityTiles = [];
            for (let i = -mobility; i <= mobility; i++) {
                for (let j = -mobility; j <= mobility; j++) {
                    if (Math.abs(i) + Math.abs(j) <= mobility) {
                        const targetRow = row + i;
                        const targetCol = col + j;

                        if (targetRow < 0 || targetCol < 0 || targetRow >= arena.tiles.length || targetCol >= arena.tiles[0].length) continue;
                        if (hasUnit(targetRow, targetCol) && (i !== 0 || j !== 0)) continue;
                        const targetTerrain: number = arena.tiles[targetRow][targetCol];
                        if (targetTerrain === 0) continue;

                        // Check the path for obstacles or terrain that blocks movement
                        const path = astarPath(row, col, targetRow, targetCol);
                        if (path.length - 1 > mobility) continue;
                        let canMove = true;
                        let mobilityPenalty = 0;
                        for (const tile of path) {
                            const terrain: number = arena.tiles[tile.y][tile.x];

                            if((row !== tile.y && col !== tile.x) && hasUnit(tile.y, tile.x)) {
                                canMove = false;
                                break;
                            } else if (terrain === 0) {
                                canMove = false;
                                break;
                            } else if (terrain === 2) {
                                mobilityPenalty += 2;
                            } else if (terrain === 3) {
                                
                            } else if (terrain === 4) {
                                canMove = false;
                                break;
                            }
                        }

                        if (canMove && (mobility - mobilityPenalty >= 0)) {
                            mobilityTiles.push({ x: targetRow, y: targetCol });
                            drawMoveTile(targetRow, targetCol);
                        }
                    }
                }
            }

            //Second loop: Draw attack range borders
            for (let tile of mobilityTiles) {
                const mobilityTileRow = tile.x;
                const mobilityTileCol = tile.y;

                for (let i = -range; i <= range; i++) {
                    for (let j = -range; j <= range; j++) {
                        if (Math.abs(i) + Math.abs(j) <= range) {
                            let action = unit.action;
                            const targetRow = mobilityTileRow + i;
                            const targetCol = mobilityTileCol + j;

                            if (targetRow === row && targetCol === col) continue;
                            if (mobilityTiles.find(tile => tile.x === targetRow && tile.y === targetCol)) continue;
                            if (hasUnit(targetRow, targetCol)) continue;

                            if (targetRow >= 0 && targetRow < arena.tiles.length && targetCol >= 0 && targetCol < arena.tiles[0].length) {
                                // Check the path for tiles that can restrict visibility
                                const path = bresenhamPath(mobilityTileRow, mobilityTileCol, targetRow, targetCol);
                                let canSee = true;
                                let rangePenalty = 0;
        
                                for (const tile of path) {
                                    if (arena.tiles){
                                        const terrain: number = arena.tiles[tile.y][tile.x];
                                        
                                        if (terrain === 3) {
                                            if (!adjacentTile(row, col, tile.y, tile.x)){
                                                canSee = false;
                                                break;
                                            }
                                        }
                                        if (terrain === 4) {
                                            canSee = false;
                                            break;
                                        }
                                    }
                                }
        
                                if (canSee && (range - rangePenalty >= 0)) {
                                    drawActionTile(targetRow, targetCol, action);
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) || 
           (Math.abs(row1 - row2) === 1 && col1 === col2) || 
           (Math.abs(col1 - col2) === 1 && row1 === row2);
}

// A* Pathfinding Algorithm
function astarPath(startRow: number, startCol: number, endRow: number, endCol: number): { x: number, y: number }[] {
    if (!arena) return [];
    const grid = arena.tiles;
    const openList: Tile[] = [];
    const closedList: Set<string> = new Set();

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
        // Sort openList by F cost (lowest F cost first)
        openList.sort((a, b) => a.f - b.f);
        const current = openList.shift()!; // Get the tile with the lowest F cost

        // If we've reached the goal, reconstruct the path
        if (current.x === endTile.x && current.y === endTile.y) {
            const path: { x: number, y: number }[] = [];
            let currentTile: Tile | null = current;
            while (currentTile) {
                path.unshift({ x: currentTile.x, y: currentTile.y });
                currentTile = currentTile.parent;
            }
            return path;
        }

        closedList.add(`${current.x},${current.y}`);

        // Check all neighbors
        for (const { x: dx, y: dy } of neighbors) {
            const neighborX = current.x + dx;
            const neighborY = current.y + dy;

            // Check if the neighbor is within bounds and is not an obstacle (assuming 0 = walkable, 1 = obstacle)
            if (neighborX >= 0 && neighborX < grid[0].length && neighborY >= 0 && neighborY < grid.length && grid[neighborY][neighborX] !== 0) {
                const neighbor: Tile = {
                    x: neighborX,
                    y: neighborY,
                    g: current.g + 1, // Assume cost to move to any neighbor is 1
                    h: heuristic({ x: neighborX, y: neighborY, g: 0, h: 0, f: 0, parent: null }, { x: endCol, y: endRow, g: 0, h: 0, f: 0, parent: null }),
                    f: 0,
                    parent: current
                };                

                if (closedList.has(`${neighbor.x},${neighbor.y}`)) {
                    continue; // Skip if already evaluated
                }

                // Check if this neighbor is better (lower f) than any previously evaluated
                if (!openList.some(tile => tile.x === neighbor.x && tile.y === neighbor.y)) {
                    neighbor.f = neighbor.g + neighbor.h;
                    openList.push(neighbor);
                }
            }
        }
    }

    return []; // No path found
}

function heuristic(a: Tile, b: Tile): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// Bresenham's Line Algorithm
function bresenhamPath(startRow: number, startCol: number, endRow: number, endCol: number) {
    const path = [];
    let x = startCol;
    let y = startRow;
    const dx = Math.abs(endCol - startCol);
    const dy = Math.abs(endRow - startRow);
    const sx = startCol < endCol ? 1 : -1;
    const sy = startRow < endRow ? 1 : -1;
    let err = dx - dy;

    while (x !== endCol || y !== endRow) {
        path.push({ x, y });

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

    path.push({ y: endRow, x: endCol });
    return path;
}

function drawPath(){
    if (!selectedTile) return;
    if (!hoveredTile) return;
    if (!validMoveTiles) return;

    const path = astarPath(selectedTile.row, selectedTile.col, hoveredTile.row, hoveredTile.col);

    for (const tile of path){
        if (validMoveTiles.find(validTile => validTile.row === tile.y && validTile.col === tile.x)){
            drawPathTile(tile.y, tile.x);
        }
    }
}

function drawPathTile(row: number, col: number){
    const frameSize = 32;
    const highlightFrameX = 0;
    const highlightFrameY = 4;

    const sx = highlightFrameX * frameSize;
    const sy = highlightFrameY * frameSize;

    const pos = coordToPosition(row, col);
    if (pos.x === -9999 || pos.y === -9999) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
}

function drawMoveTile(row: number, col: number){
    validMoveTiles.push({ row, col });
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
                validActionTiles = [];
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
                    unit.canAct = false;
                    isAction = false;
                    moveTile = null;
                    window.socket.emit('force-unit-end-turn', unit.id);
                }
            }
        }
    }
}

function drawActionTile(row: number, col: number, action: string){
    validActionTiles.push({ row, col });
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

        const frameX = unit.sprite.currentFrame;
        const frameY = unit.currentStatus;

        const sx = frameX * frameSize;
        const sy = frameY * frameSize;

        const pos = coordToPosition(unit.row, unit.col);

        ctx.imageSmoothingEnabled = false;

        ctx.drawImage(testUnitImage, sx, sy, frameSize, frameSize, pos.x, pos.y - frameSize * SCALE + (8 * SCALE), frameSize * SCALE, frameSize * SCALE);

        //update the animation of the sprite
        unit.sprite.framesElapsed++;
        if (unit.sprite.framesElapsed % unit.sprite.framesHold === 0) {
            if (unit.sprite.currentFrame < unit.sprite.idleFrames - 1) {
                unit.sprite.currentFrame++;
            } else {
                unit.sprite.currentFrame = 0;
            }
        }
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

// ---------------UI EVENTS--------------------------------------------------------
endTurnBtn.addEventListener('click', function(e){
    window.socket.emit('force-end-turn');
    selectedTile = null;
    isAction = false;
    moveTile = null;
});