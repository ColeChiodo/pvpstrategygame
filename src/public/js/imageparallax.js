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

/***/ "./src/client/imageparallax.ts":
/*!*************************************!*\
  !*** ./src/client/imageparallax.ts ***!
  \*************************************/
/***/ (() => {

eval("\nconst layers = [\n    document.getElementById('1'),\n    document.getElementById('2'),\n    document.getElementById('3'),\n    document.getElementById('4'),\n    document.getElementById('5'),\n    document.getElementById('6'),\n    document.getElementById('7'),\n    document.getElementById('8'),\n];\nlet mouseX = 0, mouseY = 0;\nlet scrollYpos = 0;\nfunction handleParallax() {\n    scrollYpos = window.scrollY;\n    updateTransforms();\n}\nfunction handleMouseMove(event) {\n    const centerX = window.innerWidth / 2;\n    const centerY = window.innerHeight / 2;\n    mouseX = (event.clientX - centerX) * 0.01;\n    mouseY = (event.clientY - centerY) * 0.01;\n    updateTransforms();\n}\nfunction updateTransforms() {\n    layers.forEach((layer, index) => {\n        if (!layer)\n            return;\n        const depth = (index + 1) * 0.5;\n        const scrollSpeed = (index + 1) * 0.2;\n        const offsetX = mouseX * depth;\n        const offsetY = mouseY * depth;\n        const scrollOffsetY = scrollY * scrollSpeed;\n        layer.style.transform = `translate(${offsetX}px, ${scrollOffsetY + offsetY}px) scale(1.1)`;\n    });\n}\nwindow.addEventListener('scroll', handleParallax);\nwindow.addEventListener('mousemove', handleMouseMove);\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/imageparallax.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/client/imageparallax.ts"]();
/******/ 	
/******/ })()
;