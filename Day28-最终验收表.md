# Day 28｜最终验收表与项目映射表

> 项目：**每日一个 AI 概念详解**（v1.0）·曾令旺 · 长沙校区
> 公网地址：https://ai-concept-daily.app.workbuddy.host/
> 代码仓库：https://github.com/XingHo-VibeCoding/vibe-coding-program
> 检测时间：2026-10-15 18:53–19:10
> 检测手段：`verify-project` Skill（27 项，A–F 六组）+ CloudBase MCP 直连数据库 +公网接口实打

## 关于本表的可信度，先说三句

1. **本表所有PASS 都来自今天实测输出**，不是复述历史文档。命令与原始输出见各行「证据」列。
2. **两个 FAIL 不掩饰、不粉饰**：A3（跨域白名单）、A7（公网首页渲染）今天第8 次实测仍失败，根因单一，详见 §四。
3. **未验证的一律标「未执行」**，本轮无未执行项—— 27 项全部实跑，工具不可用的项已改用 MCP 直连补齐。

---

## 一、能力底线对应表（逐项判定）

| 能力底线 | 我的项目对应功能 | 判定 | 证据链接 / 截图 |
|---|---|---|---|
| 至少 3 个页面 / 视图 | ① 首页列表（index.html，四态：loading/success/empty/error）② 概念详情页（concept.html?id=slug，固定 6 段 8 区块）③ 检查台（console.html，PATCH/DELETE/GET 三区块 + 删除二次确认弹窗） | **PASS** | 三文件均在库：`index.html` 38066B、`concept.html` 22845B、`console.html` 16427B；线上 A4 实测 concept.html / concepts.js 均 200；截图 `Day13-参考-四态-1..4.png`、`Day13-参考-视图切换-1/2.png`、`Day22-参考-1..5.png` |
| 至少 1 个有反馈的交互 | 收藏按钮「☆ 收藏 → ★ 已收藏」，带转圈 loading、成功/失败中文提示、刷新后读回状态 | **PASS** | `index.html:539-540` 收藏图标与 spinner 节点；`Day11-参考-收藏成功/失败提示.png`；C3–C6 实测 201→读回→200→回读比对全过 |
| 至少 1 类数据真实写入并读取数据库 | `favorites` 表的增 / 查 / 改 / 删（唯一约束 + 外键关联 concepts 取 slug） | **PASS** | 见下方「§三 写库证据链」；MCP 直连 `favorites=4` 行，与线上 GET 返回的 4 条完全对应 |
| 前端、云函数和数据库完整链路 | 静态托管 → HTTP 网关 Event 云函数（functions/api，Nodejs20.19）→ PostgREST → CloudBase PostgreSQL | **PASS** | B1/B2 health 200；C1 读出真实 7 条概念；`functions/api/lib/db.js` 只读 `process.env.CLOUDBASE_API_KEY`（D3 PASS，源码零字面量） |
| 一次公网发布（CloudBase 或等效平台） | WorkBuddy sites 静态托管，v1.0 已于 2026-10-13 19:47 部署 | **部分 PASS** | 线上三文件 md5 与本地 HEAD **逐字节一致**（index `8e72e2c5…` / concepts.js `71109000…` / concept.html `c6eedb11…`）；但**首页在浏览器里打不开数据**（A7 FAIL）→ 公网发布只能判部分通过 |
| 刷新后数据仍存在 | 跨天持久化验证：Day 19 写入的 `note:"Day 19 写入验证"`（id=7）今天仍在线上 | **PASS** | 线上 `GET /api/favorites` 返回 id=35/19/14/7 四条，最老一条createdAt=2026-10-04T10:52:02Z，跨 11 天仍在 |
| 额度、到期和备份已记录 | 环境计费信息 + 资源额度检查 + 发布前数据备份 | **PASS** | MCP `queryEnv(action=info)`：`PackageName=体验版`、`PayMode=PREPAYMENT`、`ExpireTime=2027-03-31 23:59:59`、`IsAutoRenew=false`、`EnvQps.QpsQuota=500`；`Day27-资源额度检查.md`；备份 `.workbuddy/backups/2026-10-13-pre-v1.0-data.{json,sql}` |
| 能解释提示词和验证方式 | 三层验证（契约 / 数据 / 真实浏览器）+ 三条实际改写的提示词 | **PASS** | 演示提纲「段3 提示词改写」给出实例 A/B 前后对比与可复用公式；`Day21-演示提纲.md` §段3/§段4 |

