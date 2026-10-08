# Day 22 验证记录｜PATCH / DELETE 上线，四类操作闭环

> 日期：2026-10-08 · 第4 周 ·板块顺序：① PATCH 实现 ② DELETE 实现 ③ 四类操作闭环验证
> 详细过程见本文；契约见 `api-contract.md` v0.6 §4.6 / §4.7。

---

## 1. 清单核对（动手前先摆事实）

| 清单条目 | 与本项目是否对应 | 处理 |
|---|---|---|
| PATCH / DELETE 支持路径参数 `:id`，函数内通过 id 定位 | 完全对应 | 执行（本项目只有 `favorites` 需改/删；`concepts` 是内容表，不开放写入） |
| 在「检查台页面」上完成真实的修改和删除 | **本项目原先没有检查台页面** | **新建 `console.html`**（Day 22 产物，见§6） |
| 数据库 select 确认修改、删除真实生效 | 完全对应 | 执行（§4、§5） |
| 更新 `api-contract.md` 登记两个接口 | 完全对应 | 执行（升v0.6） |
| PATCH 只允许修改备注字段 | 完全对应 | 执行（多传字段直接拒，见 §3 用例6） |
| 删除操作增加二次确认 | 完全对应 | 执行（`console.html` 确认弹窗，见 §6） |
| 今日不做：批量操作 / 用户系统 | — | **均未做**，契约 §4.6/§4.7 已显式声明 |

---

## 2. 开工前的两个意外发现（影响方案，先说清）

### 2.1 Day 20 遗留的「`OPTIONS` 预检 404」已经不存在了

Day 20（2026-10-06）实测记录：`OPTIONS /api/favorites` → **404**，判断是「云函数不放行 OPTIONS」，结论是「POST 收藏在浏览器里必然被拦」，留待第 4 周处理。

**Day 22 复测（2026-10-08）**：

```
OPTIONS /api/favorites/14  -H "Origin: http://localhost:5500"
  -H "Access-Control-Request-Method: PATCH"
  -H "Access-Control-Request-Headers: content-type"
→ HTTP 204 No Content
   access-control-allow-methods: PATCH
   access-control-allow-origin: http://localhost:5500
   access-control-allow-headers: Content-Type
   access-control-allow-credentials: true
```

| 判据 | Day 20（10-06） | Day 22（10-08） |
|---|---|---|
| `OPTIONS` 预检 | **404** | **204**，且回 `allow-methods: PATCH` |
| 云函数是否需改代码 | 判为「需要」 | **不需要**（网关层已自动应答 CORS 预检） |

**结论**：Day 20 的判断在**当时是对的**（当时确实是 404），但平台侧后续把这个能力补上了。**今天因此没有为放行 OPTIONS 去改后端代码** —— 属于「清单未要求 + 现状已无需改」，不擅自扩大范围。
> 这条留给验收日的一个提醒：Day 20 记录里的结论已过期，若Day 28 有人拿那份文档说「预检有问题」，以本节为准。

### 2.2 网关已放行 PATCH / DELETE，不需要新建路由

部署前先用空探测确认方法能不能过网关：

| 探测 | 结果 | 判读 |
|---|---|---|
| `PATCH /api/favorites/99999`（未部署时的代码） | 404 + 响应体 `{"ok":false,...,"code":"NOT_FOUND","message":"接口不存在"}` | **404 来自我们自己的函数**（响应体是我们的信封），不是网关拒绝 |
| `DELETE /api/favorites/99999` | 同上 | 同上 |
| 响应头 `x-cloudbase-upstream-status-code: 404` + `x-cloudbase-upstream-type: Tencent-SCF` | — | 上游确实是云函数 |

**结论**：既有 `/api/favorites` 前缀路由（`enablePathTransmission=true`、无方法限制）已覆盖 `/api/favorites/{id}` 并透传方法。**今天没有新建任何网关路由**，与 Day 19 加 `GET /api/favorites` 时的判断一致。

