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
        arenaImage.onload = () => {
            console.log('[DRAW] Arena image loaded:', newArena.name);
            draw();
        };
        arenaImage.onerror = () => {
            console.error('[DRAW] Failed to load arena image:', `/assets/maps/${newArena.name}.png`);
        };
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
    }

    function loadPlayers(newPlayers: Player[]) {
        players.value = newPlayers;
        if (players.value.length === 2) {
            isMyTurn.value = isTurn();
        }
    }

    function loadUnits(newPlayers: Player[]) {
        console.log('[LOAD] loadUnits called with', newPlayers.length, 'players');
        
        const updatedOrAddedIds = new Set<string | number>();

        for (const player of newPlayers) {
            console.log('[LOAD] Player:', player.name, 'has', player.units.length, 'units');
            for (const unit of player.units) {
                console.log('[LOAD] Unit:', unit.name, 'at', unit.row, unit.col, 'id:', unit.id, 'type:', typeof unit.id);
                
                const existingUnit = units.value.find(u => String(u.id) === String(unit.id));
                console.log('[LOAD] Existing unit found:', !!existingUnit, 'existing sprite:', existingUnit?.sprite?.name);

                if (existingUnit) {
                    console.log('[LOAD] Updating existing unit');
                    if (animatingUnit && animatingUnit.id === unit.id && animatingUnit.owner === player) {
                        existingUnit.row = unit.row;
                        existingUnit.col = unit.col;
                    }
                    existingUnit.health = unit.health;
                    existingUnit.canMove = unit.canMove;
                    existingUnit.canAct = unit.canAct;
                    existingUnit.currentStatus = !unit.canMove && !unit.canAct ? 1 : 0;
                    updatedOrAddedIds.add(String(existingUnit.id));
                } else {
                    console.log('[LOAD] Creating new unit, looking for sprite:', unit.name);
                    unit.owner = player;
                    const newSprite = sprites.find(s => s.name === unit.name);
                    console.log('[LOAD] Sprite found:', !!newSprite, 'name:', newSprite?.name);
                    if (newSprite) {
                        unit.sprite = { ...newSprite, currentFrame: 0, direction: 1 };
                    }
                    console.log('[LOAD] Unit sprite after assign:', unit.sprite?.name);
                    unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                    units.value.push(unit);
                    updatedOrAddedIds.add(String(unit.id));
                }
            }
        }

        if (!animatingUnit) {
            units.value = units.value.filter(u => updatedOrAddedIds.has(String(u.id)));
        }
        
        console.log('[LOAD] Total units after load:', units.value.length);
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

    function drawBackground() {
        if (!ctx || !canvasRef.value) return;
        ctx.fillStyle = '#0f0f2b';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    }

    function drawArena() {
        if (!ctx || !arenaImage || !arena || !canvasRef.value) {
            console.log('[DRAW] drawArena missing requirements, arenaImage:', !!arenaImage, 'arena:', !!arena);
            return;
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
        if (!ctx || !arena) {
            console.log('[DRAW] drawEntities missing ctx or arena');
            return;
        }
        console.log('[DRAW] Drawing', units.value.length, 'units');
        
        if (units.value.length === 0) {
            console.log('[DRAW] No units to draw');
            return;
        }

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
                    pos.x - 32 * SCALE, pos.y - frameSize * SCALE + 8 * SCALE,
                    frameSize * SCALE, frameSize * SCALE
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
                        -(pos.x + frameSize * SCALE), pos.y - frameSize * SCALE + 2 * SCALE,
                        frameSize * SCALE, frameSize * SCALE
                    );
                } else {
                    ctx.drawImage(
                        unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        pos.x, pos.y - frameSize * SCALE + 2 * SCALE,
                        frameSize * SCALE, frameSize * SCALE
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
        const highlightFrameX = hasUnit(hoveredTile.value.row, hoveredTile.value.col)
            ? (unitIsTeam(hoveredTile.value.row, hoveredTile.value.col) ? 1 : 2)
            : 0;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, highlightFrameX * frameSize, 0, frameSize, frameSize,
            hoveredTile.value.x, hoveredTile.value.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
        );
    }

    function drawSelectedTile() {
        if (!selectedTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 3 * frameSize, 0, frameSize, frameSize,
            selectedTile.value.x, selectedTile.value.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 3 * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
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
        const frameX = action === 'attack' ? 2 : 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, frameX * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 0, 4 * frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
        );
    }

    function drawHealthBars() {
        if ((!isAction && !selectedTile.value) || animatingUnit) return;
        for (const unit of units.value) {
            const pos = coordToPosition(unit.row, unit.col);
            if (pos.x === -9999) continue;
            const barHeight = 2 * SCALE;
            const barWidth = 12 * SCALE;
            ctx!.fillStyle = '#555';
            ctx!.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth, barHeight);
            ctx!.fillStyle = '#0f0';
            ctx!.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth * (unit.health / unit.maxHealth), barHeight);
        }
    }

    function drawAnimatingHealthBar() {
        if (!animateHealthBar || !animatingHealthBarUnit || !ctx) return;
        const unit = animatingHealthBarUnit;
        const pos = coordToPosition(unit.row, unit.col);
        if (pos.x === -9999) return;
        const barHeight = 2 * SCALE;
        const barWidth = 12 * SCALE;
        ctx.fillStyle = '#555';
        ctx.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth, barHeight);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth * (healthBarCurrent / unit.maxHealth), barHeight);
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
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            uiImage, 4 * frameSize, frameSize, frameSize, frameSize,
            pos.x, pos.y - 8 * SCALE,
            frameSize * SCALE, frameSize * SCALE
        );
    }

    function drawInteractionSquares() {
        if (!arenaImage || !arena || !canvasRef.value || !ctx) return;
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
        socket.emit('force-end-turn');
        selectedTile.value = null;
        isAction = false;
        moveTile.value = null;
    }

    function handleClick(event: MouseEvent) {
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

    function handleMouseMove(event: MouseEvent) {
        const clickX = event.offsetX;
        const clickY = event.offsetY;

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
        if (e.deltaY < 0) {
        } else {
        }
    }

    function start() {
        if (!canvasRef.value) return;
        ctx = canvasRef.value.getContext('2d');
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('keydown', handleKeyDown);
        canvasRef.value.addEventListener('click', handleClick);
        canvasRef.value.addEventListener('mousemove', handleMouseMove);
        canvasRef.value.addEventListener('wheel', handleWheel);
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            console.log('Gamepad connected:', e.gamepad.id);
            gamepadIndex = e.gamepad.index;
        });
        window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
            if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
        });
        resizeCanvas();
        gameLoop();
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
        currentRound = state.round || 0;
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
