import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

// Entries follow electron-vite's conventions: src/main/index.ts, src/preload/index.ts,
// src/renderer/index.html. Main and preload build as CommonJS (no "type": "module"), which keeps the
// preload loadable with sandbox: true.
export default defineConfig({
    main: {},
    preload: {},
    renderer: {
        plugins: [react()],
    },
});
