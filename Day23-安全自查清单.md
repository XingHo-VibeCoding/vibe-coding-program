# Day 23 · 安全自查清单

> 作者：曾令旺（长沙校区）｜日期：2026-10-09｜范围：`index.html` / `concept.html` / `console.html` / `concepts.js` / `functions/api/` / `db/` / `api-contract.md`
>
> **判定口径**：每项都写「怎么算通过」+ 可复制的验证命令，**不接受「已修复」这种空话**。
> 复现方式：在项目根目录（`D:\Workbuddy\vibe coding program\每日一个AI概念详解网站`）用 Git Bash 执行。

---

## 〇、一句话结论

**代码与 Git 中不存在任何真实凭证**（入库 39 个文件、9 类密钥特征词、0 条命中）。
本轮共发现并修复 **9 个问题**：高危 3 项、中危 6 项。
三类错误提示已统一为「中文 + 分场景」，真实浏览器实拍验证通过。

---

## 一、密钥排查（清单 ①）

### 1.1 全仓库搜不到密钥特征词

**怎么算通过**

```bash
# 口径 A：扫 Git 已入库文件（=真正会传到 GitHub 的内容）
git ls-files | grep -vE '\.(png|jpg)$' | wc -l# → 39
for f in $(git ls-files); do grep -qiE "sk-[A-Za-z0-9]{10}|ghp_[A-Za-z0-9]{10}|AKID[A-Za-z0-9]{10}|eyJ[A-Za-z0-9_-]{20}|-----BEGIN (RSA|EC|PRIVATE|OPENSSH)|postgres(ql)?://[^ ]*:[^ @]*@|mongodb(\+srv)?://[^ ]*:[^ @]*@|AIza[0-9A-Za-z_-]{20}|xox[baprs]-[0-9A-Za-z-]{10}" "$f" && echo "命中: $f"; done
# → 命令无任何输出 = 0 条命中
```

**实测结果**：入库 39 个文件，**0 条命中**。
Git 全量历史（`git log --all -p`）命中 2 行，均为早期 `.env.example` 里的演示占位符
（`your_api_key_here`、`postgresql://user:password@localhost`），**不是真实凭证**；这两个占位符本日已删除。

**证据**：`Day23-参考-5-密钥搜索0条.png`

### 1.2 凭证全部走环境变量

**怎么算通过**：`grep -n "CLOUDBASE_API_KEY" functions/api/lib/db.js` 显示凭证**只从 `process.env` 读**，且缺失时抛错而非静默继续。

```bash
grep -n "process.env.CLOUDBASE_API_KEY" functions/api/lib/db.js
```

**实测**：`lib/db.js:31-34` —— `if (!process.env.CLOUDBASE_API_KEY) throw new RestError('PGW_DOWN', 'CLOUDBASE_API_KEY 未配置')`。
源码内零 API Key 字面量。**通过。**

### 1.3 `.env` 不在仓库且被忽略

**怎么算通过**：三条命令都要对得上

```bash
git check-ignore -v .env            # → .gitignore:9:.env	.env
git ls-files --error-unmatch .env    # → error: pathspec '.env' did not match any file(s) known to git
git ls-files --error-unmatch .env.example  # → .env.example
```

**实测**：`.env` 被 `.gitignore` 第 9 行命中、未被跟踪；`.env.example` 已入库。**通过。**

> **口径说明**：`.env` **本地保留是正常的**（开发需要）。真正的通过标准是
> 「本地有、Git 不跟踪、`.env.example` 入库」，而不是把本地 `.env` 删掉。

### 1.4 `.env.example` 存在且不含真实值

**怎么算通过**：文件存在、被Git 跟踪、且**列得出项目真正需要的变量名**。

**本日改动（3 处修正）**：

