# Day 20 验证记录｜前端接入公网接口 + 跨域

日期：2026-10-06（Day 20，第 3 周）
今日问题：**跨域那一下，你是怎么认出问题出在哪的？**

---

## 一、清单核对（先做的事：清单与本项目不一致）

今日清单里混入了另一个项目（「今日热搜聚合站」）的模板内容。已向用户摆事实并拍板，**未照字面执行**：

| 清单条目 | 核对结果 | 处置 |
|---|---|---|
| 标题「今日热搜」、聚合微博/抖音/B站 | 本项目是「每日一个 AI 概念详解」，数据库 7 条概念，无热搜数据 | 整段忽略 |
| 「检查台页面」 | 本项目无此页面（Day 13 定稿三视图：首页/详情/异常态） | 不做 |
| 「更新时间用抓取时间」 | `concepts` 表只有 `published_on`（发布日期），无抓取时间概念 | 改用接口返回的 `published_on` |
| 「本地重新**构建**」 | 本项目明确不做构建工具 | 发布 = 同步 3 文件 + 发布 |
| 「上传 CloudBase 静态托管」 | 线上实为 workbuddy 站点托管 | 沿用，链接不变 |
| 接线真实接口 / 跨域白名单 / 重新发布 / 逐项验证 / 去 mock 字样 | 与本项目完全对应 | **已执行** |

**用户拍板**：只做本项目相关部分 / 控制台白名单方案 / 沿用 workbuddy 托管 / 用 `published_on`。

---

## 二、今天真正的技术内容：跨域到底怎么定位

### 2.1 先分清「谁的问题」——第一步先验证后端

```bash
curl https://...app.tcloudbase.com/api/health      # 200 ok=true
curl https://...app.tcloudbase.com/api/concepts    # 200，7 条
```

后端完好 → 范围砍掉一半，剩下只有「前端接线」和「跨域」两个 suspects。

### 2.2 关键判据：curl 能通 ≠ 浏览器能通

`curl` **不带 `Origin` 请求头**，所以它永远测不出 CORS 问题。
这正是 Day 15–19 契约测试全绿、但页面还连不上的根本原因。

要模拟浏览器，必须自己加 `Origin`：

```bash
curl -D - -o /dev/null -H "Origin: https://ai-concept-daily.app.workbuddy.host" \
  https://...app.tcloudbase.com/api/concepts
```

### 2.3 排错判据表（今天实测确认）

| Network 面板里的现象 | Console 报错 | 根因 | 修法 |
|---|---|---|---|
| 请求根本没发出，状态 `(failed)` | — | URL 写错 / DNS / 断网 | 查地址 |
| 状态 `(blocked: CORS policy)` | `blocked by CORS policy` | **白名单里没有你的域名** | 加安全域名 |
| 状态 200 但 Console 报错 | `...has no ACAO header` | 服务端没回 CORS 头 | 开 CORS 校验 |
| 预检 `OPTIONS` 404 / 被拒 | `Method POST is not allowed` | 服务端不放行 OPTIONS | 放行 OPTIONS |
| — | `Failed to fetch` | 可能是跨域，也可能是断网 | 加 Origin 用 curl 复测 |

### 2.4 本环境的两个具体结论（实测，非推断）

**① 网关侧 CORS 已开，且会自动补头—— 只差白名单**

`queryGateway listRoutes` 显示三条 API 路由都是 `EnableSafeDomain: true`，
即CORS 校验已启用。但带 Origin 的请求响应头里**没有** `Access-Control-Allow-Origin`，
原因就是安全域名白名单里没有页面域名。

**② `OPTIONS` 预检 404 —— 一个独立于白名单的问题**

```
OPTIONS /api/favorites  →  404 Not Found
```

原因：云函数 `index.js` 的 `parseRoute` 只放行 `GET` / `POST`，其余方法走兜底 `NOT_FOUND`。
**影响：即使白名单配好，`POST /api/favorites`（收藏写入）仍会因预检失败被浏览器拦住。**
修法有两条（都需要动后端或网关配置，属清单「今天不做改后端代码」范围）：
- 云函数侧放行 `OPTIONS` 并返回 204 + CORS 头（最直接，改 `functions/api/index.js`）；
- 或关闭网关 CORS 校验、改由函数自己管 CORS 头（改动更大）。