---

## 3. 实现：改了什么文件

| 文件 | 改动 | 属于哪个文件 |
|---|---|---|
| `functions/api/index.js` | `parseRoute` 放行 `PATCH` / `DELETE`，形状 `/api/favorites/{id}`；主分发接两个 handler | ① PATCH + ② DELETE |
| `functions/api/lib/handlers/updateFavorite.js` | **新建**。校验 id / note，只改备注；「回填 0 行 → 404」 | ① PATCH |
| `functions/api/lib/handlers/deleteFavorite.js` | **新建**。校验 id；「回填 0 行 → 404」 | ② DELETE |
| `functions/api/lib/repositories/favoritesRepo.js` | 加 `updateFavoriteNote` / `deleteFavoriteById` + 抽出共用行映射 `mapFavoriteRow` | ①+② |
| `functions/api/lib/db.js` | 加 `update()`（PATCH）/ `remove()`（DELETE）两个 PostgREST 传输方法，均带 `Prefer: return=representation` | ①+② |
| `functions/api/lib/errors.js` | 加 5 个错误码 | ① PATCH |
| `console.html` | **新建**。检查台页面（含删除二次确认） | ③ 闭环验证的页面载体 |
| `api-contract.md` | 升 v0.6，新增 §4.6 / §4.7，§3补 5 码，§7 自检表补两列 | 契约同步 |
| `PRD.md` §1.4 / `TECH_DESIGN.md` §9.5 | 变更记录补一行 | 契约同步 |
| `.workbuddy/day22-local-test.js` | **新建**。本地沙箱测试（21 项） | 验证工具 |

### 3.1 两个设计决定（值得说清为什么）

**决定一：防呆靠「回填行数」，不靠「先查后写」。**

```js
// repositories/favoritesRepo.js
async function updateFavoriteNote(id, note) {
  const rows = await update('favorites', `id=eq.${id}&select=...`, { note });
  if (!Array.isArray(rows) || !rows.length) return { hit: false, row: null };  // ← 关键
  return { hit: true, row: mapFavoriteRow(rows[0]) };
}
```

`Prefer: return=representation` 让PostgREST 把命中的行原样退回。**退回 0 行 = 这个 id 不存在**。
如果先 `SELECT` 再 `UPDATE`，会多一次往返，还留下「查得到却改不动」的竞态窗口。

**决定二：拆 3 个错误码，而不是复用。**

第一版直接复用了 `MISSING_FIELD` / `INVALID_FIELD`，真实调一次就发现问题：

```
PATCH /api/favorites/14  -d '{}'
→ {"code":"MISSING_FIELD","message":"请指定要收藏的概念"}    ←驴唇不对马嘴
```

改备注却提示"要收藏的概念"，用户看不懂。契约 §2 硬规则要求 `message` 说人话，**说错场景的话比不说更糟**。故拆出`MISSING_NOTE` / `PATCH_INVALID_FIELD` / `PATCH_FIELD_NOT_ALLOWED`，并重新部署复测。

---

## 4. 检测 1：修改检测（页面 + 数据库两端都看到）

**清单要求的操作**：把一条记录的备注改成「测试-改」，刷新仍在；控制台 select 看同一行，字段值真实变了。

### 4.1 接口侧

```bash
B="https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"
curl -s -X PATCH "$B/api/favorites/14" -H "Content-Type: application/json" -d '{"note":"测试-改"}'
```

```json
{"ok":true,"data":{"id":14,"slug":"003-prompt","note":"测试-改","createdAt":"2026-10-06T10:57:00.483Z"},"error":null}
HTTP=200
```

### 4.2 数据库侧（`queryPgDatabase`只读 SQL）

**改之前**：

```sql
SELECT f.id, c.slug, f.note FROM favorites f JOIN concepts c ON c.id=f.concept_id WHERE f.id IN (14,17);
```

