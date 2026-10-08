# API 契约（api-contract.md）

> **文档性质：接口契约（Day 15 登记；Day 17 实现读接口；Day 18 新增第一个写接口；Day 19 补收藏读回接口；Day 22 补改 / 删接口）。**
> 本文是前后端之间的"合同"：前端按这里的形状写解析逻辑，后端按这里的形状实现。
> 契约口径已于 2026-09-30 拍板为**方案 A**：只登记本项目自己的接口（依据 `TECH_DESIGN.md` §5.2）。
> 「今日热搜」模板里的 `/api/hot`、`/api/sync` 等接口**不属于本项目**，未登记（理由见 §5）。
>
> - 版本：v0.6 · 日期：2026-10-08
> - 修订记录：**v0.6（2026-10-08，Day 22）** —— 新增 §4.6 `PATCH /api/favorites/{id}`（只改备注）、§4.7 `DELETE /api/favorites/{id}`（删一条）。至此本项目「增删改查」四类操作齐备（查 = 4 个 GET，增 = POST Day 18，改 / 删 = 今天）。同步修改 `PRD.md` §1.4 变更记录与 `TECH_DESIGN.md` §9.5 的例外口径；§1 路由表说明**复用既有 `/api/favorites` 前缀路由、未新建网关路由**；§4.4 要点第 4 条改为「四类操作已齐」；§5 变更表去掉 PATCH/DELETE 条目；§7 自检表补两列。**新增 5 个错误码**（`FAVORITE_NOT_FOUND` / `INVALID_ID` / `MISSING_NOTE` / `PATCH_INVALID_FIELD` / `PATCH_FIELD_NOT_ALLOWED`）——拆码原因见 §3脚注。
> - 修订记录：**v0.5（2026-10-04，Day 19）** —— 新增 §4.5 `GET /api/favorites`（收藏列表读回）。属需求变更：§4.4 原写「本期不做 `GET /api/favorites`」，但 Day 19 清单明确要求「写入后再调一次读取接口确认新数据能被读出来」，**读写闭环必须有读接口才能成立**，故登记。同步修改 `PRD.md` §1.4 变更记录与 `TECH_DESIGN.md` §9.5 的例外口径；§1 路由表补 GET 说明；§4.4 要点第 4 条改为「GET 见 §4.5，PATCH/DELETE 仍不做」；§7 自检加一列；**无新增错误码**（复用 `DB_UNAVAILABLE` / `INTERNAL_ERROR`）。
> - 修订记录：**v0.4（2026-10-03，Day 18）** —— 新增 §4.4 `POST /api/favorites`（本项目**第一个写接口**，属需求变更：原 PRD §1.4 把「收藏」列为刻意排除、§5.4 声明「无持久化」，Day 11 已做收藏前端交互，Day 18 提前做持久化，故同步修改 PRD 与 `TECH_DESIGN` §9.5）；§3 码表补 4 个收藏错误码；§1 路由表补 `/api/favorites`；§5 原「不做 favorites」条目改为变更说明。
> - 修订记录：**v0.3（2026-10-02，Day 17）** —— §4.2 / §4.3 由「未实现」标记为「已实现」并登记实测结论；修正 §1 生产 Base URL笔误（`1498985639` → `1498895639`，数字顺序错误）；§3 码表补 `NOT_FOUND`（404 兜底，2026-10-02 拍板登记）。
> - 修订记录：**v0.2（2026-10-02，Day 17 拍板 2A）** —— §4.3 的 `useCases[].text` 改为 `useCases[].content`、`sources[].title` 改为 `sources[].label`，与数据库列名（`concept_use_cases.content` / `concept_sources.label`）及 `concepts.js` 键名对齐。
> - 契约状态：**读接口 4 个全部已实现并验证**；**写接口 3 个全部已实现并验证**（`POST /api/favorites` Day 18、`GET /api/favorites` Day 19、`PATCH` + `DELETE /api/favorites/{id}` Day 22）。Day 22 实测：本地沙箱 21/21 通过，线上 curl 11 条用例全对，真实 Chrome 操作 6 个场景全对，数据库 select 前后对比确认真落库。

---

## 1. 基础信息

