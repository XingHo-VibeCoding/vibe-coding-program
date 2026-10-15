# Day 26 发布清单｜v1.0 正式发布

日期：2026-10-12（Day 26，第 4 周）
版本：v1.0（项目首个正式版）
编制状态：2026-10-12 21:50（步骤 1 生成，未动线上）
门禁状态：**未通过** —— 发布前验证 A3/A7 两项 FAIL（根因：安全域名白名单缺 `ai-concept-daily.app.workbuddy.host`）。修复并全量重跑通过前，不得发布。处置见 §七。

---

## 一、版本信息

| 项 | 值 |
|---|---|
| 版本号 | v1.0 |
| 发布日期 | 2026-10-13（计划，以实际部署时间为准） |
| 分享链接 | https://ai-concept-daily.app.workbuddy.host/ （不变） |
| 代码版本标记 | git tag `v1.0`（打在 Day 26 收尾提交上，见 §四） |
| 前端版本 | 仓库 HEAD 工作区三文件：`index.html` / `concept.html` / `concepts.js` |
| 后端版本 | 云函数 `api`：线上代码与仓库逐字节一致（2026-10-12 实测），本次无函数变更 |
| 数据库 | 无表结构变更 |

## 二、发布内容说明

v1.0 = 当前仓库全部内容的第一个正式发布版。与「线上正在服务的版本」（2026-10-06 19:01 发布态，字节级留档于 `.workbuddy/publish/`）的差异（2026-10-12 实测 diff）：

| 文件 | 上一版（线上在跑）md5 | v1.0（HEAD）md5 | 差异内容 |
|---|---|---|---|
| `index.html` | `8b82e9c38c4763abf217ba19cca88835` | `8e72e2c541e0850028754262cf916ae0` | Day 24 修复：取消收藏改走 `removeFavoriteMock`（DELETE 真删）；失败时 `console.error` 记录原始错误码；Day 23 三类错误中文归类文案 |
| `concepts.js` | `fc2ba62a64bfb58a60b8903b5ee0df74` | `7110900077f2cc53d8e66e1de22393ec` | Day 23：识别网关层全英文错误（`GW_` 码）并转中文提示，不再把文档链接当错误显示 |
| `concept.html` | `c6eedb11a9d310932016bbe532b14214` | `c6eedb11a9d310932016bbe532b14214` | 无差异 |

**本次发布修复了一个线上真实存在的 Bug**：取消收藏是假成功——界面按钮变了，但数据库那一行从未被删，刷新后又变回「已收藏」。根因：旧版不管收藏还是取消，一律调 `toggleFavoriteMock`（只会 POST），取消时 POST 拿到 409 被当成成功处理。

后端与数据本次无变更：

- 云函数 `api`：2026-10-12 下载线上代码包（`getFunctionDownloadUrl`）与仓库 `functions/api` 逐字节比对，`diff -r` 退出码 0，线上即仓库当前版本，无需重新部署；
- 数据库：无表结构变更，不触发「发布含表结构变更前必须先导出数据」条款，但仍按 §四 执行发布前备份。

## 三、发布前必须通过的验证项

验证工具：项目级 Skill `verify-project`（位置 `.workbuddy/skills/verify-project/`），调用方式：

```bash
node .workbuddy/skills/verify-project/scripts/run-checks.mjs --groups A,B,C
```

覆盖范围：A 公网 7 项 / B 健康 2 项 / C 读写 8 项 / D 密钥 4 项 / E Git 安全 3 项（A–E 共 24 项）；F 数据库 3 项脚本不连库，须用 MCP CloudBase 工具执行（可连接 / 核心表存在 / 核心表行数）。退出码 0 = 全过，2 = 有 FAIL。

**门禁规则：A–E + F 全部 PASS 才允许发布；任何 FAIL 必须先定位修复，修复后重跑。**

**2026-10-13 用户拍板（丙）**：不接受充值升级，带已知 FAIL 发布——A3/A7 根因为平台套餐限制（见 §七），D1/D2/D4 为文档示例误报（分析见下）。本门禁按「已知 FAIL 全部定位并记录」的口径执行；当日收尾的完成标准中「检查全过」一项据此判**部分完成**。

当前基线（2026-10-12 18:02 实跑 A 组，verify-project 原始输出摘录）：