| id | slug | note |
|---|---|---|
| 14 | 003-prompt | **null** |
| 17 | 005-attention | null |

**改之后**（同一条 SQL）：

| id | slug | note |
|---|---|---|
| 14 | 003-prompt | **测试-改** ✅ |
| 17 | 005-attention | null（未受影响） |

**判读**：接口回200 只是「服务端说改成了」，数据库 select 看到 `null → 测试-改` 才是**真数据变了**。两端都看到 = 改的是真库。

### 4.3 页面侧（真实 Chrome）

检查台列表中 id=14 那一行：备注从「（空）」变成「测试-改」，状态栏显示 `修改成功：id 14（003-prompt）备注已改为「测试-改」`。
截图：`Day22-参考-2-PATCH改备注成功.png`（改前截图见 `Day22-参考-1-检查台初始列表.png`）

---

## 5. 检测 2：删除检测（两端都消失 = 真删了）

### 5.1 删之前：先确认它在

```
GET /api/favorites  → 第6 行有 "id":17,"slug":"005-attention"
当前 count = 7
```

### 5.2 执行删除

```bash
curl -s -X DELETE "$B/api/favorites/17"
```
```json
{"ok":true,"data":{"id":17,"slug":"005-attention","note":null,"createdAt":"2026-10-06T10:59:04.294Z"},"error":null}
HTTP=200
```

### 5.3 删之后：GET 里不再返回

```
005-attention 出现次数: 0
当前 count = 6                （7 → 6）
剩余 id = [19, 18, 14, 10, 7, 5]   （17 已不在其中）
```

### 5.4 数据库侧

| id | slug | note |
|---|---|---|
| 17 | ~~005-attention~~ | **整行已消失** ✅ |

### 5.5 页面侧（真实 Chrome，id=18）

| 步骤 | 结果 |
|---|---|
| 点「删除这条收藏」 | 弹出二次确认框：`即将删除 id = 18 的收藏。删除后不可恢复。` |
| 点**取消** | `004-hallucination` **仍在列表里**（二次确认真的拦住了） |
| 再点删除 → 点**确认删除** | 状态栏`已删除：id 18（004-hallucination），列表里已不再出现`，列表里该行消失 |

数据库侧同步确认 id=18 整行消失（最终 5 行：5/ 7 / 10 / 14 / 19）。
截图：`Day22-参考-3-删除二次确认.png`、`Day22-参考-4-DELETE删除成功.png`

---

## 6. 检测 3：防呆检测（不存在的 id 不许报成功）

清单原话：**「删一个不存在的数据还报『成功』= 防呆缺失，必须修」**。

### 6.1 curl 实测（线上公网）

| # | 用例 | 命令 | 实际返回 | 判定 |
|---|---|---|---|---|
| 1 | PATCH 不存在的 id | `-X PATCH "$B/api/favorites/99999" -d '{"note":"x"}'` | `{"code":"FAVORITE_NOT_FOUND","message":"这条收藏已经不在了"}` **404** | ✅ |
| 2 | DELETE 不存在的 id | `-X DELETE "$B/api/favorites/99999"` | 同上**404** | ✅ |
| 3 | PATCH 重复删已删的 id | `-X DELETE "$B/api/favorites/17"`（第二次） | 同上 **404** | ✅ 关键 |
| 4 | PATCH 非法 id | `-X PATCH "$B/api/favorites/abc"` | `{"code":"INVALID_ID","message":"收藏编号不对，请刷新页面重试"}` **400** | ✅ |
| 5 | DELETE 非法 id | `-X DELETE "$B/api/favorites/abc"` | 同上 **400** | ✅ |
| 6 | PATCH 带多余字段 | `-d '{"note":"y","slug":"002-token"}'` | `{"code":"PATCH_FIELD_NOT_ALLOWED","message":"只能改备注，其他内容不能改"}` **400** | ✅ |
| 7 | PATCH 缺 note | `-d '{}'` | `{"code":"MISSING_NOTE","message":"请填写要改的备注内容"}` **400** | ✅ |
| 8 | PATCH note 非字符串 | `-d '{"note":123}'` | `{"code":"PATCH_INVALID_FIELD","message":"备注格式不对，只能是文字"}` **400** | ✅ |
| 9 | PATCH note 超 200 字 | `-d '{"note":"aaa…250字"}'` | `{"code":"FIELD_TOO_LONG","message":"备注最多 200 字"}` **400** | ✅ |