| 问题 | 原状 | 现状 |
|---|---|---|
| 缺真正需要的变量 | 只有 `LLM_API_KEY`/`DATABASE_URL` 等占位，**没有 `CLOUDBASE_API_KEY`** | 补为第一条，注明用途与配法 |
| 含 `password` 字样 | `DATABASE_URL=postgresql://user:password@localhost:5432/mydb` | 改为「`=」空值 + 注释说明格式，连示例形状也不出现 |
| 误导性变量 | 列了项目根本不用的 `THIRD_PARTY_SECRET`、`PORT` | 删除 |

所有变量值一律留空。**通过。**

### 1.5 SQL 文件无凭证

**怎么算通过**：`grep -inE "password|secret|api[_-]?key|postgres://" db/*.sql`

**实测**：0 命中（`db/seed.sql` 里出现的 `token` 是「词元」这个 AI 概念本身的内容，不是凭证）。**通过。**

### 1.6 无SQL 注入面

**怎么算通过**：不把用户输入拼进SQL。本项目走 PostgREST 查询串，无手写 SQL 拼接；
路径参数 `id` 有白名单校验 `/^\d+$/`（`updateFavorite.js:30`）。

**实测**：`updateFavorite.js` / `deleteFavorite.js` 均先 `parseId` 走 `/^\d+$/` + `Number.isSafeInteger` + `> 0` 三重校验。
**通过（本项无需修复）。**

---

## 二、三类错误提示统一（清单 ③）

### 2.1 分类口径

| 类别 | 判定依据 | 提示口径 | 涉及错误码 |
|---|---|---|---|
| **用户输入错** | 400 / 409 / 404（资源不存在） | **告诉他改什么** | `MISSING_SLUG` `CONCEPT_NOT_FOUND` `MISSING_FIELD` `INVALID_FIELD` `SLUG_TOO_LONG` `NOTE_TOO_LONG` `MISSING_NOTE` `PATCH_INVALID_FIELD` `PATCH_FIELD_NOT_ALLOWED` `INVALID_ID` `DUPLICATE_FAVORITE` `FAVORITE_NOT_FOUND` |
| **网络/接口错** | 503 / 502 / 504 / 请求未送达（status 0） | **提示稍后再试**，明确「不是你的错」 | `DB_UNAVAILABLE` `NOT_FOUND` + fetch 层失败 |
| **服务端错** | 500 / 未知 | **通用提示 + console 记日志**，细节不外泄 | `INTERNAL_ERROR` + 未登记码兜底 |

**统一出口**：`console.html` 的 `presentError(code, status, userMsg, rawErr)` + `showError(el, p)`。
调用方拿到的只有 `{ kind, code, text }`，拿不到原始异常对象。

### 2.2 怎么算通过（三条都要满足）

```bash
# ① 服务端错误的技术细节不进响应体
curl -s https://<env>-1498895639.ap-shanghai.app.tcloudbase.com/api/nothing
# → 网关层返回 {"code":"INVALID_PATH","message":"Invalid path. For more information, please refer to https://docs..."}
#   前端必须把它转成中文，不能原样显示

# ② 输入错说清「改什么」
curl -s .../api/favorites/abc -X PATCH -H "Content-Type: application/json" -d '{"note":"x"}'
# → INVALID_ID / 「收藏编号不对，请刷新页面重试」
```

**真实浏览器实拍结果**（`Day23-参考-6-三类错误对照.png`，Chrome headless 实拍 `console.html`）：

| 类别 | 页面实际显示 |
|---|---|
| 用户输入错 | **需要你改一下**　收藏 id 只能是数字，例如 14。请把列表里的编号原样填进来。 |
| 网络/接口错 | **网络/接口问题**　这是网络或接口的问题，不用改你填的内容，等一会儿再试一次就行。 |
| 服务端错 | **服务出错了**　页面出了点问题，稍后再试。这是我们这边的问题，已经记下日志了。请稍后再试。 |

**通过。三类提示全中文、无英文技术术语、无堆栈/表名/SQL 泄漏。**

### 2.3 本日修复的错误路径问题（4 项）

| # | 原问题 | 后果 | 现状 |
|---|---|---|---|
| B1 | `console.html` 用 `innerHTML` 直接拼 `note`/`slug`/`id`，**无 HTML 转义** | `note` 是用户输入并存进数据库 → **存储型 XSS** | 新增 `esc()`，三处字段全部转义。`index.html` 早有 `esc()`（458 行），本次补齐检查台 |
| B2 | 三处 `.catch(function () {...})` **丢弃 err 对象** | 线上出问题时零排障线索 | 全部 `console.warn/error` 记录，并传给 `presentError` |
| B3 | 页面直接显示 `<code>PATCH_FIELD_NOT_ALLOWED</code>` | 用户看到工程术语，且没有分类 | 改为「需要你改一下/ 网络/接口问题 / 服务出错了」三标签 |
| B4 | `concepts.js` 把「确认白名单里是页面域名不带 https://」等**内部排查话术**显示给终端用户 | 把开发者调试口诀泄漏给使用者 | 改为中性文案「网络连不上，请检查网络后刷新页面。」原始信息只进 `console.warn` |

---

## 三、非法输入边界（清单第一部分第3 项）

### 3.1 本日修复（3 项）

| # | 问题 | 原后果 | 现状 |
|---|---|---|---|
| C1 | `console.html` 的 PATCH/DELETE id 只 `trim()` 不校验 | 空 id 发出去后后端回 `NOT_FOUND`「**接口不存在**」——用户明明漏填 id，却被告知接口不存在 | 新增 `checkId()`：空/非数字/小数/负数/0 全部在**请求发出前**拦截，并说明怎么填 |
| C2 | 前端无备注长度校验 | 写300 字才被后端拒 | 前端加 200 字上限校验，提示带**实际字数**（「现在有 259 字」） |
| C3 | `FIELD_TOO_LONG` 单码message 写死「备注最多 200 字」 | 实测「slug 超长」也回这句——**提示与实际被拒字段不符** | 拆成 `SLUG_TOO_LONG`（概念编号格式不对）/ `NOTE_TOO_LONG`（备注最多 200 字），`api-contract.md` §3/§4.4/§4.6 同步 |

### 3.2 本来就合规（无需修复，但列出来备查）

| 输入 | 防护位置 | 怎么算通过 |
|---|---|---|
| 非法 JSON 体 | `index.js:92` `parseBody` → `INVALID_FIELD` 400 | `curl -d '{bad'` → 「收藏的内容格式不对」 |
| body 类型错（数组/数字/字符串） | `createFavorite.js:53`、`updateFavorite.js:39` | 全部 `INVALID_FIELD` 400 |
| PATCH 夹带其他字段 | `updateFavorite.js:44` `extraKeys` 检查 | → `PATCH_FIELD_NOT_ALLOWED`「只能改备注，其他内容不能改」 |
| slug空白 | `createFavorite.js:34` | → `MISSING_FIELD` |
| slug 超 64 | `createFavorite.js:35` | → `SLUG_TOO_LONG`（本日新增） |
| note 超 200 | `createFavorite.js:47` / `updateFavorite.js:56` | → `NOTE_TOO_LONG` |
| 改/删不存在的 id | `updateFavorite.js:61` / `deleteFavorite.js:31` | → `FAVORITE_NOT_FOUND` 404，**绝不报成功**（Day 22 立的规矩，本日未破坏） |

---

## 四、线上实测记录（2026-10-09 14:42 初测 / 15:10 真实故障注入复测）

### 4.1 常规用例

| # | 请求 | HTTP | 返回码 | 提示 |
|---|---|---|---|---|
| 1 | `PATCH /api/favorites/abc` | 400 | `INVALID_ID` | 收藏编号不对，请刷新页面重试 |
| 2 | `PATCH` 带 `slug` | 400 | `PATCH_FIELD_NOT_ALLOWED` | 只能改备注，其他内容不能改 |
| 3 | `PATCH` 空体| 400 | `MISSING_NOTE` | 请填写要改的备注内容 |
| 4 | `POST` slug 超 80 字 | 400 | `SLUG_TOO_LONG` | 概念编号格式不对 |
| 5 | `PATCH` note 超 250 字 | 400 | `NOTE_TOO_LONG` | 备注最多 200 字 |
| 6 | `DELETE /api/favorites/999999` | 404 | `FAVORITE_NOT_FOUND` | 这条收藏已经不在了 |
| 7 | `GET /api/concepts/999-x` | 404 | `CONCEPT_NOT_FOUND` | 这个概念我还没写 |
| 8 | `GET /api/health` | 200 | — | 健康检查通过 |

### 4.2 真实故障注入（不是模拟，是真的把后端改坏）

按「临时改错表名」的做法，验证第三类服务端错：

| 阶段 | 操作 | 结果 |
|---|---|---|
| 注入 | `conceptsRepo.js` 表名 `concepts` → `concepts_typo_DAY23`，部署上线 | — |
| 触发 | `GET /api/concepts` | **HTTP 500**，响应体 `{"ok":false,"data":null,"error":{"code":"INTERNAL_ERROR","message":"页面出了点问题，稍后再试"}}` |
| 隔离验证 |同时打 `/api/health`、`/api/favorites`、`/api/concepts/007-rag` | 全部 **200**（证明故障只波及改错的那个查询，定位精准） |
| 页面表现 | 无头Chrome 打开首页 | 显示「内容没能加载出来 /页面出了点问题，稍后再试。这是我们这边的问题，已经记下日志了。」**无白屏、无英文、无堆栈** |
| 还原 | 恢复文件并重新部署 | `/api/concepts` 回到 **200 / totalCount=7 / latestDate=2026-09-22**；收藏仍 **4 条** |

**这一步暴露并修掉了一个新问题**（见 4.3）。

### 4.3 注入时发现：首页把服务端错误报成网络错

第一轮截图显示首页写的是「没能连上数据接口…如果刚配过跨域白名单，等配置生效（约 1–2 分钟）后再刷新」——
但当时后端返回的是 500，**跟白名单毫无关系**。根因：`renderError()` 不接收错误对象，三类错误共用一句话。

这与 Day 23 早前在 `concepts.js` 修掉的是同一类毛病，首页漏改了。已修：`renderError(err)` 按 `err.code` 分四档给出不同中文文案
（`INTERNAL_ERROR` / `DB_UNAVAILABLE` / `NETWORK_ERROR` / 未知码兜底），并把错误对象透传下去。

**教训**：「错误提示统一」不能只改一个页面。同一个错误分类逻辑散在多个文件时，
改一处不等于改完，必须逐个入口核对——这正是清单要求「三类错误都返回中文提示」的价值所在。

**证据**：`Day23-参考-7-真实服务端错首页.png`

### 4.4 数据与部署状态

- **本日未新增、未删除任何收藏记录**（id 5/7/14/19 保持 Day 22 后状态，共 4 条）。
- 云函数 `api` 代码已更新并部署；故障注入版本已还原并重新部署，线上为正常版本。
- 故障注入文件备份已删除，`git diff` 对 `conceptsRepo.js` 无输出（与提交版逐字一致）。

---

## 四之二、每日一问：你把哪句裸报错改成了人话？

**改前**（`console.html` Day 22 版，真实页面显示）：

```
失败：<code>PATCH_FIELD_NOT_ALLOWED</code> —— 只能改备注，其他内容不能改
```

**改后**（Day 23）：

```
需要你改一下　只能改备注，其他内容不能改　（技术码 PATCH_FIELD_NOT_ALLOWED，排查用）
```

### 为什么这句算「裸报错」

它同时犯了三件事：

1. **把工程术语当提示** —— `PATCH_FIELD_NOT_ALLOWED` 是给开发者分支用的代码，
   终端用户看到它只会问「这是什么意思」，得不到任何行动指引。
2. **没有分类** —— 用户无法判断「这是我填错了（该改）」还是「网站坏了（该等）」。
   错误提示的第一职责不是准确，是**让人知道下一步该干什么**。
3. **技术码占了视觉主位** —— 原样印在最前面且不带任何标签说明，用户第一眼看到的是一串英文。

### 改后的三段式结构

```
[分类标签]  [人话正文 —— 告诉他改什么]  [技术码 —— 折叠成小字，标注"排查用"]
需要你改一下    只能改备注，其他内容不能改    （技术码 PATCH_FIELD_NOT_ALLOWED，排查用）
   ↑解决"是哪类问题"      ↑解决"我该怎么做"        ↑保留排查能力，但不打扰人
```

三段都有存在理由：分类标签给**判断依据**，人话正文给**行动指令**，
技术码**保留但不前置**——排查时能查到，日常使用时不干扰。

### 同类改动一览（不止这一句）

| 位置 | 改前 | 改后 |
|---|---|---|
| `index.html` 错误态 | 「没能连上数据接口…如果刚配过跨域白名单，等配置生效（约 1–2 分钟）后再刷新」 | 按 `err.code` 分档：服务端 500 说「页面出了点问题…已经记下日志了」；网络错说「网络连不上…」；不再提白名单 |
| `concepts.js` 跨域提示 | 「接口连不上（Failed to fetch）。若刚配完跨域白名单，请确认白名单里是页面域名（不带 https://），并等配置生效后刷新。」 | 「网络连不上，请检查网络后刷新页面。」原始信息只进 `console.warn` |
| `console.html` 网关层错误 | 直接显示 `Invalid path. For more information, please refer to https://docs.cloudbase.net/error-code/service/INVALID_PATH` | 「接口地址不存在，请检查访问的地址是否正确。」 |
| `console.html` 删一条失败 | 「请先填写要删除的收藏 id」（漏填时提示对，但id 填了 `abc` 就没提示，直接被后端说成「接口不存在」） | 「收藏 id 只能是数字，例如 14。请把列表里的编号原样填进来。」 |

**共同的判断标准**：一句话该不该改，看它回答的是哪个问题——
- 回答「发生了什么」→ 保留但要说人话
- 回答「我该怎么做」→ 必须补上（Day 23 补的主要是这个）
- 回答「开发者怎么排查」→ 移出用户视线，进console

---

## 五、遗留与不做的事（诚实列出）

| 项| 状态 | 原因 |
|---|---|---|
| **安全域名白名单仍缺 `ai-concept-daily.app.workbuddy.host`** | **未完成（阻塞）** | Day 20 遗留至今，MCP 工具改不了（工具 bug），需用户手动在控制台加。本日公网首页仍显示错误态 |
| `console.html` 未发公网 | 未做 | Day 22 状态，本日清单未要求发布 |
| 首页收藏按钮未接 `DELETE` | 未做 | Day 22 已知限制第1 条，本日清单未要求 |
| `.env` 里的 `CLOUDBASE_API_KEY` 仍是注释态 | 有意保持 | 真实值在云函数环境变量（控制台），本地不需要 |
| 认证/授权（谁能收藏） | 不做 | PRD §1.4 明确排除，当前单用户使用 |
| 复杂异常处理框架 | 不做 | 今日清单明确「不做」 |

---

## 六、可复现的完整验证命令

```bash
cd "D:/Workbuddy/vibe coding program/每日一个AI概念详解网站"

# 1) 密钥 0 条
git ls-files | grep -vE '\.(png|jpg)$' | wc -l        # 39
for f in $(git ls-files); do grep -qiE "sk-[A-Za-z0-9]{10}|ghp_[A-Za-z0-9]{10}|AKID[A-Za-z0-9]{10}|eyJ[A-Za-z0-9_-]{20}|-----BEGIN (RSA|EC|PRIVATE|OPENSSH)|postgres(ql)?://[^ ]*:[^ @]*@|mongodb(\+srv)?://[^ ]*:[^ @]*@|AIza[0-9A-Za-z_-]{20}|xox[baprs]-[0-9A-Za-z-]{10}" "$f" && echo "命中: $f"; done
# 无输出 = 通过

# 2) .env 忽略规则
git check-ignore -v .env                                # .gitignore:9:.env	.env
git ls-files --error-unmatch .env                      # 未跟踪
git ls-files --error-unmatch .env.example              # .env.example

# 3) 三类错误（线上）
B="https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"
curl -s "$B/api/favorites/abc" -X PATCH -H "Content-Type: application/json" -d '{"note":"x"}'
curl -s "$B/api/favorites/14"  -X PATCH -H "Content-Type: application/json" -d '{"slug":"x","note":"y"}'
curl -s "$B/api/favorites/999999" -X DELETE
curl -s "$B/api/nothing"

# 4) 本地纯逻辑沙箱（18 断言：XSS 转义 + 三类分类 + id 校验）
node .workbuddy/day23-sandbox.js
```

---

## 七、诚实性声明

- 本日**所有验证均为程序化验证**（curl + Node 沙箱 + Chrome headless 无头截图），
  **未经真实浏览器肉眼点按验收**。无头截图不含地址栏，验收截图需用户自行手动截。
- 「0 条命中」的含义是：**按上述 9 类特征词正则扫描，Git 已入库文件中无匹配**。
  这不等于「数学上证明不可能有密钥」——例如把密钥手写成无特征词的中文字符串仍可能漏检。
  但按业界通行做法，本项判定为通过。
- Git 历史中命中的 2 行**确实是占位符**（`your_api_key_here` / `postgresql://user:password@localhost`），
  不是被泄露的真实凭证；**本项目至今没有发生过凭证泄露事件**。