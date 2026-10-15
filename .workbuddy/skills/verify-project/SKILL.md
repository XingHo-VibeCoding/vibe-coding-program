---
name: verify-project
description: 发布前自动检查「每日一个AI概念详解」网站。覆盖 6 大组 27 个检查项：公网可访问性 7 项（含跨域白名单与真实浏览器渲染判读）、健康接口 2 项、读写接口闭环 8 项（增/改/删/查 + 不存在 id + 数据清理交代）、密钥扫描 4 项（仓库 + Git 历史 + 工作区 + 只走环境变量）、Git 安全配置 3 项（.env 忽略 / .env 未入库 / .env.example 已入库）、数据库 3 项（可连接 / 核心表存在 / 核心表行数，需 MCP 工具）。输出逐项 PASS/FAIL/SKIP + 可复现证据，禁止模糊表述。脚本实测 A–E 组 24 项，F 组 3 项由对话中MCP 执行。在每次发布、每次改动云函数或数据库、每次对外交付前使用。
---

# verify-project · 发布前检查

> 建立于 Day 25（2026-10-11）。**每一个检查项都来自本项目真实踩过的坑**，来源见每项的「来源」行。
> 作者：曾令旺（长沙校区）｜项目：每日一个 AI 概念详解网站

## 这个 Skill 解决什么问题

前24 天里，多次出现「我以为做完了、实际没生效」的情况：

- **Day 20**：接口写进库了，但公网首页是**错误态**（安全域名白名单没配）
- **Day 22**：以为 CORS 有问题，Day 20 记的 `OPTIONS` 404 其实早已修复 —— **凭记忆判断导致结论过期**
- **Day 24**：点「取消收藏」按钮**看起来成功了，数据库那行从未被删** —— 假成功比直接报错更危险

共同点：**「看起来正常」不等于通过**。本 Skill 的全部设计目标就是消灭这类表述。

## 铁律（违反即视为检查无效）

1. **禁止模糊表述。** 不得出现「看起来正常」「基本没问题」「应该可以了」「大致正常」「大概 OK」。
2. **每个结论必须有可复现证据。** 证据形式只能是：命令原文 + 该命令的**真实输出**、HTTP 状态码原文、JSON 字段值、数据库查询返回值。
3. **判据必须机读。** 「包含 7 条概念」必须写成 `items.length === 7` 并打出实际值，不能只写「有 7 条」。
4. **200 不等于通过。** 任何写操作必须**回读验证**后才算 PASS（依据 Day 24 假成功 Bug）。
5. **工具不可用标 SKIP，不标 PASS。** 无法执行的项写 `SKIP（原因）`，禁止用「大概没问题」代替（依据 Day 15：曾误判 MCP 工具不可用，Day 16 被推翻）。
6. **区分「被测对象有缺陷」与「检查项本身写错了」。** 报 FAIL 时必须标明是哪一种。**不允许为了让输出好看而放宽判据。**
7. **测试会污染数据。** 写入类检查必须在结束时清理，并把「清理前 count / 清理后 count」写进证据。

## 固定参数

```bash
BASE="https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com"
SITE="https://ai-concept-daily.app.workbuddy.host"
```

## 调用方式

在对话中直接说：

```
用verify-project 检查一遍
```

或指定范围：

```
用 verify-project 只跑 C 组（读写接口）和 D 组（密钥）
```

或临时加查（不写进 Skill，仅本次执行）：

```
用 verify-project，再加查 index.html 有没有引用不存在的概念 slug
```

**执行方式**：`node .workbuddy/skills/verify-project/scripts/run-checks.mjs --groups A,B,C`
（`--groups` 可选，默认全部。可加 `--verbose` 看每项完整证据。）
脚本**只跑 A–E 组**（HTTP / 密钥 / Git，可自动化）；**F 组（数据库）需在对话中用 MCP 工具执行**，本文附录 A 有完整命令。

