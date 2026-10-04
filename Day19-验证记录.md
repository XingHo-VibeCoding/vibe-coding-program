# Day 19 验证记录｜写接口部署 + 真实写入与读回闭环

> 日期：2026-10-04（Day 19）｜作者：曾令旺（长沙校区）
> 契约依据：`api-contract.md` **v0.5**（Day 19 新增 §4.5 `GET /api/favorites`）
> 生产 Base URL：`https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com`

---

## 0. 环境与范围

| 项 | 值 |
|---|---|
| 云函数 | `api`（Event 型 / Nodejs20.19 / 超时 20s / 云端装依赖 TRUE） |
| 部署动作 | `updateFunctionCode` 重部署（把新增的 `lib/handlers/listFavorites.js` 与 `index.js` 路由改动推上线） |
| 网关路由 | 未新增。`/api/favorites` 那条路由**不带方法限制**（方法由云函数内部判定），GET 与 POST 共用 |
| 数据库 | CloudBase PostgreSQL，实例 `postgres-es1p1ktk`，public schema，表 `favorites` |
| 今日范围 | ① POST 接口（核验 + 加固）② 部署 ③ 写入与读回验证 |
| 今日不做 | PATCH / DELETE（第 4 周）、批量写入；**未新增任何错误码** |

> ⚠️ **口径说明**：训练营清单的示例是「打卡应用 / `checkins` 表 / `GET /api/favorites` 读回」。
> 本项目的写接口是 `POST /api/favorites`（Day 18 已登记实现）；清单第 5 步要求的读回接口原被契约写成「本期不做」，
> 为让「读写闭环」真正成立，**按项目既有纪律「先改文档再实现」**，把 `GET /api/favorites` 登记为 §4.5 并实现。
> 未登记「热搜」类接口（沿用 Day 17 拍板方案 A）。

---

## 1. 三条测试命令（直接可复制执行）

先设一个变量，避免每条都写长域名：

```bash
B="https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"
```

### ① 正常写入（期望 201）

```bash
curl -i -X POST "$B/api/favorites" \
  -H "Content-Type: application/json" \
  -d '{"slug":"001-large-language-model","note":"Day 19 写入验证"}'
```

实际返回：

```
HTTP/1.1 201
{"ok":true,"data":{"id":7,"slug":"001-large-language-model","note":"Day 19 写入验证","createdAt":"2026-10-04T10:52:02.415Z"},"error":null}
```

### ② 重复提交（同一 slug 再发一次，期望 409）

```bash
curl -i -X POST "$B/api/favorites" \
  -H "Content-Type: application/json" \
  -d '{"slug":"001-large-language-model","note":"重复提交"}'
```

实际返回：

```
HTTP/1.1 409
{"ok":false,"data":null,"error":{"code":"DUPLICATE_FAVORITE","message":"这个概念你已经收藏过了"}}
```

> 防重复的两道闸：云函数捕获数据库唯一约束冲突（PostgreSQL `23505`）转成业务码；底层由 `favorites.concept_id` 的 `UNIQUE` 约束兜底。

### ③ 缺必填字段（期望 400，提示中文）

```bash
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{}'
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{"note":"忘了带 slug"}'
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{"slug":123}'
```

实际返回：

```
HTTP/1.1 400  {"ok":false,"data":null,"error":{"code":"MISSING_FIELD","message":"请指定要收藏的概念"}}
HTTP/1.1 400  {"ok":false,"data":null,"error":{"code":"MISSING_FIELD","message":"请指定要收藏的概念"}}
HTTP/1.1 400  {"ok":false,"data":null,"error":{"code":"INVALID_FIELD","message":"收藏的内容格式不对"}}
```

### ④ 读回（闭环的读侧）

```bash
curl -s "$B/api/favorites"
```

实际返回：

```json
{"ok":true,"data":{"items":[
  {"id":7,"slug":"001-large-language-model","note":"Day 19 写入验证","createdAt":"2026-10-04T10:52:02.415Z"},
  {"id":5,"slug":"007-rag","note":"第一篇收藏","createdAt":"2026-10-03T12:18:11.092Z"}
],"count":2},"error":null}
```

