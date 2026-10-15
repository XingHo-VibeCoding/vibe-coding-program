# Day 27｜CloudBase 资源额度检查记录

日期：2026-10-13（Day 27，第 4 周）
检查人：AI 执行（全部为只读查询，未做任何变更操作）
检查工具：MCP CloudBase —— `queryEnv(action=info / usage / domains)`、`queryPgDatabase(action=sql，只读)`
环境：`ai-concept-daily-d2ex3o18b05e6dd`（别名 ai-concept-daily，ap-shanghai）

---

## 一、到期时间与套餐

| 项 | 值 | 来源 |
|---|---|---|
| 套餐 | 体验版（baas_trial） | `queryEnv info` → BillingInfo.PackageName |
| **到期时间** | **2027-03-31 23:59:59** | `queryEnv info` → BillingInfo.ExpireTime |
| 自动续费 | 否（IsAutoRenew=false） | 同上 |
| 付费模式 | 预付费（PREPAYMENT） | 同上 |
| 隔离状态 | 未隔离（IsolatedTime = 0000-00-00） | 同上 |
| QPS 配额 | 500 | BillingInfo.EnvQps.QpsQuota |
| 用量状态 | normal | BillingInfo.UsageStatus |
| 创建时间 | 2026-09-30 20:40:57 | 同上 |

## 二、本计费周期用量（2026-09-30 → 2026-10-31）

| 模块 | 用量 | 折合资源点 |
|---|---|---|
| 云函数 SCF | 调用 106 次；内存 2 GBs；出网 236 KB | 0.86 |
| 网关·安全调用（APIInvocation） | 93 次 | 0.93 |
| 网关·标准调用（HTTPInvocation） | 92 次 | 0.28 |
| 文档库 FLEXDB / MySQL(TDSQL) / 对象存储 COS / 静态托管 HOSTING / AI / 登录 Auth / 云托管 EKS / VM / Workflow / 短信 | 均为 0 | 0 |
| **合计** | — | **2.07 点** |

**判断**：体验版月度额度 3000 点（口径来自 Day 26 发布清单引用的官方配额页，访问日期 2026-10-12，本次未重新核验），本周期已用 2.07 点，约占 **0.07%**；距到期 2027-03-31 尚有 5 个多月。**无需扩容或升级。**

**一个值得注意的观察**（是观察，不是结论）：云函数调用明细只出现在 10-02（16 次）、10-03（18 次）、10-04（33 次）、10-09（39 次）四天，10-09 之后无记录。这与"公网页面自 10-06 起因跨域白名单缺失、浏览器根本调不到接口"的已知事实方向一致（curl 直连测试不走浏览器页面，不一定计入页面调用计量）；也可能是账单明细有统计延迟。以控制台画面为准。

## 三、数据备份（Day 27 导出）

| 项 | 值 |
|---|---|
| 导出文件 | `.workbuddy/backups/2026-10-13-day27-data.sql` |
| 导出方式 | MCP `queryPgDatabase` 只读 `SELECT *` 逐表全量导出，整理为 INSERT 语句；未经任何中间服务 |
| 覆盖范围 | 6 张表共 65 行：concepts 7 行 / concept_use_cases 14 行 / concept_quizzes 7 行 / concept_quiz_points 25 行 / concept_sources 8 行 / favorites 4 行 |
| 表结构 | 不在备份内——结构由 `cloudbase/` 目录迁移文件管理，恢复时先建结构再导数据 |
| 是否进 git | **否**（`.workbuddy/` 整目录被 `.gitignore` 忽略，已用 `git check-ignore` 实测） |
| 密钥/隐私核验 | 导出后对文件做关键字扫描（sk- / AIza / postgresql:// / password / secret / token / api_key / private_key / BEGIN PRIVATE KEY），正则命中 6 行，**逐行核实均为误报**（4 行为备份文件自身的核验说明注释，2 行为「词元 / Token」概念正文里的英文单词 token），无任何真实密钥特征；favorites 表 4 行 note 均为项目测试备注（"Day 19 写入验证"等），无个人身份信息 |

> **勘误（诚实记录）**：首次导出时 `concept_quiz_points` 被 MCP 查询工具的默认 `limit=20` 静默截断（接口响应仍报 `truncated:false`），备份缺 id 46–50 共 5 行；门禁 F 组的 `count(*)` 交叉核对发现了这一差异，已用 `limit=200` 全量复核并补齐（详见《Day27-验证记录.md》§三）。其余 5 张表行数均低于 20，未受影响（已与 `count(*)` 逐表核对一致）。

**恢复路径**（真出事时）：按 `Day26-回滚手册.md` §2.3 —— 先按迁移建结构，再执行本备份的 INSERT；恢复后核对行数（concepts=7 等）。

## 四、待用户手动补充（console 截图）

今日要求交的"资源检查结果"截图，请从控制台获取（MCP 数据可与画面互相印证）：

- 路径：腾讯云 CloudBase 控制台 → 环境 `ai-concept-daily` → 概览 / 资源用量页
- 画面须包含：**额度（3000 点/月）、到期日期（2027-03-31）、用量（已用 2.07 点）**
- 若控制台显示与本文数字不一致，**以控制台为准**，并把差异回来告诉我。

## 五、不确定清单（诚实标注）

1. PG 实例（postgres-es1p1ktk，共享型 SHARED）的存储用量在账单视图显示 0 MB；实际磁盘占用需以控制台数据库页为准（未实测）。
2. 体验版"3000 点/月"额度口径为第二手来源（Day 26 文档引用的官方配额页），本次未重新访问该页面。
3. 云函数调用明细 10-09 之后为空的原因（无调用 vs 统计延迟）未定论，见 §二 观察。
4. `queryEnv(action=domains)` 返回的白名单中**没有** `ai-concept-daily.app.workbuddy.host`（USER 类型仅默认 `…tcloudbaseapp.com` 一条）——这是当前公网首页打不开的根因，详见当日汇报。