---

## 三、改动清单

| 文件 | 改了什么 |
|---|---|
| `concepts.js` 第三节 | `fetchConceptList` 从 setTimeout mock 换成真fetch（`GET /api/concepts`）；新增 `API_BASE`、`API_TIMEOUT_MS=12000`、`apiRequest()`（统一超时 + 拆信封 + 挂 `err.code`） |
| `concepts.js` 第四节 | `toggleFavoriteMock` 换成真 `POST /api/favorites`（**故意保留旧函数名**，页面按此名调用）；新增 `fetchFavoriteSlugs()` 走 `GET /api/favorites` |
| `index.html` | 页脚「Day 8｜首页主视图（mock 数据版）」→「Day 20｜首页数据来自公网接口」；`renderSuccess` 优先用接口的 `isComplete`；列表渲染后读回收藏并重画按钮；错误态/空态文案按「数据来自接口」改写 |
| `.workbuddy/publish/*` | 三个文件同步（发布源，md5 已校验一致） |

**设计要点**：`fetchConceptList(onDone)` 的**函数名与回调形状从 Day 8 至今未变**，
所以`index.html` 的取数主流程一行都没改——Day 8 埋这层时预留的位置生效了。

---

## 四、过程中查出并修掉的两个真bug

### 4.1 POST 201 与 GET 200 的 `data` 形状不同

| 接口 | `data` 形状 |
|---|---|
| `POST /api/favorites` → 201 | **单条** `{ id, slug, note, createdAt }`（api-contract §4.4） |
| `GET /api/favorites` → 200 | `{ items: [...], count }`（api-contract §4.5） |

我最初按 GET 的形状解析 POST，导致 `shouldFav` 永远 `false`
（写入其实成功了，数据库确实多了行）。**教训：契约的 §4.4 与 §4.5 要分开看，不能想当然。**

### 4.2 `409 DUPLICATE_FAVORITE` 不是错误状态

重复收藏同一概念时接口返 409。若当失败处理，**用户对已收藏条目再点一次会看到「没能收藏」的报错提示**，
而实际结果就是「已经收藏过了」。
修法：`apiRequest` 把 `error.code` 挂到 `Error` 上，`toggleFavoriteMock` 对
`DUPLICATE_FAVORITE` 转成 `onDone(true)`。

顺带修：`apiRequest` 的 `catch` 里补`if (err && err.code) 透传`，
否则信封错误的 code 会被网络错误文案覆盖成 `undefined`。

---

## 五、逐项验证结果

### 5.1 本地接线（自动化，22 项全通过）

脚本：`.workbuddy/day20-verify-wire.js`（Node + `vm` 沙箱跑真实 `concepts.js`，真调公网接口）

```
=== 1. API_BASE 配置 ===              2 PASS
=== 2. 真实取数 GET /api/concepts ===  4 PASS   7 条 / 007 检索增强生成 / 09-22→09-16 倒序
=== 3. 字段够页面渲染用 ===            3 PASS   含 isComplete 布尔值
=== 4. 详情页深链接slug ===            1 PASS   007-rag
=== 5. 收藏写入 POST ===               2 PASS   真写库成功 + 409 当成功
=== 6. 收藏读回 GET ===                2 PASS   7 条 / createdAt 倒序
=== 7. 错误路径 404 ===                1 PASS   「这个概念我还没写」code=CONCEPT_NOT_FOUND
=== 8. 故障注入开关 ===                 2 PASS   ?favfail=1 仍可用
=== 9. 页脚无 mock 字样 ===             2 PASS
=== 10. 五接口公网回归 ===              4 PASS
================ 22 通过 / 0 失败 ================
```

### 5.2 公网发布（链接不变）

| 路径 | 状态码 | 判读 |
|---|---|---|
| `/` | **200** | 首页可打开 |
| `/concept.html?id=007-rag` | **200** | 深链接可分享 |
| `/concepts.js` | **200** | 数据文件可取 |
| `/.env` | **403** | 敏感文件仍被拦（Day 14 沉淀，已保持） |
| `/.workbuddy/` | **404** | 未被发布 |

