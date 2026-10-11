# Day 25 验证记录：产出可复用的发布前检查 Skill

> 日期：2026-10-11｜作者：曾令旺（长沙校区）
> 板块：① 规划检查项 → ② 制作 Skill → ③ 实跑验证
> 结论：**Skill 已入库（3 文件 1343 行），实跑 4 轮，故意注入的问题被抓出并精确定位到行号；检查项自身缺陷已从 4 个降到 0**

---

## 〇、一句话结论

`verify-project` 覆盖 **6 大组 24 个检查项**，每项都写明执行命令与机读判据。
四轮实跑证明它能**抓出真问题**（公网跨域白名单缺失、真实密钥泄露）**且不误报**（文档里的占位符示例不再被当成泄露）。

**但请注意：公网首页仍然是坏的。** 见 §五遗留项。

---

## 一、板块①：检查项从哪来

清单要求「检查项必须来自本项目真实踩过的坑」。我对每一项都做了溯源，填不出「哪一天、哪个记录文件、当时的具体现象」的**一律不收**。

完整对照表见 `.workbuddy/skills/verify-project/references/pitfalls.md`。摘要：

| 组 | 项数 | 核心来源 |
|---|---|---|
| A 公网可访问性 | 7 | Day 14 发布五路径、**Day 20 跨域白名单**、Day 25 自身发现的漏报 |
| B 健康接口 | 2 | Day 17 接口首调、**Day 25 自身发现的误报** |
| C 读写闭环 | 8 | Day 18/19/20/22/24，其中 **C6 直接来自 Day 24「取消收藏是假成功」** |
| D 密钥 | 4 | Day 23 安全自查 |
| E Git 安全 | 3 | Day 23 |
| F 数据库 | 3 | Day 15/16 |

**举两个最有价值的例子**：

- **C6 DELETE 真删**：Day 24 的 Bug 是「点取消收藏，按钮立刻变 `☆ 收藏`，但数据库那行从未被删，刷新又变回已收藏」。只看 HTTP 200 完全查不出来。所以 C6 的判据被写成**三步**：① DELETE 返 200 ② **回读后 count = 删除前 −1** ③ 该 id 已不在列表。
- **A7 真实数据渲染**：Day 25 自己发现的漏报 —— 原来 A2 只查静态 HTML 体积，但首页数据是 JS 运行时 fetch 的，**curl 根本看不到**。补了真实 Chrome 判读 `data-state`。

---

## 二、板块②：Skill 做了什么

### 2.1 文件结构

```
.workbuddy/skills/verify-project/
├── SKILL.md                    478 行 · 检查项清单 + 判据 + 输出格式 + 铁律
├── scripts/
│   └── run-checks.mjs          786 行 · 可执行检查脚本（零依赖，A–E组）
└── references/
    └── pitfalls.md              79 行 · 每项检查的踩坑来源对照
```

### 2.2 存放位置的坑（当场实测出来的）

清单要求「Skill 文件已入库」，但 `.gitignore` 第 119 行原本写着 `.workbuddy/`，**与入库要求直接冲突**。

我第一次改成这样：

```gitignore
.workbuddy/*
!.workbuddy/skills/
.workbuddy/skills/*
!.workbuddy/skills/verify-project/     # ← 这行没用
```

`git check-ignore -v` 实测发现**文件仍被忽略**。原因是：**Git 不会进入被整目录排除的目录**，
所以 `.workbuddy/skills/*` 这条已经把 `verify-project/` 这个目录本身排掉了，后面再写 `!` 也没用。

**正确写法**（排除一级子项 → 放开 skills → 对私有 skill 逐个精确排除）：

```gitignore
.workbuddy/*
!.workbuddy/skills/
.workbuddy/skills/frontend-page-rules/     # 本地私有工具，不入库
```

实测验证：

| 路径 | `git check-ignore -v` 结果 | 是否符合预期 |
|---|---|---|
| `.workbuddy/skills/verify-project/SKILL.md` | 无输出，退出码 1（未忽略） | ✅ 放行成功 |
| `.workbuddy/skills/frontend-page-rules/SKILL.md` | `.gitignore:127` | ✅ 仍忽略 |
| `.workbuddy/memory/MEMORY.md` | `.gitignore:123` | ✅ 仍忽略 |
| `.env` | `.gitignore:9` | ✅ 仍忽略 |

### 2.3 七条铁律（写在 SKILL.md 最前面）

1. **禁止模糊表述** —— 不得出现「看起来正常」「基本没问题」「应该可以了」
2. **每个结论必须有可复现证据** —— 命令原文 + 真实输出
3. **判据必须机读** —— 写 `items.length === 7` 并打出实际值，不写「有 7 条」
4. **200 不等于通过** —— 写操作必须回读验证后才算 PASS
5. **工具不可用标 SKIP，不标 PASS**
6. **必须区分「被测对象缺陷」与「检查项自身缺陷」** —— 不允许为了让输出好看而放宽判据
7. **测试会污染数据** —— 清理前后 count 必须写进证据

