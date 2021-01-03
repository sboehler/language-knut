module.exports =
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deactivate = exports.activate = void 0;
const vscode = __webpack_require__(1);
function activate(context) {
    const disposable = vscode.languages.registerFoldingRangeProvider("knut", new KnutFoldingProvider());
    context.subscriptions.push(disposable);
    const disp = vscode.languages.registerDocumentSymbolProvider("knut", new KnutOutlineProvider());
    context.subscriptions.push(disp);
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() { }
exports.deactivate = deactivate;
class KnutFoldingProvider {
    provideFoldingRanges(document, context, token) {
        const result = [];
        let indent = 0;
        const stack = [];
        for (let l = 0; l < document.lineCount; l++) {
            const line = document.lineAt(l);
            let stars = 0;
            while (line.text[stars] === '*') {
                stars++;
            }
            if (stars === 0) {
                continue;
            }
            while (stack.length > stars - 1) {
                const r = stack.pop();
                if (!r || r.start === -1) {
                    continue;
                }
                r.end = l - 1;
                result.push(r);
            }
            while (stack.length < stars - 1) {
                stack.push(new vscode.FoldingRange(-1, -1));
            }
            stack.push(new vscode.FoldingRange(l, l));
        }
        while (stack.length > 0) {
            const r = stack.pop();
            if (!r || r.start === -1) {
                continue;
            }
            r.end = document.lineCount - 1;
            result.push(r);
        }
        return result;
    }
}
class KnutOutlineProvider {
    provideDocumentSymbols(document, token) {
        const result = [];
        let indent = 0;
        const stack = [];
        for (let l = 0; l < document.lineCount; l++) {
            const line = document.lineAt(l);
            let stars = 0;
            while (line.text[stars] === '*') {
                stars++;
            }
            if (stars === 0) {
                continue;
            }
            while (stack.length > stars - 1) {
                const r = stack.pop();
                if (r) {
                    r.range = new vscode.Range(r.range.start, document.lineAt(l - 1).range.end);
                }
            }
            while (stack.length < stars - 1) {
                stack.push(undefined);
            }
            const s = new vscode.DocumentSymbol(line.text.substr(stars).trim(), "", vscode.SymbolKind.Function, line.range, line.range);
            if (stack.length > 0) {
                const parent = stack[stack.length - 1];
                parent === null || parent === void 0 ? void 0 : parent.children.push(s);
            }
            else {
                result.push(s);
            }
            stack.push(s);
        }
        while (stack.length > 0) {
            const r = stack.pop();
            if (r) {
                r.range = new vscode.Range(r.range.start, document.lineAt(document.lineCount - 1).range.end);
            }
        }
        return result;
    }
}


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");;

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		if(__webpack_module_cache__[moduleId]) {
/******/ 			return __webpack_module_cache__[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	// module exports must be returned from runtime so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })()
;
//# sourceMappingURL=extension.js.map