# Day 26 回滚手册

日期：2026-10-12（Day 26，第 4 周）
适用范围：「每日一个 AI 概念详解」线上系统 = 静态托管（前端）+ CloudBase 云函数 `api`（后端）+ PostgreSQL（数据）
配套文档：《Day26-发布清单-v1.0.md》（发布、验证与备份）；《Day26-回滚演练记录.md》（2026-10-12 实战记录，演练后回填）

---

## 一、触发条件：什么情况必须回滚

总原则：**回滚是恢复服务的手段，不是追查原因的手段**。先回滚把服务拉回来，再慢慢查原因。

| # | 现象（可观测） | 判据 | 级别 | 动作 |
|---|---|---|---|---|
| 1 | 公网首页数据渲染全挂 | 无头 Chrome `--dump-dom` 读 `<main id="list">`：`data-state="error"`、卡片 0 | P1 | 先按 §三 验证接口层定位；15 分钟内不能恢复 → 回滚到上一稳定版 |
| 2 | 静态资源异常 | 五路径中 `/`、`/concept.html`、`/concepts.js` 状态码不符合预期 | P1 | 立即回滚（发布源目录放错的典型症状） |
| 3 | 健康检查失败 | `/api/health` 非 200，或信封不是 `{ok,service,time}` | P1 | 回滚云函数层（§2.2） |
| 4 | 核心读接口 5xx / 数据不对 | `/api/concepts` 非 200，或返回条数 ≠ 7 | P1 | 数据层评估（§2.3）；必要时回滚函数层 |
| 5 | 写接口假成功 | 写操作回 200，但回读数据库无对应行（C6DELETE 判据） | P1 | 回滚云函数层（§2.2） |
| 6 | 敏感文件可公网访问 | `/.env` 或 `/.workbuddy/` 返回 200 | P0 | 立即回滚 + 检查发布源目录；事态失控时直接下线 |
| 7 | 发现安全漏洞（如密钥泄露） | verify-project D 组判据命中强特征 | P0 | 先回滚或下线，再更换密钥 |

「下线」是最后手段：`workbuddy_sites_deploy` 的 `action="unpublish"`，链接停服——宁可停服也不留漏洞。

回滚决策人：项目负责人。执行前必须确认两件事：**回滚到哪个版本**（§四 速查表）、**该版本的留档在哪**。

## 二、分三层回滚的具体步骤

三层从外到内：静态托管（前端）→ 云函数（后端）→ 数据库（数据）。**外层先试，能不动内层就不动。**

### 2.1 第一层：代码回退（静态托管回退上一版）—— 本次唯一实操路径

背景：发布工具只有「部署（覆盖）」和「下线」两个动作，**没有版本历史、无一键回退**。所以「回退上一版」= 把上一版文件找出来、放回发布目录、重新部署覆盖。上一版的来源按优先级：① 发布前留档目录 `.workbuddy/publish-prev/`；② git tag（v1.0 及以后每个发布版都打 tag，v1.0 之前的线上版本不在 git 里）。

```bash
# 0. 先留档「当前线上版本」——万一回滚目标选错了，还能再退回来
cp -r .workbuddy/publish ".workbuddy/publish-rollback-backup-$(date +%Y%m%d-%H%M%S)"

# 1. 把上一版三个文件放回发布目录（以 2026-10-12 为例：留档在 .workbuddy/publish-prev/）
cp .workbuddy/publish-prev/index.html .workbuddy/publish-prev/concept.html .workbuddy/publish-prev/concepts.js .workbuddy/publish/

# 2. 重新部署（覆盖）：工具 workbuddy_sites_deploy，directory = .workbuddy/publish/
#    注意：部署即覆盖公网，必须当轮获得用户明确同意后才可执行

# 3. 按 §三 四层验证，通过后记录：耗时、目标版本、每层结果
```

### 2.2 第二层：云函数回退 —— 【手册内容，不实操】

**不实操原因**：本次 v1.0 发布不含云函数代码变更（2026-10-12 实测：线上函数代码与仓库 `functions/api` 逐字节一致，`diff -r` 退出码 0）。线上不存在比仓库更旧的已部署版本，把旧函数码真部署上去等于制造一次真实回退而非演练，故只写方法、不执行。

步骤（真出事时按此执行）：

1. 取上一版函数代码：`git show <上一个发布 tag 或提交>:functions/api/...`（或本地留档目录）；
2. 部署：MCP `manageFunctions(action="updateFunctionCode", functionName="api", functionRootPath="D:/Workbuddy/vibe coding program/每日一个AI概念详解网站/functions")`——SDK 自动拼 `functions/api/` 子目录，无需预先压缩 zip；
   （备选两段式：`queryFunctions(action="getFunctionUploadUrl")` 拿预签名地址 → PUT 代码 zip → `updateFunctionCode` 传 code 三元组）