---

## 2. 数据库 select 验证方法

### 2.1 用 MCP 只读 SQL（本次实际用的方式）

```
queryPgDatabase(action="sql", sql="<下面的 SQL>")
```

### 2.2 用控制台 SQL 编辑器

登录 CloudBase 控制台 → 环境 `ai-concept-daily-d2ex3o18b05e6dd` → 数据库 → PostgreSQL → SQL 编辑器，粘贴同一段 SQL。

### 2.3 验证 SQL（含 JOIN，看得到 slug 而不是内部 ID）

```sql
SELECT f.id, c.slug, c.title_zh, f.note, f.created_at
FROM public.favorites f
JOIN public.concepts c ON c.id = f.concept_id
ORDER BY f.id;
```

写入前（Day 18 遗留）：

| id | slug | title_zh | note | created_at |
|---|---|---|---|---|
| 5 | 007-rag | 检索增强生成 | 第一篇收藏 | 2026-10-03 20:18:11.092456+08 |

**行数 = 1**

写入后（板 ③ 用例 ① 执行完）：

| id | slug | title_zh | note | created_at |
|---|---|---|---|---|
| 5 | 007-rag | 检索增强生成 | 第一篇收藏 | 2026-10-03 20:18:11.092456+08 |
| **7** | **001-large-language-model** | **大语言模型** | **Day 19 写入验证** | **2026-10-04 18:52:02.415653+08** |

**行数 = 2 → 比写入前多 1 行（Day 19 真实新行）**

重复提交（用例 ②）被拒后再次执行同一段 SQL，行数仍为 **2**，未写入第二行。

> 📌 后续在 19:00 又跑了一轮「五项检测」（见 §5.1），那一轮写入 `002-token` 使行数从 **2 → 3**。
> 所以现在库内是 **3 行**（007-rag / 001-large-language-model / 002-token）。行数以 §5.1 为准。

> 单表快速计数（截图用得上）：
> ```sql
> SELECT count(*) AS favorite_count FROM public.favorites;
> ```

---

## 3. 自动化契约比对结果

脚本：`.workbuddy/test-favorites-roundtrip-live.js`（公网实测，可反复执行）

```
契约比对合计：45/45
```

覆盖：§4.5 GET 形状（键集 / count / 排序倒序 / createdAt 为 UTC ISO 8601 / 不外泄 concept_id）、
§4.4 POST 的 5 类拒绝（409 / 400×3 / 404）、PATCH 与 DELETE 兜底 404、
以及 3 条老读接口回归（`/api/health`、`/api/concepts`、`/api/concepts/{slug}`）。

本地打桩测试（不连真库）：`.workbuddy/test-favorites-read-shape.js` → **21/21**；
Day 18 的 `.workbuddy/test-favorite-shape.js` 回归 → **19/19**。

---

## 4. 截图

| 文件 | 内容 |
|---|---|
| **`Day19-自检留档-一张图.png`** | **群内只交这一张**：行数核对（2→3→3）＋ 写入前后 `select` 对比 ＋ 重复/缺字段被拒 ＋ GET 读回闭环 |
| `Day19-参考-写接口三连用例.png` | 正常 201 / 重复 409 / 缺字段 400 三条命令与真实响应 |
| `Day19-参考-数据库新行.png` | 写入前 1 行 → 写入后 2 行（含 JOIN 出的 slug 与 note） |
| `Day19-参考-读写闭环读回.png` | `GET /api/favorites` 读回，新行在首位，与 POST 返回逐字段一致 |

> ⚠️ 这四张是**程序化参考截图**（把真实命令输出与真实 SQL 结果渲染成图，不含浏览器地址栏）。
> 训练营若要求「控制台/终端的原样截图」，需手动截一次：`数据库 → SQL 编辑器` 与 `终端里的 curl` 各一张。

---

## 5.1 五项检测复跑（2026-10-04 19:00–19:01，一轮到底）

上一轮（§1–§3）已经覆盖同样的路径，这里按训练营清单的编号**再跑一轮完整实测**，并把结果做成一张图：
`Day19-自检留档-一张图.png`（群内只交这一张）。

