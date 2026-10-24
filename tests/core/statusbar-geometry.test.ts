import { describe, expect, test } from 'bun:test';
import { availableSize, fitPosition, measureViewport } from '../../状态栏/geometry';

describe('房车可见窗口与拖动', () => {
  const viewport = { left: 20, top: 30, width: 400, height: 300 };
  test('可见窗口偏移直接使用 CSS px，缺少 visualViewport 时回退', () => {
    expect(
      measureViewport({
        innerWidth: 1000,
        innerHeight: 900,
        visualViewport: { offsetLeft: 20, offsetTop: 30, width: 400, height: 300 },
      }),
    ).toEqual(viewport);
    expect(measureViewport({ innerWidth: 320, innerHeight: 240 })).toEqual({
      left: 0,
      top: 0,
      width: 320,
      height: 240,
    });
  });
  test('四边和四角均回到窗口内', () => {
    for (const x of [-1000, 200, 1000])
      for (const y of [-1000, 150, 1000]) {
        const p = fitPosition({ x, y }, { width: 100, height: 80 }, viewport);
        expect(p.x).toBeGreaterThanOrEqual(28);
        expect(p.x + 100).toBeLessThanOrEqual(412);
        expect(p.y).toBeGreaterThanOrEqual(38);
        expect(p.y + 80).toBeLessThanOrEqual(322);
      }
  });
  test('元素大小变化后重新限制坐标', () => {
    expect(fitPosition({ x: 312, y: 242 }, { width: 300, height: 200 }, viewport)).toEqual({ x: 112, y: 122 });
  });
  test('极小窗口有序区间，不将超过尺寸的元素定位到窗口之前', () => {
    const small = { left: 20, top: 30, width: 10, height: 5 };
    expect(availableSize(small)).toEqual({ width: 10, height: 5 });
    expect(fitPosition({ x: 999, y: -999 }, { width: 10, height: 5 }, small)).toEqual({ x: 20, y: 30 });
    expect(fitPosition({ x: -999, y: 999 }, { width: 11, height: 6 }, small)).toEqual({ x: 20, y: 30 });
    expect(fitPosition({ x: 999, y: 999 }, { width: 8, height: 3 }, small)).toEqual({ x: 21, y: 31 });
  });
});