**11 条线上 curl 用例（含 §7 回归）全部返回受控中文错误，无一条 500 裸报错。**

### 6.2 页面侧

检查台输入 99999 → PATCH 与 DELETE 都显示红色提示：
`失败：FAVORITE_NOT_FOUND —— 这条收藏已经不在了`，**页面不崩、列表不受影响**。
截图：`Day22-参考-5-不存在id的错误提示.png`

### 6.3 本地沙箱（部署前就跑过，21/21）

```bash
node .workbuddy/day22-local-test.js
```
```
PASS  PATCH 正常 → ok:true / 回 id 14 / note 已改 / 空串 → note 变 null
PASS  PATCH 不存在 id → 报错 / → 404
PASS  PATCH 非法 id "abc" / "-1" / "0" / "1.5" / "" → INVALID_ID
PASS  PATCH 缺 note / 多余字段 slug / note 超长 / note 非字符串
PASS  DELETE 正常 → ok:true / 回 id 19 / 回 slug
PASS  DELETE 不存在 id → 报错 / → 404 / 非法 id → INVALID_ID
结果：21/21 通过
```
> 写这个脚本时踩到一个坑：它把`errors.js` 加载了两份，导致 `ApiError` 的 `instanceof` 判断失效、404 被误判成 500。生产环境只有一份模块不会触发，但已把测试脚本改成**全测试共用一个 errors 单例**。

---

## 7. 检测 4：契约同步 + 全接口回归

### 7.1 回归（确认今天的改动没弄坏前四天的东西）

| 接口 | 结果 |
|---|---|
| `GET /api/health` | 200 ✅ |
| `GET /api/concepts` | 200 ✅ |
| `GET /api/concepts/007-rag` | 200 ✅ |
| `GET /api/favorites` | 200，字段形状不变 ✅ |
| `POST /api/favorites`（重复收藏） | 409 `DUPLICATE_FAVORITE` ✅ 与 Day 18 行为一致 |

### 7.2 契约同步（清单「契约没更新= 验收日会踩自己挖的坑」）

`api-contract.md` 已升 **v0.6**，打开即见：

| 位置 | 内容 |
|---|---|
| 文首修订记录 | v0.6 一行，写明新增什么、改了什么口径、拆了几个码 |
| §1 路由表 | 注明 PATCH/DELETE **复用既有 `/api/favorites` 前缀路由，未新建** |
| §3 错误码表 | 新增 5 行 + 「为什么拆码」脚注 + 「防呆口径」说明 |
| **§4.6** | `PATCH /api/favorites/{id}` ✅ 已实现 —— 用途/请求体/字段规则表/两个响应示例/5 条要点 |
| **§4.7** | `DELETE /api/favorites/{id}` ✅ 已实现 —— 同上 |
| §4.4 要点 4 | 「不做」清单更新为只剩批量操作 |
| §5 | `PATCH`/`DELETE` 那行**划掉**（已登记），补 Day 22 变更说明 |
| §7 自检表 | 由5 列扩到 7 列，新增「防呆」「已公网实测」两行 |

同步改了 `PRD.md` §1.4 与 `TECH_DESIGN.md` §9.5 的排除口径（项目定下的纪律：改契约要同时改这两处）。

---

## 8. 四类操作闭环总表