```
[ 1/7] A1 首页 HTTP 状态        → PASS（实测 200）
[ 2/7] A2 首页非空壳            → PASS（34895 字节；引用 concepts.js ×6）
[ 3/7] A3 跨域白名单            → FAIL（带 Origin 请求，响应头无 access-control-allow-origin）
[ 4/7] A4 静态资源可达          → PASS（concepts.js / concept.html 均 200）
[ 5/7] A5 .env 未泄露到公网     → PASS（403）
[ 6/7] A6 .workbuddy 未泄露     → PASS（404）
[ 7/7] A7 公网首页渲染真实数据  → FAIL（data-state="error"，卡片 0，未命中概念标题）
汇总：PASS 5 / FAIL 2 / SKIP 0
```

A3/A7 根因同一处：安全域名白名单缺 `ai-concept-daily.app.workbuddy.host`，浏览器 fetch 被拦，首页走 error 分支。

**发布前全量实跑（2026-10-13 18:19，A–E 组 24 项 + F 组 3 项，结果记入《Day26-回滚演练记录.md》）：**

- A–E：**PASS 19 / FAIL 5**。A3、A7 为白名单已知 FAIL；D1、D2、D4 为**文档示例误报**——扫描器把 5 行文档文字当成真实凭证：`SKILL.md:309` 与 `Day25-验证记录.md:139` 是判据规则定义里的示例连接串（`realuser`/`s3cret` 本身就是描述性假词）；`Day25-验证记录.md:175/185/191` 是 Day 25 故意注入又已撤销的假密钥 `AIza7xKq9…X3` 的文字留档（Day 25 提交信息可自证）。反向佐证：真实代码零字面量（D3 PASS）、.env 三查全过（E1/E2/E3 PASS）。
- F 组（MCP 实测）：F1 可连接 PASS；F2 六张表全在 PASS；F3 行数 7/14/7/25/8 + favorites=4，与 Day 16 种子基线一致 PASS。
- **D2 的特殊性（必须记录）**：D2 扫 git 全量历史，上述假密钥存在于 Day 25 的提交中；项目禁改写历史（只用 `git revert`）→ D2 为**结构性永久 FAIL**，除非接受为记录项（待用户拍板：接受 / 脱敏工作区文件——脱敏只能清 D1/D4，清不了 D2）。

## 四、备份方式（发布前必须完成，缺一不可）

| 备份 | 位置 / 做法 | 说明 |
|---|---|---|
| 代码版本标记 | `git tag -a v1.0 -m "v1.0 ..."` 打在 Day 26 收尾提交 | 平台无版本历史，tag 是 v1.0 及以后各发布版的回退源头 |
| 数据导出 | MCP 只读查询全库 → 写入 `.workbuddy/backups/2026-10-13-pre-v1.0-data.json`（快照）+ 同目录 `.sql`（INSERT 语句，可直接导入） | 实测 6 张表：concepts 7 / concept_use_cases 14 / concept_quizzes 7 / concept_quiz_points 25 / concept_sources 8 / favorites 4；**逐表 md5 与数据库实测对账全部 MATCH**；导出文件不进 git（.gitignore:123 实测拦截），方法与位置记录在本清单 |
| 上一版文件留档 | 部署前把 `.workbuddy/publish/` 现有内容（上一稳定版本，线上正在服务）复制到 `.workbuddy/publish-prev/` | **这个版本在 git 历史里不存在**，只能靠这份留档；它同时是 Day 26 回滚演练的回退目标 |
| v1.0 文件留档 | 部署前把 HEAD 三文件复制到 `.workbuddy/publish-v1.0/` | 回滚演练的恢复源 |

铁律：**每次发布前，必须先把「线上正在跑的版本」留档**。发布工具不会替你留。

## 五、发布方式

- 工具：`workbuddy_sites_deploy`。语义 = **部署即覆盖**，平台无版本历史、无一键回退（「回退上一版」的落地方式见回滚手册 §2.1）。
- 发布源目录：`.workbuddy/publish/`——**只放三个前端文件**。项目根目录有 `.env`，整目录发布会泄露密钥。
- 步骤：① 完成 §四 全部留档与导出；② HEAD 三文件复制进 `.workbuddy/publish/`；③ 获得用户明确同意后调部署工具覆盖发布；④ 按 §六 逐项验证。
- 每次部署都会立刻覆盖线上内容，必须当轮获得用户明确同意后才可执行。
- 部署成功后告知管理入口：设置 — 数据管理 — 发布的应用。

