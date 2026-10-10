# Day 21｜3–5 分钟演示提纲

日期：2026-10-07（Day 21，第 3 周）
作者：曾令旺（长沙校区）
项目：每日一个 AI 概念详解网站

**四段结构**：用户问题 → 核心流程 → 提示词改写 → 验证方式
**总时长**：4 分 30 秒（含 30 秒缓冲）

| 段 | 内容 | 时长 | 累计 |
|---|---|---|---|
| 1 | 用户问题 | 40 秒 | 0:40 |
| 2 | 核心流程 | 90 秒 | 2:10 |
| 3 | 提示词改写 | 100 秒 | 3:50 |
| 4 | 验证方式 | 70 秒 | 5:00 |

> **本提纲已于 2026-10-07 实跑一遍**，每段都贴了真实输出，不是预演稿。
> 实跑记录见文末「走通记录」。

---

## 段 1｜用户问题（40 秒）

### 1.1 原始需求（我最初接到的话）

> 「做一个网站，把 AI 概念讲明白。」

### 1.2 这句话哪里不够用

第一次做这个项目时，我卡在三个地方——**因为这句话没回答它们**：

| 卡点 | 「做个网站」能回答吗 |
|---|---|
| 讲几个概念？讲给谁看？ | ❌ |
| 什么叫「讲明白」？ | ❌ |
| 数据存哪、怎么更新？ | ❌ |

于是我自己把它收敛成了**一个能验收的用户问题**：

> **「我想搞懂一个 AI 概念，30 秒内知道它是什么、为什么有用、我什么时候会用到它——而且不给我 jargon。」**

### 1.3 收敛后的用户画像

| 维度 | 设定 | 依据 |
|---|---|---|
| 身份 | 不写代码的产品/运营/学生 | 定「AI 原生」类说法想弄清指什么时，会搜这个 |
| 场景 | 刷到陌生术语，或用 AI 工具觉得时好时坏 | 来自 `001-large-language-model` 的第2 条用例 |
| 已有认知 | 会用 AI 工具，但说不清原理 | 场景二直接命中 |
| 核心诉求 | **能讲给别人听**（费曼式自检） | `001` 的费曼提问：「不用「大语言模型」这四个字，怎么向家里人解释它」 |
| 明确排除 | 不要术语、不要论文腔 | 「不给我 jargon」 |

**演示时可说的话**：

> 「用户不是开发者，他能不能把这个概念讲给家里人听，是我判断讲没讲明白的唯一标准。
> 所以详情页里我放了一道费曼提问——不是装饰，是验收器。」

---

## 段 2｜核心流程（90 秒）

### 2.1 一句话

> **静态页面 → 云函数 → CloudBase PostgreSQL → PostgREST，页面取到的是真库数据。**

### 2.2 数据流（讲的时候指这张图）

```
浏览器（静态托管 ai-concept-daily.app.workbuddy.host）
   │  fetch GET /api/concepts
   ↓
HTTP 网关（ap-shanghai.app.tcloudbase.com，enablePathTransmission=true）
   ↓
云函数 api（Event 型 / Nodejs20.19 /超时 20s）
   │  ① handlers  业务编排 + 校验 + 组装响应
   │  ② repositories  表级查询串 + snake_case→camelCase 字段映射
   │  ③ db.js  REST 传输
   ↓
PostgREST 网关  https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest/<表或视图>
   │  Authorization: Bearer <API Key>
   ↓
CloudBase PostgreSQL（public schema，6 表 2 视图）
```

> **一个必须讲的坑**：免费档共享集群 PG **没有 TCP 直连**（无内网地址、外网未开放）。
> 所以云函数**不走 pg 驱动**，改走官方 PostgREST REST API，代码零第三方依赖（Node20 自带 fetch）。
> 这个选择是 Day 17 被平台逼出来的，不是设计偏好。

### 2.3 三层分工（Day 19 重构后的结构）

| 层 | 文件 | 职责 | 行数变化 |
|---|---|---|---|
| handler | `lib/handlers/*.js` | 业务编排、校验、错误码、组装响应 | 56→47 / 71→55 / 86→87 / 50→28 |
| repositories | `lib/repositories/*.js` | 表级查询串 + 字段映射 | **新增** 123 + 64 行 |
| db.js | `lib/db.js` | REST 传输、错误分类 | 未改动 |

**关键设计点（Day 8 埋的）**：`fetchConceptList(onDone)` 的**函数名与回调形状从 Day 8 至今没变**，
所以 Day 20 把取数从 mock 换成真接口时，`index.html` 的取数主流程**一行都没改**。

### 2.4 页面形态（不做构建工具）