---

# 检查项清单

## A 组｜公网可访问性（6 项）

### A1 首页 HTTP 状态

```bash
curl -s -o /dev/null -w "%{http_code}" "$SITE/"
```

**通过判据**：输出**恰为** `200`。任何其他值（含 301/302/000）→ FAIL。
**来源**：Day 14 发布后五路径核对。

### A2 首页非空壳

```bash
curl -s -o /tmp/home.html -w "%{size_download}" "$SITE/"; grep -c "concepts.js" /tmp/home.html
```

**通过判据**：`size_download > 10000` **且** `grep -c` 输出 ≥ 1。
**为什么**：HTTP 200 不代表内容对，发布源目录选错也会 200 但页面是错的。
**⚠️ 局限（Day 25 第 1 轮发现）**：本项**只能证明静态 HTML 非空壳**，证明不了「展示了数据库真实数据」——首页数据是 JS 运行时 fetch 的，curl 根本看不到。真正的判据是 A7。

### A3 跨域白名单（关键，历史最高频失败项）

```bash
curl -s -D - -o /dev/null -H "Origin: $SITE" "$BASE/api/concepts"
```

**通过判据**：响应头含 `access-control-allow-origin: https://ai-concept-daily.app.workbuddy.host`，**且**不含 `*`（`*` 被本项目明令禁止）。
**排错口诀**：curl 不带 Origin 头，永远测不出 CORS。必须带。
**来源**：Day 20 用对照实验锁定的根因；Day 22/23/24 连续 3 天实测仍缺。**需人工在控制台加白名单，MCP 工具改不了（数组参数被包成 `{item:[...]}`，工具层 bug）。**

### A4 静态资源可达

```bash
curl -s -o /dev/null -w "%{http_code} concepts.js\n"  "$SITE/concepts.js"
curl -s -o /dev/null -w "%{http_code} concept.html\n"  "$SITE/concept.html"
```

**通过判据**：两者均 `200`。

### A5 `.env` 未泄露

```bash
curl -s -o /dev/null -w "%{http_code}" "$SITE/.env"
```

**通过判据**：状态码 **≠ 200**（403 / 404 均算通过）。
**为什么**：发布源目录选错（用项目根目录而非 `.workbuddy/publish/`）会把 `.env` 一起传上去。

### A6 `.workbuddy/` 未泄露

```bash
curl -s -o /dev/null -w "%{http_code}" "$SITE/.workbuddy/"
```

**通过判据**：状态码 **≠ 200**。

### A7 公网首页渲染出真实数据（真实 Chrome 判读）

> **Day 25 第 1 轮补充项（补漏报）**。清单要求「公网首页可访问**且展示数据库真实数据**」，但 A2 只能证明静态 HTML 非空壳 —— 首页数据是 JS 运行时 fetch 的，**curl 永远看不到**。必须用真实浏览器判。

```bash
chrome --headless=new --disable-gpu --no-sandbox --no-first-run \
  --user-data-dir=<独立profile目录> --virtual-time-budget=15000 \
  --dump-dom "$SITE/"
```

**通过判据**（三条全满足）：
1. `<main id="list">` 的 `data-state === "success"`
2. 渲染出的卡片元素数 **≥ 7**
3. 页面文本中命中数据库里的概念标题（如「检索增强生成」「向量化」）

**为什么必须这样判**：`data-state` 是首页自带的判读锚点（`index.html` 里 `setState()` 写入）。白名单没配时 fetch 被浏览器拦，首页会走 error 分支 —— 这正是 A3 缺陷的**用户可感知后果**。
**踩坑**：Chrome 必须带独立 `--user-data-dir`，否则会复用已运行实例的 profile 导致挂住不输出（Day 19 实测）。
**读法**：`--dump-dom` 输出的是 JS 执行后的 DOM，`--virtual-time-budget` 给 fetch 留出时间。

---

