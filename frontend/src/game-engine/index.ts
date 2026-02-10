import { ref } from 'vue';
import { Socket } from 'socket.io-client';
import { MIN_SCALE, MAX_SCALE, INPUT_DELAY } from './constants';
import { sprites } from './sprites';
import { Player, Unit, Arena, Obstacle, GameState, Tile } from './types';
import { isPointInsideTile, sleep } from './helpers';
import { astarPath } from './pathfinding';

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
    let SCALE = 2.5;
    let isDragging = false;
    let startX = 0;
    let startY = 0;

    let tiles: Tile[] = [];
    let isAction = false;
    let isMyTurn = ref(false);

    let gamepadIndex: number | null = null;
    let lastInputTime: Record<number, number> = {};

    let myUserId: string | null = null;

    function initSocket(gameSocket: Socket, session: any) {
        console.log('[INIT] initSocket called');
        socket = gameSocket;
        gameSession.value = session;
        // Extract userId from socket query or session
        myUserId = (socket.handshake?.query?.userId as string) || session?.userId || null;
        console.log('[INIT] My userId:', myUserId);

        uiImage = new Image();
        uiImage.src = '/assets/spritesheets/UI.png';
    }

    function loadArenaImage(newArena: Arena) {
        // Only load if arena changed
        if (arena?.name === newArena.name && arenaImage?.complete) {
            return;
        }
        console.log('[LOAD] loadArenaImage called for:', newArena.name);
        arena = newArena;
        
        // Check if image already cached
        const cacheKey = `arena_${newArena.name}`;
        if (imageCache.has(cacheKey)) {
            console.log('[LOAD] Using cached arena image');
            arenaImage = imageCache.get(cacheKey)!;
            return;
        }
        
        arenaImage = new Image();
        arenaImage.onload = () => {
            console.log('[LOAD] Arena image loaded and cached');
            imageCache.set(cacheKey, arenaImage!);
        };
        arenaImage.onerror = () => {
            console.error('[LOAD] Failed to load arena image:', `/assets/maps/${newArena.name}.png`);
        };
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
    }

    function loadPlayers(newPlayers: Player[]) {
        console.log('[LOAD] loadPlayers called');
        players.value = newPlayers;
        if (players.value.length === 2) {
            isMyTurn.value = isTurn();
        }
    }

    function loadUnits(newPlayers: Player[]) {
        console.log('[LOAD] loadUnits called');
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
        if (!canvasRef.value || !ctx) return;
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        draw();
    }

    async function animateMove(tempUnit: Unit, origin: { row: number; col: number }, target: { row: number; col: number }) {
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
        
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
        
        // Draw background
        ctx.fillStyle = '#0f0f2b';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);
        
        drawArena();
        drawFogOfWarTiles();
        drawEntities();
        drawUI();
        drawInteractionSquares();
    }

    function drawArena() {
        if (!ctx || !arenaImage || !arena || !canvasRef.value) {
            console.log('[DRAW] drawArena early return - ctx:', !!ctx, 'arenaImage:', !!arenaImage, 'arena:', !!arena, 'canvas:', !!canvasRef.value);
            return;
        }
        
        if (!arenaImage.complete) {
            console.log('[DRAW] Arena image not loaded yet');
            return;
        }
        
        ctx.imageSmoothingEnabled = false;
        const drawX = (canvasRef.value.width - arena.width * SCALE) / 2 + cameraOffsetX;
        const drawY = (canvasRef.value.height - arena.height * SCALE - 16 * SCALE) / 2 + cameraOffsetY;
        
        console.log('[DRAW] Drawing arena at:', drawX, drawY, 'size:', arena.width * SCALE, 'x', arena.height * SCALE);
        ctx.drawImage(arenaImage, drawX, drawY, arena.width * SCALE, arena.height * SCALE);
    }

    function drawEntities() {
        if (!ctx || !arena) return;
        if (units.value.length === 0) return;

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
                ctx.drawImage(obstacleImg, 0, 0, frameSize, frameSize,
                    pos.x - frameSize * SCALE, pos.y - frameSize * SCALE + (8 * SCALE),
                    frameSize * SCALE, frameSize * SCALE);
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
                        -(pos.x + frameSize * SCALE), pos.y - frameSize * SCALE + (2 * SCALE),
                        frameSize * SCALE, frameSize * SCALE);
                } else {
                    ctx.drawImage(unitImg, frameX * frameSize, frameY * frameSize, frameSize, frameSize,
                        pos.x, pos.y - frameSize * SCALE + (2 * SCALE),
                        frameSize * SCALE, frameSize * SCALE);
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
        ctx.drawImage(uiImage, highlightFrameX * frameSize, 0, frameSize, frameSize,
            hoveredTile.value.x, hoveredTile.value.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawSelectedTile() {
        if (!selectedTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 3 * frameSize, 0, frameSize, frameSize,
            selectedTile.value.x, selectedTile.value.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawMoveTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 3 * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawActionTile(tile: Tile, action: string) {
        if (!uiImage || !ctx) return;
        validActionTiles.value.push(tile);
        const frameSize = 32;
        const frameX = action === 'attack' ? 2 : 1;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, frameX * frameSize, frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawPathTile(tile: Tile) {
        if (!uiImage || !ctx) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 0, 4 * frameSize, frameSize, frameSize,
            tile.x, tile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawFogTile(row: number, col: number) {
        if (!uiImage || !ctx) return;
        const pos = coordToPosition(row, col);
        if (pos.x === -9999) return;
        const frameSize = 32;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 4 * frameSize, frameSize, frameSize, frameSize,
            pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
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
                        const pos = coordToPosition(targetRow, targetCol);
                        if (pos.x !== -9999) {
                            const tile = { x: pos.x, y: pos.y, row: targetRow, col: targetCol };
                            validMoveTiles.value.push(tile);
                            drawMoveTile(tile);
                        }
                    }
                }
            }
        }
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

                    const targetRow = row + i;
                    const targetCol = col + j;
                    const pos = coordToPosition(targetRow, targetCol);
                    if (pos.x !== -9999) {
                        const tile = { x: pos.x, y: pos.y, row: targetRow, col: targetCol };
                        drawActionTile(tile, unitAction);
                    }
                }
            }
        }
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
        ctx!.fillStyle = '#555';
        ctx!.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth, barHeight);
        ctx!.fillStyle = '#0f0';
        ctx!.fillRect(pos.x + barWidth - 2 * SCALE, pos.y - 16 * SCALE, barWidth * (healthBarCurrent / unit.maxHealth), barHeight);
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

    function drawInteractionSquares(): number {
        if (!arenaImage || !arena || !canvasRef.value || !ctx) return 0;
        
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
                const height = getTileHeight(row, col);
                const heightOffset = height * 16 * SCALE;
                const isoY = (col + row) * tileHeight / 2 + offsetY - heightOffset;
                tiles.push(drawIsometricTile(isoX, isoY, row, col));
            }
        }
        console.log(`[TILES] Created ${tiles.length} tiles`);
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
        const rawHeight = arena.heightMap[row]?.[col];
        const result = (rawHeight || 1) - 1;
        return result;
    }

    function isVisibleTile(row: number, col: number): boolean {
        return visibleTiles.value.some(t => t.row === row && t.col === col);
    }

    function hasUnit(row: number, col: number): boolean {
        return units.value.some(u => u.row === row && u.col === col);
    }

    function unitIsTeam(row: number, col: number): boolean {
        const unit = units.value.find(u => u.row === row && u.col === col);
        if (!unit || !myUserId) return false;
        // Use userId instead of socket ID since socket changes on reconnect
        return unit.owner.id === myUserId;
    }

    function isTurn(): boolean {
        if (players.value.length < 2 || !myUserId) return false;
        const currentPlayer = players.value[currentRound % 2];
        return currentPlayer?.id === myUserId;
    }

    function loadImage(name: string, src: string): HTMLImageElement {
        if (!imageCache.has(name)) {
            const img = new Image();
            img.src = src;
            imageCache.set(name, img);
        }
        return imageCache.get(name)!;
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

        if (gamepad.buttons[4]?.pressed) cameraOffsetY += 8 * SCALE;
        if (gamepad.buttons[5]?.pressed) cameraOffsetY -= 8 * SCALE;
    }

    function endTurn() {
        console.log('[TURN] endTurn() called, socket:', !!socket);
        if (!socket) {
            console.log('[TURN] No socket, cannot end turn');
            return;
        }
        console.log('[TURN] Emitting endTurn event');
        socket.emit('endTurn');
        selectedTile.value = null;
        isAction = false;
        moveTile.value = null;
    }

    function handleClick(event: MouseEvent) {
        console.log('[EVENT] Click at:', event.offsetX, event.offsetY, 'button:', event.button, 'isMyTurn:', isMyTurn.value);
        if (event.button !== 0) {
            console.log('[EVENT] Ignoring non-left click');
            return;
        }
        if (!isMyTurn.value) {
            console.log('[EVENT] Not my turn, ignoring click');
            return;
        }
        if (players.value.length !== 2) {
            console.log('[EVENT] Not 2 players, ignoring click');
            return;
        }
        
        // Focus canvas for keyboard events
        canvasRef.value?.focus();

        const clickX = event.offsetX;
        const clickY = event.offsetY;
        console.log('[EVENT] Processing click, tiles count:', tiles.length);

        let found = false;
        for (const tile of tiles) {
            if (!hoveredTile.value) break;
            if (isPointInsideTile(clickX, clickY, tile)) {
                if (!isAction && !selectedTile.value && unitIsTeam(hoveredTile.value.row, hoveredTile.value.col)) {
                    selectedTile.value = tile;
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
                found = true;
                break;
            }
        }
        if (!found) selectedTile.value = null;
    }

    function handleMouseDown(event: MouseEvent) {
        if (event.button !== 1) return;
        isDragging = true;
        startX = event.clientX - cameraOffsetX;
        startY = event.clientY - cameraOffsetY;
    }

    function handleMouseUp() {
        isDragging = false;
    }

    function handleMouseLeave() {
        isDragging = false;
    }

    function handleMouseMove(event: MouseEvent) {
        const clickX = event.offsetX;
        const clickY = event.offsetY;

        if (isDragging) {
            cameraOffsetX = event.clientX - startX;
            cameraOffsetY = event.clientY - startY;
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
        console.log('[EVENT] Key pressed:', e.key, 'SCALE:', SCALE, 'camera:', cameraOffsetX, cameraOffsetY);
        switch (e.key) {
            case 'z':
                if (SCALE > MIN_SCALE) SCALE -= 0.125;
                if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
                console.log('[EVENT] Zoom out, SCALE:', SCALE);
                break;
            case 'x':
                if (SCALE < MAX_SCALE) SCALE += 0.125;
                if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
                console.log('[EVENT] Zoom in, SCALE:', SCALE);
                break;
            case 'ArrowUp':
            case 'w':
                cameraOffsetY += 8 * SCALE;
                console.log('[EVENT] Move up, cameraY:', cameraOffsetY);
                break;
            case 'ArrowDown':
            case 's':
                cameraOffsetY -= 8 * SCALE;
                console.log('[EVENT] Move down, cameraY:', cameraOffsetY);
                break;
            case 'ArrowLeft':
            case 'a':
                cameraOffsetX += 8 * SCALE;
                console.log('[EVENT] Move left, cameraX:', cameraOffsetX);
                break;
            case 'ArrowRight':
            case 'd':
                cameraOffsetX -= 8 * SCALE;
                console.log('[EVENT] Move right, cameraX:', cameraOffsetX);
                break;
            case 'Enter':
                console.log('[EVENT] Enter pressed, ending turn');
                endTurn();
                break;
        }
    }

    function handleWheel(e: WheelEvent) {
        if (e.deltaY < 0) {
            if (SCALE < MAX_SCALE) SCALE *= 1.1;
            if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
        } else if (e.deltaY > 0) {
            if (SCALE > MIN_SCALE) SCALE *= 0.9;
            if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
        }
    }

    let isStarted = false;

    function start() {
        console.log('[START] start() called, isStarted:', isStarted);
        if (isStarted) {
            console.log('[START] Already started, skipping');
            return;
        }
        if (!canvasRef.value) {
            console.log('[START] ERROR: canvasRef.value is null');
            return;
        }
        
        isStarted = true;
        
        // Get context and set up canvas like old game
        ctx = canvasRef.value.getContext('2d');
        if (!ctx) {
            console.log('[START] ERROR: Could not get context');
            isStarted = false;
            return;
        }
        
        ctx.imageSmoothingEnabled = false;
        
        // Set canvas size like old game
        resizeCanvas();
        
        // Add event listeners like old game
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            gamepadIndex = e.gamepad.index;
        });
        window.addEventListener('gamepaddisconnected', (e: GamepadEvent) => {
            if (gamepadIndex === e.gamepad.index) gamepadIndex = null;
        });
        
        canvasRef.value.addEventListener('click', handleClick);
        canvasRef.value.addEventListener('mousedown', handleMouseDown);
        canvasRef.value.addEventListener('mouseup', handleMouseUp);
        canvasRef.value.addEventListener('mouseleave', handleMouseLeave);
        canvasRef.value.addEventListener('mousemove', handleMouseMove);
        canvasRef.value.addEventListener('wheel', handleWheel);
        
        console.log('[START] Event listeners added, starting game loop');
        gameLoop();
        
        // Mark canvas as started for retry detection
        if (canvasRef.value) {
            canvasRef.value.setAttribute('data-started', 'true');
        }
        console.log('[START] Game engine started successfully');
    }

    function stop() {
        console.log('[STOP] Stopping game engine');
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resizeCanvas);
        window.removeEventListener('keydown', handleKeyDown);
        if (canvasRef.value) {
            canvasRef.value.removeEventListener('click', handleClick);
            canvasRef.value.removeEventListener('mousedown', handleMouseDown);
            canvasRef.value.removeEventListener('mouseup', handleMouseUp);
            canvasRef.value.removeEventListener('mouseleave', handleMouseLeave);
            canvasRef.value.removeEventListener('mousemove', handleMouseMove);
            canvasRef.value.removeEventListener('wheel', handleWheel);
            canvasRef.value.removeAttribute('data-started');
        }
        isStarted = false;
        console.log('[STOP] Game engine stopped');
    }

    function updateState(state: GameState) {
        console.log('[UPDATE] updateState called');
        if (state.arena) {
            console.log('[UPDATE] Loading arena:', state.arena.name);
            loadArenaImage(state.arena);
        }
        if (state.players) {
            console.log('[UPDATE] Loading players and units');
            loadPlayers(state.players as any);
            loadUnits(state.players as any);
        }
        if (state.visibleTiles) {
            console.log('[UPDATE] Setting visible tiles:', state.visibleTiles.length);
            visibleTiles.value = state.visibleTiles;
        }
        if (state.round !== undefined) {
            console.log('[UPDATE] Setting round:', state.round);
            currentRound = state.round;
        }
        console.log('[UPDATE] State update complete');
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