| 视图 | 文件 | 说明 |
|---|---|---|
| V1 首页 | `index.html` | 概念列表 + 收藏按钮 |
| V2 详情 | `concept.html?id=<slug>` | 深链接可分享 |
| V3 异常态 | 由 V1/V2 渲染 | `?state=loading\|empty\|error` 强制开关 |

**技术选择**：原生多页 + URL 参数，**不引路由库**（深链接可分享是硬验收项）。

---

## 段 3｜提示词改写（100 秒）

### 3.1 什么是这一段

**把模糊需求改写成可执行的提示词。** 这是我第 3 周真正学到的东西——
同样一件活儿，提示词的差别决定输出能不能直接用。

### 3.2 实例 A：Day 20 的跨域排查（现场真实案例）

**原始提示词（我一开始会这么写）**

```
页面连不上接口，帮我看看。
```

**AI 会怎么回**：泛泛讲一遍 CORS 是什么、让你检查服务端配置——**但不会告诉你往哪看**。

**改写后（带约束、带已知条件、带要交付物）**

```
CloudBase 静态托管页面 fetch CloudBase HTTP 网关的 Event 云函数，失败。
已知条件：
- 页面域名 ai-concept-daily.app.workbuddy.host
- 接口域名ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com
- curl 不带 Origin 时接口全部 200 正常
- 真实浏览器里 net::ERR_FAILED，Console 报 Failed to fetch
请给我一份排错判据表：Network 面板里每种现象 → 根因 → 具体改哪一步。
不要讲 CORS 原理，先给判据。
```

**输出差异**：

| 维度 | 原始提示词的输出 | 改写后的输出 |
|---|---|---|
| 内容| CORS 原理科普 | 5 行判据表：`(failed)` / `(blocked: CORS policy)` / 200 但报错 / 预检 404 / `Failed to fetch` |
| 可执行性 | 「检查一下跨域配置」 | 「加白名单，格式是 host 不带协议」 |
| 能否验证 | 不能 | 每条判据配一条 curl 命令 |

**最关键的收益**：判据表里「curl 不带 Origin 永远测不出 CORS」这一条，
**直接推翻了我前 5 天的测试方法有效性**——之前 54/54、45/45 全绿的契约测试，
用这个判据重新看，全部只是「证明了后端没问题」，从来没证明过浏览器能连。

### 3.3 实例 B：Day 16 的seed脚本（同类改写）

**原始提示词**

```
写个种子脚本，把概念数据灌进数据库。
```

**改写后**

```
写 PostgreSQL 种子脚本，要求可重复执行。
环境约束：CloudBase PG，工具通道把 TRUNCATE 归为 DDL会拒绝，所以用 DELETE。
外键关系必须按 slug 反查子查询，不能依赖自增 id（因为 id 会随重复执行往后排）。
交付：脚本文件 + 执行后五张表的行数 select。
```

**输出差异**：拿到的是一份**能反复跑、不翻倍、不依赖具体 id** 的脚本，
并且顺手解决了「自增 id 会漂移」这个隐藏坑——
这个坑在原始提示词下根本不会出现，因为需求里没提。

### 3.4 可复用的改写公式（今天总结的）

```
模糊需求
  + 已知条件（环境、已验证事实、已排除的可能）
  + 约束（不能做什么、必须遵守什么）
  + 交付物形态（表 / 命令 / 可复制的检查步骤）
  − 原理科普（明确说"不要讲原理，先给判据"）
= 可直接执行、不需要二次追问的提示词
```

**最值钱的两个要素**：

1. **「已验证事实」这一栏**。把「curl 全200」写进提示词，AI 就不会建议你查后端代码——
   因为你已经告诉它后端是好的。
2. **「不要讲原理，先给判据」**。这一句把输出从「科普」拉回「工具」。

---

## 段 4｜验证方式（70 秒）

### 4.1 我的验证分三层

| 层 | 手段 | 证明什么 |
|---|---|---|
| 契约层 | `test-contract-live.js` / `test-favorites-roundtrip-live.js` | 响应**形状**与 `api-contract.md` 一致 |
| 真库层 | MCP `queryPgDatabase` 跑 select | 读到的**是数据库里的真数据**，不是 mock |
| 浏览器层 | CDP 驱动真实 Chrome 抓 Network / Console | 真实环境里**能不能连上** |

### 4.2 每条命令（现场可直接跑）

