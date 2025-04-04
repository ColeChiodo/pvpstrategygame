import * as helpers from './helpers';
import { sprites } from './sprites';
import { tileTypes } from './tiles';
import { inflate } from 'pako';

var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

const MIN_SCALE = 1.0; 
const MAX_SCALE = 7.0;
export let SCALE = isMobile ? 1.0 : 2.500;

let cameraOffsetX = isMobile ? window.innerHeight > window.innerWidth ? 0 : -35 : 0;
let cameraOffsetY = isMobile ? window.innerHeight > window.innerWidth ? 0 : 35 : 100;

let arenaImage: HTMLImageElement | null = null;
let arena: Arena | null = null;

let uiImage = new Image();
uiImage.src = '/assets/spritesheets/UI.png';

const imageCache = new Map<string, HTMLImageElement>();
const audioCache = new Map<string, HTMLAudioElement>();

let players: Player[] = [];
let units: Unit[] = [];
let tiles: { x: number, y: number, row: number, col: number}[] = [];

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

let isAnimating = false;
let animatingUnit: Unit | null;
let animateHealthBar = false;
let animatingHealthBarUnit: Unit | null = null;
let healthBarCurrent: number;

const endTurnBtn = document.getElementById('endTurnBtn') as HTMLButtonElement;
const gameOverUI = document.getElementById('gameOver') as HTMLDivElement;
let gameOver = false;

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

let gamepadIndex: number | null = null;
let lastInputTime: Record<number, number> = {};
const INPUT_DELAY = 200;

function gameLoop() {
    draw();
    gamepadHandler();
    requestAnimationFrame(gameLoop);
}

gameLoop();

function loadUnits(players: Player[]) {
    const updatedOrAddedUnitIds = new Set();

    for (const player of players) {
        for (const unit of player.units) {
            const existingUnit = units.find(u => u.id === unit.id);

            if (existingUnit) {
                if (animatingUnit && animatingUnit.id === unit.id && animatingUnit.owner === player) {
                    existingUnit.row = unit.row;
                    existingUnit.col = unit.col;
                }
                existingUnit.health = unit.health;
                existingUnit.canMove = unit.canMove;
                existingUnit.canAct = unit.canAct;
                existingUnit.currentStatus = !unit.canMove && !unit.canAct ? 1 : 0;

                updatedOrAddedUnitIds.add(existingUnit.id);
            } else {
                unit.owner = player;
                const newSprite = sprites.find(sprite => sprite.name === unit.name) || sprites[0];
                if (newSprite) unit.sprite = newSprite.copy();
                unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;

                units.push(unit);

                updatedOrAddedUnitIds.add(unit.id);
            }
        }
    }
    if (!animatingUnit) units = units.filter(unit => updatedOrAddedUnitIds.has(unit.id));
}


function loadPlayers(newPlayers: Player[]) {
    players = [];
    players = newPlayers;

    if (players.length === 2){
        if (isTurn()) endTurnBtn.disabled = false;
        else endTurnBtn.disabled = true;
    }
}

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

async function animateMove(tempUnit: Unit, origin: { row: number, col: number }, target: { x: number, y: number, row: number, col: number }) {
    console.log("animating move");
    isAnimating = true;
    const path = astarPath(origin.row, origin.col, target.row, target.col);
    const realUnit = units.find(unit => unit.row === tempUnit.row && unit.col === tempUnit.col);
    if (!realUnit) return;

    realUnit.sprite.currentFrame = 0;
    
    let lastTile: { x: number, y: number } = {x: origin.col, y: origin.row};
    
    for (const tile of path) {
        if (!isAnimating) break;
        animatingUnit = realUnit;

        realUnit.currentStatus = 2;

        playSound('step', `/assets/audio/sfx/step.wav`);

        realUnit.row = tile.y;
        realUnit.col = tile.x;

        if (realUnit.row == lastTile.y) {
            if (realUnit.col > lastTile.x) {
                realUnit.sprite.direction = 1; 
            } else if (realUnit.col < lastTile.x) {
                realUnit.sprite.direction = -1; 
            }
        } else if (realUnit.col == lastTile.x) {
            if (realUnit.row > lastTile.y) {
                realUnit.sprite.direction = -1; 
            } else if (realUnit.row < lastTile.y) {
                realUnit.sprite.direction = 1;
            }
        }

        lastTile = tile;
        await sleep(100);
    }

    isAnimating = false;
    animatingUnit = null;
    realUnit.currentStatus = 0;
    realUnit.sprite.currentFrame = 0;
}

