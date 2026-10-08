// Must load before any renderer is created: replaces Pixi's `new Function` code generation, which the
// renderer's CSP (`script-src 'self'`, no 'unsafe-eval') blocks.
import 'pixi.js/unsafe-eval';

import { Application, Assets } from 'pixi.js';

const STAGE_BACKGROUND_COLOR = 0x1e1f24;

// Pixi loads textures in workers created from blob: URLs, which the CSP also blocks.
Assets.setPreferences({ preferWorkers: false });

/**
 * Creates the Pixi application that fills `host` and keeps it sized to it. Returns a cleanup that may
 * run before the async init has finished (React StrictMode unmounts immediately in development); the
 * application is then destroyed as soon as init settles.
 */
export function mountSimulationStage(host: HTMLElement): () => void {
    const app = new Application();
    let unmounted = false;
    let initialized = false;

    const destroy = (): void => {
        app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    };

    app.init({
        resizeTo: host,
        resolution: window.devicePixelRatio,
        autoDensity: true,
        background: STAGE_BACKGROUND_COLOR,
        antialias: true,
    })
        .then(() => {
            initialized = true;
            if (unmounted) {
                destroy();
                return;
            }

            host.appendChild(app.canvas);
        })
        .catch((error: unknown) => {
            console.error('Simulation stage failed to initialize:', error);
        });

    return () => {
        unmounted = true;
        if (!initialized) {
            return;
        }

        destroy();
    };
}