## B 组｜健康接口（2 项）

### B1 `/api/health` HTTP 状态

```bash
curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health"
```

**通过判据**：恰为 `200`。

### B2 `/api/health` 信封字段

```bash
curl -s "$BASE/api/health"
```

**通过判据**（逐条打出实际值）：

- `ok === true`
- `service === "ai-concept-daily"`
- `time` 可被 `new Date(time)` 解析且非 NaN
- **响应体的键恰好是 `['ok','service','time']`，没有契约外的多余字段**

> ⚠️ **Day 25 第 1 轮修正（误报）**：原判据错误地要求 `error === null`。核对 `api-contract.md §4.1` 后发现 health 的响应体本就是 `{ok, service, time}`，**没有 error 字段**（实测 `error === undefined`）。
> **教训**：通用信封 `{ok, data, error}` 只适用于 `/api/concepts` 与 `/api/favorites`，**不能套到 health 上**。写判据前必须回契约查原文，不能凭印象套用统一格式。

**统一信封（仅 concepts / favorites）**：固定为 `{ ok, data, error }`。字段缺失即 FAIL。
**来源**：Day 17 接口首调。

---

## C 组｜读写接口闭环（7 项）

> ⚠️ C3–C6 会**写入真实数据**。每轮结束必须清理测试行，并把清理前后 count 写进证据。

### C1 读·概念列表

```bash
curl -s "$BASE/api/concepts"
```

**通过判据**（全部满足，缺一即 FAIL）：

1. HTTP `200`
2. `data.items.length === 7`
3. `data.latestDate === "2026-09-22"`
4. **严格倒序**：逐对校验 `date[i] >= date[i+1]`（不能只查首尾）

**来源**：Day 17 首调 + Day 24 全接口回归。

### C2 读·收藏列表

```bash
curl -s "$BASE/api/favorites"
```

**通过判据**：HTTP `200`；`data.items` 是数组；每项含正整数 `id`；**所有 id 互不重复**。
**来源**：Day 19 读回接口。

### C3 写·POST 新增

```bash
curl -s -X POST "$BASE/api/favorites" \
  -H "Content-Type: application/json" -d '{"slug":"001-large-language-model"}'
```

**通过判据**：HTTP **`201`**（不是 200）；响应体含正整数 `id`。
**注意**：必须选一个**当前未被收藏**的 slug，否则返回 `409 DUPLICATE_FAVORITE`。
**来源**：Day 18 写接口。

### C4 写后读回（对应 Day 20 教训）

紧接 C3，记录返回的 `id`，再执行 C2。

**通过判据**：C3 返回的 `id` **出现在** C2 的 `items` 中。
**来源**：Day 20 原话——「写入其实成功了，数据库确实多了行。教训：契约的 §4.4 与 §4.5 要分开看，不能想当然。」

### C5 改·PATCH 备注

```bash
curl -s -X PATCH "$BASE/api/favorites/<id>" \
  -H "Content-Type: application/json" -d '{"note":"verify-project自检"}'
```

**通过判据**：HTTP `200`；响应体 `note` **逐字符等于** `"verify-project自检"`（不是「有 note 字段」）。
**补充口径**：`note: ""` 表示明确清空，应存 `null`。
**来源**：Day 22。

### C6 删·DELETE 真删（Day 24 假成功 Bug 的直接对策）

```bash
# 步骤 1：删除前 count
curl -s "$BASE/api/favorites" | grep -o '"id"' | wc -l
# 步骤 2：删
curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/favorites/<id>"
# 步骤 3：删除后必须再读一次
curl -s "$BASE/api/favorites"
```

**通过判据**（三步全满足）：

1. DELETE 返回 `200`
2. **读回后 count = 删除前 count − 1**
3. 读回列表中**已无该 id**

