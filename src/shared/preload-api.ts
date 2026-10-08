/**
 * The API preload exposes to the renderer as `window.api`. Each feature adds its purpose-specific
 * functions here, backed by channels defined in `src/shared/ipc/`.
 */
export type PreloadApi = Record<string, never>;
