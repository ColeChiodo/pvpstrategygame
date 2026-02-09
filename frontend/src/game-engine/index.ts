import { ref, onMounted, onUnmounted } from 'vue';
import { Socket } from 'socket.io-client';
import { SCALE, MAX_SCALE, MIN_SCALE, INPUT_DELAY } from './constants';
import { sprites } from './sprites';
import { tileTypes } from './tiles';
import { Player, Unit, Arena, Obstacle, Sprite, GameState, Tile } from './types';
import { isPointInsideTile, formatTime, sleep } from './helpers';
import { astarPath, bresenhamPath } from './pathfinding';

const imageCache = new Map<string, HTMLImageElement>();

export function useGameEngine(canvasRef: { value: HTMLCanvasElement | null }) {
    let ctx: CanvasRenderingContext2D | null = null;
    let socket: Socket | null = null;
    let animationFrameId: number | null = null;

    const gameSession = ref<any>(null);
    const players = ref<Player[]>([]);
    const units = ref<Unit[]>([]);
    const visibleTiles = ref<{ row: number; col: number }[]>([]);
    const hoveredTile = ref<Tile | null>(null);
    const selectedTile = ref<Tile | null>(null);
    const moveTile = ref<Tile | null>(null);
    const validMoveTiles = ref<Tile[]>([]);
    const validActionTiles = ref<Tile[]>([]);

    let arena: Arena | null = null;
    let arenaImage: HTMLImageElement | null = null;
    let uiImage: HTMLImageElement | null = null;

    let currentRound = 0;
    let player1Time = 0;
    let player2Time = 0;

    let isAnimating = false;
    let animatingUnit: Unit | null = null;
    let animateHealthBar = false;
    let animatingHealthBarUnit: Unit | null = null;
    let healthBarCurrent = 0;

    let cameraOffsetX = 0;
    let cameraOffsetY = 150;
    let zoomScale = 1.0;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    let tiles: Tile[] = [];
    let isAction = false;
    let gameOver = false;
    let isMyTurn = ref(false);

    let gamepadIndex: number | null = null;
    let lastInputTime: Record<number, number> = {};

    function initSocket(gameSocket: Socket, session: any) {
        socket = gameSocket;
        gameSession.value = session;

        uiImage = new Image();
        uiImage.src = '/assets/spritesheets/UI.png';
    }

    function loadArenaImage(newArena: Arena) {
        arena = newArena;
        arenaImage = new Image();
        arenaImage.onload = () => draw();
        arenaImage.onerror = () => console.error('[DRAW] Failed to load arena image:', `/assets/maps/${newArena.name}.png`);
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
    }

    function loadPlayers(newPlayers: Player[]) {
        players.value = newPlayers;
        if (players.value.length === 2) {
            isMyTurn.value = isTurn();
        }
    }

    function loadUnits(newPlayers: Player[]) {
        const existingUnitIds = new Set(units.value.map(u => String(u.id)));
        
        for (const player of newPlayers) {
            for (const unit of player.units) {
                const unitId = String(unit.id);
                
                if (existingUnitIds.has(unitId)) {
                    const existingUnit = units.value.find(u => String(u.id) === unitId);
                    if (existingUnit) {
                        existingUnit.row = unit.row;
                        existingUnit.col = unit.col;
                        existingUnit.health = unit.health;
                        existingUnit.canMove = unit.canMove;
                        existingUnit.canAct = unit.canAct;
                        existingUnit.currentStatus = !unit.canMove && !unit.canAct ? 1 : 0;
                    }
                } else {
                    unit.owner = player;
                    const newSprite = sprites.find(s => s.name === unit.name);
                    if (newSprite) {
                        unit.sprite = { ...newSprite, currentFrame: 0, direction: 1 };
                    }
                    unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                    units.value.push(unit);
                    existingUnitIds.add(unitId);
                }
            }
        }
    }

    function resizeCanvas() {
        if (canvasRef.value) {
            canvasRef.value.width = window.innerWidth;
            canvasRef.value.height = window.innerHeight;
            draw();
        }
    }

    async function animateMove(tempUnit: Unit, origin: { row: number; col: number }, target: { row: number; col: number }) {
        console.log('[GAME] Animating move');
        isAnimating = true;
        const path = astarPath(origin.row, origin.col, target.row, target.col, arena!);
        const realUnit = units.value.find(u => u.row === tempUnit.row && u.col === tempUnit.col);
        if (!realUnit) return;

        realUnit.sprite.currentFrame = 0;
        let lastTile = { x: origin.col, y: origin.row };

        for (const tile of path) {
            if (!isAnimating) break;
            animatingUnit = realUnit;
            realUnit.currentStatus = 2;
            playSound('step', '/assets/audio/sfx/step.wav');
            realUnit.row = tile.row;
            realUnit.col = tile.col;

            if (realUnit.row === lastTile.y) {
                if (realUnit.col > lastTile.x) realUnit.sprite.direction = 1;
                else if (realUnit.col < lastTile.x) realUnit.sprite.direction = -1;
            } else if (realUnit.col === lastTile.x) {
                if (realUnit.row > lastTile.y) realUnit.sprite.direction = -1;
                else if (realUnit.row < lastTile.y) realUnit.sprite.direction = 1;
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
        const realUnit = units.value.find(u => u.row === tempUnit.row && u.col === tempUnit.col);
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

    function draw() {
        if (!ctx || !canvasRef.value) return;
        
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
        drawBackground();
        drawArena();
        drawFogOfWarTiles();
        drawEntities();
        drawUI();
        drawInteractionSquares();
    }

    function drawInteractionSquares(): number {
        console.log('[DRAW] drawInteractionSquares() called, arenaImage:', !!arenaImage, 'arena:', !!arena, 'ctx:', !!ctx);
        if (!arenaImage || !arena || !canvasRef.value || !ctx) {
            console.log('[DRAW] drawInteractionSquares() returning early');
            return 0;
        }
        const tileWidth = 32 * SCALE;
        const tileHeight = 16 * SCALE;
        const rows = arena.tiles.length;
        const cols = arena.tiles[0].length;
        const imgCenterX = canvasRef.value.width / 2;
        const imgCenterY = canvasRef.value.height / 2;
        const gridWidth = (cols - 1) * tileWidth / 2;
        const gridHeight = (rows - 1) * tileHeight / 2;
        const offsetX = imgCenterX - tileWidth / 2 + cameraOffsetX;
        const offsetY = imgCenterY - gridHeight - tileHeight - 8 * SCALE + cameraOffsetY;

        tiles = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (arena.tiles[row][col] === 0) continue;
                const isoX = (col - row) * tileWidth / 2 + offsetX;
                const isoY = (col + row) * tileHeight / 2 + offsetY - ((getTileHeight(row, col) * 16) * SCALE);
                tiles.push(drawIsometricTile(isoX, isoY, row, col));
            }
        }
        console.log('[DRAW] tiles created:', tiles.length);
        return tiles.length;
    }

    function drawBackground() {
        if (!ctx || !canvasRef.value) return;
        ctx.fillStyle = '#0f0f2b';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }

    function drawArena() {
        if (!ctx || !arenaImage || !arena || !canvasRef.value) return;
        ctx.imageSmoothingEnabled = false;
        
        const scale = SCALE * zoomScale;
        const centerX = canvasRef.value.width / 2 + cameraOffsetX;
        const centerY = canvasRef.value.height / 2 + cameraOffsetY;
        
        ctx.drawImage(
            arenaImage,
            centerX - (arena.width * scale) / 2,
            centerY - (arena.height * scale) / 2,
            arena.width * scale,
            arena.height * scale
        );
    }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            arenaImage,
            (canvasRef.value.width - arena.width * SCALE) / 2 + cameraOffsetX,
            (canvasRef.value.height - arena.height * SCALE - 16 * SCALE) / 2 + cameraOffsetY,
            arena.width * SCALE,
            arena.height * SCALE
        );
    }

    function drawEntities() {
        if (!ctx || !arena) return;
        if (units.value.length === 0) return;

        const scale = SCALE * zoomScale;

        const entities = [
            ...arena.obstacles.map(o => ({ type: 'obstacle' as const, entity: o })),
            ...units.value.map(u => ({ type: 'unit' as const, entity: u }))
        ];

        entities.sort((a, b) => {
            if (a.entity.row !== b.entity.row) return a.entity.row - b.entity.row;
            return a.entity.col - b.entity.col;
        });

        for (const { type, entity } of entities) {
            const pos = coordToPosition(entity.row, entity.col);
            if (pos.x === -9999) continue;

            if (type === 'obstacle') {
                const obstacle = entity as Obstacle;
                const frameSize = obstacle.sprite.height;
                ctx.imageSmoothingEnabled = false;
                ctx.globalAlpha = 0.75;
                const obstacleImg = loadImage(obstacle.sprite.name, `/assets/maps/${obstacle.sprite.name}.png`);
                ctx.drawImage(
                    obstacleImg, 0, 0, frameSize, frameSize,
                    pos.x - frameSize * scale, pos.y - frameSize * scale,
                    frameSize * scale, frameSize * scale
                );
                ctx.globalAlpha = 1.0;
            } else {
                const unit = entity as Unit;
                const frameSize = 32;
                const frameX = unit.sprite?.currentFrame || 0;
                const frameY = unit.currentStatus;
                const direction = unit.sprite?.direction || 1;
                const unitImg = loadImage(unit.sprite?.name || 'test', `/assets/spritesheets/units/${unit.sprite?.name || 'test'}.png`);

                ctx.imageSmoothingEnabled = false;
                ctx.save();
                if (direction === -1) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(
                        unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        -(pos.x + frameSize * scale), pos.y - frameSize * scale,
                        frameSize * scale, frameSize * scale
                    );
                } else {
                    ctx.drawImage(
                        unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        pos.x, pos.y - frameSize * scale,
                        frameSize * scale, frameSize * scale
                    );
                }
                ctx.restore();
            }
        }
    }

    function drawUI() {
        drawHoveredTile();
        drawSelectedTile();
        drawMovementTiles();
        drawActionTiles();
        drawPath();
        drawHealthBars();
        drawAnimatingHealthBar();
    }

    function drawHoveredTile() {
        if (!hoveredTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        const highlightFrameX = hasUnit(hoveredTile.value.row, hoveredTile.value.col)
            ? (unitIsTeam(hoveredTile.value.row, hoveredTile.value.col) ? 1 : 2)
            : 0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, highlightFrameX * frameSize, 0, frameSize, frameSize,
            hoveredTile.value.x, hoveredTile.value.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawSelectedTile() {
        if (!selectedTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 3 * frameSize, 0, frameSize, frameSize,
            selectedTile.value.x, selectedTile.value.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawMoveTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 3 * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawActionTile(tile: Tile, action: string) {
        if (!uiImage || !ctx) return;
        validActionTiles.value.push(tile);
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        const frameX = action === 'attack' ? 2 : 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, frameX * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawPathTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 0, 4 * frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawFogTile(row: number, col: number) {
        if (!uiImage || !ctx) return;
        const pos = coordToPosition(row, col);
        if (pos.x === -9999) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 4 * frameSize, frameSize, frameSize, frameSize,
            pos.x, pos.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawMovementTiles() {
        if (!arena || !selectedTile.value) return;
        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
        if (!unit) return;

        const mobility = unit.mobility;
        const row = selectedTile.value.row;
        const col = selectedTile.value.col;

        validMoveTiles.value = [];

        for (let i = -mobility; i <= mobility; i++) {
            for (let j = -mobility; j <= mobility; j++) {
                if (Math.abs(i) + Math.abs(j) <= mobility) {
                    const targetRow = row + i;
                    const targetCol = col + j;
                    if (targetRow < 0 || targetCol < 0 || targetRow >= arena.tiles.length || targetCol >= arena.tiles[0].length) continue;
                    if (hasUnit(targetRow, targetCol) && (i !== 0 || j !== 0)) continue;
                    if (arena.tiles[targetRow][targetCol] === 0) continue;

                    const path = astarPath(row, col, targetRow, targetCol, arena);
                    if (path.length - 1 > mobility) continue;

                    let canMove = true;
                    let mobilityPenalty = 0;
                    for (const tile of path) {
                        const terrain = arena.tiles[tile.row][tile.col];
                        if (terrain === 0 || terrain === 4) { canMove = false; break; }
                        if (terrain === 2) mobilityPenalty += 2;
                    }

                    if (canMove && (mobility - mobilityPenalty >= 0)) {
                        const tile = { x: 0, y: 0, row: targetRow, col: targetCol };
                        validMoveTiles.value.push(tile);
                        drawMoveTile(tile);
                    }
                }
            }
        }
    }

    function drawMoveTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 3 * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawActionTiles() {
        if (!isAction || !moveTile.value || !arena) return;
        const unit = units.value.find(u => u.row === moveTile.value!.row && u.col === moveTile.value!.col);
        if (!unit) return;

        const range = unit.range;
        const row = moveTile.value.row;
        const col = moveTile.value.col;
        const unitAction = unit.action;

        for (let i = -range; i <= range; i++) {
            for (let j = -range; j <= range; j++) {
                if (Math.abs(i) + Math.abs(j) <= range) {
                    if (i === 0 && j === 0) continue;
                    if (!hasUnit(row + i, col + j)) continue;
                    if (unitAction === 'heal' && !unitIsTeam(row + i, col + j)) continue;
                    if (unitAction === 'attack' && unitIsTeam(row + i, col + j)) continue;

                    const tile = { x: 0, y: 0, row: row + i, col: col + j };
                    drawActionTile(tile, unitAction);
                }
            }
        }
    }

    function drawActionTile(tile: Tile, action: string) {
        if (!uiImage || !ctx) return;
        validActionTiles.value.push(tile);
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        const frameX = action === 'attack' ? 2 : 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, frameX * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawPath() {
        if (!selectedTile.value || !hoveredTile.value) return;
        const path = astarPath(selectedTile.value.row, selectedTile.value.col, hoveredTile.value.row, hoveredTile.value.col, arena!);
        for (const tile of path) {
            if (validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                drawPathTile(tile);
            }
        }
    }

    function drawPathTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 0, 4 * frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawHealthBars() {
        if ((!isAction && !selectedTile.value) || animatingUnit) return;
        const scale = SCALE * zoomScale;
        for (const unit of units.value) {
            const pos = coordToPosition(unit.row, unit.col);
            if (pos.x === -9999) continue;
            const barHeight = 2 * scale;
            const barWidth = 12 * scale;
            ctx!.fillStyle = '#555';
            ctx!.fillRect(pos.x + barWidth - 2 * scale, pos.y - 16 * scale, barWidth, barHeight);
            ctx!.fillStyle = '#0f0';
            ctx!.fillRect(pos.x + barWidth - 2 * scale, pos.y - 16 * scale, barWidth * (unit.health / unit.maxHealth), barHeight);
        }
    }

    function drawAnimatingHealthBar() {
        if (!animateHealthBar || !animatingHealthBarUnit || !ctx) return;
        const unit = animatingHealthBarUnit;
        const pos = coordToPosition(unit.row, unit.col);
        if (pos.x === -9999) return;
        const scale = SCALE * zoomScale;
        const barHeight = 2 * scale;
        const barWidth = 12 * scale;
        ctx.fillStyle = '#555';
        ctx.fillRect(pos.x + barWidth - 2 * scale, pos.y - 16 * scale, barWidth, barHeight);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(pos.x + barWidth - 2 * scale, pos.y - 16 * scale, barWidth * (healthBarCurrent / unit.maxHealth), barHeight);
    }

    function drawFogOfWarTiles() {
        if (!arena || !uiImage || !ctx) return;
        for (let row = 0; row < arena.tiles.length; row++) {
            for (let col = 0; col < arena.tiles[row].length; col++) {
                if (arena.tiles[row][col] === 0) continue;
                if (isVisibleTile(row, col)) continue;
                drawFogTile(row, col);
            }
        }
    }

    function drawFogTile(row: number, col: number) {
        if (!uiImage || !ctx) return;
        const pos = coordToPosition(row, col);
        if (pos.x === -9999) return;
        const frameSize = 32;
        const scale = SCALE * zoomScale;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 4 * frameSize, frameSize, frameSize, frameSize,
            pos.x, pos.y - 8 * scale,
            frameSize * scale, frameSize * scale
        );
    }

    function drawInteractionSquares() {
        if (!arena || !canvasRef.value || !ctx) return 0;
        
        const scale = SCALE * zoomScale;
        const tileWidth = 32 * scale;
        const tileHeight = 16 * scale;
        const rows = arena.tiles.length;
        const cols = arena.tiles[0].length;
        const centerX = canvasRef.value.width / 2 + cameraOffsetX;
        const centerY = canvasRef.value.height / 2 + cameraOffsetY;

        tiles = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (arena.tiles[row][col] === 0) continue;
                const isoX = centerX + (col - row) * tileWidth / 2;
                const isoY = centerY + (col + row) * tileHeight / 2;
                tiles.push(drawIsometricTile(isoX, isoY, row, col));
            }
        }
        return tiles.length;
    }

    function drawIsometricTile(x: number, y: number, row: number, col: number): Tile {
        return { x, y, row, col };
    }

    function coordToPosition(row: number, col: number): { x: number; y: number } {
        const tile = tiles.find(t => t.row === row && t.col === col);
        return tile ? { x: tile.x, y: tile.y } : { x: -9999, y: -9999 };
    }

    function getTileHeight(row: number, col: number): number {
        if (!arena) return 0;
        return (arena.heightMap[row]?.[col] || 1) - 1;
    }

    function isVisibleTile(row: number, col: number): boolean {
        return visibleTiles.value.some(t => t.row === row && t.col === col);
    }

    function hasUnit(row: number, col: number): boolean {
        return units.value.some(u => u.row === row && u.col === col);
    }

    function unitIsTeam(row: number, col: number): boolean {
        const unit = units.value.find(u => u.row === row && u.col === col);
        return unit?.owner.socket === socket?.id;
    }

    function isTurn(): boolean {
        return players.value[currentRound % 2]?.socket === socket?.id;
    }

    function loadImage(name: string, src: string): HTMLImageElement {
        if (!imageCache.has(name)) {
            const img = new Image();
            img.src = src;
            imageCache.set(name, img);
        }
        return imageCache.get(name)!;
    }

    function playSound(name: string, src: string) {
        try {
            const audio = new Audio(src);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {}
    }

    function gameLoop() {
        draw();
        gamepadHandler();
        animationFrameId = requestAnimationFrame(gameLoop);
    }

    function gamepadHandler() {
        const gamepads = navigator.getGamepads();
        if (gamepadIndex === null || !gamepads[gamepadIndex]) return;
        const gamepad = gamepads[gamepadIndex];
        if (!gamepad) return;

        const currentTime = Date.now();

        if (gamepad.buttons[9]?.pressed && (!lastInputTime[9] || currentTime - lastInputTime[9] > INPUT_DELAY)) {
            lastInputTime[9] = currentTime;
            endTurn();
        }

        if (gamepad.buttons[4]?.pressed) {
            cameraOffsetY += 8 * SCALE;
        }
        if (gamepad.buttons[5]?.pressed) {
            cameraOffsetY -= 8 * SCALE;
        }
    }

    function endTurn() {
        if (!socket) return;
        socket.emit('endTurn');
        selectedTile.value = null;
        isAction = false;
        moveTile.value = null;
    }

    function handleClick(event: MouseEvent) {
        if (event.button !== 0) return;
        if (!isMyTurn.value) return;
        if (players.value.length !== 2) return;

        const clickX = event.offsetX;
        const clickY = event.offsetY;

        for (const tile of tiles) {
            if (!hoveredTile.value) break;
            if (isPointInsideTile(clickX, clickY, tile)) {
                if (!isAction && !selectedTile.value && unitIsTeam(hoveredTile.value.row, hoveredTile.value.col)) {
                    selectedTile.value = hoveredTile.value;
                } else if (!isAction && selectedTile.value && tile.row === selectedTile.value.row && tile.col === selectedTile.value.col) {
                    const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                    if (unit && validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        socket?.emit('player-unit-move', unit.id, tile);
                    }
                    selectedTile.value = null;
                } else if (!isAction && selectedTile.value && unitIsTeam(selectedTile.value.row, selectedTile.value.col)) {
                    if (validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                        socket?.emit('player-unit-move', unit?.id, tile);
                    }
                    selectedTile.value = null;
                } else if (isAction && hasUnit(tile.row, tile.col)) {
                    if (validActionTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        const unit = units.value.find(u => u.row === moveTile.value!.row && u.col === moveTile.value!.col);
                        socket?.emit('player-unit-action', unit?.id, tile);
                    }
                    isAction = false;
                    moveTile.value = null;
                }
                break;
            } else {
                hoveredTile.value = null;
            }
        }
    }

    function handleMouseMove(e: MouseEvent) {
        const clickX = e.offsetX;
        const clickY = e.offsetY;

        if (isDragging && e.buttons === 2) {
            cameraOffsetX += e.movementX;
            cameraOffsetY += e.movementY;
            return;
        }

        for (const tile of tiles) {
            if (isPointInsideTile(clickX, clickY, tile)) {
                hoveredTile.value = tile;
                break;
            } else {
                hoveredTile.value = null;
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        switch (e.key) {
            case 'z':
                break;
            case 'x':
                break;
            case 'ArrowUp':
            case 'w':
                cameraOffsetY += 8 * SCALE;
                break;
            case 'ArrowDown':
            case 's':
                cameraOffsetY -= 8 * SCALE;
                break;
            case 'ArrowLeft':
            case 'a':
                cameraOffsetX += 8 * SCALE;
                break;
            case 'ArrowRight':
            case 'd':
                cameraOffsetX -= 8 * SCALE;
                break;
            case 'Enter':
                endTurn();
                break;
        }
    }

    function handleWheel(e: WheelEvent) {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(MIN_SCALE, Math.min(MAX_SCALE, zoomScale * zoomFactor));
        
        if (newZoom !== zoomScale) {
            const rect = canvasRef.value?.getBoundingClientRect();
            if (rect) {
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                const worldX = (mouseX - rect.width / 2 - cameraOffsetX) / zoomScale;
                const worldY = (mouseY - rect.height / 2 - cameraOffsetY) / zoomScale;
                
                zoomScale = newZoom;
                
                cameraOffsetX = mouseX - rect.width / 2 - worldX * zoomScale;
                cameraOffsetY = mouseY - rect.height / 2 - worldY * zoomScale;
            }
        }
    }

    function start() {
        if (!canvasRef.value) return;
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        ctx = canvasRef.value.getContext('2d');
        if (ctx) ctx.imageSmoothingEnabled = false;
        
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);
        canvasRef.value.addEventListener('click', handleClick);
        canvasRef.value.addEventListener('mousemove', handleMouseMove);
        canvasRef.value.addEventListener('wheel', handleWheel, { passive: false });
        canvasRef.value.addEventListener('contextmenu', (e) => e.preventDefault());
        
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            gamepadIndex = e.gamepad.index;
        });
        window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
            if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
        });
        
        handleResize();
        gameLoop();
    }

    function handleResize() {
        if (!canvasRef.value || !ctx) return;
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        if (ctx) ctx.imageSmoothingEnabled = false;
        draw();
    }

    function stop() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('keydown', handleKeyDown);
        if (canvasRef.value) {
            canvasRef.value.removeEventListener('click', handleClick);
            canvasRef.value.removeEventListener('mousemove', handleMouseMove);
            canvasRef.value.removeEventListener('wheel', handleWheel);
        }
    }

    function updateState(state: GameState) {
        if (!ctx && canvasRef.value) {
            ctx = canvasRef.value.getContext('2d');
        }
        if (state.arena) {
            loadArenaImage(state.arena);
        }
        if (state.players) {
            loadPlayers(state.players as any);
            loadUnits(state.players as any);
        }
        if (state.visibleTiles) {
            visibleTiles.value = state.visibleTiles;
        }
        if (state.round !== undefined) {
            currentRound = state.round;
        }
        draw();
    }

    return {
        gameSession,
        players,
        units,
        isMyTurn,
        player1Time,
        player2Time,
        initSocket,
        start,
        stop,
        updateState
    };
}