**为什么必须回读**：Day 24 的 Bug 就是按钮立刻变「☆ 收藏」、数据库那行从未消失 —— 只看 HTTP 200 会漏掉。
**踩坑补充**：Day 24 也差点把「页面 7 条 vs 库 4 条」的**测试污染**误判成产品 Bug。比对前务必确认数据库基线干净。

### C7 对不存在的 id 不报成功（防呆口径）

```bash
curl -s -w "\n%{http_code}" -X PATCH   "$BASE/api/favorites/99999" -H "Content-Type: application/json" -d '{"note":"x"}'
curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/favorites/99999"
```

**通过判据**：两者均 **`404`** 且 `error.code === "FAVORITE_NOT_FOUND"`。
**不可接受的实现**：先查后写时把「查不到」当成功返回。**绝不允许对不存在的 id 报成功。**
**来源**：Day 22 防呆口径。

---

### C0 数据清理交代（写入类检查必须交代）

**通过判据**：本轮结束时 `GET /api/favorites` 的 count **等于本轮开始前的 count**。
**为什么需要这一项**：C3–C6 会在真实库里写入测试行。如果只报「写成功」不报「删干净」，
几轮实跑后库里就堆满测试数据，**下一次实跑的基线就不对了**（Day 24 就差点把测试污染误判成产品 Bug）。
**怎么算不通过**：结束 count ≠ 开始 count 时，输出差值，判 FAIL。

**本轮测试写入的 slug 与 id 必须一并列出**，便于人工核对。

---

## D 组｜密钥扫描（4 项）

### 特征词正则（9 类）

```
sk-[A-Za-z0-9]{10}                        # OpenAI 风格
ghp_[A-Za-z0-9]{10}                        # GitHub token
AKID[A-Za-z0-9]{10}                        # 腾讯云 AKID
eyJ[A-Za-z0-9_-]{20}                       # JWT
-----BEGIN (RSA|EC|PRIVATE|OPENSSH)         # 私钥
postgres(ql)?://[^ ]*:[^ @]*@              # 带密码的 PG 连接串
mongodb(\+srv)?://[^ ]*:[^ @]*@            # 带密码的 Mongo 连接串
AIza[0-9A-Za-z_-]{20}                      # Google API Key
xox[baprs]-[0-9A-Za-z-]{10}                 # Slack token
```

### ⚠️ 两层判定：正则命中 ≠ 泄露（Day 25 第 1 轮修正，最重要的误报教训）

第 1 轮 D1/D2/D4 报出 8 处 FAIL，逐条核对原文后发现**全部是审计文档在引用违规示例**：

| 位置 | 原文片段 | 性质 |
|---|---|---|
| `Day23-安全自查清单.md:33` | 「（your_api_key_here、postgresql://user:password@localhost），**不是真实凭证**」 | 审计结论在描述哪些是占位符 |
| `Day23-安全自查清单.md:72` | 表格行「错误示范：`DATABASE_URL=postgresql://user:password@localhost:5432/mydb`」 | 举反例 |
| `Day23-安全自查清单.md:313` | 「Git 历史中命中的 2 行**确实是占位符**」 | 同上 |
| `TECH_DESIGN.md:754` | 「形如 `postgresql://<用户名>@<主机>:5432/db`」 | 设计文档描述格式 |

**修正方式不是放宽判据，而是把判据分两层**：

1. 正则判定「该行是否命中特征词」 —— 命中不等于违规；
2. 再分类为：
   - **强特征**（私钥块 / JWT / `AKID` / `AIza` / Slack token / `sk-` 与 `ghp_` 的随机串后段）→ **判 FAIL**，这类形态没有「占位符」概念；
   - **弱占位符**（连接串的用户名/密码段是 `user`/`password`/`root`/`your_xxx`/`<占位>` 等通用占位词）→ 判 PLACEHOLDER，**不判 FAIL，但必须在输出里逐条列出并写明分类理由**，不许默默忽略；
   - 非占位词的连接串（如 `postgresql://realuser:s3cret@...`）→ **判 FAIL**。

