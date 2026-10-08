import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';

const PRELOAD_PATH = join(__dirname, '../preload/index.js');
const RENDERER_HTML_PATH = join(__dirname, '../renderer/index.html');
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function createMainWindow(): BrowserWindow {
    const window = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: PRELOAD_PATH,
        },
    });

    window.once('ready-to-show', () => {
        window.show();
    });

    // The renderer never navigates away from the app page or opens windows of its own.
    window.webContents.on('will-navigate', (event) => {
        event.preventDefault();
    });
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

    loadRenderer(window).catch((error: unknown) => {
        // A window that never loads never fires ready-to-show; destroy it so the app can still quit.
        console.error('Failed to load the renderer:', error);
        window.destroy();
    });

    return window;
}

function loadRenderer(window: BrowserWindow): Promise<void> {
    const devServerUrl = getDevServerUrl();
    if (devServerUrl) {
        return window.loadURL(devServerUrl);
    }

    return window.loadFile(RENDERER_HTML_PATH);
}

// electron-vite sets ELECTRON_RENDERER_URL to the Vite dev server while running `electron-vite dev`.
// It is honored only in unpackaged builds and only for a local origin, because this window has the
// preload attached and must never load remote content.
function getDevServerUrl(): string | null {
    if (app.isPackaged) {
        return null;
    }

    const value = process.env['ELECTRON_RENDERER_URL'];
    if (!value) {
        return null;
    }

    const url = URL.parse(value);
    if (!url || url.protocol !== 'http:' || !LOCAL_HOSTS.has(url.hostname)) {
        console.error(`Ignoring non-local ELECTRON_RENDERER_URL: ${value}`);
        return null;
    }

    return url.href;
}