---

## 三、板块③：四轮实跑

### 3.1 第 1 轮 —— 暴露 4 个误报

**结果：PASS 18 / FAIL 5**

我逐条核对了这 5 个 FAIL 的**原文**，结论是：**4 个是我自己检查项写错，只有 1 个是真缺陷**。

| FAIL 项 | 表面现象 | 核对原文后的真相 | 性质 |
|---|---|---|---|
| **B2** health 信封 | `error = undefined`，判 `error === null` 不满足 | 查 `api-contract.md §4.1`，health 响应体**本来就没有 error 字段**。我凭印象套用了通用信封 | ❌ **我写错了** |
| **D1** 仓库密钥 | 3 行命中 | 全部在 `Day23-安全自查清单.md` 第 33/72/313 行 —— **审计文档在引用违规示例**（「不是真实凭证」「错误示范：`DATABASE_URL=postgresql://user:password@localhost`」） | ❌ **我写错了** |
| **D2** Git 历史 | 2 行「真实凭证」 | 同上，命中的是 `TECH_DESIGN.md:754` 的「形如 `postgresql://user:password@host`」 | ❌ **我写错了** |
| **D4** 工作区 | 4 行命中 | 同一批文档占位符 | ❌ **我写错了** |
| **A3** 跨域白名单 | 响应头无 `access-control-allow-origin` | **真缺陷**，白名单确实没配 | ✅ 被测对象缺陷 |

**这一轮的价值**：如果我不核对原文，就会把这 4 个假 FAIL 当成真问题去修，甚至为了「全绿」去改判据——那正好违反铁律 6。

### 3.2 修正一：B2 按契约原文重写

```js
// 修正前（错）：套用通用信封
const all = okOk && svc === 'ai-concept-daily' && tmValid && err === null;

// 修正后（对）：按 api-contract.md §4.1，并反向检查多余字段
const knownKeys = ['ok', 'service', 'time'];
const extraKeys = Object.keys(j).filter(k => !knownKeys.includes(k));
const all = okOk && svc === 'ai-concept-daily' && tmValid && extraKeys.length === 0;
```

判据改严了（多了「无契约外多余字段」），不是放宽。

### 3.3 修正二：D 组改为两层判定

**这不是放宽判据，是把「正则命中」和「真的泄露」分成两层**：

```
第 1 层：正则是否命中特征词        → 命中不等于违规
第 2 层：命中的是什么性质
   ├─ 强特征（私钥块/JWT/AKID/AIza/Slack token/sk- 随机串）→ FAIL
   ├─ 弱占位符（连接串的 user/password 段是 user、password、<占位>）→ PLACEHOLDER，不判FAIL，但必须逐条列出理由
   └─ 非占位词的连接串（postgresql://realuser:s3cret@）→ FAIL
```

分类理由会打印出来，例如：

```
Day23-安全自查清单.md:72: DATABASE_URL=postgresql://user:password@localhost:5432/mydb
  → 文档示例：用户名与密码段均为通用占位词（user="user" pass="password"）
```

**判据本身没放松**：真实凭证命中数仍必须 = 0，占位符无论多少都不影响判定，但**必须全部列名，不许默默忽略**。

### 3.4 补漏报：A7 真实 Chrome 判读

```bash
chrome --headless=new --disable-gpu --no-sandbox \
  --user-data-dir=<独立profile> --virtual-time-budget=15000 \
  --dump-dom "$SITE/"
```

判据三条全满足才算 PASS：`data-state === 'success'` / 卡片数 ≥ 7 / 渲染出数据库里的概念标题。

**实测结果（这一项证明了 A3 缺陷的真实后果）**：

```
data-state = "error"；页面内卡片元素数 = 0；命中数据库概念标题 = (无)
```

curl 看到的 A1/A2 全是 200，看起来一切正常；**只有真实浏览器才看得出现在首页是坏的**。

### 3.5 第 2 轮：故意注入问题

在 `index.html` 末尾追加（该行**尚未提交**）：

```html
<!-- Day 25 故意注入的测试缺陷：verify-project 应查出这一行
AIza7xKq9pLm3nRt5vYb2wE8cJ4hF6dS1uZ0gX3 -->
```

注入位置：**index.html:866**（`git status` 确认已modified）

**检查结果**：

