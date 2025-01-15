/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/client/game.ts":
/*!****************************!*\
  !*** ./src/client/game.ts ***!
  \****************************/
/***/ (() => {

eval("\nconst user = JSON.parse(document.getElementById('user').innerHTML);\nconst MIN_SCALE = 1.0;\nconst MAX_SCALE = 5.0;\nlet SCALE = 3.125;\nlet cameraOffsetX = 0;\nlet cameraOffsetY = 0;\nlet arenaImage = null;\nlet arena = null;\nlet uiImage = new Image();\nuiImage.src = '/assets/spritesheets/UI.png';\nlet testUnitImage = new Image();\ntestUnitImage.src = `/assets/spritesheets/units/test.png`;\nlet players = [];\nlet units = [];\nlet visibleTiles = [];\nlet hoveredTile = null;\nlet selectedTile = null;\nlet moveTile = null;\nlet validMoveTiles = [];\nlet actionTile = null;\nlet validActionTiles = [];\nlet currentRound = 0;\nlet player1Time = 0;\nlet player2Time = 0;\nlet isAction = false;\nconst canvas = document.getElementById('gameCanvas');\nconst ctx = canvas.getContext('2d');\nfunction drawBackground() {\n    ctx.fillStyle = '#222034';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n}\nfunction drawArena() {\n    if (arenaImage) {\n        ctx.imageSmoothingEnabled = false;\n        ctx.drawImage(arenaImage, (canvas.width - arena.width * SCALE) / 2 + cameraOffsetX, (canvas.height - arena.height * SCALE + 16 * SCALE) / 2 + cameraOffsetY, arena.width * SCALE, arena.height * SCALE);\n    }\n}\nfunction draw() {\n    const loading = document.getElementById('loading');\n    if (loading && players.length === 2)\n        loading.remove();\n    ctx.clearRect(0, 0, canvas.width, canvas.height);\n    drawBackground();\n    drawArena();\n    drawFogOfWarTiles();\n    drawUnits();\n    drawUI();\n    drawInteractionSquares();\n    editHTML();\n}\nfunction formatTime(seconds) {\n    const minutes = Math.floor(seconds / 60);\n    const remainingSeconds = seconds % 60;\n    const formattedMinutes = minutes.toString().padStart(2, '0');\n    const formattedSeconds = remainingSeconds.toString().padStart(2, '0');\n    return `${formattedMinutes}:${formattedSeconds}`;\n}\nfunction editHTML() {\n    if (players.length < 2)\n        return;\n    const player1Name = document.getElementById('player1Name');\n    const player2Name = document.getElementById('player2Name');\n    player1Name.innerHTML = players[0].name;\n    player2Name.innerHTML = players[1].name;\n    const player1Timer = document.getElementById('player1Time');\n    const player2Timer = document.getElementById('player2Time');\n    const player1FormattedTime = formatTime(player1Time);\n    const player2FormattedTime = formatTime(player2Time);\n    player1Timer.innerHTML = player1FormattedTime;\n    player2Timer.innerHTML = player2FormattedTime;\n}\nwindow.addEventListener('keydown', (e) => {\n    switch (e.key) {\n        case 'z':\n            if (SCALE !== MIN_SCALE)\n                SCALE -= 0.125;\n            if (SCALE < MIN_SCALE)\n                SCALE = MIN_SCALE;\n            break;\n        case 'x':\n            if (SCALE !== MAX_SCALE)\n                SCALE += 0.125;\n            if (SCALE > MAX_SCALE)\n                SCALE = MAX_SCALE;\n            break;\n        case \"ArrowUp\":\n        case \"w\":\n            cameraOffsetY += 8 * SCALE;\n            break;\n        case \"ArrowDown\":\n        case \"s\":\n            cameraOffsetY -= 8 * SCALE;\n            break;\n        case \"ArrowLeft\":\n        case \"a\":\n            cameraOffsetX += 8 * SCALE;\n            break;\n        case \"ArrowRight\":\n        case \"d\":\n            cameraOffsetX -= 8 * SCALE;\n            break;\n        case \"Enter\":\n            window.socket.emit('force-end-turn');\n            selectedTile = null;\n            isAction = false;\n            moveTile = null;\n            break;\n    }\n});\nfunction loadUnits(players) {\n    units = [];\n    for (const player of players) {\n        for (const unit of player.units) {\n            unit.owner = player;\n            units.push(unit);\n        }\n    }\n    drawUnits();\n}\nfunction loadPlayers(newPlayers) {\n    players = [];\n    players = newPlayers;\n}\nwindow.socket.on('gameState', (gameState) => {\n    loadArenaImage(gameState.arena); // move to a game start function in the future to only load once\n    loadPlayers(gameState.players);\n    loadUnits(gameState.players);\n    visibleTiles = gameState.visibleTiles;\n    currentRound = gameState.round;\n    player1Time = gameState.player1Time;\n    player2Time = gameState.player2Time;\n});\nfunction gameLoop() {\n    draw();\n    requestAnimationFrame(gameLoop);\n}\ngameLoop();\nfunction loadArenaImage(newArena) {\n    if (!arenaImage) {\n        arenaImage = new Image();\n        arenaImage.src = `/assets/maps/${newArena.name}.png`;\n        arena = newArena;\n        arenaImage.onload = () => {\n            drawArena();\n        };\n    }\n}\nfunction resizeCanvas() {\n    canvas.width = window.outerWidth;\n    canvas.height = window.outerHeight;\n    draw();\n}\nresizeCanvas();\nwindow.addEventListener('resize', resizeCanvas);\nwindow.addEventListener('orientationchange', resizeCanvas);\nlet tiles = [];\nfunction drawInteractionSquares() {\n    if (!arenaImage)\n        return;\n    if (!arena)\n        return;\n    const tileWidth = 32 * SCALE; // width of an isometric tile\n    const tileHeight = 16 * SCALE; // height of an isometric tile\n    const rows = arena.tiles.length;\n    const cols = arena.tiles[0].length;\n    // get canvas center\n    const imgCenterX = canvas.width / 2;\n    const imgCenterY = canvas.height / 2;\n    // Calculate the total width and height of the grid\n    const gridWidth = (cols - 1) * tileWidth / 2; // Total width of the grid\n    const gridHeight = (rows - 1) * tileHeight / 2; // Total height of the grid\n    // Calculate the offset to center the grid on the image\n    const offsetX = imgCenterX - tileWidth / 2 + cameraOffsetX;\n    const offsetY = imgCenterY - gridHeight - tileHeight - 8 * SCALE + cameraOffsetY;\n    // Draw the tiles\n    tiles = [];\n    for (let row = 0; row < rows; row++) {\n        for (let col = 0; col < cols; col++) {\n            // Calculate isometric coordinates\n            if (arena.tiles[row][col] === 0)\n                continue;\n            const isoX = (col - row) * tileWidth / 2 + offsetX;\n            const isoY = (col + row) * tileHeight / 2 + offsetY;\n            tiles.push(drawIsometricTile(isoX, isoY, row, col));\n        }\n    }\n}\nfunction drawIsometricTile(x, y, row, col) {\n    ctx.beginPath();\n    ctx.moveTo(x, y);\n    ctx.lineTo(x + 16 * SCALE, y + 8 * SCALE);\n    ctx.lineTo(x + 32 * SCALE, y);\n    ctx.lineTo(x + 16 * SCALE, y - 8 * SCALE);\n    ctx.closePath();\n    //ctx.stroke();\n    return { x, y, row, col };\n}\nfunction isPointInsideTile(px, py, tile) {\n    // Vertices of the tile\n    const x1 = tile.x, y1 = tile.y;\n    const x2 = tile.x + 16 * SCALE, y2 = tile.y + 8 * SCALE;\n    const x3 = tile.x + 32 * SCALE, y3 = tile.y;\n    const x4 = tile.x + 16 * SCALE, y4 = tile.y - 8 * SCALE;\n    // Helper function to calculate the area of a triangle given by three points\n    const sign = (x1, y1, x2, y2, x3, y3) => {\n        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);\n    };\n    // Check if the point is inside the tile (diamond shape)\n    const d1 = sign(px, py, x1, y1, x2, y2);\n    const d2 = sign(px, py, x2, y2, x3, y3);\n    const d3 = sign(px, py, x3, y3, x4, y4);\n    const d4 = sign(px, py, x4, y4, x1, y1);\n    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);\n    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);\n    // Point is inside the tile if all signs are the same (either all positive or all negative)\n    return !(hasNeg && hasPos);\n}\nwindow.socket.on('player-unit-moved', (unitID, tile) => {\n    isAction = true;\n    moveTile = tile;\n    console.log(`Unit ${unitID} looking to perform an action`);\n});\nfunction isTurn() {\n    return players[currentRound % 2].name === user.username;\n}\nfunction unitCanMove(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            return unit.canMove;\n        }\n    }\n    return false;\n}\nfunction unitCanAct(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            return unit.canAct;\n        }\n    }\n    return false;\n}\nlet isDragging = false;\nlet startX = 0;\nlet startY = 0;\ncanvas.addEventListener('click', function (event) {\n    if (!isTurn())\n        return;\n    if (players.length != 2)\n        return;\n    const clickX = event.offsetX;\n    const clickY = event.offsetY;\n    let found = false;\n    for (const tile of tiles) {\n        if (!hoveredTile)\n            break;\n        if (isPointInsideTile(clickX, clickY, tile)) {\n            if (!isAction && !selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col) && unitCanMove(hoveredTile.row, hoveredTile.col)) {\n                // first click\n                selectedTile = tile;\n            }\n            else if (!isAction && selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {\n                // move clicked on the same tile to stay\n                const unit = units.find(unit => unit.row === selectedTile.row && unit.col === selectedTile.col);\n                console.log(`Staying on: ${tile.row}, ${tile.col}`);\n                window.socket.emit('player-unit-move', unit.id, tile);\n                break;\n            }\n            else if (!isAction && selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {\n                // move clicked on another tile to move\n                if (validMoveTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {\n                    const unit = units.find(unit => unit.row === selectedTile.row && unit.col === selectedTile.col);\n                    console.log(`Moving to: ${tile.row}, ${tile.col}`);\n                    window.socket.emit('player-unit-move', unit.id, tile);\n                }\n                selectedTile = null;\n            }\n            else if (isAction && hasUnit(tile.row, tile.col)) {\n                // action clicked on another unit\n                if (validActionTiles.find(validTile => validTile.row === tile.row && validTile.col === tile.col)) {\n                    const unit = units.find(unit => unit.row === moveTile.row && unit.col === moveTile.col);\n                    console.log(`Action on: ${tile.row}, ${tile.col}`);\n                    window.socket.emit('player-unit-action', unit.id, tile);\n                }\n                isAction = false;\n                moveTile = null;\n            }\n            else if (isAction && hasUnit(tile.row, tile.col)) {\n                // action clicked on same tile to cancel\n                const unit = units.find(unit => unit.row === moveTile.row && unit.col === moveTile.col);\n                isAction = false;\n                moveTile = null;\n                console.log(`Cancel action on: ${tile.row}, ${tile.col}`);\n                window.socket.emit('player-unit-action', unit.id, tile);\n            }\n            found = true;\n            break;\n        }\n    }\n    if (!found) {\n        selectedTile = null;\n    }\n});\ncanvas.addEventListener('mousedown', (e) => {\n    if (e.button !== 1)\n        return;\n    isDragging = true;\n    startX = e.clientX - cameraOffsetX;\n    startY = e.clientY - cameraOffsetY;\n});\ncanvas.addEventListener('mouseup', () => {\n    isDragging = false;\n});\ncanvas.addEventListener('mouseleave', () => {\n    isDragging = false;\n});\ncanvas.addEventListener('wheel', (e) => {\n    if (e.deltaY < 0) {\n        if (SCALE !== MAX_SCALE)\n            SCALE *= 1.1;\n        if (SCALE > MAX_SCALE)\n            SCALE = MAX_SCALE;\n    }\n    else if (e.deltaY > 0) {\n        if (SCALE !== MIN_SCALE)\n            SCALE *= 0.9;\n        if (SCALE < MIN_SCALE)\n            SCALE = MIN_SCALE;\n    }\n});\ncanvas.addEventListener('mousemove', function (event) {\n    const clickX = event.offsetX;\n    const clickY = event.offsetY;\n    for (const tile of tiles) {\n        if (isPointInsideTile(clickX, clickY, tile)) {\n            //console.log(`You hovered on: ${tile.row}, ${tile.col}`);\n            hoveredTile = tile;\n            break;\n        }\n        else {\n            hoveredTile = null;\n        }\n    }\n    if (isDragging) {\n        cameraOffsetX = event.clientX - startX;\n        cameraOffsetY = event.clientY - startY;\n    }\n});\nfunction hasUnit(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            return true;\n        }\n    }\n    return false;\n}\nfunction unitIsTeam(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            return unit.owner.name === user.username;\n        }\n    }\n    return false;\n}\nfunction unitCanBeHealed(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            if (unit.owner.name !== user.username)\n                return false;\n            return unit.health < unit.maxHealth;\n        }\n    }\n    return false;\n}\nfunction unitCanBeAttacked(row, col) {\n    for (const unit of units) {\n        if (unit.row === row && unit.col === col) {\n            if (unit.owner.name === user.username)\n                return false;\n            return unit.health > 0;\n        }\n    }\n    return false;\n}\nfunction drawHoveredTile() {\n    if (!hoveredTile)\n        return;\n    const frameSize = 32;\n    const highlightFrameX = hasUnit(hoveredTile.row, hoveredTile.col) ? (unitIsTeam(hoveredTile.row, hoveredTile.col) ? 1 : 2) : 0;\n    const highlightFrameY = 0;\n    const sx = highlightFrameX * frameSize;\n    const sy = highlightFrameY * frameSize;\n    ctx.imageSmoothingEnabled = false;\n    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, hoveredTile.x, hoveredTile.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);\n}\nfunction drawSelectedTile() {\n    if (!selectedTile)\n        return;\n    const frameSize = 32;\n    const highlightFrameX = 3;\n    const highlightFrameY = 0;\n    const col = selectedTile.col;\n    const row = selectedTile.row;\n    const sx = highlightFrameX * frameSize;\n    const sy = highlightFrameY * frameSize;\n    const pos = coordToPosition(row, col);\n    ctx.imageSmoothingEnabled = false;\n    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);\n}\nfunction drawUI() {\n    drawHoveredTile();\n    drawSelectedTile();\n    drawMovementTiles();\n    drawActionTiles();\n    drawHealthBars();\n}\nfunction drawFogOfWarTiles() {\n    if (!arena)\n        return;\n    for (let row = 0; row < arena.tiles.length; row++) {\n        for (let col = 0; col < arena.tiles[row].length; col++) {\n            if (arena.tiles[row][col] === 0)\n                continue;\n            if (isVisibleTile(row, col))\n                continue;\n            drawFogOfWarTile(row, col);\n        }\n    }\n}\nfunction isVisibleTile(row, col) {\n    const tile = visibleTiles.find(visibleTiles => visibleTiles.row === row && visibleTiles.col === col);\n    if (tile)\n        return true;\n    return false;\n}\nfunction drawFogOfWarTile(row, col) {\n    const frameSize = 32;\n    const highlightFrameX = 4;\n    const highlightFrameY = 1;\n    const sx = highlightFrameX * frameSize;\n    const sy = highlightFrameY * frameSize;\n    const pos = coordToPosition(row, col);\n    if (pos.x === -9999 || pos.y === -9999)\n        return;\n    ctx.imageSmoothingEnabled = false;\n    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);\n}\nfunction drawHealthBars() {\n    for (const unit of units) {\n        const pos = coordToPosition(unit.row, unit.col);\n        if (pos.x === -9999 || pos.y === -9999)\n            return;\n        const frameSize = 16;\n        const frameX = unitIsTeam(unit.row, unit.col) ? 2 : 4;\n        const frameY = 4;\n        const sx = frameX * frameSize;\n        const sy = frameY * frameSize;\n        let gap = 1 * SCALE;\n        let totalWidth = unit.maxHealth * (frameSize * SCALE / 4) + (unit.maxHealth - 1) * gap;\n        let startX = pos.x - totalWidth / 2;\n        for (let i = 0; i < unit.maxHealth; i++) {\n            let xPosition = startX + i * (frameSize * SCALE / 4 + gap) + frameSize * SCALE;\n            if (i < unit.health) {\n                ctx.imageSmoothingEnabled = false;\n                ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, xPosition, pos.y - 28 * SCALE, frameSize * SCALE / 4, frameSize * SCALE / 4);\n            }\n            else {\n                ctx.imageSmoothingEnabled = false;\n                ctx.drawImage(uiImage, sx + frameSize, sy, frameSize, frameSize, xPosition, pos.y - 28 * SCALE, frameSize * SCALE / 4, frameSize * SCALE / 4);\n            }\n        }\n    }\n}\nfunction drawMovementTiles() {\n    if (selectedTile) {\n        const unit = units.find(unit => unit.row === selectedTile.row && unit.col === selectedTile.col);\n        if (unit) {\n            validMoveTiles = [];\n            const mobility = unit.mobility;\n            const range = unit.range;\n            const row = selectedTile.row;\n            const col = selectedTile.col;\n            let mobilityTiles = [];\n            for (let i = -mobility; i <= mobility; i++) {\n                for (let j = -mobility; j <= mobility; j++) {\n                    if (Math.abs(i) + Math.abs(j) <= mobility) {\n                        if (hasUnit(row + i, col + j) && (i !== 0 && j !== 0))\n                            continue;\n                        mobilityTiles.push({ x: row + i, y: col + j });\n                        drawMoveTile(row + i, col + j);\n                    }\n                }\n            }\n            // Second loop: Draw attack range borders\n            for (let tile of mobilityTiles) {\n                const mobilityTileRow = tile.x;\n                const mobilityTileCol = tile.y;\n                for (let i = -range; i <= range; i++) {\n                    for (let j = -range; j <= range; j++) {\n                        if (Math.abs(i) + Math.abs(j) <= range) {\n                            let action = unit.action;\n                            const attackRow = mobilityTileRow + i;\n                            const attackCol = mobilityTileCol + j;\n                            if (attackRow < 0 || attackRow >= arena.tiles.length)\n                                continue;\n                            if (attackCol < 0 || attackCol >= arena.tiles[0].length)\n                                continue;\n                            if (attackRow === row && attackCol === col)\n                                continue;\n                            if (mobilityTiles.find(tile => tile.x === attackRow && tile.y === attackCol))\n                                continue;\n                            if (hasUnit(attackRow, attackCol))\n                                continue;\n                            drawActionTile(attackRow, attackCol, action);\n                        }\n                    }\n                }\n            }\n        }\n    }\n}\nfunction drawMoveTile(row, col) {\n    validMoveTiles.push({ row, col });\n    if (!selectedTile)\n        return;\n    const frameSize = 32;\n    const highlightFrameX = 3;\n    const highlightFrameY = 1;\n    const sx = highlightFrameX * frameSize;\n    const sy = highlightFrameY * frameSize;\n    const pos = coordToPosition(row, col);\n    if (pos.x === -9999 || pos.y === -9999)\n        return;\n    ctx.imageSmoothingEnabled = false;\n    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);\n}\nfunction drawActionTiles() {\n    if (isAction) {\n        if (moveTile) {\n            const unit = units.find(unit => unit.row === moveTile.row && unit.col === moveTile.col);\n            if (unit) {\n                validActionTiles = [];\n                const range = unit.range;\n                const row = moveTile.row;\n                const col = moveTile.col;\n                let actionPerformed = false;\n                for (let i = -range; i <= range; i++) {\n                    for (let j = -range; j <= range; j++) {\n                        if (Math.abs(i) + Math.abs(j) <= range) {\n                            if (i === 0 && j === 0)\n                                continue;\n                            if (!hasUnit(row + i, col + j))\n                                continue;\n                            let action = unit.action;\n                            if (action === 'heal' && !unitIsTeam(row + i, col + j))\n                                continue;\n                            if (action === 'heal' && !unitCanBeHealed(row + i, col + j))\n                                continue;\n                            if (action === 'attack' && !unitCanBeAttacked(row + i, col + j))\n                                continue;\n                            if (action === 'attack' && unitIsTeam(row + i, col + j))\n                                continue;\n                            drawActionTile(row + i, col + j, action);\n                            actionPerformed = true;\n                        }\n                    }\n                }\n                if (!actionPerformed) {\n                    console.log(`Unit ${unit.id} has no valid actions`);\n                    unit.canAct = false;\n                    isAction = false;\n                    moveTile = null;\n                    window.socket.emit('force-unit-end-turn', unit.id);\n                }\n            }\n        }\n    }\n}\nfunction drawActionTile(row, col, action) {\n    validActionTiles.push({ row, col });\n    const frameSize = 32;\n    const highlightFrameX = action === 'attack' ? 2 : 1;\n    const highlightFrameY = 1;\n    const sx = highlightFrameX * frameSize;\n    const sy = highlightFrameY * frameSize;\n    const pos = coordToPosition(row, col);\n    if (pos.x === -9999 || pos.y === -9999)\n        return;\n    ctx.imageSmoothingEnabled = false;\n    ctx.drawImage(uiImage, sx, sy, frameSize, frameSize, pos.x, pos.y - 8 * SCALE, frameSize * SCALE, frameSize * SCALE);\n}\nfunction drawUnits() {\n    units.sort((a, b) => {\n        const posA = coordToPosition(a.row, a.col);\n        const posB = coordToPosition(b.row, b.col);\n        return posA.y - posB.y;\n    });\n    for (const unit of units) {\n        const frameSize = 32;\n        const frameX = 0;\n        const frameY = unit.name === 'attack_guy' ? 0 : 1;\n        const sx = frameX * frameSize;\n        const sy = frameY * frameSize;\n        const pos = coordToPosition(unit.row, unit.col);\n        ctx.imageSmoothingEnabled = false;\n        ctx.drawImage(testUnitImage, sx, sy, frameSize, frameSize, pos.x, pos.y - frameSize * SCALE + (8 * SCALE), frameSize * SCALE, frameSize * SCALE);\n    }\n}\nfunction coordToPosition(row, col) {\n    for (const tile of tiles) {\n        if (tile.row === row && tile.col === col) {\n            return { x: tile.x, y: tile.y };\n        }\n    }\n    return { x: -9999, y: -9999 };\n}\n// -----------Touch Screen Logic---------------------------\n// let touchStartTime = 0;\n// const TAP_THRESHOLD = 200;\n// canvas.addEventListener('touchstart', function(e) {\n//     e.preventDefault(); // Prevent default touch behavior (like scrolling)\n//     if (e.touches.length !== 1) return; // Ensure it's a single touch\n//     touchStartTime = Date.now();\n//     isDragging = true;\n//     startX = e.touches[0].clientX - cameraOffsetX;\n//     startY = e.touches[0].clientY - cameraOffsetY;\n//     const touch = e.changedTouches[0];\n//     const clickX = touch.clientX - canvas.offsetLeft;\n//     const clickY = touch.clientY - canvas.offsetTop;\n//     let found = false;\n//     for (const tile of tiles) {\n//         if (!hoveredTile) break;\n//         if (isPointInsideTile(clickX, clickY, tile)) {\n//             //console.log(`You clicked on: ${tile.row}, ${tile.col}`);\n//             if (!selectedTile && unitIsTeam(hoveredTile.row, hoveredTile.col)) {\n//                 selectedTile = tile;\n//             } else if (selectedTile && tile.row === selectedTile.row && tile.col === selectedTile.col) {\n//                 const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);\n//                 console.log(`Moving to: ${tile.row}, ${tile.col}`);\n//                 window.socket.emit('player-unit-move', unit!.id, tile);\n//                 break;\n//             } else if (selectedTile && unitIsTeam(selectedTile.row, selectedTile.col)) {\n//                 const unit = units.find(unit => unit.row === selectedTile!.row && unit.col === selectedTile!.col);\n//                 console.log(`Moving to: ${tile.row}, ${tile.col}`);\n//                 window.socket.emit('player-unit-move', unit!.id, tile);\n//                 selectedTile = null;\n//             }\n//             found = true;\n//             break;\n//         }\n//     }\n//     if (!found) {\n//         selectedTile = null;\n//     }\n// });\n// let prevTouchDistance: number | null = null;\n// canvas.addEventListener('touchmove', function(e) {\n//     e.preventDefault();\n//     if (e.touches.length === 1) {\n//         if (!isDragging) return;\n//         const touchX = e.touches[0].clientX;\n//         const touchY = e.touches[0].clientY;\n//         cameraOffsetX = touchX - startX;\n//         cameraOffsetY = touchY - startY;\n//         // Update hovered tile (similar to mousemove)\n//         const clickX = touchX - canvas.offsetLeft;\n//         const clickY = touchY - canvas.offsetTop;\n//         for (const tile of tiles) {\n//             if (isPointInsideTile(clickX, clickY, tile)) {\n//                 hoveredTile = tile;\n//                 break;\n//             }\n//             else {\n//                 hoveredTile = null;\n//             }\n//         }\n//     }\n//     if (e.touches.length === 2) {\n//         // Get the coordinates of the two touch points\n//         const touch1X = e.touches[0].clientX;\n//         const touch1Y = e.touches[0].clientY;\n//         const touch2X = e.touches[1].clientX;\n//         const touch2Y = e.touches[1].clientY;\n//         // Calculate the current distance between the two touch points\n//         const currentDistance = Math.sqrt(\n//             (touch2X - touch1X) ** 2 + (touch2Y - touch1Y) ** 2\n//         );\n//         if (prevTouchDistance !== null) {\n//             // Calculate the scale factor based on the distance change\n//             const scaleChange = currentDistance / prevTouchDistance;\n//             // Apply the zoom (scale) adjustment\n//             if (scaleChange > 1) {\n//                 // Zoom in (scale up)\n//                 if (SCALE !== MAX_SCALE) SCALE *= 1.05;\n//                 if (SCALE > MAX_SCALE) SCALE = MAX_SCALE;\n//             } else {\n//                 // Zoom out (scale down)\n//                 if (SCALE !== MIN_SCALE) SCALE *= 0.95;\n//                 if (SCALE < MIN_SCALE) SCALE = MIN_SCALE;\n//             }\n//         }\n//         // Update the previous touch distance for the next move event\n//         prevTouchDistance = currentDistance;\n//     }\n// });\n// canvas.addEventListener('touchend', function(e) {\n//     isDragging = false;\n//     if (e.touches.length < 2) {\n//         prevTouchDistance = null;\n//     }\n// });\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/game.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/client/game.ts"]();
/******/ 	
/******/ })()
;