---

## 二、附录 J｜100分最终验收与项目映射表（逐项判定）

| 项目 | 分值 | 判定 | 通过证据（今天实测） |
|---|---|---|---|
| **提示词理解与改写** | 20 | **PASS** | 3 条实际改写并留档：① Day 16 seed 脚本（「写个种子脚本」→「可重复执行 + DELETE 不用 TRUNCATE + 外键按 slug 反查 + 交付行数 select」）② Day 20 跨域排查（「页面连不上接口」→「已知条件 4 条 + 不要讲原理先给判据 + 交付判据表」，输出直接推翻我前5 天测试方法的有效性）③ Day 27 取消收藏假成功（按现象/复现/报错原文/已尝试动作/修复方式/验证证据六段式定位）。详见 `Day27-修复提示词-取消收藏假成功.md`、`Day21-演示提纲.md` §段3 |
| **前端页面与交互** | 15 | **PASS** | 3 个页面/视图齐备（见能力底线表第 1 行）；反馈状态：首页四态 + 收藏按钮五态（默认/hover/loading/成功/失败）+ 检查台删除二次确认弹窗 + 三类中文错误提示；移动端截图 `Day10-360px实测-首页无遮挡.png`、`Day11-参考-收藏后-窄屏390.png`；四态截图 `Day13-参考-四态-1..4.png` |
| **云函数与 API** | 15 | **PASS** | 7 个接口全部实跑通：health（200，信封 `{ok,service,time}` 无契约外字段）、concepts 列表（7 条严格倒序）、concepts 详情、favorites 增/查/改/删。错误响应实测 2 类：404 `FAVORITE_NOT_FOUND`（PATCH 与 DELETE 双向）；契约共登记 15 个错误码，`api-contract.md` §3 全表可查 |
| **云数据库（PostgreSQL）** | 15 | **PASS** | MCP 直连实测六表行数：`favorites=4 / concepts=7 / concept_use_cases=14 / concept_quizzes=7 / concept_quiz_points=25 / concept_sources=8`；真实写入（POST 201→id=50）、修改（PATCH note 逐字符一致）、删除（DELETE 回读 count 5→4 且 id 消失）、持久化（Day 19 的行今天仍在）；初始化走 seed 脚本 + 迁移通道 |
| **第三周周成果** | 10 | **PASS** | `Day21-第3周周验收表.md`（20613B）、`Day21-第3周周验证日.md`（16225B）、`Day21-演示提纲.md`（12837B）、`Day21-周验证日打卡.png`；检查台 v1 = `console.html`（16427B，公网未部署，仅本地/后端验证） |
| **Skill 与测试** | 10 | **PASS** | `verify-project` Skill：A–E 组 24 项 + F 组 3 项 = 27 项，今日实跑 **25 PASS / 2 FAIL**；**故意注入缺陷被查出**（Day 25 在 index.html:866 注入假密钥 → D1/D4 独立命中并定位行号；Day 27 D 组加第三层META 判定后回归验证「注入到无标记词的.md 仍判 REAL」） |
| **线上发布（CloudBase 或等效平台）** | 10 | **部分 PASS** | 公网地址可达、线上文件与仓库 HEAD 逐字节一致、线上数据真实持久化（4 条跨 11 天）；**但首页浏览器实测 `data-state="error"`、卡片 0 张**（A7 FAIL），根因是安全域名白名单（A3 FAIL）。发布本身成功，「用户能用」这一层未达成 → 扣分 |
| **额度、到期和备份** | 5 | **PASS** | 到期时间 `2027-03-31 23:59:59`、计费状态 `体验版 / PREPAYMENT / EnvActivated=no / IsAutoRenew=false`、QPS 配额 500（均 MCP 实测）；备份 `.workbuddy/backups/2026-10-13-pre-v1.0-data.json`（12657B）+ `.sql`（15987B）+ `Day27-资源额度检查.md` |

