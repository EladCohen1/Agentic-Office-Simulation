import type { PreloadApi } from '../shared/preload-api';

declare global {
    interface Window {
        api: PreloadApi;
    }
}
