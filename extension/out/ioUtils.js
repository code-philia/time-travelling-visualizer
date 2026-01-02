"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDirectory = isDirectory;
const fs_1 = require("fs");
function isDirectory(path) {
    return (0, fs_1.existsSync)(path) && (0, fs_1.statSync)(path).isDirectory();
}
//# sourceMappingURL=ioUtils.js.map