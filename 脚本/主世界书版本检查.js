await waitGlobalInitialized('DVS');
await DVS.lorebookVersionCheck({ onExpired: 'AUTO_UPDATE' });