async function animateAction(tempUnit: Unit) {
    isAnimating = true;
    const realUnit = units.find(unit => unit.row === tempUnit.row && unit.col === tempUnit.col);
    if (!realUnit) return;

    animatingUnit = realUnit;

    realUnit.sprite.currentFrame = 0;
    
    while (realUnit.sprite.currentFrame < realUnit.sprite.actionFrames) {
        animatingUnit = realUnit;
        realUnit.currentStatus = 3;
        realUnit.sprite.currentFrame++;
        await sleep(realUnit.sprite.framesHold);
    }

    isAnimating = false;
    animatingUnit = null;
    realUnit.currentStatus = 0;
    realUnit.sprite.currentFrame = 0;
}

// -----------Socket Events--------------------------------

window.socket.on('game-code', (data: { code: string }) => {
    const gameCode = document.getElementById('gameCode');
    if (!gameCode) return;

    gameCode.textContent = data.code;
});

window.socket.on('invalid-code', () => {
    alert("Invalid Code. Please try again.");
});

window.socket.on('gameState', (compressedData) => {
    let gameState;
    try {
        const decompressed = inflate(compressedData, { to: 'string' });

        gameState = JSON.parse(decompressed);
    } catch (err) {
        console.error('Error inflating or parsing the game state:', err);
    }
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
        nextTurnBG.classList.add("border-amber-500");
        nextTurnBG.classList.remove("border-cyan-500");
    } else {
        nextRoundMsg.innerHTML = "YOUR TURN";
        nextTurnBG.classList.remove("border-amber-500");
        nextTurnBG.classList.add("border-cyan-500");
        if (document.hidden) {
            alert('It is now your turn.');
        }
    }

    const nextTurnDiv = document.getElementById("nextTurn") as HTMLDivElement;
    nextTurnDiv.classList.toggle("top-full");
    nextTurnDiv.classList.toggle("top-0");
    setTimeout(() => {
        nextTurnDiv.classList.toggle("top-full");
        nextTurnDiv.classList.toggle("top-0");
    }, 4000);
});

window.socket.on('player-unit-moving', (compressedData) => {
    let data: any;
    try {
        const decompressed = inflate(compressedData, { to: 'string' });

        data = JSON.parse(decompressed);
    } catch (err) {
        console.error('Error inflating or parsing the game state:', err);
    }
    const isUnitVisible = units.find(u => u.row === data.unit.row && u.col === data.unit.col);
    if (!isUnitVisible) return;

    isAction = true;
    animateMove(data.unit, data.origin, data.target);
    console.log(`${data.unit.name} is moving [${data.origin.row}, ${data.origin.col}] => [${data.target.row}, ${data.target.col}]`);
    moveTile = data.target;
});

window.socket.on('player-unit-acting', (compressedData) => {
    let data: any;
    try {
        const decompressed = inflate(compressedData, { to: 'string' });

        data = JSON.parse(decompressed);
    } catch (err) {
        console.error('Error inflating or parsing the game state:', err);
    }
    const isUnitVisible = units.find(u => u.row === data.unit.row && u.col === data.unit.col);
    if (!isUnitVisible) return;

    isAction = false;
    animateAction(data.unit);
});

window.socket.on('animate-healthbar', (unit: Unit, healthBefore: number, healthAfter: number) => {
    const isUnitVisible = units.find(u => u.row === unit.row && u.col === unit.col);
    if (!isUnitVisible) return;

    const action: string = healthBefore > healthAfter ? "attack" : "heal";

    if (action === "attack") {
        playSound(action, `/assets/audio/sfx/bonk.wav`);
    } else if (action === "heal") {
        playSound(action, `/assets/audio/sfx/powerup.wav`);
    }


    animateHealthBar = true;
    animatingHealthBarUnit = unit;
    healthBarCurrent = healthBefore;
    const healthDiff = healthAfter - healthBefore;
    const healthTick = healthDiff / 5;
    const interval = setInterval(() => {
        healthBarCurrent += healthTick;
    }, 100);

    setTimeout(() => {
        animateHealthBar = false;
        animatingHealthBarUnit = null;
        clearInterval(interval);
    }, 600);
});