**分类理由要打印出来**，示例：
```
Day23-安全自查清单.md:72: DATABASE_URL=postgresql://user:password@localhost:5432/mydb
  → 文档示例：用户名与密码段均为通用占位词（user="user" pass="password"）
```

> **第 2 轮又发现一个同类 bug**：Git diff 行**没有文件路径**，导致「是否文档」的判断恒为 false，同一批占位符在 D2 里被重复判成真实凭证。修正为给 `scanText()` 传 `{ history: true }`。
> **教训**：判据里任何依赖「文件属性」的分支，都要问一句「这个属性在当前调用路径上真的拿得到吗」。

**判据仍是机读的**：真实凭证命中数必须 = 0，占位符与 META 无论多少都不影响判定，但必须全部列名。

### 第 3 层：META（判据自指 / 历史注入记录）—— Day 27 新增

Day 27 门禁实跑（19:35）报出 D1/D2/D4 共 5 处 FAIL，逐条核对原文后确认**无真实泄露**：
命中的全是「审计文档在解释判据本身」或「记录 Day 25 故意注入的假密钥」的说明行
（`SKILL.md:309`、`Day25-验证记录.md:139/175/185/191`）。
根因不是判据错，是**执行时机**：Day 25 实跑发生在提交之前，这些文档入库后第一次被扫到自己。

**处置：加第三层，不是放宽判据。**

| 层 | 判定 | 结果 |
|---|---|---|
| 1 | 正则是否命中 9 类特征词 | 命中 ≠ 违规 |
| 2 | 强特征 / 弱占位符 | REAL（FAIL）/ PLACEHOLDER（列出） |
| 3 | 上下文有无说明标记 | META（列出，不判 FAIL） |

**第 3 层判据**：命中行**本身或前后各 2 行**内出现说明标记 → 归 META。
标记词：`故意注入` `注入的测试` `注入测试` `假密钥` `示例` `演示` `假设` `判据` `占位` `不是真实` `已撤销` `撤销` `revoked` `应查出` `错误示范` `违规示例`。
初版含`审计`一词，覆盖面过宽，已移除——宁可多报一次待人工核对，也不要让标记词变成万能豁免。

**必须看上下文窗口**：`Day25-验证记录.md:175` 的密钥与标记词是**分两行**写的
（上一行 `<!-- Day 25 故意注入的测试缺陷：…`，下一行才是 `AIza… -->`），只看本行会漏判。

**三条约束（保证不削弱真泄露检测，Day 27 已逐条实测）**：

1. **只对文档类文件生效**（`.md`/`.txt`/`.log` 或 Git 历史 diff 行）。代码文件
   （`.js`/`.mjs`/`.json`/`.html`）里的连接串一律 REAL —— Day 25 注入测试打的正是 `index.html:866`。
2. **不按文件名开白名单、不按密钥串开白名单**。同一串密钥出现在无标记词的上下文里，照样 REAL。
3. **META 与 PLACEHOLDER 都逐条打印**，写明命中的标记词，不静默忽略。

**回归验证（Day 27 实测，探针已清理）**：同一串假密钥 `AIzaSyD3mQ8…` 分别写入
①代码文件 `_dtest-inject.html` ②无标记词的 `.md` 文件 —— **两处均判 REAL，D4 FAIL**。
删掉探针后 D 组 4/4 PASS。即：META 只豁免「文档在讲这个形态」，不豁免「真的存了这个形态」。

### D1 仓库（Git 已入库文件）无真实密钥

对 `git ls-files` 列出的非图片文件逐个跑上面的正则。

**通过判据**：**真实凭证命中数 = 0**。占位符与 META 命中数不限，但须全部列出。
命中时**必须打印 `文件:行号:内容` + 分类理由**再判 FAIL，便于定位。
**来源**：Day 23 安全自查；Day 27 加第 3 层 META。

