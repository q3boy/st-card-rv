export interface Viewport { left: number; top: number; width: number; height: number }
export interface Point { x: number; y: number }
export interface Size { width: number; height: number }
export interface ViewportWindow {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: Pick<VisualViewport, 'offsetLeft' | 'offsetTop' | 'width' | 'height'> | null;
}

/** 浏览器已经以 CSS px 返回可见区域，不再乘缩放或显示密度。 */
export function measureViewport(win: ViewportWindow): Viewport {
  const viewport = win.visualViewport;
  return viewport
    ? { left: viewport.offsetLeft, top: viewport.offsetTop, width: viewport.width, height: viewport.height }
    : { left: 0, top: 0, width: win.innerWidth, height: win.innerHeight };
}

export function availableSize(viewport: Viewport, margin = 8): Size {
  return { width: Math.max(0, viewport.width < margin * 2 ? viewport.width : viewport.width - margin * 2),
    height: Math.max(0, viewport.height < margin * 2 ? viewport.height : viewport.height - margin * 2) };
}

/** 调用方先限制元素尺寸并读回 DOM 实际尺寸；空间不足时逐轴缩小边距。 */
export function fitPosition(point: Point, size: Size, viewport: Viewport, margin = 8): Point {
  function fit(value: number, start: number, extent: number, length: number) {
    const room = Math.max(0, extent - length);
    const inset = Math.min(Math.max(0, margin), room / 2);
    const lower = start + inset;
    const upper = start + Math.max(inset, room - inset);
    return Math.min(upper, Math.max(lower, value));
  }
  return { x: fit(point.x, viewport.left, viewport.width, size.width),
    y: fit(point.y, viewport.top, viewport.height, size.height) };
}

