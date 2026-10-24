import type { RvArtKind, TimeOfDay } from './display';
import driveDawn from '../状态栏素材/房车配图/rv-drive-dawn.png';
import driveDay from '../状态栏素材/房车配图/rv-drive-day.png';
import driveDusk from '../状态栏素材/房车配图/rv-drive-dusk.png';
import driveNight from '../状态栏素材/房车配图/rv-drive-night.png';
import parkDawn from '../状态栏素材/房车配图/rv-park-dawn.png';
import parkDay from '../状态栏素材/房车配图/rv-park-day.png';
import parkDusk from '../状态栏素材/房车配图/rv-park-dusk.png';
import parkNight from '../状态栏素材/房车配图/rv-park-night.png';
import expandDawn from '../状态栏素材/房车配图/rv-expand-dawn.png';
import expandDay from '../状态栏素材/房车配图/rv-expand-day.png';
import expandDusk from '../状态栏素材/房车配图/rv-expand-dusk.png';
import expandNight from '../状态栏素材/房车配图/rv-expand-night.png';

/** 行车状态 × 拓展状态 × 时段共 12 张，构建时缩放到 888 像素宽并编码为 WebP。 */
export const rvArt: Record<RvArtKind, Record<TimeOfDay, string>> = {
  drive: { dawn: driveDawn, day: driveDay, dusk: driveDusk, night: driveNight },
  park: { dawn: parkDawn, day: parkDay, dusk: parkDusk, night: parkNight },
  expand: { dawn: expandDawn, day: expandDay, dusk: expandDusk, night: expandNight },
};