**诚实自评：按上表判定，7 项满分通过、1 项（线上发布）部分通过，折算约 95/100。**
失分点唯一：安全域名白名单未加，公网首页对真实用户不可用。这一项 8 天来一直挂着，不是今天新出现的。

---

## 三、27 项检查逐项明细（今天实跑原始结论）

### A 组｜公网 7 项 →5 PASS / 2 FAIL

| 项 | 判定 | 实测值 |
|---|---|---|
| A1 首页 HTTP 状态 | PASS | 200 |
| A2 首页非空壳 | PASS | 38066 字节，concepts.js 引用 6 次 |
| A3 跨域白名单（带 Origin 头） | **FAIL** | HTTP 200 但响应头无 `access-control-allow-origin` |
| A4 静态资源可达 | PASS | concepts.js 200、concept.html 200 |
| A5 .env 未泄露公网 | PASS | 403 |
| A6 .workbuddy/ 未泄露公网 | PASS | 404 |
| A7 公网首页渲染出真实数据（真实 Chrome） | **FAIL** | `data-state="error"`、卡片 0 张、未命中任何概念标题 |

### B 组｜健康接口 2 项 → 2 PASS

| 项 | 判定 | 实测值 |
|---|---|---|
| B1 health HTTP 状态 | PASS | 200 |
| B2 health 信封字段与值 | PASS | `ok===true` / `service==="ai-concept-daily"` / `time` 可解析 / 无契约外字段 |

原始响应（今天 18:54 实打）：
```json
{"ok":true,"service":"ai-concept-daily","time":"2026-10-15T10:54:36.766Z"}
```

### C 组｜读写闭环 8 项 → 8 PASS（19:03 复跑）

| 项 | 判定 | 实测值 |
|---|---|---|
| C1 读·概念列表 | PASS | 7 条，`latestDate=2026-09-22`，日期序列严格倒序 |
| C2 读·收藏列表 | PASS | 4 条，ids=[35,19,14,7]，无重复 |
| C3 写·POST 新增 | PASS | 201，id=50，slug=002-token |
| C4 写后读回 | PASS | count=5，id=50 在列表中 |
| C5 改·PATCH 备注 | PASS | 200，`"verify-project自检"` 逐字符一致 |
| C6 删·DELETE 真删 | PASS | 200，回读 count 5→4，id 已消失 |
| C7 不存在的 id 不报成功 | PASS | PATCH/DELETE 均 404 + `FAVORITE_NOT_FOUND` |
| C0 数据清理交代 | PASS | 本轮开始 4 条 → 结束 4 条，已还原基线 |

### D 组｜密钥 4 项 → 4 PASS

| 项 | 判定 | 实测值 |
|---|---|---|
| D1 仓库（含 Git 历史）真实凭证 | PASS | 真实凭证命中 **0 行** |
| D2 硬编码连接串 | PASS | 0 行|
| D3 凭证只从环境变量读 | PASS | `process.env.CLOUDBASE_API_KEY`，缺失时 throw，源码零字面量 |
| D4 工作区无真实密钥 | PASS | 真实凭证 **0 行**；13 行命中全部是「文档在描述占位符示例」 |

### E 组｜环境 3 项 → 3 PASS

| 项 | 判定 | 实测值 |
|---|---|---|
| E1 .env 被 .gitignore 忽略 | PASS | `.gitignore:9` |
| E2 .env 不在 Git 已入库文件 | PASS | `git ls-files` 无匹配 |
| E3 .env.example 已入库 | PASS | 恰 1 行 |

### F 组｜数据库 3 项 → 3 PASS（MCP 直连）

| 项 | 判定 | 实测值 |
|---|---|---|
| F1 数据库可连接 | PASS | `managePgDatabase(action=execute)` 查询成功返回 |
| F2 核心表存在 | PASS | concepts / concept_use_cases / concept_quizzes / concept_quiz_points / concept_sources / favorites 均存在 |
| F3 核心表行数 | PASS | 7 / 14 / 7 / 25 / 8 / **favorites=4** |

### 附加实测（清单逐项要求的额外项）

