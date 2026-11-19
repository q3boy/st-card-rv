# 房车卡文档

这里维护「房车慢生活」的当前设计、作者业务规则、构建和验证方法。角色卡源文件位于上级目录，生产配图与用于排版参考的旧效果图分开维护。

## 阅读入口

| 你要做什么 | 文档 |
| --- | --- |
| 理解旅行手册的布局、四时段主题、配图、交互和数据读取 | [状态栏设计](状态栏设计.md) |
| 修改状态栏、ShadowRoot 样式、注册订阅或自动化测试 | [代码设计与测试方案](状态栏代码设计与测试方案.md) |
| 调整正文资料筛选、旅行规划、变量检查或油电水结算 | [场景与资源结算设计](房车场景与资源结算设计.md) |
| 修改 NPC 生成拦截的界面、请求或 YAML 解析 | [NPC 注册与挂载](../生成拦截/npc/index.ts)、[请求框架](../生成拦截/npc/requests.ts)、[人设解析](../生成拦截/npc/profile.ts) |
| 维护 12 张房车配图、地图 SVG、图标与许可 | [状态栏素材](状态栏素材.md) |
| 查四时段及深色界面的颜色 | [主色值表](状态栏主色值表.md) |
| 在获授权后部署真实酒馆验证、恢复数据 | [真实酒馆部署验证流程](真实酒馆部署验证流程.md) |
| 查询 DVS 公共接口和卡片接入 | [作者手册](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS作者使用手册.md)、[接口参考](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS接口与进阶用法.md) |

## 独立开发环境

在房车仓库根目录执行以下命令。使用 Bun 1.4.2、支持 `node --experimental-strip-types` 的 Node（至少 22.6.0）和本库 Playwright 所需的 Chromium；TypeScript 由本库依赖锁定为 6.0.3。

```sh
bun install --frozen-lockfile
bun x --no-install playwright install chromium
bun run typecheck
bun run test
bun run test:browser
bun run build:check
bun run docs:check
```

安装 npm 依赖不会安装 Node 或 Chromium。浏览器测试模拟 Helper、DVS 和高德接口，结果不等于真实酒馆或文件保存验收。

## 构建与测试命令

命令定义以 [package.json](../package.json) 为准，构建细节见 [build.ts](../scripts/build.ts)。

| 命令 | 作用 |
| --- | --- |
| `bun run test` | 运行 `tests/core` 房车业务与状态栏测试及 `tests/tools` 工具检查 |
| `bun run typecheck` | 用 Node 调用 vue-tsc，并检查测试 TypeScript |
| `bun run build:check` | 只生成隔离的状态栏和 DVS 作者构建，不复制到卡片脚本目录、不打包或推送角色卡 |
| `bun run build` | 构建并复制脚本，再用 `tavern_sync bundle 房车` 打包。若索引旁有 [compress-list.yaml](../compress-list.yaml)，按清单压缩输出 PNG 中的世界书正文、DVS 脚本和状态栏脚本。清单填写索引引用的打包文件路径，例如 `脚本/DVS.bundle.js` |
| `bun run build 0.1.3` | 先将 `index.yaml` 的 `版本` 和 `[DVS:版本]` 条目的 `内容` 都改为传入的版本号，再构建并打包 |
| `bun run build:sync` | 先执行 `build`，再执行 `tavern_sync push 房车` 推送到当前连接的酒馆 |
| `bun run test:browser [Playwright 参数]` | 隔离构建后运行 Chromium 模拟 Helper 浏览器测试，产物在 `.test-data/card-rv`；例如 `bun run test:browser --grep 地图` |
| `bun run sync <子命令> [参数]` | 使用本库 YAML 执行同步工具命令；例如 `bun run sync list`、`bun run sync bundle 房车`，推送前按部署流程确认目标 |
| `bun run encode-webp <PNG 目录> <输出目录>` | 将 `rv-*.png` 编码为同名 WebP；两目录均由调用者指定 |

`build` 会改写卡片脚本目录并生成角色卡 PNG。不传版本参数时保留现有版本；传参时先修改源文件，后续构建或打包失败也会保留已写入的版本号。只验证构建时运行 `bun run build:check`，默认输出到 `.test-data/card-rv/build`，可用环境变量 `CARD_RV_BUILD_DIR` 指定其他输出目录，相对路径以房车仓库根目录解析，绝对路径保持原位置。推送前的授权、专用卡准备、同步连接与读回见[真实酒馆部署验证流程](真实酒馆部署验证流程.md)。

## 公开声明与提交 hook

`types/sqlite-helper/` 保存完整公开声明副本，包含两个入口、依赖及随包提供的第三方声明；独立构建直接使用此副本。正常安装、构建和测试不读取父仓库、不触发同步。

