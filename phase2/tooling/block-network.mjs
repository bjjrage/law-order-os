// Preload for offline CLI verification; accidental fetch cannot leave this process.
globalThis.fetch=async()=>{throw new Error('NETWORK_FORBIDDEN_IN_PHASE2_OFFLINE_VERIFICATION');};
