CREATE TABLE "世界信息" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  "标识" TEXT NOT NULL DEFAULT '世界'
    CHECK ("标识" = '世界'),

  "日期时间" TEXT NOT NULL DEFAULT '未知'
    CHECK (
      "日期时间" = '未知'
      OR "日期时间" GLOB
        '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]'
    ), -- YYYY-MM-DD HH:mm
  "国家" TEXT NOT NULL DEFAULT '未知',
  "省份" TEXT NOT NULL DEFAULT '未知',
  "城市" TEXT NOT NULL DEFAULT '未知',
  "区域" TEXT NOT NULL DEFAULT '未知',
  "天气" TEXT NOT NULL DEFAULT '未知'
);

CREATE TABLE "房车信息" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  "标识" TEXT NOT NULL DEFAULT '房车'
    CHECK ("标识" = '房车'),

  "油料" REAL NOT NULL CHECK ("油料" >= 0),         -- 升，主副油箱合计
  "储备电力" REAL NOT NULL CHECK ("储备电力" >= 0), -- kWh
  "储备水源" REAL NOT NULL CHECK ("储备水源" >= 0), -- 升，仅清水

  "状态" TEXT NOT NULL DEFAULT '未知',
  "行车状态" TEXT NOT NULL DEFAULT '驻车'
    CHECK ("行车状态" IN ('行车', '驻车')),
  "拓展状态" TEXT NOT NULL DEFAULT '收起'
    CHECK ("拓展状态" IN ('收起', '展开')),
  "所在地点" TEXT NOT NULL DEFAULT '未知'
);

CREATE TABLE "主角信息" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  "标识" TEXT NOT NULL DEFAULT '主角'
    CHECK ("标识" = '主角'),

  "当前位置" TEXT NOT NULL DEFAULT '未知',
  "状态" TEXT NOT NULL DEFAULT '未知',
  "资金" INTEGER NOT NULL CHECK ("资金" >= 0),         -- 可支配资金，人民币元
  "粉丝数量" INTEGER NOT NULL CHECK ("粉丝数量" >= 0)  -- 全平台合计
);

CREATE TABLE "角色信息" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  -- 仅记录 NPC，以姓名作为业务定位键
  "姓名" TEXT NOT NULL,
  "昵称" TEXT NOT NULL DEFAULT '未知',
  "年龄" INTEGER NOT NULL,
  "身份" TEXT NOT NULL DEFAULT '未知',

  "生活背景" TEXT NOT NULL DEFAULT '未知',
  "当前处境" TEXT NOT NULL DEFAULT '未知',

  "相貌" TEXT NOT NULL DEFAULT '未知',
  "身材" TEXT NOT NULL DEFAULT '未知',
  "穿着" TEXT NOT NULL DEFAULT '未知',

  "胸部特征" TEXT NOT NULL DEFAULT '未知',
  "私处外观" TEXT NOT NULL DEFAULT '未知',
  "私处内部构造" TEXT NOT NULL DEFAULT '未知',
  "性经验" TEXT NOT NULL DEFAULT '未知',
  "性爱插入体验" TEXT NOT NULL DEFAULT '未知',
  "性爱技巧与偏好" TEXT NOT NULL DEFAULT '未知',
  "性爱生理反应" TEXT NOT NULL DEFAULT '未知',

  "核心特质" TEXT NOT NULL DEFAULT '未知',
  "行为模式" TEXT NOT NULL DEFAULT '未知',
  "相遇情境" TEXT NOT NULL DEFAULT '未知',
  "在意与反感" TEXT NOT NULL DEFAULT '未知',
  "对主角观感" TEXT NOT NULL DEFAULT '未知',

  "说话风格" TEXT NOT NULL DEFAULT '未知',

  "好感度" INTEGER NOT NULL CHECK ("好感度" BETWEEN -100 AND 100),
  "当前位置" TEXT NOT NULL DEFAULT '未知',
  "同行状态" TEXT NOT NULL DEFAULT '未知',
  "状态" TEXT NOT NULL DEFAULT '未知',
  "心声" TEXT NOT NULL DEFAULT '未知'
);

CREATE TABLE "房车物资" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  -- 仅记录额外物资，以物品名作为业务定位键
  "物品名" TEXT NOT NULL,
  "数量" INTEGER NOT NULL CHECK (typeof("数量") = 'integer' AND "数量" >= 0),
  "单位" TEXT NOT NULL DEFAULT '未知',
  "说明" TEXT NOT NULL DEFAULT '未知',
  "状态" TEXT NOT NULL DEFAULT '未知',
  "存放位置" TEXT NOT NULL DEFAULT '未知'
);

CREATE TABLE "随身物品" (
  "rid" BLOB PRIMARY KEY NOT NULL DEFAULT (randomblob(16))
    CHECK (typeof("rid") = 'blob' AND length("rid") = 16),

  -- 以持有人与物品名共同定位；主角使用玩家实际姓名，NPC 使用角色信息中的姓名
  "持有人" TEXT NOT NULL,
  "物品名" TEXT NOT NULL,
  "数量" REAL NOT NULL CHECK ("数量" >= 0),
  "单位" TEXT NOT NULL DEFAULT '未知',
  "说明" TEXT NOT NULL DEFAULT '未知',
  "状态" TEXT NOT NULL DEFAULT '未知'
);