window.socket.on('display-emote', (src: string, sid: string) => {
    if (players[0].socket === sid) {
        let p2Emote = document.getElementById('p2Emote');
        if (!p2Emote) return;
        let emoteImg = loadImage(src+'2', src);
        p2Emote.appendChild(emoteImg);
        emoteImg.classList.value = "w-16 h-16 sm:w-24 sm:h-24 transition-all duration-500 opacity-0";
        setTimeout(() => {
            emoteImg.classList.toggle('opacity-0');
            emoteImg.classList.toggle('opacity-95');
            // play sound for emote
            setTimeout(() => {
                emoteImg.classList.toggle('opacity-0');
                emoteImg.classList.toggle('opacity-95');
                setTimeout(() => {
                    p2Emote.removeChild(emoteImg)
                }, 500);
            }, 5000);
        }, 100);
    } else if (players[1].socket === sid) {
        let p1Emote = document.getElementById('p1Emote');
        if (!p1Emote) return;
        let emoteImg = loadImage(src+'1', src);
        p1Emote.appendChild(emoteImg);
        emoteImg.classList.value = "w-16 h-16 sm:w-24 sm:h-24 transition-all duration-500 opacity-0";
        setTimeout(() => {
            emoteImg.classList.toggle('opacity-0');
            emoteImg.classList.toggle('opacity-95');
            // play sound for emote
            setTimeout(() => {
                emoteImg.classList.toggle('opacity-0');
                emoteImg.classList.toggle('opacity-95');
                setTimeout(() => {
                    p1Emote.removeChild(emoteImg)
                }, 500);
            }, 5000);
        }, 100);
    }
});

// -----------Drawing Functions----------------------------

function drawBackground() {
    ctx.fillStyle = '#0f0f2b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawArena() {
    if (arenaImage) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(arenaImage, (canvas.width - arena!.width * SCALE) / 2 + cameraOffsetX, (canvas.height - arena!.height * SCALE - 16 * SCALE) / 2 + cameraOffsetY, arena!.width * SCALE, arena!.height * SCALE);
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
    drawEntities();
    drawUI();
    drawInteractionSquares();
    editHTML();
}

function drawEntities(): void {
    if (!arena) return;

    const entities = [
        ...arena.obstacles.map(obstacle => ({ type: 'obstacle' as const, entity: obstacle })),
        ...units.map(unit => ({ type: 'unit' as const, entity: unit }))
    ];

    entities.sort((a, b) => {
        if (a.entity.row !== b.entity.row) {
            return a.entity.row - b.entity.row;
        }
        return a.entity.col - b.entity.col;
    });

    for (const { type, entity } of entities) {
        const pos = coordToPosition(entity.row, entity.col);

        if (type === 'obstacle') {
            const obstacle = entity;
            const frameSize = obstacle.sprite.height;
            const frameX = 0;
            const frameY = 0;
            const sx = frameX * frameSize;
            const sy = frameY * frameSize;

            ctx.imageSmoothingEnabled = false;
            ctx.globalAlpha = 0.75;

            const obstacleImage = loadImage(obstacle.sprite.name, `/assets/maps/${obstacle.sprite.name}.png`);
            ctx.drawImage(obstacleImage, sx, sy, frameSize, frameSize, pos.x - 32 * SCALE, pos.y - frameSize * SCALE + (8 * SCALE), frameSize * SCALE, frameSize * SCALE);

            obstacle.sprite.framesElapsed++;
            if (obstacle.sprite.framesElapsed % obstacle.sprite.framesHold === 0) {
                if (obstacle.sprite.currentFrame < obstacle.sprite.idleFrames - 1) {
                    obstacle.sprite.currentFrame++;
                } else {
                    obstacle.sprite.currentFrame = 0;
                }
            }
            ctx.globalAlpha = 1.0;
        } else if (type === 'unit') {
            const unit = entity;
            const frameSize = 32;
            const frameX = unit.sprite.currentFrame;
            const frameY = unit.currentStatus;
            const sx = frameX * frameSize;
            const sy = frameY * frameSize;
            const direction = unit.sprite.direction;

            ctx.imageSmoothingEnabled = false;

            const unitImage = loadImage(unit.sprite.name, `/assets/spritesheets/units/${unit.sprite.name}.png`);
            ctx.save();
            if (direction === -1) {
                // Flip horizontally
                ctx.scale(-1, 1);
                ctx.drawImage(unitImage, sx, sy, frameSize, frameSize, -(pos.x + frameSize * SCALE), pos.y - frameSize * SCALE + (2 * SCALE), frameSize * SCALE, frameSize * SCALE);
            } else {
                ctx.drawImage(unitImage, sx, sy, frameSize, frameSize, pos.x, pos.y - frameSize * SCALE + (2 * SCALE), frameSize * SCALE, frameSize * SCALE);
            }
            ctx.restore();

            unit.sprite.framesElapsed++;
            if (unit.sprite.framesElapsed % unit.sprite.framesHold === 0) {
                if (unit.sprite.currentFrame < unit.sprite.idleFrames - 1 && (unit.currentStatus === 0 || unit.currentStatus === 1)) {
                    unit.sprite.currentFrame++;
                } else if (unit.sprite.currentFrame < unit.sprite.walkFrames - 1 && unit.currentStatus === 2) {
                } else if (unit.sprite.currentFrame < unit.sprite.actionFrames - 1 && unit.currentStatus === 3) {
                } else {
                    unit.sprite.currentFrame = 0;
                }
            }
        }
    }
}

