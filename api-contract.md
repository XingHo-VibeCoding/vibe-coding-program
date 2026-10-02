# API 契约（api-contract.md）

> **文档性质：接口契约初稿（Day 15 登记，只登记、不实现）。**
> 本文是前后端之间的"合同"：前端按这里的形状写解析逻辑，后端按这里的形状实现。
> 契约口径已于 2026-09-30 拍板为**方案 A**：只登记本项目自己的 3 个接口（依据 `TECH_DESIGN.md` §5.2）。
> 「今日热搜」模板里的 `/api/hot`、`/api/favorites` 等接口**不属于本项目**，未登记（理由见 §5）。
>
> - 版本：v0.3 · 日期：2026-10-02
> - 修订记录：**v0.3（2026-10-02，Day 17）** —— §4.2 / §4.3 由「未实现」标记为「已实现」并登记实测结论；修正 §1 生产 Base URL 笔误（`1498985639` → `1498895639`，数字顺序错误，以实际网关域名为准）；§3 码表补 `NOT_FOUND`（404，未登记路径兜底，2026-10-02 拍板登记）。
> - 修订记录：**v0.2（2026-10-02，Day 17 拍板 2A）** —— §4.3 的 `useCases[].text` 改为 `useCases[].content`、`sources[].title` 改为 `sources[].label`，与数据库列名（`concept_use_cases.content` / `concept_sources.label`）及 `concepts.js` 键名对齐；`TECH_DESIGN.md` §5.2 的返回示意只含列表接口形状、不涉及这两个子键名，无需同步修改。
> - 契约状态：3 个接口**全部已实现并公网验证**（Day 17：54/54 项形状比对通过；真库验证通过——改库后接口返回跟着变）

---

## 1. 基础信息

| 项 | 值 | 说明 |
|---|---|---|
| 生产 Base URL | `https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com` | CloudBase HTTP 访问服务的默认域名（API 网关），**只服务接口，不服务页面**（v0.3 修正笔误） |
| 已挂路由 | `/api/health` → 云函数 `api`<br>`/api/concepts` → 云函数 `api`（前缀覆盖 `/api/concepts/{slug}`） | Day 15 / Day 17 建立并验证；两条路由均开启路径透传（`enablePathTransmission=true`） |
| 计划路由 | ~~`/api` → 同一个云函数 `api`~~（Day 17 实际按接口各挂一条前缀路由，见上） | 按 `TECH_DESIGN.md` 方案 B1，所有接口由这一个函数承载 |
| 前端调用方式 | 相对路径或 `VITE_API_BASE_URL` | `TECH_DESIGN.md` §8.2；若两服务不同域，会触发跨域——**本期不处理**（见 §6） |

---

## 2. 统一响应信封（所有接口共用，前端只写一套解析）

```json
// 成功
{ "ok": true,  "data": { }, "error": null }

// 失败
{ "ok": false, "data": null, "error": { "code": "CONCEPT_NOT_FOUND", "message": "这个概念我还没写" } }
```

**硬规则**（依据 `TECH_DESIGN.md` §5.3，与 `PRD.md` §7 对齐）：

1. `message` 只写用户能懂的人话，**不出现任何技术信息**（表名、SQL、堆栈、连接串）。
2. 技术细节只进云函数日志，不进响应体。
3. 每个失败响应都对应前端的一个「返回首页」出口，由前端统一渲染，接口不关心。

---

## 3. 错误码表（全部接口共用）

| 业务码 | HTTP | 何时返回 | `message`（用户可见） |
|---|---|---|---|
| `MISSING_SLUG` | 400 | 请求地址没带概念标识 | 没有指定要看哪个概念 |
| `CONCEPT_NOT_FOUND` | 404 | `slug` 在库里查不到 | 这个概念我还没写 |
| `DB_UNAVAILABLE` | 503 | 数据库连不上 / 云函数超时 | 内容暂时打不开，稍后再试 |
| `INTERNAL_ERROR` | 500 | 未预期异常 | 页面出了点问题，稍后再试 |
| `NOT_FOUND` | 404 | 请求路径未登记任何接口（兜底） | 接口不存在 |

---

## 4. 接口清单

### 4.1 `GET /api/health` —— 健康检查 ✅ 已实现（Day 15）

| 项 | 内容 |
|---|---|
| 用途 | 部署自检：确认网关、云函数两层都活着（Day 15 不连数据库，故不反映数据库状态；Day 16+ 接库后建议把"库可达"纳入健康判定——**待定，Day 16 再拍板**） |
| 请求参数 | 无 |
| 成功响应 | `200`，体：`{ "ok": true, "service": "ai-concept-daily", "time": "<ISO 8601 服务器时间>" }` |
| 错误响应 | 无业务错误码；基础设施级故障由网关返回（如 `INVALID_ENV` / `INVALID_PATH`，见 `docs.cloudbase.net/error-code/service/`） |
| 已实测 | 2026-09-30 公网验证通过，响应原样透传、无网关包裹 |

### 4.2 `GET /api/concepts` —— 首页列表 + 顶部计数 ✅ 已实现（Day 17，实测通过）