### D2 Git 全量历史无真实密钥

```bash
git log --all -p | grep -nE "<上面的正则>"
```

**通过判据**：真实凭证命中 = **0**（同样走三层判定）。
**注意**：diff 行无文件路径，文件类型判断恒为 false —— 只能靠**上下文标记**判 META，
这也是第 3 层必须看窗口的原因。
**白名单**：占位符与 META **不算违规**，但**报告里必须列出来并标注分类理由**，不能默默忽略。

### D3 凭证只从环境变量读

```bash
grep -n "process.env.CLOUDBASE_API_KEY" functions/api/lib/db.js
```

**通过判据**：**同时**出现 `process.env.CLOUDBASE_API_KEY` 的读取，**且**缺失时 `throw`（不静默继续）。

### D4 工作区无真实密钥

排除 `.env`、`.workbuddy/`、`.git/` 后全量扫（含**未入库**的本地文件）。

**通过判据**：真实凭证命中 = **0**。命中时输出精确到 `文件:行号`。
**本项价值**：D1 只扫已入库文件，**未提交的新改动扫不到** —— Day 25 实测正是靠 D4 在工作区抓到了刚注入的假密钥（`index.html:866`，该行当时尚未提交）。
**Day 27 起**：META 豁免只对 `.md`/`.txt`/`.log` 生效，注入到 `.html`/`.js` 的强特征仍判 REAL —— 上面那个 Day 25 场景今天重跑仍会被抓到。

---

## E 组｜Git 安全配置（3 项）

### E1 `.env` 被忽略

```bash
git check-ignore -v .env; echo "退出码=$?"
```

**通过判据**：退出码 **0**，且输出含 `.gitignore` 行号 + `:	.env`。

### E2 `.env` 不在仓库

```bash
git ls-files | grep -x "\.env"; echo "退出码=$?"
```

**通过判据**：**无文件路径输出**；`grep` 退出码 `1`。

### E3 `.env.example` 存在且已入库

```bash
git ls-files | grep -x "\.env\.example"
```

**通过判据**：输出**恰 1 行** `.env.example`。
**为什么两者都要**：`.env` 必须忽略（防泄露），`.env.example` 必须入库（让别人知道要配什么变量）—— 只做前者等于新 clone 的人不知道要配什么。

---

## F 组｜数据库（3 项）— 需 MCP 工具，脚本不覆盖

### F1 可连接

```sql
SELECT 1;
```

**通过判据**：返回 1 行，值为 `1`。连接报错 → FAIL（记错误原文）。
**无法执行时**：标 `SKIP（MCP 工具本会话不可用）`，**不得标 PASS**。

### F2 核心表存在

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema='public'
  AND table_name IN ('concepts','concept_use_cases','concept_quizzes',
                     'concept_quiz_points','concept_sources')
ORDER BY table_name;
```

**通过判据**：返回**恰好 5 行**，且表名集合与上述完全一致。少一张即 FAIL。

### F3 核心表行数

```sql
SELECT 'concepts' t, count(*) FROM concepts
UNION ALL SELECT 'concept_use_cases', count(*) FROM concept_use_cases
UNION ALL SELECT 'concept_quizzes', count(*) FROM concept_quizzes
UNION ALL SELECT 'concept_quiz_points', count(*) FROM concept_quiz_points
UNION ALL SELECT 'concept_sources', count(*) FROM concept_sources
ORDER BY 1;
```

**通过判据**：`concepts=7`、`concept_use_cases=14`、`concept_quizzes=7`、`concept_quiz_points=25`、`concept_sources=8`。
**注**：这是 Day 16 种子的基线。若F2 通过但 F3 不符，先确认是否有新增概念（合法增长），再判断。
**来源**：Day 16 建库。

---

# 输出格式（强制）

```
Day N 发布前检查 · 项目：每日一个 AI 概念详解
执行时间：<真实时间戳>
执行命令：node .workbuddy/skills/verify-project/scripts/run-checks.mjs --groups A,B,C