需要提交前同步时，显式运行 `bun run hooks:install` 安装本库 pre-commit。已有默认 pre-commit 或其它 `core.hooksPath` 时安装器停止并说明如何合并，不覆写原 hook。hook 在房车按 `card/房车/` 挂载时尝试读取父库 `release/st-sqlite-helper/types`；来源不存在便保留副本并允许提交，来源存在但读取、复制或暂存失败会使提交失败。

也可运行 `bun run types:sync <声明目录>` 手工指定本地来源；省略参数使用同一默认位置，显式同步遇到来源不存在时报错。有变化时打印来源 `manifest.json` 中的版本（没有则显示未知）和增删改文件清单，同步并暂存本库声明目录。它只同步声明，不比较版本高低；不支持对该目录手工修改或部分暂存，提交前应核对暂存差异。构建工具副本各自维护，不随声明同步。

## 清理与工具

`bun run clean:test`（或 `bun run clean`）只清理本库 `.test-data/card-rv` 和固定的 `.test-data/evidence/房车地图提示与标识`，不接受自定义目录。其它专项证据及 `CARD_RV_BUILD_DIR` 自定义产物由所属轮次核对后处理。清理前先保存必要证据和恢复所需备份。

配图制作资料见 [tools/配图](../tools/配图/README.md)。已纳入版本管理的工具与资料随仓库保留；`人设图/`、生成的 `脚本/状态栏.js`、`脚本/DVS.bundle.js`、`dist/`、`.test-data/` 继续忽略。同步工具来源与许可见 [THIRD-PARTY-NOTICES](../THIRD-PARTY-NOTICES.md)，不自动运行 `sync update`。

## 记忆扩展

房车卡由作者在 `index.yaml` 的 DVS 脚本数据中启用记忆扩展。地点档案和剧情线索开启，角色档案和物品记录关闭，作者在 `写作要求` 中约定公历日期用 `YYYY-MM-DD`，年月用 `YYYY-MM`，需要保留的时刻用 `HH:mm`。地点按“地名·具体场所”书写，只填写剧情中已知的层级。其余记忆参数使用 DVS 默认值。角色记忆、地点记忆和逐楼剧情仍正常记录；玩家从记忆胶囊查看及管理，不能自行开关扩展。

## NPC 生成拦截

玩家提出“在营地遇到一对姐妹”时，输入增强可以先确定要生成两人。弹窗一次生成人设，玩家可以分别调整。只有确认整组后，才交给酒馆继续写正文。

### 触发与首次生成