| 项 | 内容 |
|---|---|
| 用途 | 首页一次性渲染完整：列表 + 计数。**统计并入列表接口**，不单开 `/api/meta`（少一个请求 = 少一个失败点，`TECH_DESIGN.md` §5.2） |
| 请求参数 | **无**（本期不做分页、筛选、搜索——`PRD §1.4`） |
| 成功响应 | `200`，`data` 形状见下方 JSON |
| 错误响应 | `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "slug": "003-transformer",
        "serialNo": 3,
        "date": "2026-09-18",
        "titleZh": "Transformer",
        "titleEn": "Transformer",
        "definition": "一种靠「注意力」并算整句话的模型架构。",
        "isComplete": true
      }
    ],
    "completeCount": 7,
    "totalCount": 7,
    "latestDate": "2026-09-22"
  },
  "error": null
}
```

> 要点：`items` **不返回正文**（类比、为什么重要、提问、要点、来源）——列表页不渲染它们，传过去纯属浪费，也保住"数据与视图分离"。`items` 按日期倒序 + 编号倒序（`TECH_DESIGN.md` §4.4），**排序由服务端做**，前端不再排。

### 4.3 `GET /api/concepts/{slug}` —— 详情页 6 段 ✅ 已实现（Day 17，实测通过）

| 项 | 内容 |
|---|---|
| 用途 | 概念详情页一次取全：页头字段 + 6 段 + 完整度 |
| 请求参数 | **路径参数** `slug`，形如 `007-rag`；服务端统一转小写后匹配 |
| 成功响应 | `200`，`data` 形状见下方 JSON |
| 错误响应 | `MISSING_SLUG`(400，未带 slug) / `CONCEPT_NOT_FOUND`(404) / `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
{
  "ok": true,
  "data": {
    "slug": "007-rag",
    "serialNo": 7,
    "date": "2026-09-22",
    "titleZh": "检索增强生成",
    "titleEn": "RAG",
    "definition": "…",
    "analogy": "…",
    "whyMatters": "…",
    "useCases": [ { "content": "…", "sortOrder": 1 } ],
    "quiz": [ { "question": "…", "points": [ "…", "…", "…" ], "sortOrder": 1 } ],
    "sources": [ { "url": "https://…", "label": "…", "sortOrder": 1 } ],
    "isComplete": true
  },
  "error": null
}
```

> 要点：6 段的**顺序由子表里的 `sortOrder` 保证**，服务端查询时显式 `ORDER BY sort_order`（`TECH_DESIGN.md` §9.1"迁移期最容易出错的四件事"之一）。字段名沿用 `concepts.js` 的英文键名口径（Day 7 拍板）；其中 `useCases[].content` 与 `sources[].label` 自 v0.2 起对齐数据库列名与 `concepts.js` 键名（原 `text` / `title` 作废）。

---

## 5. 明确不登记的接口（与本次拍板口径一致）

以下接口**不属于本项目**，故不进入本契约（依据 `PRD.md` §1.4、`TECH_DESIGN.md` §5.4；2026-09-30 拍板"方案 A"再次确认）：

| 不登记 | 理由 |
|---|---|
| `GET /api/hot`（热搜列表）、`POST /api/sync`（同步热搜） | 这是「今日热搜」项目的接口；本项目是概念词典，没有"热搜"概念 |
| `GET/POST /api/favorites`、`PATCH/DELETE /api/favorites/:id` | 本项目**任何写接口都不做**（`TECH_DESIGN.md` §5.4）。首页收藏目前是内存态（刷新即清空，已知设计限制）；若未来要做收藏持久化，属需求变更，**先改 PRD 再登记契约** |
| 登录/注册、搜索、分页、埋点 | `PRD §1.4` 明确不做 |

---

## 6. 已知待办（Day 16–20）

1. **跨域**：前端在静态托管域名，API 在网关域名，两域不同 → 浏览器调用 `/api/concepts` 时会撞 CORS。今日清单明确不处理；届时优先方案 = 把静态托管也挂到同一网关域名下（HTTP 访问服务支持关联静态网站托管），实现同域免 CORS——**Day 16 拍板**。
2. **数据库建表 + seed 导入**：`/api/concepts` 两个接口依赖 PostgreSQL 表（`TECH_DESIGN.md` §4.2）。
3. **契约变更纪律**：改本文任何形状 = 同时改 `TECH_DESIGN.md` §5 并在修订记录写一行；**前后端各自实现前先对齐本文**。

---

## 7. 契约完整性自检（对照今日"契约完整性检测"标准）

| 检查项 | 4.1 health | 4.2 concepts | 4.3 concepts/{slug} |
|---|---|---|---|
| 路径 | ✅ | ✅ | ✅ |
| 方法 | ✅ GET | ✅ GET | ✅ GET |
| 请求参数 | ✅（无） | ✅（无） | ✅（路径参数 slug） |
| 响应 JSON 形状 | ✅ | ✅ | ✅ |
| 错误形状 | ✅（网关级） | ✅（复用 §3 码表） | ✅（复用 §3 码表） |
| 统一信封 | ✅（含 ok 字段） | ✅ | ✅ |

---

*本文只登记契约，未实现任何接口，未改动任何代码文件。依据：`TECH_DESIGN.md` §5.2/§5.3/§5.4、`PRD.md` §1.4/§7、2026-09-30 拍板记录。*