3. 环境变量不用重配：`CLOUDBASE_API_KEY` 已配在函数上，代码回退不影响它；
4. 验证：health + concepts + favorites 读写抽验（含 DELETE 回读）；必要时 `queryFunctions(action="listFunctionLogs")` 看执行日志。

### 2.3 第三层：数据恢复 —— 【手册内容，不实操】

**不实操原因**：本次 v1.0 无表结构变更，不触发「发布含表结构变更前必须先导出数据」条款；且发布前备份与现网数据一致，恢复等于无操作。数据恢复是三层中唯一有真实写库风险的一层，演练不动数据。

铁律（必须遵守）：**凡发布包含表结构变更，必须在发布前导出数据**；数据恢复只能通过发布前导出的备份重新导入，没有第二条路。

步骤（真出事时按此执行）：

1. 取发布前导出的备份：`.workbuddy/backups/<日期>-pre-<版本>-data.sql`；
2. 恢复入口：MCP `managePgDatabase(action="execute", confirm=true)` 执行备份中的 INSERT；TRUNCATE / DDL 归迁移通道（`applyMigration`），不走 execute；
3. 恢复后核对：核心表行数与发布前备份记录一致（concepts = 7 等）；
4. 验证：接口读回 + 页面渲染（§三）。

## 三、回滚后的验证方法（四层，从外到内）

| 层 | 方法 | 通过判据 |
|---|---|---|
| 静态层 | 五路径 curl | `/` 200、`/concept.html` 200、`/concepts.js` 200、`/.env` 403、`/.workbuddy/` 404 |
| 版本层 | 线上文件 md5 vs 目标版本留档 | 三个 md5 全部相等——证明线上确实是目标版本，而非缓存或中间态 |
| 渲染层 | 无头 Chrome `--dump-dom` | `<main id="list">` 的 `data-state="success"`、卡片 ≥ 7、命中数据库概念标题 |
| 接口层 | curl 抽验 7 个接口 | health 信封 `{ok,service,time}`；concepts 返回 7 条；favorites 写-读-改-删各一轮，DELETE 后回读确认真的删了 |
| 数据层 | MCP 查核心表行数 | 与发布前备份记录一致 |

全部通过后，在演练/事故记录里写清：回滚原因、目标版本、每层验证结果、**实际耗时**、操作人、遗留问题。

## 四、版本与留档位置速查（2026-10-12）

| 版本 | 前端三文件 md5 | 留档位置 | 备注 |
|---|---|---|---|
| 上一稳定版本（2026-10-06 发布态） | index `8b82e9c38c4763abf217ba19cca88835` / concept `c6eedb11a9d310932016bbe532b14214` / concepts `fc2ba62a64bfb58a60b8903b5ee0df74` | `.workbuddy/publish-prev/` | **git 历史里没有这个版本**，只能靠留档；Day 26 回滚演练的回退目标 |
| v1.0（2026-10-12 发布） | index `8e72e2c541e0850028754262cf916ae0` / concept `c6eedb11a9d310932016bbe532b14214` / concepts `7110900077f2cc53d8e66e1de22393ec` | `.workbuddy/publish-v1.0/` + git tag `v1.0` | 含 Day 23/24 修复；tag 打在 Day 26 收尾提交 |
| 云函数 `api` | 线上与仓库逐字节一致（`diff -r` exit 0） | 仓库 `functions/api/` | 无历史版本差异 |
| 数据库备份 | — | `.workbuddy/backups/2026-10-13-pre-v1.0-data.json` + 同名 `.sql`（INSERT） | 发布前导出；逐表 md5 与数据库对账一致；不进 git |

## 五、注意事项

- 回滚只用安全方式：重新部署上一版留档文件。**禁止** `git reset --hard`、强制推送等改写历史的操作（项目铁律：回退只用 `git revert`）。
- 部署与回滚都会立刻覆盖公网内容，执行前必须拿到用户明确同意。
- 每次演练或真实回滚后，更新 §四 速查表与本手册。
- 判据不要退化：HTTP 200 不等于成功（写接口必须回读）；curl 不带 Origin 永远测不出跨域；证明「首页展示真实数据」只能用真实 Chrome。

## 参考资料（访问日期均为 2026-10-12）

- 项目内：`.workbuddy/skills/verify-project/SKILL.md`（判据来源）；`api-contract.md`（接口契约）；《Day26-发布清单-v1.0.md》
- MCP 工具 schema（2026-10-12 实测）：`manageFunctions(updateFunctionCode)` / `managePgDatabase(execute)` / `queryFunctions(getFunctionDownloadUrl / listFunctionLogs)`