可编辑的[作者脚本](../脚本/DVS.js)在已有的那一次 `DVS.register` 中注册 `npc_generate`。卡片启用 `pre_narr_ui`，并使用支持拦截参数和世界书取材的 SQLite Helper。[注册项](../生成拦截/npc/index.ts) · [DVS 生成拦截接口](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS接口与进阶用法.md#生成拦截)

玩家明确要求不生成新角色时跳过。其余情况，输入增强结合本轮输入、前文和可用规划，判断玩家是否希望新女性角色登场，或当前既无同行女性、也未在延续与已登场女性的互动。已有角色不计为新人。玩家指定人数时遵照要求，其余按情境安排 1 至 4 人。

人数通过 `context.params.count` 交给组件。首次请求和重试均须返回指定人数，姓名彼此不同。模型返回一个 `<npc_list>`，其中每人都是完整的 `<npc name="实际姓名">…</npc>`。人设 YAML 直接以资料分组为顶层，基础信息中的姓名须等于标签的 `name`，年龄须为至少 18 的整数。

### 查看和调整人设

弹窗固定使用白天配色。首人默认展开，其余折叠为摘要。每张卡保留基础信息、外貌与穿着、背景与处境、性格与表达、相遇与关系，以及独立的 NSFW 信息区。宽屏分栏，组件容器宽度不超过 650px 时改为单列。Vue 和 ShadowRoot 在打开界面时才创建。缺少适用的 Vue 环境时提示更新并重开角色，已有 DVS 注册、普通文字摘要和确认版正文交接仍可使用。[人设卡](../生成拦截/npc/ProfileCard.vue) · [布局](../生成拦截/npc/styles.css) · [界面挂载](../生成拦截/npc/view.ts)

玩家可从任一张卡发起调整。每张卡保留自己的输入，文本框未设长度上限。留空时，请模型重新构思该角色，保留同组关系和相遇背景。有输入时，按该要求修改，较新的要求优先。请求同时给出该角色的完整人设和同组其他人的当前人设。只在其他人已有描述受到影响时，才要求模型一并返回那个人。例如妹妹改名后，姐姐资料里记录的称呼也可能需要更正。

调整响应只列有变化的人物，每人仍须交付完整人设。优先用 `oldname` 匹配原名，未提供时用 `name`。组外人物忽略。一个原人物只能更新一次，更新后的姓名须互异。全部匹配项通过检查后按原次序一起替换，人数保持不变。空列表表示没有变化。请求或解析失败会保留整组候选和玩家输入，玩家可展开“查看详情”看本次错误及本次取得的模型返回。未取得返回时会明确显示。[弹窗](../生成拦截/npc/NpcGenerate.vue) · [解析与替换](../生成拦截/npc/profile.ts)

### 请求资料与临时历史

首次和调整请求都先按名读取“NPC生成机制”和“人设生成”。同名条目全部保留，先排机制，再排人设。缺少任一组会报错。组装资料时去掉全部 `[[DVS_FILTER:…]]` 声明，保留其余正文，展开酒馆宏。每条业务消息在统一发送处再展开一次 DVS 宏，带入最近正文、本轮输入和可用规划。[请求源码](../生成拦截/npc/requests.ts) · [生成机制](../世界书/NPC生成机制.txt) · [人设模板](../世界书/人设生成.txt)

每张卡只保留这次打开期间的成功调整历史。调整通过解析后，按 `ai`、`user` 顺序记录上次候选和本次实际发送的要求。失败不追加。取消后重新打开，只加载胶囊里的确认版，历史和未确认的编辑不会带入。

### 确认、正文和变量

玩家在底部点“确认人设并继续”。多人时按钮显示“确认 N 位人设并继续”，一次提交整组。等待请求期间无法确认，玩家仍可关闭或按 Esc 取消。结果的 `profile` 保存按卡片顺序排列的完整人设标签文本。胶囊逐人显示姓名、年龄和职业，沿用胶囊自身样式。打开“查看/重新生成NPC”直接展示确认版，需要调整时才请求模型。取消保留旧结果。

输入增强顶部的“重新生成”会重做整组任务。命中 NPC 交互时，DVS 保存确认的人设后，还会等待 `toPrompt` 返回。这次操作不生成正文。回调报错时，已保存的人设仍在。

确认保存后，本轮正文屏蔽“NPC生成机制”和“人设生成”两个条目，采用玩家确认的人设。重新生成正文时也应用当前注册项的屏蔽名单。`toPrompt` 把完整标签逐人交给正文模型，要求在回复末尾原样输出。外层的 `<npc_list>` 和用于匹配改名的 `oldname` 都只用于弹窗响应。新增角色发生在后续变量更新。正文缺少某人的标签时，房车规则不会仅凭胶囊新增该人。[注册和屏蔽名单](../生成拦截/npc/index.ts) · [正文标签与资料](../生成拦截/npc/profile.ts) · [角色信息规则](../世界书/DVS-RULES_角色信息.yaml)

卡片索引引用构建产物 `脚本/DVS.bundle.js`。修改作者脚本或组件后，先构建再打包或同步。`build:check` 在隔离目录生成 `DVS.js`、`状态栏.js` 和记录源码及产物哈希的 `build.json`。[构建脚本](../scripts/build.ts) · [请求测试](../tests/core/npc-requests.test.ts) · [人设解析测试](../tests/core/npc-profile.test.ts) · [界面测试](../tests/browser/npc-generate.spec.ts)

## 职责边界

[安装引导脚本](../脚本/install.js)通过 CDN import 加载 SQLite Helper 的安装与更新引导，随角色脚本启用。缺少插件时由玩家确认安装；正式 Git 版有更新时由玩家确认更新，成功后再选择是否刷新。运行需要联网，脚本自身的后续更新在重新加载且 CDN 缓存更新后生效。它不替代 DVS 的接口等待与业务注册，具体行为见[安装引导说明](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/使用/安装引导脚本.md)。

[主世界书版本检查脚本](../脚本/主世界书版本检查.js)启动时独立调用一次 `DVS.lorebookVersionCheck({ onExpired: 'AUTO_UPDATE' })`，与变量注册没有先后要求。主书版本落后时，玩家可选择「备份并更新」。DVS 收到酒馆的备份成功回复后，用卡内世界书覆盖原书，角色继续使用同一书名。成功后点击「刷新页面」生效；备份未确认时原书保持不动，玩家需手动备份后重新导入卡内世界书。卡片版本与主书唯一的 `[DVS:版本]` 条目应同步维护，见[DVS 作者手册](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS作者使用手册.md#可选检查主世界书版本)。

`DVS.js` 注册业务规则，正文完成后的自动变量更新及 JSON 显示／隐藏由 DVS 插件处理，悬浮栏通过更新通知重读状态。确认稿只是视觉参考，不作为实际界面证据。

## 项目规则

DVS 的公共接口和执行保证见[作者使用手册](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS作者使用手册.md)。本目录只管理房车作者侧内容，不将卡片设计或素材准备当作 DVS 功能实现证据。
