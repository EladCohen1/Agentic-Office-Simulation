import type { Texture } from 'pixi.js';

import { createSvgTexture } from './svg-texture';

export interface SvgTextureCache {
    /** Returns the texture for this SVG markup, rasterizing it once. */
    get(svgMarkup: string): Promise<Texture>;
    /** Destroys every texture created so far, including ones still loading. */
    destroy(): void;
}

/** Shares one texture per distinct SVG, so reused pieces (desks, stools) rasterize once. */
export function svgTextureCache(resolution: number): SvgTextureCache {
    const pending = new Map<string, Promise<Texture>>();
    let destroyed = false;

    return {
        get(svgMarkup) {
            if (destroyed) {
                return Promise.reject(new Error('The SVG texture cache has been destroyed.'));
            }

            const existing = pending.get(svgMarkup);
            if (existing) {
                return existing;
            }

            const created = createSvgTexture(svgMarkup, resolution);
            pending.set(svgMarkup, created);
            return created;
        },
        destroy() {
            destroyed = true;
            // Textures still rasterizing are destroyed as soon as they finish, so none leak.
            for (const texture of pending.values()) {
                texture.then((ready) => ready.destroy(true)).catch(() => undefined);
            }
            pending.clear();
        },
    };
}
