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
    let cameraOffsetY = 100;
    let zoomScale = 0.8;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    let tiles: Tile[] = [];
    let isAction = false;
    let gameOver = false;
    let isMyTurn = ref(false);

    let gamepadIndex: number | null = null;
    let lastInputTime: Record<number, number> = {};

    function initSocket(gameSocket: Socket, session: any) {
        console.log('[INIT] initSocket called');
        socket = gameSocket;
        gameSession.value = session;

        uiImage = new Image();
        uiImage.src = '/assets/spritesheets/UI.png';
        console.log('[INIT] UI image src set:', uiImage.src);
    }

    function loadArenaImage(newArena: Arena) {
        console.log('[LOAD] loadArenaImage called, arena name:', newArena?.name);
        arena = newArena;
        arenaImage = new Image();
        arenaImage.onload = () => {
            console.log('[LOAD] Arena image loaded successfully');
            draw();
        };
        arenaImage.onerror = () => console.error('[LOAD] Failed to load arena image:', `/assets/maps/${newArena.name}.png`);
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
        console.log('[LOAD] Arena image src set:', arenaImage.src);
    }

    function loadPlayers(newPlayers: Player[]) {
        console.log('[LOAD] loadPlayers called, player count:', newPlayers?.length);
        players.value = newPlayers;
        if (players.value.length === 2) {
            isMyTurn.value = isTurn();
            console.log('[LOAD] isMyTurn set to:', isMyTurn.value, 'my socket:', socket?.id, 'player1 socket:', players.value[0]?.socket);
        }
    }

    function loadUnits(newPlayers: Player[]) {
        console.log('[LOAD] loadUnits called, player count:', newPlayers?.length);
        const existingUnitIds = new Set(units.value.map(u => String(u.id)));
        console.log('[LOAD] Existing unit IDs:', Array.from(existingUnitIds));
        
        for (const player of newPlayers) {
            console.log('[LOAD] Processing player:', player.name, 'units:', player.units?.length);
            for (const unit of player.units) {
                const unitId = String(unit.id);
                console.log('[LOAD] Checking unit:', unit.name, 'id:', unitId);
                
                if (existingUnitIds.has(unitId)) {
                    const existingUnit = units.value.find(u => String(u.id) === unitId);
                    if (existingUnit) {
                        console.log('[LOAD] Updating existing unit:', unitId);
                        existingUnit.row = unit.row;
                        existingUnit.col = unit.col;
                        existingUnit.health = unit.health;
                        existingUnit.canMove = unit.canMove;
                        existingUnit.canAct = unit.canAct;
                        existingUnit.currentStatus = !unit.canMove && !unit.canAct ? 1 : 0;
                    }
                } else {
                    console.log('[LOAD] Adding new unit:', unit.name, 'id:', unitId);
                    unit.owner = player;
                    const newSprite = sprites.find(s => s.name === unit.name);
                    if (newSprite) {
                        unit.sprite = { ...newSprite, currentFrame: 0, direction: 1 };
                        console.log('[LOAD] Assigned sprite:', unit.sprite.name);
                    } else {
                        console.log('[LOAD] WARNING: No sprite found for unit:', unit.name);
                    }
                    unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                    units.value.push(unit);
                    existingUnitIds.add(unitId);
                }
            }
        }
        console.log('[LOAD] Total units after load:', units.value.length);
    }

    function resizeCanvas() {
        console.log('[RESIZE] resizeCanvas called');
        if (canvasRef.value) {
            canvasRef.value.width = window.innerWidth;
            canvasRef.value.height = window.innerHeight;
            console.log('[RESIZE] Canvas size:', canvasRef.value.width, 'x', canvasRef.value.height);
            draw();
        }
    }

    async function animateMove(tempUnit: Unit, origin: { row: number; col: number }, target: { row: number; col: number }) {
        console.log('[ANIMATE] Animating move');
        isAnimating = true;
        const path = astarPath(origin.row, origin.col, target.row, target.col, arena!);
        const realUnit = units.value.find(u => u.row === tempUnit.row && u.col === tempUnit.col);
        if (!realUnit) {
            console.log('[ANIMATE] ERROR: realUnit not found');
            return;
        }

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
        console.log('[ANIMATE] animateAction called');
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
        console.log('[DRAW] draw() called');
        if (!ctx || !canvasRef.value) {
            console.log('[DRAW] draw() returning early - ctx:', !!ctx, 'canvasRef.value:', !!canvasRef.value);
            return;
        }
        
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
        drawBackground();
        drawArena();
        drawFogOfWarTiles();
        drawEntities();
        drawUI();
        drawInteractionSquares();
    }

    function drawBackground() {
        if (!ctx || !canvasRef.value) return;
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#0f0f2b';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }

    function drawArena() {
        console.log('[DRAW] drawArena() called, arenaImage:', !!arenaImage);
        if (!ctx || !arenaImage || !arena || !canvasRef.value) return;
        
        ctx.imageSmoothingEnabled = false;
        console.log('[DRAW] Drawing arena with zoomScale:', zoomScale);
        
        const drawX = (canvasRef.value.width - arena.width * zoomScale) / 2 + cameraOffsetX;
        const drawY = (canvasRef.value.height - arena.height * zoomScale - 16 * zoomScale) / 2 + cameraOffsetY;
        
        ctx.drawImage(arenaImage, drawX, drawY, arena.width * zoomScale, arena.height * zoomScale);
    }

    function drawEntities() {
        console.log('[DRAW] drawEntities() called, units count:', units.value.length);
        if (!ctx || !arena) return;
        if (units.value.length === 0) {
            console.log('[DRAW] No units to draw');
            return;
        }

        const entities = [
            ...arena.obstacles.map(o => ({ type: 'obstacle' as const, entity: o })),
            ...units.value.map(u => ({ type: 'unit' as const, entity: u }))
        ];

        console.log('[DRAW] Total entities to draw:', entities.length);

        entities.sort((a, b) => {
            if (a.entity.row !== b.entity.row) return a.entity.row - b.entity.row;
            return a.entity.col - b.entity.col;
        });

        for (const { type, entity } of entities) {
            const pos = coordToPosition(entity.row, entity.col);
            console.log('[DRAW] Entity:', type, 'at position:', pos);
            if (pos.x === -9999) continue;

            if (type === 'obstacle') {
                const obstacle = entity as Obstacle;
                const frameSize = obstacle.sprite.height;
                ctx.imageSmoothingEnabled = false;
                ctx.globalAlpha = 0.75;
                const obstacleImg = loadImage(obstacle.sprite.name, `/assets/maps/${obstacle.sprite.name}.png`);
                ctx.drawImage(obstacleImg, 0, 0, frameSize, frameSize,
                    pos.x - frameSize * zoomScale, pos.y - frameSize * zoomScale + (8 * zoomScale),
                    frameSize * zoomScale, frameSize * zoomScale);
                ctx.globalAlpha = 1.0;
            } else {
                const unit = entity as Unit;
                const frameSize = 32;
                const frameX = unit.sprite?.currentFrame || 0;
                const frameY = unit.currentStatus;
                const direction = unit.sprite?.direction || 1;
                const unitName = unit.sprite?.name || 'test';
                const unitImg = loadImage(unitName, `/assets/spritesheets/units/${unitName}.png`);

                ctx.imageSmoothingEnabled = false;
                ctx.save();
                if (direction === -1) {
                    ctx.scale(-1, 1);
                    ctx.drawImage(unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        -(pos.x + frameSize * zoomScale), pos.y - frameSize * zoomScale + (2 * zoomScale),
                        frameSize * zoomScale, frameSize * zoomScale);
                } else {
                    ctx.drawImage(unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        pos.x, pos.y - frameSize * zoomScale + (2 * zoomScale),
                        frameSize * zoomScale, frameSize * zoomScale);
                }
                ctx.restore();
            }
        }
    }

    function drawUI() {
        console.log('[DRAW] drawUI() called');
        drawHoveredTile();
        drawSelectedTile();
        drawMovementTiles();
        drawActionTiles();
        drawPath();
        drawHealthBars();
        drawAnimatingHealthBar();
    }

    function drawHoveredTile() {
        console.log('[DRAW] drawHoveredTile() called, hoveredTile:', !!hoveredTile.value);
        if (!hoveredTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        const highlightFrameX = hasUnit(hoveredTile.value.row, hoveredTile.value.col)
            ? (unitIsTeam(hoveredTile.value.row, hoveredTile.value.col) ? 1 : 2)
            : 0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, highlightFrameX * frameSize, 0, frameSize, frameSize,
            hoveredTile.value.x, hoveredTile.value.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawSelectedTile() {
        console.log('[DRAW] drawSelectedTile() called, selectedTile:', !!selectedTile.value);
        if (!selectedTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 3 * frameSize, 0, frameSize, frameSize,
            selectedTile.value.x, selectedTile.value.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawMoveTile(tile: Tile) {
        console.log('[DRAW] drawMoveTile() called');
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 3 * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawActionTile(tile: Tile, action: string) {
        console.log('[DRAW] drawActionTile() called');
        if (!uiImage || !ctx) return;
        validActionTiles.value.push(tile);
        const frameSize = 32;
        const frameX = action === 'attack' ? 2 : 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, frameX * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawPathTile(tile: Tile) {
        console.log('[DRAW] drawPathTile() called');
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 0, 4 * frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawFogTile(row: number, col: number) {
        console.log('[DRAW] drawFogTile() called');
        if (!uiImage || !ctx) return;
        const pos = coordToPosition(row, col);
        if (pos.x === -9999) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 4 * frameSize, frameSize, frameSize, frameSize,
            pos.x, pos.y - 8 * zoomScale, frameSize * zoomScale, frameSize * zoomScale);
    }

    function drawMovementTiles() {
        console.log('[DRAW] drawMovementTiles() called, selectedTile:', !!selectedTile.value);
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

    function drawActionTiles() {
        console.log('[DRAW] drawActionTiles() called, isAction:', isAction, 'moveTile:', !!moveTile.value);
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

    function drawPath() {
        console.log('[DRAW] drawPath() called');
        if (!selectedTile.value || !hoveredTile.value) return;
        const path = astarPath(selectedTile.value.row, selectedTile.value.col, hoveredTile.value.row, hoveredTile.value.col, arena!);
        for (const tile of path) {
            if (validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                drawPathTile(tile);
            }
        }
    }

    function drawHealthBars() {
        console.log('[DRAW] drawHealthBars() called, animatingUnit:', !!animatingUnit);
        if ((!isAction && !selectedTile.value) || animatingUnit) return;
        for (const unit of units.value) {
            const pos = coordToPosition(unit.row, unit.col);
            if (pos.x === -9999) continue;
            const barHeight = 2 * zoomScale;
            const barWidth = 12 * zoomScale;
            ctx!.fillStyle = '#555';
            ctx!.fillRect(pos.x + barWidth - 2 * zoomScale, pos.y - 16 * zoomScale, barWidth, barHeight);
            ctx!.fillStyle = '#0f0';
            ctx!.fillRect(pos.x + barWidth - 2 * zoomScale, pos.y - 16 * zoomScale, barWidth * (unit.health / unit.maxHealth), barHeight);
        }
    }

    function drawAnimatingHealthBar() {
        console.log('[DRAW] drawAnimatingHealthBar() called');
        if (!animateHealthBar || !animatingHealthBarUnit || !ctx) return;
        const unit = animatingHealthBarUnit;
        const pos = coordToPosition(unit.row, unit.col);
        if (pos.x === -9999) return;
        const barHeight = 2 * zoomScale;
        const barWidth = 12 * zoomScale;
        ctx.fillStyle = '#555';
        ctx.fillRect(pos.x + barWidth - 2 * zoomScale, pos.y - 16 * zoomScale, barWidth, barHeight);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(pos.x + barWidth - 2 * zoomScale, pos.y - 16 * zoomScale, barWidth * (healthBarCurrent / unit.maxHealth), barHeight);
    }

    function drawFogOfWarTiles() {
        console.log('[DRAW] drawFogOfWarTiles() called');
        if (!arena || !uiImage || !ctx) return;
        for (let row = 0; row < arena.tiles.length; row++) {
            for (let col = 0; col < arena.tiles[row].length; col++) {
                if (arena.tiles[row][col] === 0) continue;
                if (isVisibleTile(row, col)) continue;
                drawFogTile(row, col);
            }
        }
    }

    function drawInteractionSquares(): number {
        console.log('[DRAW] drawInteractionSquares() called');
        if (!arenaImage || !arena || !canvasRef.value || !ctx) {
            console.log('[DRAW] drawInteractionSquares() returning early');
            return 0;
        }
        
        const tileWidth = 32 * zoomScale;
        const tileHeight = 16 * zoomScale;
        const rows = arena.tiles.length;
        const cols = arena.tiles[0].length;
        const imgCenterX = canvasRef.value.width / 2;
        const imgCenterY = canvasRef.value.height / 2;
        const gridWidth = (cols - 1) * tileWidth / 2;
        const gridHeight = (rows - 1) * tileHeight / 2;
        const offsetX = imgCenterX - tileWidth / 2 + cameraOffsetX;
        const offsetY = imgCenterY - gridHeight - tileHeight - 8 * zoomScale + cameraOffsetY;

        tiles = [];
        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                if (arena.tiles[row][col] === 0) continue;
                const isoX = (col - row) * tileWidth / 2 + offsetX;
                const isoY = (col + row) * tileHeight / 2 + offsetY - ((getTileHeight(row, col) * 16) * zoomScale);
                tiles.push(drawIsometricTile(isoX, isoY, row, col));
            }
        }
        console.log('[DRAW] tiles created:', tiles.length);
        return tiles.length;
    }

    function drawIsometricTile(x: number, y: number, row: number, col: number): Tile {
        console.log('[DRAW] drawIsometricTile() called, x:', x, 'y:', y, 'row:', row, 'col:', col);
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
        console.log('[TURN] isTurn() called, currentRound:', currentRound, 'players.length:', players.value.length);
        if (players.value.length < 2) return false;
        const currentPlayer = players.value[currentRound % 2];
        const mySocketId = socket?.id;
        const result = currentPlayer?.socket === mySocketId;
        console.log('[TURN] isTurn() result:', result, 'currentPlayer:', currentPlayer?.name, 'mySocketId:', mySocketId);
        return result;
    }

    function loadImage(name: string, src: string): HTMLImageElement {
        console.log('[IMAGE] loadImage called, name:', name, 'src:', src);
        if (!imageCache.has(name)) {
            const img = new Image();
            img.src = src;
            imageCache.set(name, img);
            console.log('[IMAGE] New image cached:', name);
        }
        return imageCache.get(name)!;
    }

    function playSound(name: string, src: string) {
        console.log('[AUDIO] playSound called, name:', name);
        try {
            const audio = new Audio(src);
            audio.volume = 0.5;
            audio.play().catch(() => {});
        } catch (e) {
            console.log('[AUDIO] Audio play failed:', e);
        }
    }

    function gameLoop() {
        console.log('[LOOP] gameLoop() called');
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

        if (gamepad.buttons[4]?.pressed) cameraOffsetY += 8 * zoomScale;
        if (gamepad.buttons[5]?.pressed) cameraOffsetY -= 8 * zoomScale;
    }

    function endTurn() {
        console.log('[TURN] endTurn() called');
        if (!socket) return;
        socket.emit('endTurn');
        selectedTile.value = null;
        isAction = false;
        moveTile.value = null;
    }

    function handleClick(event: MouseEvent) {
        console.log('[EVENT] handleClick called, button:', event.button, 'offsetX:', event.offsetX, 'offsetY:', event.offsetY);
        if (event.button !== 0) {
            console.log('[EVENT] handleClick ignored - not left click');
            return;
        }
        if (!isMyTurn.value) {
            console.log('[EVENT] handleClick ignored - not my turn');
            return;
        }
        if (players.value.length !== 2) {
            console.log('[EVENT] handleClick ignored - not 2 players');
            return;
        }
        console.log('[EVENT] Click proceeding...');

        const clickX = event.offsetX;
        const clickY = event.offsetY;
        console.log('[EVENT] tiles array length:', tiles.length);

        let found = false;
        for (const tile of tiles) {
            if (!hoveredTile.value) break;
            if (isPointInsideTile(clickX, clickY, tile)) {
                console.log('[EVENT] Clicked inside tile:', tile.row, tile.col);
                
                if (!isAction && !selectedTile.value && unitIsTeam(hoveredTile.value.row, hoveredTile.value.col)) {
                    console.log('[EVENT] First click - selecting unit');
                    selectedTile.value = tile;
                } else if (!isAction && selectedTile.value && tile.row === selectedTile.value.row && tile.col === selectedTile.value.col) {
                    console.log('[EVENT] Clicked same tile - staying in place');
                    const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                    if (unit && validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        console.log('[EVENT] Emitting player-unit-move (stay)');
                        socket?.emit('player-unit-move', unit.id, tile);
                    }
                    selectedTile.value = null;
                } else if (!isAction && selectedTile.value && unitIsTeam(selectedTile.value.row, selectedTile.value.col)) {
                    if (validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                        console.log('[EVENT] Emitting player-unit-move');
                        socket?.emit('player-unit-move', unit?.id, tile);
                    }
                    selectedTile.value = null;
                } else if (isAction && hasUnit(tile.row, tile.col)) {
                    if (validActionTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                        const unit = units.value.find(u => u.row === moveTile.value!.row && u.col === moveTile.value!.col);
                        console.log('[EVENT] Emitting player-unit-action');
                        socket?.emit('player-unit-action', unit?.id, tile);
                    }
                    isAction = false;
                    moveTile.value = null;
                }
                found = true;
                break;
            }
        }
        if (!found) {
            console.log('[EVENT] No tile found at click position');
            selectedTile.value = null;
        }
    }

    function handleMouseDown(event: MouseEvent) {
        console.log('[EVENT] handleMouseDown called, button:', event.button);
        if (event.button !== 1) {
            console.log('[EVENT] handleMouseDown ignored - not middle click');
            return;
        }
        isDragging = true;
        startX = event.clientX - cameraOffsetX;
        startY = event.clientY - cameraOffsetY;
        console.log('[EVENT] Started dragging, startX:', startX, 'startY:', startY);
    }

    function handleMouseUp() {
        console.log('[EVENT] handleMouseUp called, isDragging:', isDragging);
        isDragging = false;
    }

    function handleMouseLeave() {
        console.log('[EVENT] handleMouseLeave called');
        isDragging = false;
    }

    function handleMouseMove(event: MouseEvent) {
        console.log('[EVENT] handleMouseMove called, movementX:', event.movementX, 'movementY:', event.movementY);
        
        const clickX = event.offsetX;
        const clickY = event.offsetY;
        console.log('[EVENT] Mouse position:', clickX, clickY);

        if (isDragging) {
            console.log('[EVENT] Dragging, updating camera offset');
            cameraOffsetX = event.clientX - startX;
            cameraOffsetY = event.clientY - startY;
            console.log('[EVENT] New camera offset:', cameraOffsetX, cameraOffsetY);
            return;
        }

        for (const tile of tiles) {
            if (isPointInsideTile(clickX, clickY, tile)) {
                console.log('[EVENT] Hovering tile:', tile.row, tile.col);
                hoveredTile.value = tile;
                break;
            } else {
                hoveredTile.value = null;
            }
        }
    }

    function handleKeyDown(e: KeyboardEvent) {
        console.log('[EVENT] handleKeyDown called, key:', e.key);
        switch (e.key) {
            case 'z':
                console.log('[EVENT] Z pressed - zoom out');
                if (zoomScale > MIN_SCALE) {
                    zoomScale = Math.max(MIN_SCALE, zoomScale - 0.125);
                    console.log('[EVENT] New zoomScale:', zoomScale);
                }
                break;
            case 'x':
                console.log('[EVENT] X pressed - zoom in');
                if (zoomScale < MAX_SCALE) {
                    zoomScale = Math.min(MAX_SCALE, zoomScale + 0.125);
                    console.log('[EVENT] New zoomScale:', zoomScale);
                }
                break;
            case 'ArrowUp':
            case 'w':
                console.log('[EVENT] Up/W pressed - moving camera up');
                cameraOffsetY += 8 * zoomScale;
                console.log('[EVENT] New cameraOffsetY:', cameraOffsetY);
                break;
            case 'ArrowDown':
            case 's':
                console.log('[EVENT] Down/S pressed - moving camera down');
                cameraOffsetY -= 8 * zoomScale;
                console.log('[EVENT] New cameraOffsetY:', cameraOffsetY);
                break;
            case 'ArrowLeft':
            case 'a':
                console.log('[EVENT] Left/A pressed - moving camera left');
                cameraOffsetX += 8 * zoomScale;
                console.log('[EVENT] New cameraOffsetX:', cameraOffsetX);
                break;
            case 'ArrowRight':
            case 'd':
                console.log('[EVENT] Right/D pressed - moving camera right');
                cameraOffsetX -= 8 * zoomScale;
                console.log('[EVENT] New cameraOffsetX:', cameraOffsetX);
                break;
            case 'Enter':
                console.log('[EVENT] Enter pressed - ending turn');
                endTurn();
                break;
        }
    }

    function handleWheel(e: WheelEvent) {
        console.log('[EVENT] handleWheel called, deltaY:', e.deltaY);
        if (e.deltaY < 0) {
            console.log('[EVENT] Zooming in');
            if (zoomScale < MAX_SCALE) {
                zoomScale = Math.min(MAX_SCALE, zoomScale * 1.1);
                console.log('[EVENT] New zoomScale:', zoomScale);
            }
        } else if (e.deltaY > 0) {
            console.log('[EVENT] Zooming out');
            if (zoomScale > MIN_SCALE) {
                zoomScale = Math.max(MIN_SCALE, zoomScale * 0.9);
                console.log('[EVENT] New zoomScale:', zoomScale);
            }
        }
    }

    function start() {
        console.log('[START] start() called');
        console.log('[START] canvasRef.value:', !!canvasRef.value);
        if (!canvasRef.value) return;
        
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        ctx = canvasRef.value.getContext('2d');
        console.log('[START] ctx:', !!ctx);
        if (ctx) {
            ctx.imageSmoothingEnabled = false;
            console.log('[START] Context created, imageSmoothingEnabled set to false');
        }
        
        console.log('[START] Adding event listeners');
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyDown);
        console.log('[START] Window listeners added');
        
        canvasRef.value.addEventListener('click', handleClick);
        console.log('[START] Click listener added');
        canvasRef.value.addEventListener('mousedown', handleMouseDown);
        canvasRef.value.addEventListener('mouseup', handleMouseUp);
        canvasRef.value.addEventListener('mouseleave', handleMouseLeave);
        canvasRef.value.addEventListener('mousemove', handleMouseMove);
        canvasRef.value.addEventListener('wheel', handleWheel);
        console.log('[START] Mouse listeners added');
        
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            console.log('[GAMEPAD] Connected:', e.gamepad.id);
            gamepadIndex = e.gamepad.index;
        });
        window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
            console.log('[GAMEPAD] Disconnected:', e.gamepad.id);
            if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
        });
        
        console.log('[START] Calling handleResize and gameLoop');
        handleResize();
        gameLoop();
    }

    function handleResize() {
        console.log('[RESIZE] handleResize() called');
        if (!canvasRef.value || !ctx) return;
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        ctx.imageSmoothingEnabled = false;
        console.log('[RESIZE] Canvas size set to:', canvasRef.value.width, 'x', canvasRef.value.height);
        draw();
    }

    function stop() {
        console.log('[STOP] stop() called');
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            console.log('[STOP] Animation frame cancelled');
        }
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('keydown', handleKeyDown);
        if (canvasRef.value) {
            canvasRef.value.removeEventListener('click', handleClick);
            canvasRef.value.removeEventListener('mousedown', handleMouseDown);
            canvasRef.value.removeEventListener('mouseup', handleMouseUp);
            canvasRef.value.removeEventListener('mouseleave', handleMouseLeave);
            canvasRef.value.removeEventListener('mousemove', handleMouseMove);
            canvasRef.value.removeEventListener('wheel', handleWheel);
            console.log('[STOP] Event listeners removed');
        }
    }

    function updateState(state: GameState) {
        console.log('[UPDATE] updateState() called');
        if (!ctx && canvasRef.value) {
            ctx = canvasRef.value.getContext('2d');
            console.log('[UPDATE] Context created from updateState');
        }
        if (state.arena) {
            console.log('[UPDATE] Loading arena');
            loadArenaImage(state.arena);
        }
        if (state.players) {
            console.log('[UPDATE] Loading players and units');
            loadPlayers(state.players as any);
            loadUnits(state.players as any);
        }
        if (state.visibleTiles) {
            visibleTiles.value = state.visibleTiles;
            console.log('[UPDATE] Visible tiles count:', visibleTiles.value.length);
        }
        if (state.round !== undefined) {
            currentRound = state.round;
            console.log('[UPDATE] Current round:', currentRound);
        }
        console.log('[UPDATE] Calling draw()');
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
