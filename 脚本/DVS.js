$(async () => {
  const relationshipStage = affection => {
    if (affection < -70) return '敌视';
    if (affection < -40) return '厌恶';
    if (affection < -10) return '反感';
    if (affection <= 10) return '冷淡';
    if (affection <= 40) return '友善';
    if (affection <= 70) return '亲近';
    return '亲密';
  };
  const object = (value, name) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${name}必须是对象`);
    }
    return value;
  };
  const amount = (value, name, fallback) => {
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new Error(`${name}必须是非负有限数值`);
    }
    return value;
  };
  const resourceField = resource => {
    if (resource === '油') return '油料';
    if (resource === '电') return '储备电力';
    if (resource === '水') return '储备水源';
    throw new Error('补给或额外消耗的资源必须是油、电或水');
  };
  const settle = (_state, newTables, oldTables) => {
    const rows = newTables.本轮结算 ?? [];
    const oldVehicle = oldTables.房车信息.find(row => row.标识 === '房车');
    const vehicle = newTables.房车信息.find(row => row.标识 === '房车');
    if (rows.length > 1) throw new Error('本轮结算只能有一行');
    if (!oldVehicle || !vehicle) {
      if (rows.length) throw new Error('本轮结算缺少房车起点或结果数据');
      delete newTables.本轮结算;
      return newTables;
    }
    const capacity = { 油料: 1000, 储备电力: 72, 储备水源: 1000 };
    const storage = {};
    for (const field of Object.keys(capacity)) {
      storage[field] = Math.min(capacity[field], amount(oldVehicle[field], `起点${field}`));
    }
    const change = (field, quantity) => {
      storage[field] = Math.max(0, Math.min(capacity[field], storage[field] + quantity));
    };
    const supply = (field, value, name) => {
      if (value === 'FULL') storage[field] = capacity[field];
      else change(field, amount(value, name));
    };
    if (rows.length) {
      const settlement = object(rows[0], '本轮结算');
      const itinerary = settlement.行程 === undefined ? [] : settlement.行程;
      if (!Array.isArray(itinerary)) throw new Error('本轮结算.行程必须是数组');
      const ongoing = object(settlement.持续补充 === undefined ? {} : settlement.持续补充, '本轮结算.持续补充');
      for (const [index, item] of itinerary.entries()) {
        const event = object(item, `行程第${index + 1}项`);
        if (event.类型 === '行车' || event.类型 === '驻车' || event.类型 === '外出') {
          const hours = amount(event.时间, '活动时间') / 60;
          if (event.类型 === '行车') {
            if (event.道路类型 !== '铺装' && event.道路类型 !== '非铺装') {
              throw new Error('行车道路类型必须是铺装或非铺装');
            }
            change('油料', -amount(event.距离, '行车距离') * (event.道路类型 === '铺装' ? 0.35 : 0.50));
            // 行车耗电与行车充电合并后再限制容量。
            change('储备电力', hours * (1.0 - 0.5));
            change('储备水源', -hours * 2.5);
          } else if (event.类型 === '驻车') {
            change('油料', -hours * 0.1);
            change('储备电力', -hours * 0.8);
            change('储备水源', -hours * 2.5);
          } else {
            change('储备电力', -hours * 0.1);
          }
        } else if (event.类型 === '补给') {
          supply(resourceField(event.资源), event.数量, '补给数量');
        } else if (event.类型 === '额外消耗') {
          change(resourceField(event.资源), -amount(event.数量, '额外消耗数量'));
        } else {
          throw new Error(`行程第${index + 1}项的类型无效`);
        }
      }
      change('储备电力', amount(ongoing.太阳能时长, '太阳能时长', 0) / 60 * 1.5);
      change('储备电力', amount(ongoing.风电时长, '风电时长', 0) / 60 * 0.6);
      if (ongoing.雨水收集 !== undefined) {
        const rain = object(ongoing.雨水收集, '雨水收集');
        change('储备水源', amount(rain.时长, '降雨时长') / 60 * amount(rain.平均降雨强度, '平均降雨强度') * 14);
      }
    }
    // 修正二进制浮点末位误差，例如1000 - 0.35应取为999.7，而不是999.6。
    const round = (value, digits) => {
      const scale = 10 ** digits;
      return Math.round((value + Number.EPSILON * Math.max(1, value)) * scale) / scale;
    };
    vehicle.油料 = round(storage.油料, 1);
    vehicle.储备电力 = round(storage.储备电力, 2);
    vehicle.储备水源 = round(storage.储备水源, 1);
    delete newTables.本轮结算;
    return newTables;
  };
  const lifetime = new AbortController();
  $(window).one('pagehide', () => lifetime.abort());
  try {
    await waitGlobalInitialized('DVS');
    await DVS.register({
      scriptId: getScriptId(),
      uniqueKeys: {
        世界信息: ['标识'],
        房车信息: ['标识'],
        主角信息: ['标识'],
        角色信息: ['姓名'],
        房车物资: ['物品名'],
        随身物品: ['持有人', '物品名'],
      },
      virtualTables: {
        本轮结算: { keys: [], fields: { 行程: 'array', 持续补充: 'object' } },
      },
      narrativePrepare: ({ tables }) => ({
        ...tables,
        角色信息: DVS.table('角色信息', tables.角色信息.map(row => {
          const person = { ...row, 关系阶段: relationshipStage(row.好感度) };
          if (row.同行状态 !== '已离开') return person;
          return Object.fromEntries(
            ['姓名', '年龄', '身份', '生活背景', '关系阶段', '对主角观感', '同行状态']
              .map(field => [field, person[field]]),
          );
        }))
          .excludeFields(['相遇情境', '好感度'])
          .excludeValues('未知')
          .rows(),
        房车物资: DVS.table('房车物资')
          .replaceValues('未知', '')
          .rows(),
        随身物品: DVS.table('随身物品')
          .replaceValues('未知', '')
          .rows(),
      }),
      beforeGen: (_state, tables) => tables,
      preUpdate: settle,
    }, { signal: lifetime.signal });
  } catch (error) {
    console.error('角色卡 DVS 初始化或注册失败：', error);
  }
});
