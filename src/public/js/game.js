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

eval("\nconst SCALE = 3.125;\nlet arenaImage = null;\nlet arena = null;\nlet player = null;\nconst canvas = document.getElementById('gameCanvas');\nconst ctx = canvas.getContext('2d');\nfunction drawBackground() {\n    ctx.fillStyle = '#222034';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n}\nfunction drawArena() {\n    if (arenaImage) {\n        ctx.imageSmoothingEnabled = false;\n        ctx.drawImage(arenaImage, (canvas.width - arena.width * SCALE) / 2, (canvas.height - arena.height * SCALE + 16 * SCALE) / 2, arena.width * SCALE, arena.height * SCALE);\n    }\n}\nfunction drawPlayer() {\n    if (!player)\n        return;\n    ctx.fillStyle = player.color;\n    ctx.fillRect(player.x, player.y, player.height, player.height);\n}\nfunction draw() {\n    ctx.clearRect(0, 0, canvas.width, canvas.height);\n    drawBackground();\n    drawArena();\n    drawInteractionSquares();\n    drawPlayer();\n}\nwindow.addEventListener('keydown', (e) => {\n    console.log('Key pressed:', e.key);\n    window.socket.emit('player-action', e.key);\n});\nfunction gameLoop() {\n    window.socket.on('gameState', (gameState) => {\n        console.log('Game State:', gameState);\n        loadArenaImage(gameState.arena); // move to a game start function in the future to only load once\n        loadBox(gameState.box); // move to a game start function in the future to only load once\n        draw();\n    });\n}\ngameLoop();\n// ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------\nfunction loadArenaImage(newArena) {\n    if (!arenaImage) { // Only load the image once\n        arenaImage = new Image();\n        arenaImage.src = `/assets/maps/${newArena.image}`;\n        arena = newArena;\n        arenaImage.onload = () => {\n            drawArena();\n        };\n    }\n}\nfunction loadBox(newBox) {\n    if (!player) {\n        player = newBox;\n    }\n    else {\n        player.x = newBox.x;\n        player.y = newBox.y;\n    }\n}\nfunction resizeCanvas() {\n    canvas.width = window.outerWidth;\n    canvas.height = window.outerHeight;\n    draw();\n}\nresizeCanvas();\nwindow.addEventListener('resize', resizeCanvas);\nlet tiles = [];\nfunction drawInteractionSquares() {\n    if (!arenaImage)\n        return;\n    const tileWidth = 100; // width of an isometric tile\n    const tileHeight = 50; // height of an isometric tile\n    const rows = 10; // number of rows in the grid\n    const cols = 10; // number of columns in the grid\n    // get canvas center\n    const imgCenterX = canvas.width / 2;\n    const imgCenterY = canvas.height / 2;\n    // Calculate the total width and height of the grid\n    const gridWidth = (cols - 1) * tileWidth / 2; // Total width of the grid\n    const gridHeight = (rows - 1) * tileHeight / 2; // Total height of the grid\n    // Calculate the offset to center the grid on the image\n    const offsetX = imgCenterX - tileWidth / 2;\n    const offsetY = imgCenterY - gridHeight - tileHeight * 1.5;\n    // Draw the tiles\n    for (let row = 0; row < rows; row++) {\n        for (let col = 0; col < cols; col++) {\n            // Calculate isometric coordinates\n            const isoX = (col - row) * tileWidth / 2 + offsetX;\n            const isoY = (col + row) * tileHeight / 2 + offsetY;\n            tiles.push(drawIsometricTile(isoX, isoY, row, col));\n        }\n    }\n}\nfunction drawIsometricTile(x, y, row, col) {\n    ctx.beginPath();\n    ctx.moveTo(x, y);\n    ctx.lineTo(x + 50, y + 25);\n    ctx.lineTo(x + 100, y);\n    ctx.lineTo(x + 50, y - 25);\n    ctx.closePath();\n    //ctx.stroke();\n    return { x, y, row, col };\n}\nfunction isPointInsideTile(px, py, tile) {\n    // Vertices of the tile\n    const x1 = tile.x, y1 = tile.y;\n    const x2 = tile.x + 50, y2 = tile.y + 25;\n    const x3 = tile.x + 100, y3 = tile.y;\n    const x4 = tile.x + 50, y4 = tile.y - 25;\n    // Helper function to calculate the area of a triangle given by three points\n    const sign = (x1, y1, x2, y2, x3, y3) => {\n        return (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);\n    };\n    // Check if the point is inside the tile (diamond shape)\n    const d1 = sign(px, py, x1, y1, x2, y2);\n    const d2 = sign(px, py, x2, y2, x3, y3);\n    const d3 = sign(px, py, x3, y3, x4, y4);\n    const d4 = sign(px, py, x4, y4, x1, y1);\n    const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0) || (d4 < 0);\n    const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0) || (d4 > 0);\n    // Point is inside the tile if all signs are the same (either all positive or all negative)\n    return !(hasNeg && hasPos);\n}\n// Attach click event listener to the canvas\ncanvas.addEventListener('click', function (event) {\n    const clickX = event.offsetX;\n    const clickY = event.offsetY;\n    // Iterate over tiles to see if the click is inside any of them\n    for (const tile of tiles) {\n        if (isPointInsideTile(clickX, clickY, tile)) {\n            console.log(`You clicked on: ${tile.col}, ${tile.row}`);\n            break;\n        }\n    }\n});\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/game.ts?");

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