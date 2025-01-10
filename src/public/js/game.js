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

eval("\nconst canvas = document.getElementById('gameCanvas');\nconst ctx = canvas.getContext('2d');\nfunction resizeCanvas() {\n    canvas.width = window.innerWidth;\n    canvas.height = window.innerHeight;\n}\nresizeCanvas();\nwindow.addEventListener('resize', resizeCanvas);\nfunction drawBackground() {\n    ctx.fillStyle = 'cornflowerblue';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n}\nfunction drawPlayer(player) {\n    ctx.fillStyle = player.color;\n    ctx.fillRect(player.x, player.y, player.height, player.height);\n}\nfunction draw(player) {\n    drawBackground();\n    drawPlayer(player);\n}\nwindow.addEventListener('keydown', (e) => {\n    console.log('Key pressed:', e.key);\n    window.socket.emit('player-action', e.key);\n});\nfunction gameLoop() {\n    window.socket.on('gameState', (gameState) => {\n        console.log('Game State:', gameState);\n        draw(gameState.box);\n    });\n}\ngameLoop();\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/game.ts?");

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