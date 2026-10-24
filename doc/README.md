# 房车卡文档

这里维护「房车慢生活」的当前设计、作者业务规则、构建和验证方法。角色卡源文件位于上级目录，生产配图与用于排版参考的旧效果图分开维护。

## 阅读入口

| 你要做什么 | 文档 |
| --- | --- |
| 理解旅行手册的布局、四时段主题、配图、交互和数据读取 | [状态栏设计](状态栏设计.md) |
| 修改状态栏、ShadowRoot 样式、注册订阅或自动化测试 | [代码设计与测试方案](状态栏代码设计与测试方案.md) |
| 调整正文资料筛选、旅行规划、变量检查或油电水结算 | [场景与资源结算设计](房车场景与资源结算设计.md) |
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
| `bun run build:check` | 只生成隔离的状态栏构建，不复制到卡片脚本目录、不打包或推送角色卡 |
| `bun run build` | 构建状态栏脚本，带 `--publish` 复制到 `脚本/状态栏.js`，再执行 `tavern_sync bundle 房车` 打包角色卡 |
| `bun run build 0.1.3` | 先将 `index.yaml` 的 `版本` 和 `[DVS_VERSION]` 条目的 `内容` 都改为传入的版本号，再构建并打包 |
| `bun run build:sync` | 先执行 `build`，再执行 `tavern_sync push 房车` 推送到当前连接的酒馆 |
| `bun run test:browser [Playwright 参数]` | 隔离构建后运行 Chromium 模拟 Helper 浏览器测试，产物在 `.test-data/card-rv`；例如 `bun run test:browser --grep 地图` |
| `bun run sync <子命令> [参数]` | 使用本库 YAML 执行同步工具命令；例如 `bun run sync list`、`bun run sync bundle 房车`，推送前按部署流程确认目标 |
| `bun run encode-webp <PNG 目录> <输出目录>` | 将 `rv-*.png` 编码为同名 WebP；两目录均由调用者指定 |

`build` 会改写卡片脚本目录并生成角色卡 PNG。不传版本参数时保留现有版本；传参时先修改源文件，后续构建或打包失败也会保留已写入的版本号。只验证构建时运行 `bun run build:check`，默认输出到 `.test-data/card-rv/build`，可用环境变量 `CARD_RV_BUILD_DIR` 指定其他输出目录，相对路径以房车仓库根目录解析，绝对路径保持原位置。推送前的授权、专用卡准备、同步连接与读回见[真实酒馆部署验证流程](真实酒馆部署验证流程.md)。

## 公开声明与提交 hook

`types/sqlite-helper/` 保存完整公开声明副本，共 16 个 `.d.ts` 文件，包含两个入口及其依赖；独立构建直接使用此副本。正常安装、构建和测试不读取父仓库、不触发同步。

需要提交前同步时，显式运行 `bun run hooks:install` 安装本库 pre-commit。已有默认 pre-commit 或其它 `core.hooksPath` 时安装器停止并说明如何合并，不覆写原 hook。hook 在房车按 `card/房车/` 挂载时尝试读取父库 `release/st-sqlite-helper/types`；来源不存在便保留副本并允许提交，来源存在但读取、复制或暂存失败会使提交失败。

也可运行 `bun run types:sync <声明目录>` 手工指定本地来源；省略参数使用同一默认位置，显式同步遇到来源不存在时报错。有变化时打印来源 `manifest.json` 中的版本（没有则显示未知）和增删改文件清单，同步并暂存本库声明目录。它只同步声明，不比较版本高低；不支持对该目录手工修改或部分暂存，提交前应核对暂存差异。构建工具副本各自维护，不随声明同步。

## 清理与工具

`bun run clean:test`（或 `bun run clean`）只清理本库 `.test-data/card-rv` 和固定的 `.test-data/evidence/房车地图提示与标识`，不接受自定义目录。其它专项证据及 `CARD_RV_BUILD_DIR` 自定义产物由所属轮次核对后处理。清理前先保存必要证据和恢复所需备份。

配图制作资料见 [tools/配图](../tools/配图/README.md)。已纳入版本管理的工具与资料随仓库保留；`人设图/`、生成的 `脚本/状态栏.js`、`dist/`、`.test-data/` 继续忽略。同步工具来源与许可见 [THIRD-PARTY-NOTICES](../THIRD-PARTY-NOTICES.md)，不自动运行 `sync update`。

## 职责边界

[主世界书版本检查脚本](../脚本/主世界书版本检查.js)在启动时独立调用一次 `DVS.lorebookVersionCheck({ onExpired: 'AUTO_UPDATE' })`。主书落后时由玩家确认是否备份并更新，成功后玩家点击刷新页面；不依赖变量注册，也不保证先于注册运行。卡片版本和主书唯一 `[DVS_VERSION]` 条目应同步维护，完整规则见[DVS 作者手册](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS作者使用手册.md#可选检查主世界书版本)。

`DVS.js` 注册业务规则，正文完成后的自动变量更新及 JSON 显示／隐藏由 DVS 插件处理，悬浮栏通过更新通知重读状态。确认稿只是视觉参考，不作为实际界面证据。

## 项目规则

DVS 的公共接口和执行保证见[作者使用手册](https://github.com/q3boy/st-sqlite-helper/blob/master/doc/dvs/指南/DVS作者使用手册.md)。本目录只管理房车作者侧内容，不将卡片设计或素材准备当作 DVS 功能实现证据。
