import { expect, test } from 'bun:test';
import type { BusinessDatabaseHandle, SqlBinds } from '../../types/sqlite-helper/sqlite-helper';
import { AmapEnvError, readAmapConfig, saveAmapConfig } from '../../状态栏/env';
import { gate, sqlJs } from '../support/database';

// 地图配置只使用字符串位置参数；其它公开绑定类型由 Helper 自身测试负责。
function stringBinds(binds?: SqlBinds): string[] {
  if (binds === undefined) return [];
  if (!Array.isArray(binds) || binds.some(value => typeof value !== 'string'))
    throw new Error('地图测试只支持字符串位置参数');
  return binds as string[];
}

async function charDatabase(bytes?: Uint8Array) {
  const SQL = await sqlJs(),
    database = new SQL.Database(bytes);
  let transactions = 0;
  const handle: BusinessDatabaseHandle = {
    debounce() {
      return this;
    },
    async query(sql, binds) {
      const result = database.exec(sql, stringBinds(binds))[0];
      return { columns: result?.columns ?? [], rows: result?.values ?? [] };
    },
    async transaction(commands) {
      transactions++;
      database.run('BEGIN');
      try {
        for (const command of commands) database.run(command.sql, stringBinds(command.binds));
        database.run('COMMIT');
        return { committed: true, persisted: false };
      } catch (error) {
        database.run('ROLLBACK');
        throw {
          code: 'SQL_FAILED',
          message: error instanceof Error ? error.message : String(error),
          executionState: 'rolled-back',
        };
      }
    },
    async update() {
      throw new Error('不使用单独写入');
    },
    async exec() {
      throw new Error('不使用单独写入');
    },
    async runSql() {
      throw new Error('不使用单独写入');
    },
  };
  return {
    database,
    handle,
    get transactions() {
      return transactions;
    },
  };
}
test('查询无表不创建，保存一次事务创建两项；UPSERT保留其它键，导出字节重开相同', async () => {
  const first = await charDatabase();
  try {
    expect(await readAmapConfig(first.handle)).toEqual({ key: '', securityJsCode: '' });
    expect(first.database.exec("SELECT name FROM sqlite_master WHERE name='env'")).toEqual([]);
    const input = { key: " Key ' $() <tag> ", securityJsCode: " security ' \n other " };
    const saved = await saveAmapConfig(first.handle, input);
    expect(saved.config).toEqual({ key: input.key.trim(), securityJsCode: input.securityJsCode.trim() });
    expect(saved.persisted).toBe(false);
    expect(saved.message).toContain('后台保存');
    expect(first.transactions).toBe(1);
    first.database.run("INSERT INTO env VALUES ('other', 'keep')");
    await saveAmapConfig(first.handle, { key: 'new', securityJsCode: 'new-sec' });
    expect(first.database.exec("SELECT value FROM env WHERE key='other'")[0]?.values).toEqual([['keep']]);
    const reopened = await charDatabase(first.database.export());
    try {
      expect(await readAmapConfig(reopened.handle)).toEqual({ key: 'new', securityJsCode: 'new-sec' });
    } finally {
      reopened.database.close();
    }
  } finally {
    first.database.close();
  }
});
test('char为空、未初始化与已有文件缺失/权限错误分别交付', async () => {
  await expect(readAmapConfig(null)).rejects.toThrow('请先打开房车角色聊天');
  await expect(saveAmapConfig(null, { key: 'key', securityJsCode: 'sec' })).rejects.toThrow('请先打开房车角色聊天');
  for (const code of ['DB_UNINITIALIZED', 'DB_MISSING', 'AUTH_DENIED', 'SYS_FAILED']) {
    const failure = { code, message: `${code}原错误` },
      database = await charDatabase();
    try {
      const handle = {
        ...database.handle,
        async query() {
          throw failure;
        },
      };
      if (code === 'DB_UNINITIALIZED') expect(await readAmapConfig(handle)).toEqual({ key: '', securityJsCode: '' });
      else {
        await expect(readAmapConfig(handle)).rejects.toBe(failure);
        await expect(saveAmapConfig(handle, { key: 'k', securityJsCode: 's' })).rejects.toBe(failure);
      }
    } finally {
      database.database.close();
    }
  }
});
test('不兼容的env拒绝保存，不DROP或迁移原表', async () => {
  const db = await charDatabase();
  try {
    db.database.run("CREATE TABLE env (key TEXT, value TEXT); INSERT INTO env VALUES ('old', 'keep')");
    await expect(readAmapConfig(db.handle)).rejects.toThrow('不兼容');
    await expect(saveAmapConfig(db.handle, { key: 'new', securityJsCode: 'sec' })).rejects.toThrow('不兼容');
    expect(db.transactions).toBe(0);
    expect(db.database.exec('SELECT * FROM env')[0]?.values).toEqual([['old', 'keep']]);
  } finally {
    db.database.close();
  }
});
test('缺少任一输入时不提交；小写TEXT声明也是相同表结构', async () => {
  const db = await charDatabase();
  try {
    await expect(saveAmapConfig(db.handle, { key: ' ', securityJsCode: 'sec' })).rejects.toThrow('请填写');
    await expect(saveAmapConfig(db.handle, { key: 'key', securityJsCode: '' })).rejects.toThrow('请填写');
    expect(db.transactions).toBe(0);
    db.database.run('CREATE TABLE env (key text PRIMARY KEY NOT NULL, value text NOT NULL)');
    expect((await saveAmapConfig(db.handle, { key: 'key', securityJsCode: 'sec' })).config.key).toBe('key');
  } finally {
    db.database.close();
  }
});
test('提交成功后读回失败不会诱导重发或继续加载地图', async () => {
  const db = await charDatabase();
  let committed = false;
  try {
    const handle: BusinessDatabaseHandle = {
      ...db.handle,
      async query(sql, binds) {
        if (committed) throw { code: 'AUTH_DENIED', message: '读回权限错误' };
        return db.handle.query(sql, binds);
      },
      async transaction(commands) {
        const result = await db.handle.transaction(commands);
        committed = true;
        return result;
      },
    };
    let error: unknown;
    try {
      await saveAmapConfig(handle, { key: 'key', securityJsCode: 'sec' });
    } catch (failure) {
      error = failure;
    }
    expect((error as AmapEnvError).message).toBe('读回权限错误');
    expect((error as AmapEnvError).canRetry).toBe(false);
    expect((error as AmapEnvError).requiresReadback).toBe(true);
    expect(db.transactions).toBe(1);
    expect(await readAmapConfig(db.handle)).toEqual({ key: 'key', securityJsCode: 'sec' });
  } finally {
    db.database.close();
  }
});
test('第二项失败时第一项一起回滚，输入不被修改', async () => {
  const db = await charDatabase();
  try {
    await saveAmapConfig(db.handle, { key: 'old', securityJsCode: 'old-sec' });
    db.database.run(
      "CREATE TRIGGER reject_sec BEFORE UPDATE ON env WHEN NEW.key='amap_sec' BEGIN SELECT RAISE(ABORT, '不能写第二项'); END",
    );
    const input = { key: ' new ', securityJsCode: ' sec ' };
    let error: unknown;
    try {
      await saveAmapConfig(db.handle, input);
    } catch (failure) {
      error = failure;
    }
    expect(error).toBeInstanceOf(AmapEnvError);
    expect((error as AmapEnvError).canRetry).toBe(true);
    expect(await readAmapConfig(db.handle)).toEqual({ key: 'old', securityJsCode: 'old-sec' });
    expect(input).toEqual({ key: ' new ', securityJsCode: ' sec ' });
  } finally {
    db.database.close();
  }
});
test.each(['SQL_COMMITTED', 'SQL_SAVED', 'SQL_UNKNOWN'])('%s不报告正常成功、不重发，要求重新读取核对', async code => {
  const db = await charDatabase();
  let calls = 0;
  try {
    const handle = {
      ...db.handle,
      async transaction() {
        calls++;
        throw { code, message: '助手原错误', executionState: 'unknown' };
      },
    };
    let error: unknown;
    try {
      await saveAmapConfig(handle, { key: 'key', securityJsCode: 'sec' });
    } catch (failure) {
      error = failure;
    }
    expect(calls).toBe(1);
    expect((error as AmapEnvError).message).toBe('助手原错误');
    expect((error as AmapEnvError).canRetry).toBe(false);
    expect((error as AmapEnvError).requiresReadback).toBe(true);
  } finally {
    db.database.close();
  }
});
test('保存期间角色切换不把写入送到新角色代理', async () => {
  const old = await charDatabase(),
    next = await charDatabase(),
    entered = gate(),
    release = gate();
  const fixed = {
    ...old.handle,
    async transaction(commands: Parameters<BusinessDatabaseHandle['transaction']>[0]) {
      entered.release();
      await release.promise;
      return old.handle.transaction(commands);
    },
  };
  let current = fixed as BusinessDatabaseHandle;
  try {
    const pending = saveAmapConfig(current, { key: 'old-role', securityJsCode: 'sec' });
    await entered.promise;
    current = next.handle;
    release.release();
    await pending;
    expect(await readAmapConfig(old.handle)).toEqual({ key: 'old-role', securityJsCode: 'sec' });
    expect(await readAmapConfig(current)).toEqual({ key: '', securityJsCode: '' });
  } finally {
    old.database.close();
    next.database.close();
  }
});
