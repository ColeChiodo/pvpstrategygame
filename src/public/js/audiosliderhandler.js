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

/***/ "./src/client/audiosliderhandler.ts":
/*!******************************************!*\
  !*** ./src/client/audiosliderhandler.ts ***!
  \******************************************/
/***/ (() => {

eval("\nconst volumeSlider = document.getElementById(\"volumeSlider\");\nconst volumeIcon = document.getElementById(\"volumeIcon\");\nconst gainNode = window.gainNode;\nlet isMuted = gainNode.gain.value === 0;\nvolumeSlider.addEventListener(\"input\", () => {\n    const volume = volumeSlider.valueAsNumber;\n    gainNode.gain.value = volume;\n    volumeIcon.src = volume === 0 ? \"/assets/global/mute.png\" : \"/assets/global/audio.png\";\n    isMuted = volume === 0;\n});\nfunction toggleMute() {\n    isMuted = !isMuted;\n    gainNode.gain.value = isMuted ? 0 : volumeSlider.valueAsNumber;\n    volumeIcon.src = isMuted ? \"/assets/global/mute.png\" : \"/assets/global/audio.png\";\n    console.log(`isMuted: ${isMuted}`);\n}\ndocument.addEventListener(\"DOMContentLoaded\", () => {\n    const volume = volumeSlider.valueAsNumber;\n    gainNode.gain.value = volume;\n    volumeIcon.src = volume === 0 ? \"/assets/global/mute.png\" : \"/assets/global/audio.png\";\n    isMuted = volume === 0;\n});\nwindow.toggleMute = toggleMute;\n\n\n//# sourceURL=webpack://pvpstrategygame/./src/client/audiosliderhandler.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = {};
/******/ 	__webpack_modules__["./src/client/audiosliderhandler.ts"]();
/******/ 	
/******/ })()
;