| # | 检测项 | 结果 | 实测证据 |
|---|---|---|---|
| 1 | 写入检测：正常 POST → `{ok:true}`；`select * from favorites order by id desc limit 1` 最顶上就是新行 | ✅ 通过 | `HTTP 201`，`id=10`；写入前 `limit 1` 查到 id=7（库内 2 行），写入后查到 **id=10**（库内 3 行） |
| 2 | 防重复：同一条请求原样再发 → 被拒且说明明确，行数不增加 | ✅ 通过 | `HTTP 409 DUPLICATE_FAVORITE`「这个概念你已经收藏过了」；复查 `count(*)` 仍 **3** |
| 3 | 校验：删掉必填字段再发 → 被拒且说出缺了什么 | ✅ 通过 | `HTTP 400 MISSING_FIELD`「**请指定要收藏的概念**」——直说缺的是「概念（`slug`）」，不是笼统报错 |
| 4 | 闭环：调 `GET /api/favorites` → 刚写入的数据出现在返回里 | ✅ 通过 | `HTTP 200`，`count=3`，`002-token`（id=10）在 **items 首位**，`createdAt` 与 POST 返回逐字段一致 |
| 5 | 行数核对：写入前 N 行 / 正常写入 +1 / 重复提交仍 N 行 | ✅ 通过 | **2 → 3 → 3**，三个数字对得上 |

**本轮写入的原文（可直接复现）**

```bash
B="https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{"slug":"002-token","note":"Day 19 检测批次"}'   # 201
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{"slug":"002-token","note":"Day 19 检测批次"}'   # 409（原样再发）
curl -i -X POST "$B/api/favorites" -H "Content-Type: application/json" -d '{"note":"忘了带 slug"}'                          # 400
curl -s "$B/api/favorites"                                                                                                   # 200，读回
```

```sql
-- 写入前后各查一次（表名见 db/schema.sql）
SELECT * FROM public.favorites ORDER BY id DESC LIMIT 1;   -- 最顶上就是刚写的那行
SELECT count(*) AS 行数 FROM public.favorites;             -- 2 → 3 → 3
```

**每日一问：你防了哪一种重复提交或错误输入？怎么测的？**

- **防重复**：防「同一个概念被重复收藏」。`favorites.concept_id` 上加了 `UNIQUE` 约束做地基，
  云函数捕获 PostgreSQL 唯一冲突（`23505`）后转成业务码 `DUPLICATE_FAVORITE`（409），
  而不是扔一个笼统的 500。测法：把同一条请求原样重发一次，断言 ① 状态码 409、② `error.code` 是
  `DUPLICATE_FAVORITE`、③ `message` 与契约逐字一致、④ 复查 `count(*)` 没涨。
- **防错误输入**：防「缺必填字段 / 类型不对 / 超长」。服务端在**写库之前**先校验：缺 `slug` → `MISSING_FIELD`(400)、
  `slug` 传数字 → `INVALID_FIELD`(400)、`note` 超 200 字 → `FIELD_TOO_LONG`(400)、`slug` 在库中不存在 → `CONCEPT_NOT_FOUND`(404)。
  测法：删掉 `slug` 只留 `note` 再发，断言 400 + 提示里说得清「缺的是概念」。
- 两条的共同点：**拒绝发生在写库之前或由数据库唯一约束兜底**，所以「被拒 = 行数不变」可以用行数直接证明。

---

## 6. 已知限制 / 待办

1. **前端仍未接线**：页面还在读本地 `concepts.js`（mock），收藏仍是内存态；`GET /api/favorites` 目前只有接口、没有页面消费方（Day 17 拍板 3A 悬置中）。
2. **跨域未处理**：静态托管域名与 API 网关域名不同，浏览器直接调用会撞 CORS（`api-contract.md` §6.1 待拍板）。
3. **收藏量级无上限设计**：本期无分页，`count` 等于返回条数。
4. `POST /api/favorites` 用的是 `slug` 而非「打卡日 + 计划项」，本项目没有打卡概念，防重复口径 = **同一概念只能收藏一次**。