```bash
B="https://ai-concept-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"

# ① 契约层：45 项逐字比对
node .workbuddy/test-favorites-roundtrip-live.js    # → 契约比对合计：45/45

# ② 真库层：五张表行数
SELECT 'concepts' t, count(*) FROM public.concepts
UNION ALL SELECT 'concept_use_cases', count(*) FROM public.concept_use_cases
UNION ALL SELECT 'concept_quizzes', count(*) FROM public.concept_quizzes
UNION ALL SELECT 'concept_quiz_points', count(*) FROM public.concept_quiz_points
UNION ALL SELECT 'concept_sources', count(*) FROM public.concept_sources
# → 7 / 14 / 7 / 25 / 8（与Day 16 跑第二遍后一致 = 幂等成立）

# ③ 浏览器层：带 Origin 测 CORS（关键：不带 Origin 永远测不出）
curl -D - -o /dev/null -H "Origin: https://ai-concept-daily.app.workbuddy.host" "$B/api/concepts" \
  | grep -i "access-control-allow-origin"
```

### 4.3 「改库 → 刷新 →跟着变」是最硬的证据

```sql
UPDATE concepts SET definition = '【Day20 真数据验证】…' WHERE slug = '007-rag';
```
→ 立刻调接口，返回的是**刚改的新内容** → 改回原文。

这一条证明了页面连的是**真库**，不是本地静态文件。

### 4.4 今天必须主动说的一条局限

> **契约测试全绿 ≠ 浏览器能连上。**
>
> 第 3 周我测接口用 curl，curl **不带 `Origin` 头**，
> 而CORS 是**浏览器强制执行**的规则——所以我的测试方法从一开始就测不出跨域。
>
> 今天实测：同一个接口，
> `Origin: localhost:5500` → **能拿到 CORS 头**，
> `Origin: ai-concept-daily.app.workbuddy.host` → **拿不到**。
> 网关三条路由的 `EnableSafeDomain` 都是 `true`，唯一缺口是**白名单少一条**。
>
> 当前结论：**公网页面在浏览器里仍显示错误态**，
> `OPTIONS` 预检也仍返回 `404`（写接口会被拦）。
> 这是我第 3 周**唯一没做完的验收项**，已如实标FAIL 并留了补救计划。

**为什么要主动说这段**：验收表里那条 FAIL，如果我不讲，演示就是「挑好的说」。
讲清楚它为什么 FAIL、我怎么定位的、下周怎么补，比多报一个PASS 更能说明我会不会验收。

---

## 走通记录（2026-10-07 实跑）

| 段 | 动作 | 真实输出 | 用时 |
|---|---|---|---|
| 1 | 讲用户问题 | 表格已填（1.2 / 1.3 节） | 约 40 秒 |
| 2 | 实拉列表接口 | `GET /api/concepts` → **200**，耗时 **800 ms**，7 条 / `totalCount=7` / `completeCount=7` / `latestDate=2026-09-22`，首条 `007-rag` | 实测 |
| 2 | 实拉详情接口 | `GET /api/concepts/001-large-language-model` → **200**，六段齐全（定义/类比/为什么重要/2条用例/1 题 4 要点/1 条来源） | 实测 |
| 2 | 详情深链接 | `concept.html?id=001-large-language-model` → **200** | 实测 |
| 3 | 讲提示词改写 | 实例 A /实例 B 前后对比表 | 约 100 秒 |
| 4 | 跑契约比对 | `test-favorites-roundtrip-live.js` → **45/45**；`test-contract-live.js` → 全部通过 | 实测 |
| 4 | 真库 select | 五表行数 **7 / 14 / 7 / 25 / 8** | 实测 |
| 4 | CORS 对照实验 | workbuddy 域名 **无 ACAO 头**；`localhost:5500` **有** → FAIL 根因确认 | 实测 |

**实跑中发现的一个小问题（已修正）**：第一次解析接口返回时，我把 `quiz[0].points`
当成对象数组（`{content, sortOrder}`）来读，结果显示为空。
实际契约里**它是字符串数组**。查了 `api-contract.md` §4.3 与
`test-contract-live.js` 的断言后确认——**契约没错，是我解析脚本错了**。
这也说明契约比对脚本是有用的：它早就把`points` 的类型断言过了。

---

## 演示时不能说错的三件事

1. **别说「7 条概念全部验证通过」** —— 页面在浏览器里现在是错误态，
   契约测试全绿只证明**后端和契约**没问题，不证明**前端连得上**。
2. **别说「页面能收藏」** —— `OPTIONS` 预检404，页面点收藏会被浏览器拦。
   真库写入能力已验证，但**页面上的按钮还点不动**。
3. **别说「我建了个检查台」** —— 本项目没有检查台页面，
   Day 13 定稿的三视图是首页 / 详情 / 异常态。

## 一句话收尾（可作为演示最后一句）

> 「第 3 周我把后端从零打通到公网可复现：建库、读接口、写接口、重构、契约比对，
> 五项验收全 PASS。唯一没做完的是前端到后端的跨域通道，
> 根因已用对照实验锁定在**安全域名白名单少一条**加上**预检未放行 OPTIONS**，
> 需要一次手动配置加一处后端改动，都在下周。」