```
[18/24] D1 仓库已入库文件无真实密钥  →  FAIL
  实测：【真实凭证，必须为空】
  实测：  index.html:866: AIza7xKq9pLm3nRt5vYb2wE8cJ4hF6dS1uZ0gX3 -->
  实测：    → 强特征形态（私钥块/JWT/云厂商 Key/Slack token），无占位符概念
  证据：判据：**真实凭证命中数 = 0** → 实测 1，不满足。
       （正则总命中 4 行，其中 3 行经分类为文档占位符示例，已逐条列出说明理由，未默默忽略）

[21/24] D4 工作区无真实密钥  →  FAIL
  实测：  index.html:866: AIza7xKq9pLm3nRt5vYb2wE8cJ4hF6dS1uZ0gX3 -->
  证据：判据：真实凭证命中 = 0 → 实测 1，不满足
```

✅ **抓到了，且精确定位到文件 + 行号**。D1 与 D4 两项独立查出同一处（双重保险）。
同一批文档占位符**没有**被误报 —— 说明 3.3 的修正生效了。

### 3.6 第 2 轮修正：又抓出一个同类 bug

第 2 轮的 D2 **从 FAIL 变 PASS** 时，我在输出里发现一个新问题：

```
[19/24] D2 Git 全量历史无真实密钥  →  PASS
  实测：正则命中 7 行 → 真实凭证 0 行 / 文档占位符 7 行
```

但第 2 轮（注入后、修正前）的 D2 输出是「真实凭证 **7** 行」——**跟 D1 明明是同一批文档占位符，D1 判 PLACEHOLDER，D2 却判 REAL**。

**根因**：分类函数里有个分支「非文档文件 → 直接判 REAL」。而 **Git diff 的行根本没有文件路径**，`isDoc` 恒为 `false`，导致同一批占位符在 D2 里全部误判。

修正：把定性依据从「文件类型」改成「是否弱占位词」，文件类型只作附加说明。

**教训**：判据里任何依赖「文件属性」的分支，都要问一句 —— **这个属性在我这条调用路径上真的拿得到吗**。

### 3.7 第 3/4 轮：撤销注入后的最终结果

**撤销验证**（三项都通过）：

```
git status --porcelain index.html   → 无输出
grep -c "AIza7xKq9" index.html      → 0（退出码 1 = 已清除）
git diff --stat index.html         → 无输出（与 HEAD 逐字节一致）
```

**A–E 组最终结果**：

```
汇总：PASS 22 / FAIL 2 / SKIP 0（共 24 项）

FAIL 明细：
  · A3 跨域白名单（带 Origin 头实测） —— 被测对象缺陷
  · A7 公网首页渲染出真实数据（真实 Chrome 判读） —— 被测对象缺陷

被测对象缺陷数：2    检查项自身缺陷数：0
```

### 3.8 F 组：数据库（MCP 工具实跑，非脚本）

| 项 | 执行 | 实测结果 | 判定 |
|---|---|---|---|
| F1 可连接 | `SELECT 1 AS ping` | 返回 1 行，值 `1` | ✅ PASS |
| F2 核心表存在 | 查 `information_schema.tables` | 返回**恰好 5 行**：concept_quiz_points / concept_quizzes / concept_sources / concept_use_cases / concepts | ✅ PASS |
| F3 核心表行数 | 五表 count | concepts=**7**、concept_use_cases=**14**、concept_quizzes=**7**、concept_quiz_points=**25**、concept_sources=**8** | ✅ PASS |

F3 与 Day 16 种子基线**完全一致**，说明 C 组三轮写入测试数据后没有污染。

### 3.9 数据清理交代

| 轮次 | 写入 | 删除 | 结束 count | 基线 | 判定 |
|---|---|---|---|---|---|
| 第 1 轮 | 1 行（`002-token`） | 1 行（id=36） | 4 | 4 | ✅ 已还原 |
| 第 2 轮 | 1 行（`002-token`） | 1 行（id=37） | 4 | 4 | ✅ 已还原 |
| 注入轮 | 1 行（`002-token`） | 1 行（id=38） | 4 | 4 | ✅ 已还原 |

---

## 四、逐条对照完成标准

