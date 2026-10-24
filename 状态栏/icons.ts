import {
  PhArrowsOut,
  PhCalendarBlank,
  PhCaretDown,
  PhCaretUp,
  PhChatCircleDots,
  PhClock,
  PhCloudSun,
  PhCoffee,
  PhDrop,
  PhGear,
  PhGasPump,
  PhLightning,
  PhMapPin,
  PhMoney,
  PhMountains,
  PhTruck,
  PhUser,
  PhUsers,
  PhUsersThree,
  PhWrench,
} from '@phosphor-icons/vue';
import mapPerson from '../状态栏素材/图形/map-person.svg';
import mapRv from '../状态栏素材/图形/map-rv.svg';

/** 面板内图标统一使用 Phosphor fill。 */
export const panelIcons = {
  person: PhUser,
  companions: PhUsers,
  fans: PhUsersThree,
  location: PhMapPin,
  coffee: PhCoffee,
  coins: PhMoney,
  calendar: PhCalendarBlank,
  time: PhClock,
  weather: PhCloudSun,
  wrench: PhWrench,
  expansion: PhArrowsOut,
  fuel: PhGasPump,
  power: PhLightning,
  water: PhDrop,
  'region-mountains': PhMountains,
  thought: PhChatCircleDots,
  rv: PhTruck,
  gear: PhGear,
  'chevron-up': PhCaretUp,
  'chevron-down': PhCaretDown,
};
export type RvIconName = keyof typeof panelIcons;

/** 地图标记由高德 iframe 以 HTML 字符串插入，图例必须与标记同一图形，因此两处共用这两个 SVG。 */
export const mapIcons = { traveller: mapPerson, rv: mapRv };
export type RvMapIconName = keyof typeof mapIcons;
export function iconMarker(name: RvMapIconName): string {
  return `<img class="rv-icon" data-icon="${name}" data-purpose="map" src="${mapIcons[name]}" alt="" aria-hidden="true" draggable="false" style="display:inline-block;width:${name === 'rv' ? 32 : 24}px;height:${name === 'rv' ? 18 : 24}px;object-fit:contain;vertical-align:middle;pointer-events:none">`;
}