| 项 | 判定 | 证据 |
|---|---|---|
| 至少 1 类数据真实写入并读取数据库 | PASS | 线上 GET `/api/favorites` 返回 4 条，其中 id=7 的 `note="Day 19 写入验证"`、`createdAt=2026-10-04T10:52:02Z`—— 11 天前写入的数据今天仍可读出，且 MCP 直连 `favorites` 表同样 4 行，两条独立路径互证 |
| 线上文件与仓库一致 | PASS | 三文件 md5 逐字节一致（见能力底线表第 5 行） |
| 密钥、.env、私人信息未进 Git | PASS | `git grep -IE "ZengLingWang\|1[3-9][0-9]{9}\|[0-9]{17}[0-9Xx]"` 已入库文件 **0 命中** |
| 检查台是否在公网 | **未部署** | `console.html` 线上 **404**（发布源 `.workbuddy/publish/` 只放三文件，刻意不放检查台与 `.env`）。本地与接口级验证通过，但公网不可达—— 演示时不能说「公网有三个页面」 |

---

## 四、两个 FAIL 的根因与修复动作

### 现象

公网首页在真实浏览器里显示错误态，0 张卡片。

### 根因（Day 20对照实验锁定，Day 22/23/24/27/28 连续实测同一现象）

**CloudBase 安全域名白名单缺`ai-concept-daily.app.workbuddy.host`。**
浏览器从该域名发fetch 到 CloudBase HTTP 网关，响应无 `Access-Control-Allow-Origin`，浏览器直接拦掉→ 首页 `fetch` 失败 → 走 `error` 分支 → 0 卡片。

### 今天新增的核实证据

MCP `queryEnv(action=domains)` 返回 11 条域名，逐条核对：
- 1 条 USER 类型：`ai-concept-daily-d2ex3o18b05e6dd-1498895639.tcloudbaseapp.com`
- 10 条 SYSTEM 类型：`weda.cloud.tencent.com/cn`、`tcb.cloud.tencent.com/cn`、`*.preview.cloudbase.net`、`*.webapps.tcloudbase.com` 等

**结论：确实没有 `ai-concept-daily.app.workbuddy.host`。** 这不是工具读错，是客观事实。

### 为什么改不了（Day 12–14 已查清，如实记录）

- `addSecurityDomain` API 被**套餐**拦截：`[CreateAuthDomain] 当前套餐无法执行此操作`（体验版 `baas_trial` 无此权限）—— 不是工具 bug。
- 换静态托管域名绕过不了：`…tcloudbaseapp.com` 返回 418 空响应，且以其为 Origin 请求接口同样无 ACAO 响应头。

### 修复动作（需你亲手做，我不能代做）

控制台路径：**云开发平台 → 环境 `ai-concept-daily-d2ex3o18b05e6dd` → 环境配置 → 安全来源 → 安全域名 →【添加域名】**

- 填：`ai-concept-daily.app.workbuddy.host`（**不带协议、不带路径、不带端口**）
- 每环境≤ 50 条，1–2 分钟生效
- 生效后我立刻重跑 A3 + A7，两项应变PASS，线上发布那一项才能补成满分

### 已知的替代验证路径（今天 Day 27 已验证过）

`http://localhost:5500/` 在白名单内，**不依赖上述修复**即可跑通完整 UX 流程（收藏 → 刷新仍在 → 取消 → 刷新保持已取消，5 步全过，截图 `Day27-修复验证-1..5.png`）。演示录屏可用localhost 版；公网版留待白名单修好。

---

## 五、资源、额度、到期与备份

| 项 | 值 | 来源 |
|---|---|---|
| 环境 ID | `ai-concept-daily-d2ex3o18b05e6dd` | MCP |
| 套餐 | 体验版 `baas_trial` | MCP `info` |
| 计费模式 | 预付费 `PREPAYMENT`，`EnvPaid=yes` / `EnvCharged=yes` | MCP `info` |
| **到期时间** | **2027-03-31 23:59:59** | MCP `BillingInfo.ExpireTime` |
| **自动续费** | **否**（`IsAutoRenew=false`） | MCP `info` |
| 激活状态 | `EnvActivated=no`、`IsAlwaysFree=false`、`EnableOverrun=false` | MCP `info` |
| QPS 配额 | 500（`QpsCustomLimit=-1`，未自定义提额） | MCP `info` |
| PG 实例 | `postgres-es1p1ktk`，SHARED 租户，ap-shanghai | MCP `info` |
| 运行时 | PostgreSQL（`nosql=false`、`mysql=false`） | MCP `RuntimeBackends` |
| 数据备份 | `.workbuddy/backups/2026-10-13-pre-v1.0-data.json`（12657B）+同名 `.sql`（15987B，INSERT 语句）+ `2026-10-13-day27-data.sql` | 本地磁盘，未入库（正确） |
| 备份含密钥？ | 否。Day 27 复扫仅命中备份文件自身注释里的扫描说明行 | `Day27-验证记录.md` |