| # | 完成标准 | 状态 | 证据 |
|---|---|---|---|
| 1 | Skill 文件已入库 | ✅ **已完成** | `git add --dry-run` 实测3 个文件均可add；`.gitignore` 例外规则经 `git check-ignore -v` 四路验证 |
| 2 | 对当前项目实跑一遍并给出结果 | ✅ **已完成** | 共 **4 轮**实跑：A–E 组 24 项 + F 组 3 项（MCP） |
| 3 | 故意留个问题它能查出来 | ✅ **已完成** | 注入 `index.html:866` 假密钥 → D1、D4 双双报 FAIL 并精确定位行号 |
| 4 | 覆盖公网 | ✅ | A1–A7（7 项） |
| 5 | 覆盖健康 | ✅ | B1–B2（2 项） |
| 6 | 覆盖读写 | ✅ | C0–C7（8 项，含增/改/删/查 + 不存在 id + 清理交代） |
| 7 | 覆盖密钥 | ✅ | D1–D4（4 项） |
| 8 | 覆盖 Git 安全 | ✅ | E1–E3（3 项） |
| 9 | 覆盖数据库 | ✅ | F1–F3（3 项） |
| 10 | 输出逐项 PASS/FAIL + 证据 | ✅ | 每项含「命令 / 实测输出 / 判定 / 证据」四段，无省略 |
| 11 | 没有模糊表述 | ✅ | 全文检索输出，无「看起来正常」「基本没问题」等表述 |
| 12 | 每个检查项写明执行命令和「怎么算通过」 | ✅ | SKILL.md 24 项逐条列出，判据全部机读 |
| 13 | 不做自动化流水线 | ✅ | 未引入 CI 配置、未接 GitHub Actions |
| 14 | 至少运行两次（第二次修正过误报或漏报） | ✅ **运行 4 轮**，修正 3 处误报 + 1 处漏报 |

---

## 五、遗留与阻塞（如实列出）

| # | 事项 | 状态 | 说明 |
|---|---|---|---|
| 1 | **安全域名白名单仍缺 `ai-concept-daily.app.workbuddy.host`** | ❌ **未完成（阻塞）** | Day 20 起连续 **5 天**遗留。今天 A3、A7 两项实跑 FAIL，根因就是它。MCP `addSecurityDomain` 工具数组参数有 bug（Day 20 试过 6 次），**必须人工在 CloudBase 控制台加** |
| 2 | `.gitignore` 改动需你确认 | ⚠️ **待确认** | 原 `.workbuddy/`（整目录排除）改为 `.workbuddy/*` + 逐级放开。已验证对`.env`、`.workbuddy/memory/`、`frontend-page-rules` 的忽略行为**完全不变** |
| 3 | F 组未纳入脚本 | ⚠️ **有意为之** | 脚本不连数据库（避免依赖凭证）。按 SKILL.md 附录 A 在对话中用 MCP 执行。清单要求「今日不做自动化流水线」，故不写成自动调用 |
| 4 | 未做肉眼浏览器验收 | ⚠️ 如实说明 | A7 用的是**无头 Chrome 程序化判读**，不是我肉眼看的截图 |

### 关于第 1 项的提醒

A7 的实测输出 `data-state = "error"`、卡片数 `0` —— **公网首页现在打开就是错误态**，
用户看到的是「请求失败」。这不是新问题（Day 20/22/23/24 都记着），但今天被自动化检查**正式确诊**了。

---

## 六、Skill 的调用方式

在对话中直接说：

```
用 verify-project 检查一遍
```

或指定范围：

```
用 verify-project 只跑 C 组和 D 组
```

或临时加查（不写进 Skill）：

```
用 verify-project，再加查 index.html 有没有引用不存在的概念 slug
```

执行命令（也可直接跑）：

```bash
node .workbuddy/skills/verify-project/scripts/run-checks.mjs --groups A,B,C
node .workbuddy/skills/verify-project/scripts/run-checks.mjs --verbose
```

**退出码**：0 = 全通过，2 = 有 FAIL。可直接接进任何发布流程。

---

## 七、每日一问

**为什么「报FAIL」比「不报」更需要设计？**

因为检查工具最危险的失败模式不是漏报，而是**让人不再相信它**。
第 1 轮 5 个 FAIL 里 4 个是假的——如果我不核对原文就照着去「修」，
要么白改一堆不存在的问题，要么改到最后只剩「全绿」，而真正的白名单缺失被淹没在噪音里。

所以 SKILL.md 的铁律 6 写的是：**报 FAIL 必须标明是「被测对象缺陷」还是「检查项自身缺陷」，两者分开计数**。
今天的实跑结果就是这句话的证明：**被测对象缺陷 2，检查项自身缺陷 0** —— 前者是用户的待办，后者是我的待办。混在一起就都没法推进。

---

## 八、参考资料

- 检查项溯源：本项目 `Day20-验证记录.md`、`Day22-验证记录.md`、`Day23-安全自查清单.md`、`Day24-验证记录.md`、`api-contract.md` §4.1
- Git 整目录排除导致 `!` 例外失效：Git 官方文档 gitignore「Note that Git does not ignore files in a directory that is excluded」约定，实测已验证
- Chrome 无头模式 `--dump-dom` 输出执行后的 DOM，配合 `--virtual-time-budget` 给异步 fetch 留时间；必须带独立 `--user-data-dir`（Day 19 实测踩过）