| 项 | 值 | 说明 |
|---|---|---|
| 生产 Base URL | `https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com` | CloudBase HTTP 访问服务的默认域名（API 网关），**只服务接口，不服务页面**（v0.3 修正笔误） |
| 已挂路由 | `/api/health` → 云函数 `api`<br>`/api/concepts` → 云函数 `api`（前缀覆盖 `/api/concepts/{slug}`）<br>`/api/favorites` → 云函数 `api`（Day 18 新增；**前缀已覆盖 `/api/favorites/{id}`**，Day 22 的 PATCH / DELETE 未新建路由） | 三条路由均开启路径透传（`enablePathTransmission=true`）；**路由不带方法限制，方法由云函数内部判定**——故 `GET /api/favorites`（Day 19）与 `PATCH`/`DELETE /api/favorites/{id}`（Day 22）**都不需要新建网关路由**，全部共用既有那一条。Day 22 实测确认网关会把 PATCH / DELETE 透传到函数（未部署前探到的是本函数的 404 兜底，不是网关拒绝） |
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
| `MISSING_FIELD` | 400 | 写接口请求体缺必填字段 | 请指定要收藏的概念 |
| `INVALID_FIELD` | 400 | 字段类型不对（如 `slug` 传了数字/数组/对象） | 收藏的内容格式不对 |
| `FIELD_TOO_LONG` | 400 | 字段超过长度上限（`slug` > 64 或 `note` > 200 字符） | 备注最多 200 字 |
| `DUPLICATE_FAVORITE` | 409 | 该概念已在收藏中 | 这个概念你已经收藏过了 |
| `FAVORITE_NOT_FOUND` | 404 | PATCH / DELETE 的 `id` 在库里查不到 | 这条收藏已经不在了 |
| `INVALID_ID` | 400 | 路径 `id` 不是正整数（字母 / 负数 / 0 / 小数 / 空） | 收藏编号不对，请刷新页面重试 |
| `MISSING_NOTE` | 400 | PATCH 请求体缺 `note` | 请填写要改的备注内容 |
| `PATCH_INVALID_FIELD` | 400 | PATCH 的 `note` 不是字符串 | 备注格式不对，只能是文字 |
| `PATCH_FIELD_NOT_ALLOWED` | 400 | PATCH 带了 `note` 以外的字段 | 只能改备注，其他内容不能改 |

> 后 4 个码为 Day 18 新增（第一批写接口专属）；`CONCEPT_NOT_FOUND`、`DB_UNAVAILABLE`、`INTERNAL_ERROR` 读写共用。
>
> **⚠️ 为什么 Day 22 又拆了 3 个码（v0.6）**：原先打算让 PATCH 复用 `MISSING_FIELD` / `INVALID_FIELD`，实测发现这两个码的 `message` 是**写死了 POST 场景**的人话—— PATCH 缺 `note` 时会弹出「请指定要收藏的概念」，改备注却提示"要收藏的概念"，用户完全看不懂。契约硬规则 §2 第1 条要求 `message` 说人话，**说错场景的话比不说更糟**，故拆出 `MISSING_NOTE` / `PATCH_INVALID_FIELD` / `PATCH_FIELD_NOT_ALLOWED` 三个 PATCH 专属码。
> `INVALID_FIELD`（`收藏的内容格式不对`）保留给 POST 用，语义未变。
>
> **防呆口径（Day 22 确立）**：改 / 删**不先查后写**，而是靠 PostgREST 的 `Prefer: return=representation` 回填行数判断——回填 0 行即这个 `id` 不存在，直接回 `FAVORITE_NOT_FOUND`。**绝不允许对不存在的 id 返回成功**（清单「防呆检测」点名要修的就是这个）。

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

### 4.4 `POST /api/favorites` —— 收藏一个概念 ✅ 已实现（Day 18，本项目第一个写接口）

| 项 | 内容 |
|---|---|
| 用途 | 把一条概念加入收藏并落库。Day 11 的收藏是**内存态**（刷新即清空），本接口把它持久化到数据库 |
| 请求头 | `Content-Type: application/json` |
| 请求体 | `{ "slug": "007-rag", "note": "可选备注" }` |
| 成功响应 | `201`，`data` 形状见下方 JSON |
| 错误响应 | `MISSING_FIELD`(400) / `INVALID_FIELD`(400) / `FIELD_TOO_LONG`(400) / `CONCEPT_NOT_FOUND`(404) / `DUPLICATE_FAVORITE`(409) / `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
{
  "ok": true,
  "data": {
    "id": 1,
    "slug": "007-rag",
    "note": "第一篇收藏",
    "createdAt": "2026-10-03T12:34:56.000Z"
  },
  "error": null
}
```

**字段规则**（服务端校验，任一不满足即拒，`message` 全为中文人话）：

