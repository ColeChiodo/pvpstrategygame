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

eval("\nconst canvas = document.getElementById('gameCanvas');\nconst ctx = canvas.getContext('2d');\n// resize canvas to fit window function\nfunction resizeCanvas() {\n    canvas.width = window.innerWidth;\n    canvas.height = window.innerHeight;\n    // redraw canvas\n    ctx.fillStyle = 'cornflowerblue';\n    ctx.fillRect(0, 0, canvas.width, canvas.height);\n}\nresizeCanvas();\nwindow.addEventListener('resize', resizeCanvas);\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/game.ts?");

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