版本核对（从公网抓下来比对）：

- 页脚 = `Day 20｜首页数据来自公网接口`✅
- `mock 数据版` 出现次数 = **0** ✅
- `MOCK_DELAY_MS` 出现次数 = **0** ✅
- `API_BASE` = 公网接口地址 ✅
- 线上 `index.html` md5 = `8b82e9c38c4763abf217ba19cca88835`，与发布源**一致** ✅

### 5.3 公网接口可用（curl，全部 200）

`GET /api/health`、`GET /api/concepts`、`GET /api/concepts/007-rag`、`GET /api/favorites` 均 200；
`POST /api/favorites` 201（真写库，已写入 `004-hallucination` / `005-attention` / `006-embedding` 三条验证数据）。

### 5.4 跨域当前实际状态（未通过，需手动一步）

| 检查 | 结果 |
|---|---|
| 网关路由 `EnableSafeDomain` | ✅ 三条 API 路由均为 true |
| 安全域名白名单含页面域名 | ❌ **无** `ai-concept-daily.app.workbuddy.host` |
| 带 Origin 的 GET 响应 | 200，但**无** `Access-Control-Allow-Origin` 头 |
| `OPTIONS` 预检 | **404**（云函数不放行 OPTIONS） |

**结论：公网首页目前会显示错误态**（"内容没能加载出来"），因为浏览器拿不到 CORS 头。
**必须先补白名单。**

---

## 六、卡点与处理（清单要求提前列的3 个，实际踩到 4 个）

| # | 卡点 | 实际发生 | 处理 |
|---|---|---|---|
| 1 | **跨域白名单未配** | ✅ 发生 | MCP 的 `manageEnv(addSecurityDomain)` 与 `callCloudApi(tcb/CreateAuthDomain)` **数组参数均被工具层包成 `{item:[...]}` 导致校验失败**（重试 6 次无效，判定为工具 bug）；`tcb env domain create` 命令存在但需先 `tcb login`（浏览器授权，须用户手动）→ **需用户手动加** |
| 2 | **`OPTIONS` 预检 404** | ✅ 发生（清单未预见） | 需云函数放行 OPTIONS，属「改后端代码」，清单说明天不做 → **留待明天，今天记录在案** |
| 3 | **POST/GET 回包形状不同** | ✅ 发生 | 按契约 §4.4/§4.5 分别处理，已修 |
| 4 | **409 被当失败** | ✅ 发生 | 挂 `err.code` 分支处理，已修 |

**白名单格式（今天查证，官方文档与 MCP schema 一致）**：
格式是 `host`，**不带协议**。填 `ai-concept-daily.app.workbuddy.host`，
**不要**填 `https://ai-concept-daily.app.workbuddy.host`（带协议无效）。
本地调试项格式为 `localhost:5500`。**不要配 `*` 通配符。**

---

## 七、清单「今天怎么检测」四项 · 逐项自检结果

检测脚本：`.workbuddy/day20-check.js`（可重复跑，只读）
真实浏览器取证：`.workbuddy/day20-cdp-check.js`（CDP 驱动真实 Chrome 打开公网首页）
**总判定：13 项 PASS / 0 项 FAIL / 2 项 BLOCKED（卡在需手动加白名单）**

### 检测 1：公网可达 ✅ 通过

| 路径 | 状态 | 判读 |
|---|---|---|
| `/` | 200 | 首页可取|
| `/concept.html?id=007-rag` | 200 | 详情深链接可取 |
| `/concepts.js` | 200 | 数据文件可取 |
| `/.env` | **403** | 敏感文件仍被拦（Day 14 沉淀，保持） |

> 同伴用自己的设备打开并看到数据 —— **此项需你线下确认并留证**，我这一侧无法代替。

### 检测 2：真数据（页面连的是真库） ✅ 通过（含改库实测）

**我实际改了一次库来验证**，这是清单要求的「控制台改一条数据，刷新页面看是否跟着变」：