function drawUI(){
    drawHoveredTile();
    drawSelectedTile();
    drawMovementTiles();
    drawActionTiles();
    drawPath();
    drawHealthBars();
    drawAnimatingHealthBar();
    //drawTileInfo();
    drawHoveredUnitInfo();
    // draw selected unit info
}

let editHTMLOnce = true;
function editHTML() {
    if (players.length < 2) return;
    if (editHTMLOnce) {
        const player1BG = document.getElementById('player1') as HTMLDivElement;
        const player2BG = document.getElementById('player2') as HTMLDivElement;
    
        if (players[0].socket === window.socket.id) {
            player1BG.classList.add("bg-cyan-600");
            player1BG.classList.remove("bg-amber-600");
            player1BG.classList.add("border-cyan-400");
            player1BG.classList.remove("boarder-amber-400");
            player2BG.classList.add("bg-amber-600");
            player2BG.classList.remove("bg-cyan-600");
            player2BG.classList.add("border-amber-400");
            player2BG.classList.remove("boarder-cyan-400");
        } else {
            player2BG.classList.add("bg-cyan-600");
            player2BG.classList.remove("bg-amber-600");
            player2BG.classList.add("border-cyan-400");
            player2BG.classList.remove("boarder-amber-400");
            player1BG.classList.add("bg-amber-600");
            player1BG.classList.remove("bg-cyan-600");
            player1BG.classList.add("border-amber-400");
            player1BG.classList.remove("boarder-cyan-400");
        }
    
        const player1Name = document.getElementById('player1Name') as HTMLDivElement;
        const player2Name = document.getElementById('player2Name') as HTMLDivElement;
    
        player1Name.innerHTML = players[0].name;
        player2Name.innerHTML = players[1].name;
    
        const player1ProfilePic = document.getElementById('player1ProfilePic') as HTMLImageElement;
        const player2ProfilePic = document.getElementById('player2ProfilePic') as HTMLImageElement;
    
        player1ProfilePic.src = `/assets/profileimages/${players[0].profileimage}.png`;
        player2ProfilePic.src = `/assets/profileimages/${players[1].profileimage}.png`;
    
        editHTMLOnce = false;
    }

    const player1Timer = document.getElementById('player1Time') as HTMLDivElement;
    const player2Timer = document.getElementById('player2Time') as HTMLDivElement;

    const player1FormattedTime = formatTime(player1Time);
    const player2FormattedTime = formatTime(player2Time);

    player1Timer.innerHTML = player1FormattedTime;
    player2Timer.innerHTML = player2FormattedTime;
}

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
            const isoY = (col + row) * tileHeight / 2 + offsetY - ((getTileHeight(row, col) * 16) * SCALE);

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