## 六、发布后逐项验证步骤

1. **五路径**（发布后立即执行）：

   ```bash
   for p in "/" "/concept.html" "/concepts.js" "/.env" "/.workbuddy/"; do
     curl -s -o /dev/null -w "%{http_code} $p\n" "https://ai-concept-daily.app.workbuddy.host$p"
   done
   ```

   预期：200 / 200 / 200 / 403 / 404。
2. **版本一致性**：`curl -s <链接>/index.html | md5sum`（及另两个文件）逐一比对，必须等于 §二 表中 v1.0 的 md5——证明线上跑的确实是 v1.0，而不是缓存或旧版。
3. **真实浏览器渲染**（唯一能证明「公网首页展示真实数据」的判据，curl 做不到）：无头 Chrome `--dump-dom` 读 `<main id="list">` 的 `data-state`，须为 `success`、卡片 ≥ 7、命中数据库概念标题。
4. **接口抽验**：health 信封 `{ok,service,time}`；concepts 返回 7 条；favorites 写-读-改-删各一轮，DELETE 后回读确认真的删了（C6DELETE 判据）。
5. **用户验收截图**（浏览器地址栏 + 页面同时入镜，无头截图不算）：v1.0 公网首页。

## 七、当前阻塞项与不确定清单

- **阻塞（未修，用户丙 决策接受）**：安全域名白名单缺 `ai-concept-daily.app.workbuddy.host`。2026-10-12/13 实测：MCP `manageEnv(addSecurityDomain)` 报「[CreateAuthDomain] 当前套餐无法执行此操作」；2026-10-13 用户在控制台「HTTP 网关 → 跨域设置」点【添加跨域域名】同样被要求充值——**体验版（baas_trial）套餐硬限制，API 与控制台都拦**。正确控制台路径（实测）：HTTP 网关 → 跨域设置 → 添加跨域域名（格式不带协议；每环境 ≤50 条；约 1–2 分钟生效）。用户拍板丙：不充值，v1.0 带此已知 FAIL 发布；升级个人版（19.9 元/月限时）或迁移 CloudBase 静态托管为后续可选清偿路径。
- 备选：升级个人版（19.9 元/月，限时）——控制台也被拦时启用；变配对现有数据的影响以控制台提示为准（未实测，推断不写事实）。
- 数据导出的实际表清单以 MCP 实测为准（上文 6 张为依据接口契约的推断）。

## 发布结果（演练/发布当天回填）

| 项 | 结果 | 证据 |
|---|---|---|
| 发布前全量验证（A–E+F） | PASS 22 / FAIL 5（A3/A7 套餐限制已知 FAIL；D1/D2/D4 文档示例误报） | 2026-10-13 18:19 A–E 实跑 + MCP F 组；分析见 §三 |
| 部署时间 / 操作人 | 2026-10-13 18:35 部署成功（verified: true，sandbox 23b6f8f9…）；曾令旺授权，WorkBuddy 执行 | 部署工具返回 shareLink 不变 |
| 发布后五路径 | PASS（200 / 200 / 200 / 403 / 404） | 2026-10-13 18:37:08 curl 实测 |
| 发布后 md5 一致性 | PASS（线上三文件 8e72e2c5 / c6eedb11 / 71109000 = v1.0） | 2026-10-13 18:37:08 curl + md5sum |
| 发布后 Chrome 渲染 | FAIL（data-state="error"、0 卡片）——已知 FAIL（A3 根因），非部署问题；前端代码确已上线（md5 为证） | 2026-10-13 18:37:14 A 组复跑 A7 |
| 数据导出文件 | `.workbuddy/backups/2026-10-13-pre-v1.0-data.json` + `.sql`，6 表 md5 对账 MATCH | make-sql.mjs 输出 |
| git tag v1.0 | 待回填（Day 26 收尾提交时打，D1 甲） | |

## 参考资料（访问日期均为 2026-10-12）

- 项目内：`.workbuddy/skills/verify-project/SKILL.md`（判据来源）；`api-contract.md`（接口契约）；`AGENTS.md`（项目规则）
- 官方：安全来源配置 https://docs.cloudbase.net/envconfig/security/intro （控制台路径、50 条上限、1–2 分钟生效）
- 官方：套餐配额与资源点 https://cloud.tencent.com/document/product/876/127357 （体验版 0 元/3000 点每月；个人版 19.9 元/月限时）
