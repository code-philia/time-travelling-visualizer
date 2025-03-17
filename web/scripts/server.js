/**
 * This server script is used for serving built
 * web pages used in VS Code extension.
 *
 * Selective arguments will be passed
 * to node to set up the predefined variables
 * like __APP_CONFIG__ for initializing the view.
 */

import express from 'express';
import path from 'path';
import serveStatic from 'serve-static';

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { parseArgs } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const { values } = parseArgs({
    options: {
        layout: { type: 'string', default: 'app' }
    }
});

const layout = values.layout;
console.log(`Using layout: ${layout}`);

const app = express();
const PORT = 3002;

// Serve the Vite build output
app.use(serveStatic(path.join(__dirname, '..', 'dist', layout)));

app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
});
