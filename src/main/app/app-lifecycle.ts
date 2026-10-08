import { app, BrowserWindow } from 'electron';

import { createMainWindow } from './main-window';

export function startApp(): void {
    app.whenReady()
        .then(() => {
            createMainWindow();

            // macOS keeps the app running without windows; re-open one when the dock icon is clicked.
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    createMainWindow();
                }
            });
        })
        .catch((error: unknown) => {
            console.error('App failed to start:', error);
            app.quit();
        });

    app.on('window-all-closed', () => {
        if (process.platform === 'darwin') {
            return;
        }

        app.quit();
    });
}
