await waitGlobalInitialized('DVS');
// 玩家确认后，DVS 等酒馆回复备份成功，再用卡内世界书覆盖原书。
await DVS.lorebookVersionCheck({ onExpired: 'AUTO_UPDATE' });