| 操作 | 接口 | 状态 | 真实生效证据 |
|---|---|---|---|
| **增** | `POST /api/favorites` | ✅ Day 18 | Day 18/19 已验；今天回归 409 行为不变 |
| **查** | `GET /api/favorites` | ✅ Day 19 | 今天 count 7 → 6 → 5，顺序与字段不变 |
| **改** | `PATCH /api/favorites/{id}` | ✅ **Day 22 新** | DB：`note` 由 `null` → `测试-改` |
| **删** | `DELETE /api/favorites/{id}` | ✅ **Day 22 新** | DB：id=17 / 18 两行整行消失 |

**结论：增删改查四类操作闭环成立，且每一类都有「接口 + 数据库」双端证据。**

---

## 9. 交付物清单

| 文件 | 说明 |
|---|---|
| `console.html` | 检查台页面（改/删/列表 + 二次确认） |
| `Day22-参考-1-检查台初始列表.png` | 改之前：id=14 备注「（空）」 |
| `Day22-参考-2-PATCH改备注成功.png` | 改之后：id=14 备注「测试-改」 |
| `Day22-参考-3-删除二次确认.png` | 删除二次确认弹窗 |
| `Day22-参考-4-DELETE删除成功.png` | 删除后 id=18 从列表消失 |
| `Day22-参考-5-不存在id的错误提示.png` | 防呆：中文错误，页面不崩 |
| `Day22-自检留档-一张图.png` | 群内只交这一张（四格拼图） |
| `Day22-验证记录.md` | 本文档 |
| `.workbuddy/day22-local-test.js` | 本地沙箱测试（21 项） |
| `.workbuddy/day22-cdp.js` | 真实 Chrome 自动化操作脚本 |

---

## 10. 未完成 / 需人工做的事（诚实列出）

| # | 事项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **安全域名白名单仍缺 `ai-concept-daily.app.workbuddy.host`** | ❌ **未完成（阻塞项，Day 20 遗留）** | 今天实测：该域名的请求**依然拿不到** `Access-Control-Allow-Origin` 头。后果：公网首页仍显示错误态、`console.html` 若部署到 workbuddy 域名也无法调接口。**需用户手动加**（MCP 工具数组参数有 bug，`tcb env domain create` 需先 `tcb login`）|
| 2 | `console.html` 未发布到公网 | ⚠️ **有意未做** | 清单只说「在检查台页面上完成一次真实的修改和删除」，没要求发布。今天在 `localhost:5500` 验证（本地域名在白名单内，能正常调接口）。若要发布需先解决第 1 项 |
| 3 | 首页收藏按钮仍未接 PATCH/DELETE | ⚠️ **有意未做** | 清单指定的载体是「检查台页面」。首页的收藏交互按PRD 属内存态+ POST 接线（Day 20），今天不动它 |
| 4 | 批量操作、用户系统 | ✅ 按清单「今日不做」正确排除 |契约 §4.6/§4.7 已显式声明 |
| 5 | 我这一侧仍是程序化验证 | ⚠️ 说明 | curl + 数据库 select + CDP 驱动真实 Chrome；**页面的视觉呈现未经本人肉眼逐像素确认**，检查台是本次新建页面，样式较朴素 |

---

## 11. 每日一问

> **接口返回「删除成功」时，你怎么确定它真的删了，而不是只是回了个 200？**
>
> 今天用的办法是 `Prefer: return=representation` —— 让数据库把**被删掉的那一行**原样退回。
> 退回了0 行，就说明这个 `id` 本来就不存在，这时候必须报 404 而不是"成功"。
>
> 反过来说，如果只看 HTTP 状态码，`DELETE` 一个不存在的 id 也可能给你 204——
> 看起来一切正常，数据却纹丝不动。**"没报错"和"做成了"是两件事。**
>
> 这个道理不止适用于删除接口：任何"按 id 操作"的接口（改、删、启用、停用）都该问一遍：
> 目标不存在时，我返回的是「明确说没有」，还是「假装成功」？