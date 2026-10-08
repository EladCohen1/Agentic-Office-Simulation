import { contextBridge } from 'electron';

import type { PreloadApi } from '../shared/preload-api';

const api: PreloadApi = {};

contextBridge.exposeInMainWorld('api', api);