function drawTileInfo() {
    if (!arena) return;
    if (!hoveredTile) return;
    const bgWidth = 256;
    const bgHeight = 64;
    const margin = 10;
    const padding = 10;
    const squareX = 0;
    const squareY = margin + (64 * 4);

    const terrain: number = arena.tiles[hoveredTile.row][hoveredTile.col];
    const terrainType = tileTypes.find(tile => tile.id === terrain);
    if (!terrainType) return;

    ctx.fillStyle = '#45283c';
    ctx.fillRect(squareX, squareY, bgWidth, bgHeight); // replace with tile info ui back image

    ctx.fillStyle = 'white';
    ctx.font = '42px "VT323"';
    ctx.fillText(terrainType.name.toUpperCase(), squareX + padding, squareY + padding + 34);
}

function drawHoveredUnitInfo() {
    if (!arena) return;
    if (!hoveredTile) return;
    if (!hasUnit(hoveredTile.row, hoveredTile.col)) return;

    const margin = 10;
    const padding = 10;
    const statLabelHeight = 30;
    const squareX = 0;

    const hoveredUnit = units.find(unit => unit.row === hoveredTile!.row && unit.col === hoveredTile!.col);
    if (!hoveredUnit) return;

    const nameWidth = hoveredUnit.name.length * 24 + 6 * padding;
    const statsWidth = Math.max(
        ctx.measureText('HP:' + hoveredUnit.health.toString() + '/' + hoveredUnit.maxHealth.toString()).width,
        ctx.measureText('Atk:' + hoveredUnit.attack.toString() + ' Def:' + hoveredUnit.defense.toString()).width,
        ctx.measureText('Rng:' + hoveredUnit.range.toString() + '/' + ' Mob:' + hoveredUnit.mobility.toString()).width,
    );

    const bgWidth = Math.max(nameWidth, statsWidth) + 2 * padding;
    const bgHeight = 64 + 3 * statLabelHeight;
    const squareY = isMobile ? canvas.height - bgHeight : canvas.height - (64 * 5) - margin;

    ctx.fillStyle = '#222034';
    ctx.fillRect(squareX, squareY, bgWidth, bgHeight);

    ctx.fillStyle = 'white';
    ctx.font = '42px "VT323"';
    ctx.fillText(hoveredUnit.name.toUpperCase(), squareX + padding, squareY + padding + 34);

    const frameSize = 32;
    const frameX = hoveredUnit.sprite.currentFrame;
    const frameY = hoveredUnit.currentStatus;
    const sx = frameX * frameSize;
    const sy = frameY * frameSize;

    ctx.imageSmoothingEnabled = false;

    const unitImage = loadImage(hoveredUnit.sprite.name, `/assets/spritesheets/units/${hoveredUnit.sprite.name}.png`);
    ctx.drawImage(unitImage, sx, sy, frameSize, frameSize, squareX + bgWidth - padding - 64, squareY + padding - (16 * 5), frameSize * 4, frameSize * 4);

    ctx.font = '24px "VT323"';
    const statLabels = [
        `HP:${Math.round(hoveredUnit.health)}/${hoveredUnit.maxHealth}`,
        `Atk:${hoveredUnit.attack} Def:${hoveredUnit.defense}`,
        `Rng:${hoveredUnit.range} Mob:${hoveredUnit.mobility}`,
    ];    

    statLabels.forEach((label, index) => {
        ctx.fillText(label, squareX + padding, squareY + padding + 34 + (index + 1) * statLabelHeight);
    });
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

function drawFogOfWarTile(row: number, col: number) {
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

function drawHealthBars() {
    if ((!isAction && !selectedTile || animatingUnit)) return;
    for (const unit of units){
        const pos = coordToPosition(unit.row, unit.col);
        if (pos.x === -9999 || pos.y === -9999) return;

        const barHeight = 2 * SCALE;
        const barWidth = 12 * SCALE;
        const barX = pos.x + barWidth - (2 * SCALE);
        const barY = pos.y - 16 * SCALE;
        
        ctx.fillStyle = '#555';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        const healthWidth = barWidth * (unit.health / unit.maxHealth);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(barX, barY, healthWidth, barHeight);
    }
}

function drawAnimatingHealthBar() {
    if (!animateHealthBar) return;
    if (!animatingHealthBarUnit) return;
    const unit = animatingHealthBarUnit;
    const pos = coordToPosition(unit.row, unit.col);
    if (pos.x === -9999 || pos.y === -9999) return;

    const barHeight = 2 * SCALE;
    const barWidth = 12 * SCALE;
    const barX = pos.x + barWidth - (2 * SCALE);
    const barY = pos.y - 16 * SCALE;
    
    ctx.fillStyle = '#555';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthWidth = barWidth * (healthBarCurrent / unit.maxHealth);
    ctx.fillStyle = '#0f0';
    ctx.fillRect(barX, barY, healthWidth, barHeight);
}

function drawMovementTiles() {
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
                        if (path.length === 0) continue;
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
                                console.log("obstacle detected");
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

// turn into arrow
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

// -----------Canvas Events Controls-----------------------

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

let isDragging = false;
let startX = 0;
let startY = 0;

canvas.addEventListener('click', function(event) {
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
                window.socket.emit('player-unit-move', unit!.id, tile);
                break;
            } else if (!isAction && selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {
                // move clicked on another tile to move
                if (validMoveTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {
                    const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);
                    window.socket.emit('player-unit-move', unit!.id, tile);
                }
                selectedTile = null;
            } else if (isAction && hasUnit(tile.row, tile.col)) {
                // action clicked on another unit
                if (validActionTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {
                    const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
                    window.socket.emit('player-unit-action', unit!.id, tile);
                }
                isAction = false;
                moveTile = null;
            } else if (isAction && hasUnit(tile.row, tile.col)) {
                // action clicked on same tile to cancel
                const unit = units.find(unit => unit.row === moveTile!.row && unit.col === moveTile!.col);
                isAction = false;
                moveTile = null;
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

// -----------Touch Screen Logic---------------------------

let touchStartX: number = 0;
let touchStartY: number = 0;
let isTouchDragging: boolean = false;
let lastTouchDistance: number | null = null;

canvas.addEventListener("touchstart", (e: TouchEvent) => {
    if (e.touches.length === 1) {
        isTouchDragging = true;
        touchStartX = e.touches[0].clientX - cameraOffsetX;
        touchStartY = e.touches[0].clientY - cameraOffsetY;
    } else if (e.touches.length === 2) {
        lastTouchDistance = getTouchDistance(e.touches);
    }
}, { passive: true });

canvas.addEventListener("touchmove", (e: TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && isTouchDragging) {
        cameraOffsetX = e.touches[0].clientX - touchStartX;
        cameraOffsetY = e.touches[0].clientY - touchStartY;
    } else if (e.touches.length === 2) {
        const newDistance = getTouchDistance(e.touches);
        if (lastTouchDistance !== null) {
            SCALE *= newDistance / lastTouchDistance;
            SCALE = Math.max(MIN_SCALE - 0.5, Math.min(MAX_SCALE - 0.5, SCALE));
        }
        lastTouchDistance = newDistance;
    }
}, { passive: false });

canvas.addEventListener("touchend", (e: TouchEvent) => {
    if (e.touches.length === 0) {
        isTouchDragging = false;
        lastTouchDistance = null;
    }
}, { passive: true });

function getTouchDistance(touches: TouchList): number {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// ---------------GAMEPAD CONTROLS-------------------------------------------------

window.addEventListener('gamepadconnected', (event: GamepadEvent) => {
    console.log(`Gamepad connected: ${event.gamepad.id}`);
    gamepadIndex = event.gamepad.index;
});

window.addEventListener('gamepaddisconnected', (event: GamepadEvent) => {
    console.log(`Gamepad disconnected: ${event.gamepad.id}`);
    if (gamepadIndex === event.gamepad.index) {
        gamepadIndex = null;
    }
});

function gamepadHandler(): void {
    const gamepads = navigator.getGamepads();
    if (gamepadIndex === null || !gamepads[gamepadIndex]) return;
    const gamepad = gamepads[gamepadIndex];
    if (!gamepad) return;

    const currentTime = Date.now();
    const deadzone = 0.2;
    const moveSpeed = 8 * SCALE;

    if (gamepad.buttons[9].pressed) {
        if (!lastInputTime[9] || currentTime - lastInputTime[9] > INPUT_DELAY) {
            lastInputTime[9] = currentTime;
            window.socket.emit('force-end-turn');
            selectedTile = null;
            isAction = false;
            moveTile = null;
        }
    }

    if (gamepad.buttons[4].pressed) {
        if (SCALE !== MIN_SCALE) SCALE -= 0.125;
        if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
    }

    if (gamepad.buttons[5].pressed) {
        if (SCALE !== MAX_SCALE) SCALE += 0.125;
        if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
    }

    const horizontal: number = gamepad.axes[2];
    const vertical: number = gamepad.axes[3];

    if (Math.abs(horizontal) > deadzone) {
        cameraOffsetX -= horizontal * moveSpeed;
    }

    if (Math.abs(vertical) > deadzone) {
        cameraOffsetY -= vertical * moveSpeed;
    }
}

// ---------------UI EVENTS--------------------------------------------------------

endTurnBtn.addEventListener('click', function(e){
    window.socket.emit('force-end-turn');
    selectedTile = null;
    isAction = false;
    moveTile = null;
});

// ----------------Helpers=========================================================

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60); 
    const remainingSeconds = seconds % 60;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');

    return `${formattedMinutes}:${formattedSeconds}`;
}

function unitCanMove(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            return unit.canMove;
        }
    }
    return false;
}

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
            return unit.owner.socket === window.socket.id;
        }
    }
    return false;
}