| 字段 | 必填 | 类型 | 长度上限 | 不满足时的码 |
|---|---|---|---|---|
| `slug` | 是 | string | ≤ 64 字符（服务端转小写、去空白后匹配） | 缺 → `MISSING_FIELD`；类型错 → `INVALID_FIELD`；超长 → `FIELD_TOO_LONG` |
| `note` | 否 | string | ≤ 200 字符；允许空/缺省 | 类型错 → `INVALID_FIELD`；超长 → `FIELD_TOO_LONG` |

> 要点：
> 1. **防重复**：同一概念重复收藏返回 `DUPLICATE_FAVORITE`(409)，**不写入第二行**；数据库上以 `favorites.concept_id` 的 `UNIQUE` 约束兜底，云函数捕获唯一冲突后转成该业务码。
> 2. **响应回 `slug` 不回 `concept_id`**：内部主键不外泄，前端只认 `slug`。
> 3. `slug` 在 `concepts` 表查不到 → `CONCEPT_NOT_FOUND`(404)，与 §4.3 复用同一个码。
> 4. 本组接口**不做**：批量写入、收藏列表分页。**四类操作的现状**（Day 22）：`POST` 见本文、`GET` 见 §4.5、`PATCH` 见 §4.6、`DELETE` 见 §4.7 —— 增删改查已齐，**批量操作仍未做**（PRD §1.4 明确不做）。

### 4.5 `GET /api/favorites` —— 收藏列表（写后读回） ✅ 已实现（Day 19）

| 项 | 内容 |
|---|---|
| 用途 | 读回已收藏的概念列表。为 Day 19「写入 → 读回」闭环提供读侧；也是将来「收藏页」的数据源（前端接线仍待办，见 §6.4） |
| 请求参数 | **无**（本期不做分页/筛选——`PRD §1.4`） |
| 成功响应 | `200`，`data` 形状见下方 JSON |
| 错误响应 | `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
{
  "ok": true,
  "data": {
    "items": [
      {
        "id": 2,
        "slug": "001-large-language-model",
        "note": "Day 19 写入验证",
        "createdAt": "2026-10-04T10:47:12.345Z"
      }
    ],
    "count": 2
  },
  "error": null
}
```

> 要点：
> 1. **排序由服务端做**：`createdAt` 倒序（最新收藏在最前），方便"刚写完就能在第一条看到"。
> 2. **只回 `slug` 不回 `concept_id`**：与 §4.4 同一口径，内部主键不外泄（跨表取 `slug` 由服务端关联完成）。
> 3. `note` 没填时回 `null`，不回空字符串——前端只判 `null` 一种情况。
> 4. `createdAt` 统一为 UTC 的 ISO 8601（`…Z`），处理方式同 §4.4（PostgREST 原样回的是 `+08:00` 偏移 + 5 位小数秒，服务端显式转换）。
> 5. 空表时回 `{ "items": [], "count": 0 }`，**不是错误**（前端渲染空态）。

### 4.6 `PATCH /api/favorites/{id}` —— 修改收藏备注 ✅ 已实现（Day 22，公网验证通过）

| 项 | 内容 |
|---|---|
| 用途 | 改一条已存在收藏的**备注**。至此「增（POST）→ 查（GET）→ 改（PATCH）→ 删（DELETE）」四类操作齐备 |
| 请求头 | `Content-Type: application/json` |
| 请求体 | `{ "note": "新的备注" }` —— **只允许这一个字段** |
| 成功响应 | `200`，`data` 形状 = 被改完的那一行（与 §4.5 `items[]` 元素同构，见下方 JSON） |
| 错误响应 | `INVALID_ID`(400) / `MISSING_NOTE`(400) / `PATCH_INVALID_FIELD`(400) / `PATCH_FIELD_NOT_ALLOWED`(400) / `FIELD_TOO_LONG`(400) / `FAVORITE_NOT_FOUND`(404) / `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
// PATCH /api/favorites/14   {"note":"测试-改"}
{
  "ok": true,
  "data": { "id": 14, "slug": "003-prompt", "note": "测试-改", "createdAt": "2026-10-06T10:57:00.483Z" },
  "error": null
}

// PATCH /api/favorites/99999（不存在的 id）
{
  "ok": false,
  "data": null,
  "error": { "code": "FAVORITE_NOT_FOUND", "message": "这条收藏已经不在了" }
}
```

**字段规则**：

| 字段 | 必填 | 类型 | 长度上限 | 说明 |
|---|---|---|---|---|
| 路径参数 `id` | 是 | 正整数 | — | 非正整数 → `INVALID_ID`(400) |
| `note` | **是** | string | ≤ 200 字符 | 缺失 → `MISSING_NOTE`；非字符串 → `PATCH_INVALID_FIELD`；超长 → `FIELD_TOO_LONG` |

