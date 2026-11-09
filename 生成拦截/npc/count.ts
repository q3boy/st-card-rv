export function hasNpcCount(params: unknown): params is { count: number } {
  if (!params || typeof params !== 'object' || !('count' in params)) return false;
  return typeof params.count === 'number' && Number.isInteger(params.count) && params.count > 0;
}