function unitCanBeHealed(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            if (unit.owner.socket !== window.socket.id) return false;
            return unit.health < unit.maxHealth;
        }
    }
    return false;
}

function unitCanBeAttacked(row: number, col: number): boolean {
    for (const unit of units) {
        if (unit.row === row && unit.col === col) {
            if (unit.owner.socket === window.socket.id) return false;
            return unit.health > 0;
        }
    }
    return false;
}

function isVisibleTile(row: number, col: number): boolean {
    const tile = visibleTiles.find(visibleTiles => visibleTiles.row === row && visibleTiles.col === col);
    if (tile) return true;
    return false;
}

function adjacentTile(row1: number, col1: number, row2: number, col2: number): boolean {
    return (row1 === row2 && col1 === col2) || 
           (Math.abs(row1 - row2) === 1 && col1 === col2) || 
           (Math.abs(col1 - col2) === 1 && row1 === row2);
}

// A* Pathfinding Algorithm
// TODO: take into account tile movement weight
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

            // Check if the neighbor is within bounds and is not an obstacle (assuming 1 = walkable, 0 = obstacle) and height difference is not >= 1.5
            if (neighborX >= 0 && neighborX < grid[0].length && neighborY >= 0 && neighborY < grid.length && (grid[neighborY][neighborX] !== 0 && grid[neighborY][neighborX] !== 4) && arena.heightMap[neighborY][neighborX] - arena.heightMap[current.y][current.x] <= 1.5) {
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

function coordToPosition(row: number, col: number): { x: number, y: number } {
    for (const tile of tiles) {
        if (tile.row === row && tile.col === col) {
            return { x: tile.x, y: tile.y };
        }
    }
    return { x: -9999, y: -9999 };
}

function isTurn(){
    return players[currentRound % 2].socket === window.socket.id;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTileHeight(row: number, col: number): number{
    if (!arena) return 0;
    return arena.heightMap[row][col] - 1;
}

function loadImage(name: string, src: string): HTMLImageElement {
    if (!imageCache.has(name)) {
        const img = new Image();
        img.src = src;
        imageCache.set(name, img);
    }
    return imageCache.get(name)!;
}

const audioContext = new AudioContext();
const gainNode = audioContext.createGain();
gainNode.gain.value = 0.5;
gainNode.connect(audioContext.destination);

function playSound(name: string, src: string) {
    const audio = audioCache.get(name) ?? loadAudio(name, src);
    
    audio.currentTime = 0;
    
    try {
        // Connect only if not already connected
        const track = audioContext.createMediaElementSource(audio);
        track.connect(gainNode);
    } catch (e) {
        // MediaElementSource can only be used once per audio element — ignore this error if already connected
    }

    audio.play().catch(e => console.error("Audio play failed:", e));
}

function loadAudio(name: string, src: string): HTMLAudioElement {
    if (!audioCache.has(name)) {
        const audio = new Audio(src);
        audioCache.set(name, audio);
    }
    return audioCache.get(name)!;
}

window.gainNode = gainNode;