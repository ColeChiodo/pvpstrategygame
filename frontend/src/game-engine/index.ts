import { ref, readonly } from 'vue';
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
    
    // Track which unit is assigned to each action tile and if movement is needed
    // Key: "row,col", Value: { unitId, requiresMove, moveTarget, movePath }
    let actionTileAssignments = new Map<string, { unitId: number; requiresMove: boolean; moveTarget?: { row: number; col: number }; movePath?: { row: number; col: number }[] }>();

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
    let isAction = ref(false);
    let isMyTurn = ref(false);
    
    // Track pending action after move (for move+attack)
    let pendingAction: { unitId: number; targetRow: number; targetCol: number; movePath?: { row: number; col: number }[] } | null = null;

    let gamepadIndex: number | null = null;
    let lastInputTime: Record<number, number> = {};

    let myUserId: string | null = null;
    let myPlayerIndex: number = -1;

    function setPlayerIndex(index: number) {
        myPlayerIndex = index;
    }

    function initSocket(gameSocket: Socket, session: any) {
        socket = gameSocket;
        gameSession.value = session;
        myUserId = (socket.handshake?.query?.userId as string) || session?.userId || null;

        uiImage = new Image();
        uiImage.src = '/assets/spritesheets/UI.png';
    }

    function loadArenaImage(newArena: Arena) {
        if (arena?.name === newArena.name && arenaImage?.complete) return;
        arena = newArena;

        const cacheKey = `arena_${newArena.name}`;
        if (imageCache.has(cacheKey)) {
            arenaImage = imageCache.get(cacheKey)!;
            return;
        }

        arenaImage = new Image();
        arenaImage.onload = () => imageCache.set(cacheKey, arenaImage!);
        arenaImage.onerror = () => console.error('[LOAD] Failed to load arena');
        arenaImage.src = `/assets/maps/${newArena.name}.png`;
    }

    function loadPlayers(newPlayers: Player[]) {
        players.value = newPlayers;
        console.log('[GAME-ENGINE] loadPlayers:', {
            myPlayerIndex,
            myUserId,
            players: newPlayers.map((p, i) => `${p.name}[${i}](${p.id})`)
        });
        if (players.value.length === 2) {
            isMyTurn.value = isTurn();
        }
    }

    function loadUnits(newPlayers: Player[]) {
        console.log('[GAME-ENGINE] loadUnits START:', {
            myPlayerIndex,
            myUserId,
            newPlayersCount: newPlayers.length,
            newPlayers: newPlayers.map(p => `${p.name}: ${p.units.length} units`)
        });

        const receivedUnitIds = new Set<string>();
        const receivedMyUnitIds = new Set<string>();

        for (const player of newPlayers) {
            const isMyPlayer = myPlayerIndex >= 0
                ? newPlayers.indexOf(player) === myPlayerIndex
                : player.id === myUserId;

            for (const unit of player.units) {
                receivedUnitIds.add(String(unit.id));
                if (isMyPlayer) {
                    receivedMyUnitIds.add(String(unit.id));
                }
            }
        }

        const existingUnitIds = new Set(units.value.map(u => String(u.id)));

        for (const player of newPlayers) {
            const isMyPlayer = myPlayerIndex >= 0
                ? newPlayers.indexOf(player) === myPlayerIndex
                : player.id === myUserId;

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
                        existingUnit.mobilityRemaining = unit.mobilityRemaining ?? unit.mobility;
                        // Unit is exhausted if both canMove and canAct are false
                        existingUnit.currentStatus = !unit.canMove && !unit.canAct ? 1 : 0;
                        if (isMyPlayer) {
                            existingUnit.owner = player;
                        }
                    }
                } else {
                    unit.owner = player;
                    const newSprite = sprites.find(s => s.name === unit.name);
                    if (newSprite) {
                        unit.sprite = { ...newSprite, currentFrame: 0, direction: 1 };
                    }
                    // Initialize mobilityRemaining if not provided
                    if (unit.mobilityRemaining === undefined) {
                        unit.mobilityRemaining = unit.mobility;
                    }
                    unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                    units.value.push(unit);
                }
            }
        }

        console.log('[GAME-ENGINE] loadUnits END:', {
            myPlayerIndex,
            myUserId,
            receivedMyUnitIds: Array.from(receivedMyUnitIds),
            totalUnitsAfter: units.value.length,
            totalUnitsAfterIds: units.value.map(u => `${u.name}(${u.row},${u.col})`)
        });

        for (let i = units.value.length - 1; i >= 0; i--) {
            const existingUnit = units.value[i];
            const unitId = String(existingUnit.id);

            if (receivedMyUnitIds.has(unitId)) continue;

            if (!receivedUnitIds.has(unitId)) {
                console.log('[GAME-ENGINE] Removing invisible unit:', existingUnit.name, existingUnit.row, existingUnit.col);
                units.value.splice(i, 1);
            }
        }
    }

    function resizeCanvas() {
        if (!canvasRef.value || !ctx) return;
        canvasRef.value.width = window.innerWidth;
        canvasRef.value.height = window.innerHeight;
        draw();
    }

    async function animateMove(unitId: number, origin: { row: number; col: number }, target: { row: number; col: number }, precomputedPath?: { row: number; col: number }[]) {
        isAnimating = true;
        const path = precomputedPath || astarPath(origin.row, origin.col, target.row, target.col, arena!);
        const realUnit = units.value.find(u => u.id === unitId);
        if (!realUnit) {
            isAnimating = false;
            return;
        }

        realUnit.sprite.currentFrame = 0;
        realUnit.animatingRow = origin.row;
        realUnit.animatingCol = origin.col;
        let lastTile = { col: origin.col, row: origin.row };

        for (const tile of path) {
            if (!isAnimating) break;
            animatingUnit = realUnit;
            realUnit.currentStatus = 2;
            realUnit.animatingRow = tile.row;
            realUnit.animatingCol = tile.col;

            if (tile.row === lastTile.row) {
                if (tile.col > lastTile.col) realUnit.sprite.direction = 1;
                else if (tile.col < lastTile.col) realUnit.sprite.direction = -1;
            } else if (tile.col === lastTile.col) {
                if (tile.row > lastTile.row) realUnit.sprite.direction = -1;
                else if (tile.row < lastTile.row) realUnit.sprite.direction = 1;
            }

            lastTile = tile;
            await sleep(100);
        }

        isAnimating = false;
        animatingUnit = null;
        realUnit.currentStatus = 0;
        realUnit.sprite.currentFrame = 0;
        delete realUnit.animatingRow;
        delete realUnit.animatingCol;
    }

    async function animateAction(unitId: number) {
        isAnimating = true;
        const realUnit = units.value.find(u => u.id === unitId);
        if (!realUnit) {
            isAnimating = false;
            return;
        }

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

    async function triggerHealthBarAnimation(unitId: number, healthBefore: number, healthAfter: number) {
        const targetUnit = units.value.find(u => u.id === unitId);
        if (!targetUnit) return;

        animatingHealthBarUnit = targetUnit;
        animateHealthBar = true;
        healthBarCurrent = healthBefore;

        const healthDiff = healthAfter - healthBefore;
        const steps = 20; // Animation steps
        const healthStep = healthDiff / steps;
        const delay = 50; // ms between steps

        for (let i = 0; i < steps; i++) {
            healthBarCurrent += healthStep;
            await sleep(delay);
        }

        healthBarCurrent = healthAfter;
        animateHealthBar = false;
        animatingHealthBarUnit = null;
    }

    function draw() {
        if (!ctx || !canvasRef.value) return;

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);

        ctx.fillStyle = '#0f0f2b';
        ctx.fillRect(0, 0, canvasRef.value.width, canvasRef.value.height);

        drawArena();
        drawFogOfWarTiles();
        drawInteractionSquares();
        drawEntities();
        drawUI();
    }

    function drawArena() {
        if (!ctx || !arenaImage || !arena || !canvasRef.value) return;

        if (!arenaImage.complete) return;

        ctx.imageSmoothingEnabled = false;
        const drawX = (canvasRef.value.width - arena.width * SCALE) / 2 + cameraOffsetX;
        const drawY = (canvasRef.value.height - arena.height * SCALE - 16 * SCALE) / 2 + cameraOffsetY;

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
            const aRow = 'animatingRow' in a.entity && a.entity.animatingRow !== undefined ? a.entity.animatingRow : a.entity.row;
            const aCol = 'animatingCol' in a.entity && a.entity.animatingCol !== undefined ? a.entity.animatingCol : a.entity.col;
            const bRow = 'animatingRow' in b.entity && b.entity.animatingRow !== undefined ? b.entity.animatingRow : b.entity.row;
            const bCol = 'animatingCol' in b.entity && b.entity.animatingCol !== undefined ? b.entity.animatingCol : b.entity.col;
            if (aRow !== bRow) return aRow - bRow;
            return aCol - bCol;
        });

        for (const { type, entity } of entities) {
            const row = 'animatingRow' in entity && entity.animatingRow !== undefined ? entity.animatingRow : entity.row;
            const col = 'animatingCol' in entity && entity.animatingCol !== undefined ? entity.animatingCol : entity.col;
            const pos = coordToPosition(row, col);
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
        // Recalculate position based on current camera offset
        const pos = coordToPosition(hoveredTile.value.row, hoveredTile.value.col);
        if (pos.x === -9999) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, highlightFrameX * frameSize, 0, frameSize, frameSize,
            pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
    }

    function drawSelectedTile() {
        if (!selectedTile.value || !uiImage || !ctx) return;
        const frameSize = 32;
        // Recalculate position based on current camera offset
        const pos = coordToPosition(selectedTile.value.row, selectedTile.value.col);
        if (pos.x === -9999) return;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(uiImage, 3 * frameSize, 0, frameSize, frameSize,
            pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);
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
        // Don't draw movement tiles when in action mode
        if (isAction.value || !arena || !selectedTile.value) return;
        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
        if (!unit) return;

        // Use remaining mobility instead of full mobility
        const mobilityRemaining = unit.mobilityRemaining ?? unit.mobility;
        const row = selectedTile.value.row;
        const col = selectedTile.value.col;

        validMoveTiles.value = [];

        for (let i = -mobilityRemaining; i <= mobilityRemaining; i++) {
            for (let j = -mobilityRemaining; j <= mobilityRemaining; j++) {
                if (Math.abs(i) + Math.abs(j) <= mobilityRemaining) {
                    const targetRow = row + i;
                    const targetCol = col + j;
                    if (targetRow < 0 || targetCol < 0 || targetRow >= arena.tiles.length || targetCol >= arena.tiles[0].length) continue;
                    if (hasUnit(targetRow, targetCol) && (i !== 0 || j !== 0)) continue;
                    if (arena.tiles[targetRow][targetCol] === 0) continue;

                    const path = astarPath(row, col, targetRow, targetCol, arena);
                    if (path.length - 1 > mobilityRemaining) continue;

                    let canMove = true;
                    let mobilityPenalty = 0;
                    for (const tile of path) {
                        const terrain = arena.tiles[tile.row][tile.col];
                        if (terrain === 0 || terrain === 4) { canMove = false; break; }
                        if (terrain === 2) mobilityPenalty += 2;
                    }

                    if (canMove && (mobilityRemaining - mobilityPenalty >= 0)) {
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
        if (!arena || !selectedTile.value) return;
        
        // Only show action tiles for the selected unit
        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
        if (!unit || !unit.canAct) return;
        
        // Clear previous assignments
        actionTileAssignments.clear();
        validActionTiles.value = [];
        
        const isMyUnit = players.value[myPlayerIndex]?.units.some(mu => mu.id === unit.id);
        if (!isMyUnit) return;
        
        const mobility = unit.mobilityRemaining ?? unit.mobility;
        const totalReach = mobility + unit.range;
        const unitAction = unit.action;
        
        for (let i = -totalReach; i <= totalReach; i++) {
            for (let j = -totalReach; j <= totalReach; j++) {
                if (Math.abs(i) + Math.abs(j) > totalReach) continue;
                if (i === 0 && j === 0) continue;
                
                const targetRow = unit.row + i;
                const targetCol = unit.col + j;
                const tileKey = `${targetRow},${targetCol}`;
                
                // Check if there's a unit at this tile
                const targetUnit = units.value.find(u => u.row === targetRow && u.col === targetCol);
                
                // Check if it's a valid target
                if (targetUnit) {
                    const isEnemy = !unitIsTeam(targetRow, targetCol);
                    if (unitAction === 'heal' && isEnemy) continue;
                    if (unitAction === 'attack' && !isEnemy) continue;
                    
                    // For healers, only show if target needs healing
                    if (unitAction === 'heal' && targetUnit.health >= targetUnit.maxHealth) continue;
                    
                    // Check if unit is already in attack range
                    const distance = Math.abs(i) + Math.abs(j);
                    const inAttackRange = distance <= unit.range;
                    
                    // If not in attack range, check if we can move to attack range
                    let moveTarget: { row: number; col: number } | undefined;
                    let movePath: { row: number; col: number }[] | undefined;
                    if (!inAttackRange) {
                        const attackPos = findAttackPosition(unit, targetRow, targetCol);
                        if (!attackPos) continue; // Can't reach
                        moveTarget = attackPos.moveTarget;
                        movePath = attackPos.path;
                    }
                    
                    // Add action tile assignment
                    actionTileAssignments.set(tileKey, {
                        unitId: unit.id,
                        requiresMove: !inAttackRange,
                        moveTarget,
                        movePath
                    });
                    
                    const pos = coordToPosition(targetRow, targetCol);
                    if (pos.x !== -9999) {
                        const tile = { x: pos.x, y: pos.y, row: targetRow, col: targetCol };
                        validActionTiles.value.push(tile);
                        drawActionTile(tile, unitAction);
                    }
                }
            }
        }
    }
    
    function findAttackPosition(unit: Unit, targetRow: number, targetCol: number): { moveTarget: { row: number; col: number }; path: { row: number; col: number }[] } | null {
        const mobility = unit.mobilityRemaining ?? unit.mobility;
        const range = unit.range;
        
        // Find all tiles within mobility range that can attack the target
        let bestPosition: { row: number; col: number; distance: number; path: { row: number; col: number }[] } | null = null;
        
        for (let i = -mobility; i <= mobility; i++) {
            for (let j = -mobility; j <= mobility; j++) {
                if (Math.abs(i) + Math.abs(j) > mobility) continue;
                
                const moveRow = unit.row + i;
                const moveCol = unit.col + j;
                
                // Check if tile is valid (no unit, not obstacle)
                if (hasUnit(moveRow, moveCol) && (moveRow !== unit.row || moveCol !== unit.col)) continue;
                if (!arena || arena.tiles[moveRow]?.[moveCol] === 0) continue;
                if (!arena.tiles[moveRow]?.[moveCol] === 4) continue;
                
                // Check if from this position, target is in attack range
                const attackDistance = Math.abs(moveRow - targetRow) + Math.abs(moveCol - targetCol);
                if (attackDistance <= range) {
                    // Calculate path to this position
                    const path = astarPath(unit.row, unit.col, moveRow, moveCol, arena!);
                    if (path.length <= 1) continue;
                    
                    // Check path length is within mobility
                    const pathCost = calculatePathCost(path, arena!);
                    if (pathCost > mobility) continue;
                    
                    // This is a valid position - pick the one closest to max range (furthest from target)
                    if (!bestPosition || attackDistance > bestPosition.distance) {
                        bestPosition = { row: moveRow, col: moveCol, distance: attackDistance, path };
                    }
                }
            }
        }
        
        return bestPosition ? { moveTarget: { row: bestPosition.row, col: bestPosition.col }, path: bestPosition.path } : null;
    }
    
    function calculatePathCost(path: { row: number; col: number }[], arena: Arena): number {
        let cost = 0;
        for (let i = 1; i < path.length; i++) {
            const tile = path[i];
            const terrain = arena.tiles[tile.row]?.[tile.col];
            if (terrain === 2) {
                cost += 2; // Forest terrain costs more
            } else {
                cost += 1;
            }
        }
        return cost;
    }

    function drawPath() {
        // Don't draw path when in action mode
        if (isAction.value || !selectedTile.value || !hoveredTile.value) return;
        const path = astarPath(selectedTile.value.row, selectedTile.value.col, hoveredTile.value.row, hoveredTile.value.col, arena!);
        for (const pathTile of path) {
            if (validMoveTiles.value.find(t => t.row === pathTile.row && t.col === pathTile.col)) {
                const pos = coordToPosition(pathTile.row, pathTile.col);
                if (pos.x !== -9999) {
                    const tile = { x: pos.x, y: pos.y, row: pathTile.row, col: pathTile.col };
                    drawPathTile(tile);
                }
            }
        }
    }

    function drawHealthBars() {
        if ((!isAction.value && !selectedTile.value) || animatingUnit) return;
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
        const currentPlayerIndex = currentRound % 2;
        const currentPlayer = players.value[currentPlayerIndex];
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

    function updateAnimations() {
        // Update sprite animations
        for (const unit of units.value) {
            if (!unit.sprite) continue;
            
            unit.sprite.framesElapsed++;
            
            if (unit.sprite.framesElapsed % unit.sprite.framesHold === 0) {
                const status = unit.currentStatus;
                
                if (status === 0 || status === 1) {
                    // Idle animation
                    if (unit.sprite.currentFrame < unit.sprite.idleFrames - 1) {
                        unit.sprite.currentFrame++;
                    } else {
                        unit.sprite.currentFrame = 0;
                    }
                } else if (status === 2) {
                    // Walk animation
                    if (unit.sprite.currentFrame < unit.sprite.walkFrames - 1) {
                        unit.sprite.currentFrame++;
                    } else {
                        unit.sprite.currentFrame = 0;
                    }
                } else if (status === 3) {
                    // Action animation
                    if (unit.sprite.currentFrame < unit.sprite.actionFrames - 1) {
                        unit.sprite.currentFrame++;
                    } else {
                        unit.sprite.currentFrame = 0;
                        // Reset to idle after action completes
                        unit.currentStatus = unit.canMove || unit.canAct ? 0 : 1;
                    }
                }
            }
        }
        
        // Update obstacle animations
        if (arena) {
            for (const obstacle of arena.obstacles) {
                if (!obstacle.sprite) continue;
                obstacle.sprite.framesElapsed++;
                if (obstacle.sprite.framesElapsed % obstacle.sprite.framesHold === 0) {
                    if (obstacle.sprite.currentFrame < obstacle.sprite.idleFrames - 1) {
                        obstacle.sprite.currentFrame++;
                    } else {
                        obstacle.sprite.currentFrame = 0;
                    }
                }
            }
        }
    }

    function gameLoop() {
        updateAnimations();
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
        if (!socket) return;
        socket.emit('endTurn');
        selectedTile.value = null;
        isAction.value = false;
        moveTile.value = null;
    }

    function handleClick(event: MouseEvent) {
        if (event.button !== 0) return;
        if (!isMyTurn.value) return;
        if (players.value.length !== 2) return;

        canvasRef.value?.focus();

        const clickX = event.offsetX;
        const clickY = event.offsetY;

        let found = false;
        for (const tile of tiles) {
            if (!hoveredTile.value) break;
            if (isPointInsideTile(clickX, clickY, tile)) {
                const clickedUnit = units.value.find(u => u.row === tile.row && u.col === tile.col);
                const isMyUnit = clickedUnit && players.value[myPlayerIndex]?.units.some(u => u.id === clickedUnit.id);
                const canUnitMove = clickedUnit && clickedUnit.canMove && (clickedUnit.mobilityRemaining ?? 0) > 0;

                if (!isAction.value && !selectedTile.value && isMyUnit && canUnitMove) {
                    selectedTile.value = tile;
                } else if (!isAction.value && selectedTile.value && tile.row === selectedTile.value.row && tile.col === selectedTile.value.col) {
                    const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                    if (unit) {
                        console.log('[MOVE] Staying in place:', unit.name, '->', tile.row, tile.col);
                        socket?.emit('move', { unitId: unit.id, row: tile.row, col: tile.col });
                    }
                    selectedTile.value = null;
                } else if (selectedTile.value) {
                    // First check if clicking on an action tile (even if not in action mode)
                    const actionAssignment = actionTileAssignments.get(`${tile.row},${tile.col}`);
                    
                    if (actionAssignment) {
                        // Clicked on an action tile
                        const actingUnit = units.value.find(u => u.id === actionAssignment.unitId);
                        if (actingUnit) {
                            if (actionAssignment.requiresMove && actionAssignment.moveTarget) {
                                // Need to move first, then attack
                                console.log('[MOVE+ATTACK]', actingUnit.name, 'moving to', actionAssignment.moveTarget.row, actionAssignment.moveTarget.col, 'then attacking', tile.row, tile.col);
                                
                                // Set up pending action after move with precomputed path
                                pendingAction = {
                                    unitId: actingUnit.id,
                                    targetRow: tile.row,
                                    targetCol: tile.col,
                                    movePath: actionAssignment.movePath
                                };
                                
                                socket?.emit('move', { 
                                    unitId: actingUnit.id, 
                                    row: actionAssignment.moveTarget.row, 
                                    col: actionAssignment.moveTarget.col 
                                });
                            } else {
                                // Already in range, attack immediately
                                console.log('[ACTION]', actingUnit.name, '->', tile.row, tile.col);
                                socket?.emit('action', { unitId: actingUnit.id, row: tile.row, col: tile.col });
                            }
                        }
                        selectedTile.value = null;
                    } else {
                        // Normal move logic
                        const unit = units.value.find(u => u.row === selectedTile.value!.row && u.col === selectedTile.value!.col);
                        if (unit) {
                            if (validMoveTiles.value.find(t => t.row === tile.row && t.col === tile.col)) {
                                // Clicked on a valid move tile
                                console.log('[MOVE]', unit.name, '->', tile.row, tile.col);
                                socket?.emit('move', { unitId: unit.id, row: tile.row, col: tile.col });
                            } else {
                                // Clicked outside mobility range - move as far as possible
                                const path = astarPath(selectedTile.value.row, selectedTile.value.col, tile.row, tile.col, arena!);
                                if (path.length > 1) {
                                    // Find furthest valid tile along the path
                                    let furthestTile: { row: number; col: number } | null = null;
                                    const unitMobility = unit.mobilityRemaining ?? unit.mobility;
                                    
                                    for (let i = path.length - 1; i >= 0; i--) {
                                        const pathTile = path[i];
                                        const distance = Math.abs(pathTile.row - selectedTile.value.row) + Math.abs(pathTile.col - selectedTile.value.col);
                                        const isValidTile = validMoveTiles.value.find(t => t.row === pathTile.row && t.col === pathTile.col);
                                        
                                        if (isValidTile && distance <= unitMobility) {
                                            furthestTile = pathTile;
                                            break;
                                        }
                                    }
                                    
                                    if (furthestTile && (furthestTile.row !== selectedTile.value.row || furthestTile.col !== selectedTile.value.col)) {
                                        console.log('[MOVE] Partial move', unit.name, '->', furthestTile.row, furthestTile.col);
                                        socket?.emit('move', { unitId: unit.id, row: furthestTile.row, col: furthestTile.col });
                                    }
                                }
                            }
                        }
                        selectedTile.value = null;
                    }
                } else if (isAction.value && moveTile.value) {
                    // Legacy action mode (when unit was moved first)
                    const actionAssignment = actionTileAssignments.get(`${tile.row},${tile.col}`);
                    
                    if (actionAssignment) {
                        const actingUnit = units.value.find(u => u.id === actionAssignment.unitId);
                        if (actingUnit) {
                            console.log('[ACTION]', actingUnit.name, '->', tile.row, tile.col);
                            socket?.emit('action', { unitId: actingUnit.id, row: tile.row, col: tile.col });
                        }
                    }

                    isAction.value = false;
                    moveTile.value = null;
                    selectedTile.value = null;
                }
                found = true;
                break;
            }
        }
        if (!found) {
            selectedTile.value = null;
            isAction.value = false;
            moveTile.value = null;
        }
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

    let lastMouseX = 0;
    let lastMouseY = 0;

    function updateHoveredTile() {
        if (lastMouseX === 0 && lastMouseY === 0) return;
        let found = false;
        for (let i = tiles.length - 1; i >= 0; i--) {
            if (isPointInsideTile(lastMouseX, lastMouseY, tiles[i])) {
                hoveredTile.value = tiles[i];
                found = true;
                break;
            }
        }
        if (!found) {
            hoveredTile.value = null;
        }
    }

    function handleMouseMove(event: MouseEvent) {
        lastMouseX = event.offsetX;
        lastMouseY = event.offsetY;

        if (isDragging) {
            cameraOffsetX = event.clientX - startX;
            cameraOffsetY = event.clientY - startY;
        }

        updateHoveredTile();
    }

    function handleKeyDown(e: KeyboardEvent) {
        switch (e.key) {
            case 'z':
                if (SCALE > MIN_SCALE) SCALE -= 0.125;
                if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;
                updateHoveredTile();
                break;
            case 'x':
                if (SCALE < MAX_SCALE) SCALE += 0.125;
                if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;
                updateHoveredTile();
                break;
            case 'ArrowUp':
            case 'w':
                cameraOffsetY += 8 * SCALE;
                updateHoveredTile();
                break;
            case 'ArrowDown':
            case 's':
                cameraOffsetY -= 8 * SCALE;
                updateHoveredTile();
                break;
            case 'ArrowLeft':
            case 'a':
                cameraOffsetX += 8 * SCALE;
                updateHoveredTile();
                break;
            case 'ArrowRight':
            case 'd':
                cameraOffsetX -= 8 * SCALE;
                updateHoveredTile();
                break;
            case 'Enter':
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
        updateHoveredTile();
    }

    let isStarted = false;

    function start() {
        if (isStarted) return;
        if (!canvasRef.value) return;

        isStarted = true;

        ctx = canvasRef.value.getContext('2d');
        if (!ctx) {
            isStarted = false;
            return;
        }

        ctx.imageSmoothingEnabled = false;
        resizeCanvas();

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

        gameLoop();

        if (canvasRef.value) {
            canvasRef.value.setAttribute('data-started', 'true');
        }
    }

    function stop() {
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
        if (state.round !== undefined) {
            currentRound = state.round;
        }
    }

    function hasValidActionTargets(unitRow: number, unitCol: number, unitAction: string): boolean {
        const unit = units.value.find(u => u.row === unitRow && u.col === unitCol);
        if (!unit || !unit.canAct) return false;

        const range = unit.range;

        for (let i = -range; i <= range; i++) {
            for (let j = -range; j <= range; j++) {
                if (Math.abs(i) + Math.abs(j) <= range) {
                    if (i === 0 && j === 0) continue;

                    const targetRow = unitRow + i;
                    const targetCol = unitCol + j;

                    // Check if there's a unit at this tile
                    const targetUnit = units.value.find(u => u.row === targetRow && u.col === targetCol);

                    if (targetUnit) {
                        const isEnemy = !unitIsTeam(targetRow, targetCol);
                        if (unitAction === 'heal' && !isEnemy) return true;
                        if (unitAction === 'attack' && isEnemy) return true;
                    }
                }
            }
        }

        return false;
    }

    function getPendingAction(): { unitId: number; targetRow: number; targetCol: number } | null {
        return pendingAction;
    }
    
    function clearPendingAction() {
        pendingAction = null;
    }

    return {
        gameSession,
        players,
        units,
        isMyTurn,
        player1Time,
        player2Time,
        isAction,
        selectedTile,
        moveTile,
        initSocket,
        start,
        stop,
        updateState,
        animateMove,
        animateAction,
        triggerHealthBarAnimation,
        hasValidActionTargets,
        getPendingAction,
        clearPendingAction,
        setPlayerIndex
    };
}