[1/16] A1 首页 HTTP 状态
  命令：curl -s -o /dev/null -w "%{http_code}" "$SITE/"
  实测输出：200
  判定：PASS
  证据：http_code=200，满足「恰为 200」

[3/16] A3 跨域白名单
  命令：curl -s -D - -o /dev/null -H "Origin: $SITE" "$BASE/api/concepts"
  实测输出：HTTP/1.1 200 OK
            content-type: application/json
            （响应头中无 access-control-allow-origin）
  判定：FAIL
  缺陷类型：被测对象缺陷（非检查项写错）
  根因：安全域名白名单缺 ai-concept-daily.app.workbuddy.host
  依据：Day 20 对照实验已锁定根因；Day 22/23/24 连续 3 天实测同一现象
  修复方式：需人工在 CloudBase 控制台 → 环境 → 安全域名 手动添加
            （MCP addSecurityDomain 工具数组参数有 bug，改不了）

────────────────────────────
汇总：PASS 12 / FAIL 1 / SKIP 3
FAIL 项：A3 跨域白名单 —— 被测对象缺陷（白名单未配，Day 20 起连续 4 天）
SKIP 项：F1/F2/F3 —— MCP 数据库工具本会话不可用，按铁律 5 不标 PASS
被测对象缺陷数：1检查项自身缺陷数：0
数据清理：写入 1 行 / 删除 1 行 / count 4 → 4（已还原基线）
下一步：阻塞公网交付，需人工加白名单后再跑本 Skill
```

**每项必须有**：命令 → 原始输出 → PASS/FAIL/SKIP → 证据。
**汇总必须区分**：被测对象缺陷 vs 检查项自身缺陷。

---

# 常见失败与排查

| 现象 | 根因 | 排查命令 |
|---|---|---|
| curl 测 CORS 永远「正常」 | curl 不带 Origin 头 | 加 `-H "Origin: $SITE"` |
| A5 返回 200 | 发布源目录误用项目根目录，把 `.env` 传上去了 | 改用 `.workbuddy/publish/` 作发布源 |
| B1 超时 / 503 | 云函数未部署，或环境变量 `CLOUDBASE_API_KEY` 缺失 | `curl "$BASE/api/health"` 看 `service` 字段 |
| C1 items.length ≠ 7 | 数据库数据与前端不一致，或接口没部署最新代码 | 先跑 F3 看库里有几条 |
| C6 报 200 但行还在 | 命中 Day 24 假成功模式 | 必须执行步骤 3 回读，不能只看 200 |
| `.gitignore` 里的 `!` 例外不生效 | 写了 `.workbuddy/` 这类**整目录排除**；Git 不会进入被排除的目录，例外规则静默失效 | 改成「排除一级子项 → 逐级 `!` 放开」 |
| F 组标 FAIL 但其他都过 | MCP 把 TRUNCATE 归为 DDL 而拒绝 | TRUNCATE 走 applyMigration 通道 |

# 附录 A · 数据库组在对话中的执行方式

F 组不用脚本。调用本 Skill 后，用 MCP 数据库工具依次执行 F1/F2/F3 的 SQL，把返回的**原始行**贴进输出。若 `ToolSearch` 未找到数据库工具，如实标 SKIP。

# 附录 B · 维护规则

新增检查项时必须补齐三件事，否则不算完成：

1. 在「检查项清单」里写明**执行命令 + 机读判据 + 来源（哪天的哪个坑）**；
2. 在 `scripts/run-checks.mjs` 的 `GROUPS` 中登记；
3. 在本文「常见失败与排查」表里补一行（若会产生新的失败模式）。

**禁止**为了让某次实跑通过而放宽判据。判据要改，必须在验证记录里写明「第几轮、为什么改、改前改后的判据原文」。
