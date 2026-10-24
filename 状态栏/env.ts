import type { BusinessDatabaseHandle, PublicError } from '../types/sqlite-helper/sqlite-helper';

export interface AmapConfig { key: string; securityJsCode: string; }
export interface AmapConfigSaved { config: AmapConfig; committed: true; persisted: false; message: string; }
export class AmapEnvError extends Error {
  constructor(message: string, readonly canRetry: boolean, readonly requiresReadback = false, options?: ErrorOptions) {
    super(message, options); this.name = 'AmapEnvError';
  }
}
const empty = (): AmapConfig => ({ key: '', securityJsCode: '' });
function fields(error: unknown): Partial<PublicError> {
  return error && typeof error === 'object' ? error as Partial<PublicError> : {};
}
async function tableExists(char: BusinessDatabaseHandle): Promise<boolean> {
  const result = await char.query("SELECT name FROM sqlite_master WHERE type='table' AND name='env'");
  return result.rows.length > 0;
}
async function assertSchema(char: BusinessDatabaseHandle): Promise<void> {
  const result = await char.query('SELECT name, type, "notnull", pk FROM pragma_table_info(?)', ['env']);
  const index = (name: string) => result.columns.indexOf(name);
  const columns = result.rows.map(row => ({ name: row[index('name')], type: row[index('type')], notnull: row[index('notnull')], pk: row[index('pk')] }));
  const key = columns.find(column => column.name === 'key'), value = columns.find(column => column.name === 'value');
  if (columns.length !== 2 || String(key?.type).toUpperCase() !== 'TEXT' || key?.notnull !== 1 || key.pk !== 1 || String(value?.type).toUpperCase() !== 'TEXT' || value?.notnull !== 1 || value.pk !== 0) {
    throw new AmapEnvError('当前角色已有的 env 表与地图配置要求不兼容，未修改原表。', false);
  }
}
export async function readAmapConfig(char: BusinessDatabaseHandle | null): Promise<AmapConfig> {
  if (!char) throw new AmapEnvError('请先打开房车角色聊天', false);
  try {
    if (!await tableExists(char)) return empty();
    await assertSchema(char);
    const result = await char.query('SELECT key, value FROM env WHERE key IN (?, ?)', ['amap_key', 'amap_sec']);
    const config = empty(), keyIndex = result.columns.indexOf('key'), valueIndex = result.columns.indexOf('value');
    for (const row of result.rows) {
      if (typeof row[valueIndex] !== 'string') throw new AmapEnvError('地图配置值不是文本，未修改原数据。', false);
      if (row[keyIndex] === 'amap_key') config.key = row[valueIndex] as string;
      if (row[keyIndex] === 'amap_sec') config.securityJsCode = row[valueIndex] as string;
    }
    return config;
  } catch (error) {
    if (fields(error).code === 'DB_UNINITIALIZED') return empty();
    throw error;
  }
}
/** The caller captures char once at submit time and discards the result if its role has changed. */
export async function saveAmapConfig(char: BusinessDatabaseHandle | null, input: AmapConfig): Promise<AmapConfigSaved> {
  if (!char) throw new AmapEnvError('请先打开房车角色聊天', false);
  const config = { key: input.key.trim(), securityJsCode: input.securityJsCode.trim() };
  if (!config.key || !config.securityJsCode) throw new AmapEnvError('请填写地图 Key 和安全密钥', true);
  // Querying an uninitialized char database must not create it just to show the form.
  try { if (await tableExists(char)) await assertSchema(char); }
  catch (error) { if (fields(error).code !== 'DB_UNINITIALIZED') throw error; }
  try {
    const result = await char.transaction([
      { sql: 'CREATE TABLE IF NOT EXISTS env (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)' },
      { sql: 'INSERT INTO env (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', binds: ['amap_key', config.key] },
      { sql: 'INSERT INTO env (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', binds: ['amap_sec', config.securityJsCode] },
    ]);
    if (result.committed !== true || result.persisted !== false) throw new AmapEnvError('助手未返回可确认的配置写入结果，请重新读取已存配置核对。', false, true);
    let stored: AmapConfig;
    try { stored = await readAmapConfig(char); }
    catch (error) { throw new AmapEnvError(fields(error).message ?? String(error), false, true, { cause: error }); }
    if (stored.key !== config.key || stored.securityJsCode !== config.securityJsCode) {
      throw new AmapEnvError('配置已提交，但读回值与本次输入不同，请重新读取已存配置核对。', false, true);
    }
    return { config: stored, committed: true, persisted: false, message: '配置已写入，文件由助手在后台保存' };
  } catch (error) {
    if (error instanceof AmapEnvError) throw error;
    const details = fields(error), uncertain = ['SQL_COMMITTED', 'SQL_SAVED', 'SQL_UNKNOWN'].includes(details.code ?? '');
    const canRetry = !uncertain && (details.executionState === 'not-started' || details.executionState === 'rolled-back');
    throw new AmapEnvError(details.message ?? String(error), canRetry, uncertain || !canRetry, { cause: error });
  }
}