**到期风险结论**：距到期约 5.3 个月，**不自动续费**。到期后环境停服 → 公网地址与接口同时失效，数据在 PG 实例里不会丢，但需重新购买环境并重新部署。这条已记录，不隐藏。

---

## 六、结营复盘（200 字以内）

28 天做了一个「每日一个 AI 概念」网站：静态三页 + 云函数 7 接口 + PostgreSQL 6 表，收藏的增查改删真跑通了。最有价值的不是网站本身，是三个习惯——**改一件事只验证一件事**（Day 24 定位「取消收藏假成功」，靠的是读回比对而不是看返回值）；**判据要能自己被推翻**（Day 20 的 CORS 判据表直接推翻我前 5 天「全绿」的测试有效性）；**失败要留证据**（故意注入假密钥验证门禁能抓到）。最大的教训是**平台限制会拖住交付**：跨域白名单卡了 8 天，教会我把「我做不了的」和「我做错的」分开记。下一个作品，先定验收门禁，再动手写代码。

---

## 七、今天要交的两张截图（需你亲手截，我不代做）

### 截图 1｜附录 J 验收清单逐项打勾

**怎么截**：打开本文件（`Day28-最终验收表.md`）的 §一、§二 两张表，在Word/浏览器里把每行判定列加上勾（✅ 通过 / ⚠️ 部分通过 / ❌ 失败 / ⬜ 未执行），**让「线上发布」那一行的 ⚠️ 和 §四 的两个 FAIL 一起出现在画面里**。

**为什么要把 FAIL 一起截进去**：清单要求「逐项打勾」，但只截全绿等于隐瞒。验收官看到你标出了 FAIL 和根因，比看到全绿更能说明你真测过。

**图里必须有**：表格的勾选状态 + 文档标题「Day 28｜最终验收表与项目映射表」。

### 截图 2｜作品公网 URL 打开的样子

**怎么截**：
1. 浏览器打开 `https://ai-concept-daily.app.workbuddy.host/`
2. **不要隐藏地址栏**（清单明确要求「图里要有地址栏」）
3. 等页面加载完（当前会显示错误提示文案，这是真实状态）
4. 全屏截图

**你会看到什么**：页面显示请求失败的错误态，0 张概念卡片。**这是当前真实状态，不是截图失败。**

**如果想让截图好看些（可选，二选一）**：
- 方案 A（推荐）：照实截错误态，在图上补一行文字「安全域名白名单未加，见验收表 §四」—— 诚实且信息量更大
- 方案 B：先去控制台加白名单（1–2 分钟生效），修好后我重跑 A3/A7，全PASS 再截，页面正常显示 7 张卡片

**不能做**：拿 localhost 截图冒充公网截图，或用Day 20 的旧图（那张是修好之前拍的，界面已变）。

---

## 八、诚实交代：今天仍未完成的事

| 事项 | 状态 | 卡在哪 |
|---|---|---|
| 公网首页对真实用户可用（A3/A7） | **未完成** | 安全域名白名单，需控制台人工操作，已连续 8 天 |
| 真人外行试用（Day 27 遗留） | **未完成** | 需一位没参与项目的真人在浏览器里点一遍；我AI 不能代做。脚本已备好：`Day27-外行试用任务脚本.md` |
| 真人复验「取消收藏」修复 | **未完成** | 同上；可走 `localhost:5500` 当天完成，脚本见 `Day27-最小复验任务.md` |
| console 资源页截图 | **未完成** | 需你手动截 CloudBase 控制台资源用量页 |
| Day 26/27 遗留文档提交 |今日一并提交 | 见收尾提交 |

以上 5 项**不因「今日验收表已写完」而变成已完成**。验收表的职责是把它们如实摊开，不是把它们抹平。