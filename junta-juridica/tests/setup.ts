import { beforeEach, afterEach, vi } from 'vitest';
beforeEach(()=>{vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('NETWORK_FORBIDDEN_IN_OFFLINE_TEST');}));});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