```sql
-- 改
UPDATE concepts SET definition = '【Day20 真数据验证】先翻资料再回答，这就是检索增强生成。'
WHERE slug = '007-rag';
-- 结果：rowCount = 1
```

紧接着调公网接口：

```
接口返回的 007 定义：【Day20 真数据验证】先翻资料再回答，这就是检索增强生成。
✅ 判定：接口返回的是刚改的新内容 —— 页面刷新就能看到变化
```

随后**已改回原文并复查无残留**：

```
已改回原内容：回答之前先去你的资料里翻一遍，把翻到的内容一起交上去，再让它开口。
✅库已恢复原状，无残留
```

**结论**：页面数据源是真库，不是 mock。改库 → 刷新 → 内容会跟着变。

> 清单里「与附录 F 来源的当前榜单对得上」一句属于热搜站模板，本项目无榜单，已按概念内容核对。

### 检测 3：请求去向 ✅ 通过（真实 Chrome 取证）

用 CDP 驱动**真实 Chrome 154** 打开 `https://ai-concept-daily.app.workbuddy.host/`，抓 Network：

```
[GET] https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com/api/concepts

含 localhost/127.0.0.1 的请求数 : 0← 合格，无本地地址
页面/脚本请求数: 2
```

同时确认线上文件内容：

- `API_BASE` = `https://...ap-shanghai.app.tcloudbase.com`（公网，无localhost）
- `MOCK_DELAY_MS` 出现次数 = 0
- 页脚 = `Day 20｜首页主视图` → 实际为 `Day 20｜首页数据来自公网接口`，无「mock 数据版」

**检测 3 完全合格**：请求地址是公网地址，没有 localhost 残留。

### 检测 4：三件套 ⚠️ 2/3 通过

| 子项 | 状态 | 证据 |
|---|---|---|
| 4-1 公网首页可打开 | ✅ | HTTP 200 |
| 4-2 健康接口 `ok:true` | ✅ | `time=2026-10-06T11:09:15.612Z` |
| 4-3 页面写入 + 刷新仍在 | ❌ | 接口层写入已验证（真库现有 7 条），**但页面写入被跨域拦住，点不动** |

---

## 八、真实浏览器完整复现了跨域失败（最有价值的证据）

这是今天最硬的一份证据 —— 不是推断，是 Chrome 实跑：

```
浏览器：Chrome/154.0.8037.97

========== 页面实际渲染结果 ==========
  data-state : error
  卡片数量   : 0
  面板文案   : 内容没能加载出来没能连上数据接口。……
========== Network ==========
  [GET] https://...tcloudbase.com/api/concepts  -> (无状态/失败)
  ✗ 错误=net::ERR_FAILED  拦截原因=无
========== Console ==========
  error: [concepts] 读取概念列表失败： Error: 接口连不上（Failed to fetch）。
```

**逐条对上清单的三种判据**：

- 请求地址 = **公网地址** ✅
- 请求**发出去了**（Network 里有记录，只是没有响应状态）—— 不是 URL 写错
- 失败在**响应阶段** —— JS 侧只看到 `Failed to fetch`
- → **判定：跨域被浏览器拦，不是部署失败、不是接口挂了、不是代码没切干净**

### 8.1 决定性对照实验：证明根因就是「白名单少一条」

同一个接口，只改 `Origin` 头：

| Origin | Access-Control-Allow-Origin | 判读 |
|---|---|---|
| `https://ai-concept-daily.app.workbuddy.host` | **(无此头)** | ❌ 不在白名单 |
| `http://localhost:5500` | **`http://localhost:5500`**（原样回显） | ✅ 在白名单里 |

**这一个对照就排除了所有其他可能**：
- 接口正常（两个 Origin 都 HTTP 200）
- 网关 CORS 功能正常（`localhost:5500` 被正确放行并回显）
- **唯一缺口：workbuddy 域名不在安全域名白名单里**

> 注：`localhost:5500` 之所以已在白名单，是 Day 16 遗留的本地调试配置，不是我今天加的。

### 8.2 补完「每日一问」

**问：跨域那一下，你是怎么认出问题出在哪的？**