> 要点：
> 1. **只允许改 `note`**：传了别的字段 → `PATCH_FIELD_NOT_ALLOWED`(400)，**不静默忽略**。`slug` 指向哪个概念属于这条收藏的身份，改了等于换成另一条收藏；`concept_id` 是外键，更不该从接口层动。**想换收藏对象 = 删掉再收藏。**
> 2. **`note` 必须出现，但可以是空串**：`""` 视为「明确清空备注」，落库成 `null`（与 §4.5 回 `null` 的口径对齐）。这样区分得清「不想改备注」与「想把备注清空」。
> 3. **成功响应直接回改完的那一行**，前端可本地替换该行显示，不必再 GET 一次对账。
> 4. **不存在就报 404，绝不报成功**：靠数据层回填行数判断（见 §3 防呆口径）。已实测：PATCH 99999 → 404，且数据库该行**未被动过**。
> 5. 本接口**不做**：改 `slug` / 改 `concept_id`、批量 PATCH（一次改多条）、部分字段的深合并（整体替换 `note`，不做 JSON Patch）。

### 4.7 `DELETE /api/favorites/{id}` —— 删除一条收藏 ✅ 已实现（Day 22，公网验证通过）

| 项 | 内容 |
|---|---|
| 用途 | 删掉一条收藏。补上 Day 18/19 遗留的最后一块——**没有删除，收藏就只能加不能减** |
| 请求参数 | **路径参数** `id`，正整数；**不需要请求体**（删除没有参数可传，带了也是忽略，反而误导） |
| 成功响应 | `200`，`data` = **被删掉的那一行**（前端可直接把这一行从列表里去掉，不必再 GET 对账） |
| 错误响应 | `INVALID_ID`(400) / `FAVORITE_NOT_FOUND`(404) / `DB_UNAVAILABLE`(503) / `INTERNAL_ERROR`(500) |

```json
// DELETE /api/favorites/17
{
  "ok": true,
  "data": { "id": 17, "slug": "005-attention", "note": null, "createdAt": "2026-10-06T10:59:04.294Z" },
  "error": null
}

// DELETE /api/favorites/17（第二次删同一条 —— 关键：不能报成功）
{
  "ok": false,
  "data": null,
  "error": { "code": "FAVORITE_NOT_FOUND", "message": "这条收藏已经不在了" }
}
```

> 要点：
> 1. **重复删必须报错**（`FAVORITE_NOT_FOUND` 404），不是返回"删除成功"。这是 `favorites.id` 主键 + 回填行数的直接结果，已实测。
> 2. **成功回 200 而不是 204**：因为要回「被删掉的那一行」，让前端不必再对账。空body 的 204 在这里反而更麻烦。
> 3. **前端必须做二次确认**（Day 22 已在 `console.html` 落地）：删除不可撤销，误点代价高。已实测「点取消 → 数据仍在」「点确认 → 真消失」。
> 4. 外键均为 `ON DELETE CASCADE`，但 `favorites` 是叶子表（没有子表引用它），删它不会牵连其他表。
> 5. 本期**不做**：批量删除（一次删多条）、按 `slug` 删（对外一律用 `id`，与 §4.5 列表返回的字段一致）、回收站 / 撤销删除。

---

## 5. 明确不登记的接口 / 变更说明

以下接口**不属于本项目**，故不进入本契约（依据 `PRD.md` §1.4、`TECH_DESIGN.md` §5.4；2026-09-30 拍板"方案 A"再次确认）：

| 不登记 | 理由 |
|---|---|
| `GET /api/hot`（热搜列表）、`POST /api/sync`（同步热搜） | 这是「今日热搜」项目的接口；本项目是概念词典，没有"热搜"概念 |
| ~~`PATCH` / `DELETE /api/favorites`~~ | **已于 Day 22 登记**（§4.6 / §4.7）——「不登记」表里已划掉这一行 |
| 登录/注册、搜索、分页、埋点 | `PRD §1.4` 明确不做 |

