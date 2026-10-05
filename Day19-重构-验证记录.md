# Day 19 重构验证记录｜拆出数据访问层 + 全接口回归

> 日期：2026-10-05 ｜ 作者：曾令旺（长沙校区）
> 契约依据：`api-contract.md` **v0.5**（本次**契约零改动**：无新增/修改路径、字段名、状态码、错误码）
> 生产 Base URL：`https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com`

---

## 0. 范围与纪律

| 项 | 值 |
|---|---|
| 今日清单 | ① 理解分层思路 ② 拆出数据访问层 ③ 全接口回归 |
| 主任务 | 完成一次完整重构 + 全接口回归验证 |
| 今日不做 | 改接口路径和字段名；加新功能 —— **已遵守**（契约未动，未新增错误码） |
| 与 10-04 那批的区别 | 10-04 提交的 `ec8c8bc` 是「写接口部署 + 读写回闭环」；本文件专记**重构批次**，两者内容不同 |

---

## 1. 一句话结论

「查数据库」这段代码，从 `functions/api/lib/handlers/*.js` **搬到了**新建的 `functions/api/lib/repositories/*.js`；
4 个 handler 变薄（只剩校验 / 错误码 / 组装响应）；**5 个已上线接口行为不变，回归全绿**。

## 2. 层级变化

```
改动前：handler（业务 + 表级查询串）→ db.js（REST 传输）
改动后：handler（业务）→ repositories（表级查询 + 字段映射）→ db.js（REST 传输）
```

> 说明一处与清单预设的偏差：清单假设「路由里内嵌查库代码」，但本项目 `index.js` 本来就**没有**查库代码，
> 所以真正待拆的是 handler 里的表级 PostgREST 查询串，而不是路由。

## 3. 改动文件（新增 2 / 修改 4，共 6 个）

| 文件 | 类型 | 变化 |
|---|---|---|
| `functions/api/lib/repositories/conceptsRepo.js` | **新增** | 123 行：concepts 及其 4 张子表的表级查询 + 字段映射 |
| `functions/api/lib/repositories/favoritesRepo.js` | **新增** | 64 行：favorites 表的查询/写入 + 唯一冲突翻译 |
| `functions/api/lib/handlers/listConcepts.js` | 修改 | 56 → 47 行，删掉内嵌查询串 |
| `functions/api/lib/handlers/getConcept.js` | 修改 | 71 → 55 行，5 张表查询下沉到 repo |
| `functions/api/lib/handlers/createFavorite.js` | 修改 | 86 → 87 行，校验保留，查询/写入下沉 |
| `functions/api/lib/handlers/listFavorites.js` | 修改 | 50 → 28 行，关联查询与时间归一下沉 |

未改动：`index.js`（路由）、`lib/db.js`（传输层）、`lib/errors.js`（错误码映射）、`package.json`。

## 4. 回归结果

| 层次 | 脚本 | 结果 |
|---|---|---|
| 本地打桩（不连真库） | `.workbuddy/test-favorite-shape.js` | **19/19** |
| 本地打桩（不连真库） | `.workbuddy/test-favorites-read-shape.js` | **21/21** |
| 本地打桩（不连真库） | `.workbuddy/test-rest-shape.js` | **全部通过** |
| 公网实测 | `.workbuddy/test-contract-live.js` | **与 api-contract v0.2 完全一致** |
| 公网实测 | `.workbuddy/test-favorites-roundtrip-live.js` | **45/45** |

部署动作：`manageFunctions(action="updateFunctionCode", functionName="api", functionRootPath=<项目>/functions)` → 成功，返回 3 条 accessUrls。网关路由未新增（路径与方法都没变）。

## 5. 五个已上线接口逐个结果（公网实测）

| 接口 | 方法 | 状态码 | 实测结论 |
|---|---|---|---|
| `/api/health` | GET | 200 | `{"ok":true,"service":"ai-concept-daily","time":"2026-10-05T12:29:44.877Z"}` |
| `/api/concepts` | GET | 200 | 7 条，首条 `007-rag`，`totalCount=7` |
| `/api/concepts/{slug}` | GET | 200 | 6 段齐全，`isComplete=true` |
| `/api/favorites` | POST | 409 | 重复提交被拒 `DUPLICATE_FAVORITE`，**行数不变** |
| `/api/favorites` | GET | 200 | `count=3`（id 10 / 7 / 5），`createdAt` 倒序 |

> 说明：POST 的 **201 成功分支本次未复跑**，原因是任何一次成功写入都会给 `favorites` 永久多留一行，
> 沿用 Day 19 既定纪律（不污染行数证据）。该分支由**本地打桩 19/19**覆盖；
> 同时公网 **409 冲突分支**已实测通过 —— 它同样走完整的「校验 → 查概念 → 真库 insert → 唯一冲突翻译」链路，
> 只有最后一步走的是失败分支。这是本次回归里**唯一未覆盖的点**，如实标出。

## 6. 截图

| 文件 | 内容 |
|---|---|
| `Day19-重构-参考-文件结构.png` | `functions/api` 完整文件树，新拆出的 `lib/repositories/` 两个文件高亮 |
| `Day19-重构-参考-接口回归.png` | 5 个接口的状态码与真实返回摘要 + 5 个回归脚本结果 |

> ⚠️ 这两张是**程序化参考截图**（用真实返回渲染，**不含浏览器地址栏**）。
> 练习要求「图里要有新拆出来的数据库操作文件，以及地址栏和接口返回」——
> **地址栏那一项必须手动补一张**：浏览器打开
> `https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com/api/concepts`
> （或 `/api/favorites`），截「地址栏 + 页面里的 JSON 返回」即可。

## 7. 已知限制 / 未覆盖

1. **前端仍未接线**：页面读本地 `concepts.js`，收藏仍是内存态（Day 17 拍板 3A 悬置）。
2. **跨域未处理**：静态托管域名与 API 网关不同域（`api-contract.md` §6.1 待拍板）。
3. 本次重构**只搬家、不改行为**，因此没有触碰 PRD / api-contract / TECH_DESIGN 三份文档；
   `TECH_DESIGN.md` 里目前**没有**关于 `lib/repositories/` 这一层的描述，是否需要补记由作者决定。