**答（今天实际走完的路径）：**
1. **先甩给后端**：curl 测接口全 200 → 后端没问题。
2. **意识到 curl 测不出 CORS**（它不带 `Origin` 头）→ 给 curl 手动加 `-H "Origin: 页面域名"`。
3. **看响应头有没有 `Access-Control-Allow-Origin`** → 没有。**这一步就把范围缩到「跨域」一个原因。**
4. **用真实浏览器复现** → `net::ERR_FAILED` + Console `Failed to fetch`，而不是 404/500。
   **这一步排除了「地址写错」和「接口异常」**。
5. **做对照实验** → 换个 `Origin`（`localhost:5500`）居然能拿到 CORS 头。
   **这一步锁死了根因：白名单少一条。**

**可复用的判据**：

| Network 现象 | 结论 |
|---|---|
| 请求根本没发出 | URL 写错 / 断网 |
| 发出但 `(failed)`，地址是公网的 | **跨域**（本文档的情况） |
| `(blocked: CORS policy)` | 白名单缺你的域名 |
| 404 / 500 | 接口或路由问题，跟跨域无关 |
| 预检 `OPTIONS` 404 | 服务端不放行 OPTIONS，写接口必然失败 |

**今天额外发现的坑**：安全域名格式是 `host`（**不带 `https://`**），且**写接口比读接口多一道 `OPTIONS` 预检**——
所以「读通」不代表「写能通」。

---

## 九、还剩什么（2 项 BLOCKED，都要你操作）

### 9.1 加安全域名白名单（阻塞 1、3、4-3）

**这是唯一的阻塞点。** MCP 工具与 `tcb` CLI 都因权限/参数问题无法代做（见 §六卡点 1）。

控制台 → 环境 `ai-concept-daily-d2ex3o18b05e6dd` → **HTTP 访问服务 → 跨域设置 → 添加跨域域名**：

```
ai-concept-daily.app.workbuddy.host
localhost:5500
```

⚠️ **不带 `https://`**，**不要用 `*`**。配完等 1–2 分钟。

验证方法：重跑 `node .workbuddy/day20-check.js`，跨域那两项应变成 PASS。

### 9.2 同伴从自己设备打开（检测 1 的最后一环）

白名单生效后再约同伴，否则对方只会看到错误态。

---

## 十、完成标准核对（检测后更新）

| 完成标准 | 状态 | 证据 |
|---|---|---|
| 公网首页展示数据库真实数据 | **部分** | 接口真实可用、改库实测生效、真实 Chrome 确认地址是公网；**但白名单未配，浏览器实际显示错误态** |
| 控制台改数据刷新跟着变 | **已完成** | 实测 `UPDATE` → 接口返回新内容（§检测 2）|
| F12 里请求地址是公网地址 | **已完成** | 真实 Chrome Network 抓取，地址为公网，无 localhost（§检测 3） |
| 健康接口和读写接口公网可用 | **已完成** | 五接口 curl 全 200/201；真库 favorites 现有 7 条 |
| 至少一名同伴从自己的设备打开 | **未完成** | 需你操作 |
| 跨域等部署问题已解决并有记录 | **部分** | 根因已用对照实验锁定并记录；**白名单这一步需你手动完成** |

---

## 八、每日一问（今天真正要掌握的）

**问：curl 明明返回 200，为什么浏览器就是拿不到数据？**

答：因为 curl 不带 `Origin` 头，而 CORS 是浏览器强制执行的规则。
判定动作只有一个——**把浏览器的 `Origin` 手动加进 curl**：

```bash
curl -D - -o /dev/null -H "Origin: https://你的页面域名" 接口地址
```

看响应里有没有 `Access-Control-Allow-Origin`：
- 没有 → 白名单没配你的域名，或服务端没开 CORS；
- 有了但浏览器还报 → 域名写法不对（带 `https://` 就是常见错法）；
- 预检 `OPTIONS` 404 → 服务端只放行了 GET/POST，还要放行 OPTIONS。

**今天还多知道一件事**：安全域名的格式是 `host`（不带协议），且**写接口比读接口多一道预检**，
所以读通不代表写能通——`OPTIONS` 404 是个独立于白名单的坑。