> **⚠️ 变更说明（Day 18，2026-10-03）**：本表原有一条「`GET/POST /api/favorites`、`PATCH/DELETE /api/favorites/:id` —— 本项目**任何写接口都不做**」。按训练营 Day 18 进度，**收藏持久化提前到今天**：这属于需求变更，故已同步修改 `PRD.md` §1.4 / §5.4 与 `TECH_DESIGN.md` §9.5 的排除口径，随后登记 §4.4。**变更纪律不变**：今后若要再加写接口，仍须先改 PRD、再改本文。
>
> **⚠️ 变更说明（Day 22，2026-10-08）**：Day 19 结束时本表还挂着「`PATCH`/`DELETE /api/favorites`属第 4 周」。Day 22 清单要求「补齐修改和删除接口，**数据操作闭环完整**」——只有增和读，收藏只能加不能减、备注写错也改不了。故登记 §4.6 / §4.7，同时在 `PRD.md` §1.4 变更记录与 `TECH_DESIGN.md` §9.5 例外口径同步补一行。**新增 5 个错误码**（`FAVORITE_NOT_FOUND` / `INVALID_ID` / `MISSING_NOTE` / `PATCH_INVALID_FIELD` / `PATCH_FIELD_NOT_ALLOWED`，拆码理由见 §3）、**未新建网关路由**（复用既有 `/api/favorites` 前缀路由）、**未做批量操作**（清单「今日不做」明确排除）。
>
> **⚠️ 变更说明（Day 19，2026-10-04）**：§4.4 原第 4 条写「本期不做 `GET /api/favorites`」。Day 19 清单要求「写入后再调一次读取接口（`GET /api/favorites`），确认新写入的数据能被读出来」——**没有读接口，读写闭环就只是半条**。故把该条改为「`GET` 属本期（§4.5），`PATCH`/`DELETE` 仍属第 4 周」，同步在 `PRD.md` §1.4 变更记录补一行、`TECH_DESIGN.md` §9.5 例外口径补读接口。**未新增错误码、未新增网关路由。**

---

## 6. 已知待办（Day 16–20）

1. **跨域**：前端在静态托管域名，API 在网关域名，两域不同 → 浏览器调用 `/api/concepts` 时会撞 CORS。今日清单明确不处理；届时优先方案 = 把静态托管也挂到同一网关域名下（HTTP 访问服务支持关联静态网站托管），实现同域免 CORS——**Day 16 拍板**。
2. **数据库建表 + seed 导入**：`/api/concepts` 两个接口依赖 PostgreSQL 表（`TECH_DESIGN.md` §4.2）。
3. **契约变更纪律**：改本文任何形状 = 同时改 `TECH_DESIGN.md` §5 并在修订记录写一行；**前后端各自实现前先对齐本文**。
4. **前端接线**：页面目前仍读本地 `concepts.js`（mock 数据），尚未切到本文接口——**待办**。

---

## 7. 契约完整性自检（对照今日"契约完整性检测"标准）

| 检查项 | 4.1 health | 4.2 concepts | 4.3 concepts/{slug} | 4.4 POST favorites | 4.5 GET favorites | 4.6 PATCH favorites/{id} | 4.7 DELETE favorites/{id} |
|---|---|---|---|---|---|---|---|
| 路径 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 方法 | ✅ GET | ✅ GET | ✅ GET | ✅ POST | ✅ GET | ✅ PATCH | ✅ DELETE |
| 请求参数 | ✅（无） | ✅（无） | ✅（路径参数 slug） | ✅（JSON 体 slug/note） | ✅（无） | ✅（路径 id + 体 note） | ✅（路径 id，无体） |
| 响应 JSON 形状 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 错误形状 | ✅（网关级） | ✅（复用 §3 码表） | ✅（复用 §3 码表） | ✅（§3 码表 + 4 个新码） | ✅（复用 `DB_UNAVAILABLE`/`INTERNAL_ERROR`） | ✅（§3 码表 + 4 个新码） | ✅（§3 码表 + 2 个新码） |
| 统一信封 | ✅（含 ok 字段） | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 防呆（不存在的 id 不报成功） | — | — | ✅（slug → 404） | ✅（重复 → 409） | — | ✅ 实测 404 | ✅ 实测 404（重复删也 404） |
| 已公网实测 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ 2026-10-08 | ✅ 2026-10-08 |

---

*本文登记契约。Day 17 已实现并验证 3 个读接口；Day 18 新增并实现 `POST /api/favorites`；Day 19 新增并实现 `GET /api/favorites`（读写闭环成立）；**Day 22 新增并实现 `PATCH` / `DELETE /api/favorites/{id}`，增删改查四类操作齐备**（详见 `Day22-验证记录.md`）。依据：`TECH_DESIGN.md` §5.2/§5.3/§5.4、`PRD.md` §1.4/§7、2026-09-30 拍板记录、2026-10-03（Day 18）/ 2026-10-04（Day 19）/ 2026-10-08（Day 22）需求变更拍板与清单。*
