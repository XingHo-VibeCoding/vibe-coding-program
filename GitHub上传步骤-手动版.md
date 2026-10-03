# GitHub 手动上传步骤

> 项目：`每日一个AI概念详解`
> 远程仓库：`https://github.com/XingHo-VibeCoding/vibe-coding-program`（**私有**）
> 整理日期：2026-09-29（Day 14）

---

## 0. 先看当前真实状态（2026-09-29 12:37 实测）

| 检查项 | 实测结果 |
|---|---|
| 远程地址 | `origin` → `https://github.com/XingHo-VibeCoding/vibe-coding-program.git` |
| 本地 HEAD | `dc4df1d`（Day 10 那次提交） |
| 远程 main | `dc4df1d` —— **与本地完全一致** |
| 网络 | `git ls-remote` 成功，通路正常 |
| `.env` | 已被 `.gitignore:9` 挡住 ✅ |
| `.workbuddy/` | 已被 `.gitignore:119` 挡住 ✅ |

**结论**：Day 10 及以前的东西全在 GitHub 上了；**Day 11～14 的改动全部只在本地、还没提交**。

> ⚠️ **推送必须用本地 git，不能用 GitHub 连接器。**
> 仓库属主是 `XingHo-VibeCoding`，连接器登录的是另一个账号 `cantor31415926-a11y`，
> 对该仓库**只有读权限**，写入会报 `403 Resource not accessible by integration`。

---

## 路径 A：本地终端（推荐）

保留完整提交历史，一条命令推完，是正路。

### 步骤

**第 1 步：打开 Git Bash**

在文件资源管理器里右键项目文件夹 → **Open Git Bash here**；
或者从开始菜单打开 Git Bash，然后 `cd` 进项目目录。

```bash
cd "/d/Workbuddy/vibe coding program/每日一个AI概念详解网站"
```

**第 2 步：看现在有哪些改动**

```bash
git status --short
```

你应该看到 `M`（改过）与 `??`（新文件）两类。**这一眼是为了确认没有意外文件。**

**第 3 步：加进暂存区**

```bash
git add .
```

**第 4 步：安全闸门（必做，别跳）**

```bash
git status --short
```

确认列表里**没有** `.env`、`*.key`、`*.pem`、`credential*.json`、`*.db`。
`.env` 和 `.workbuddy/` 已被 `.gitignore` 自动挡掉，正常情况下根本不会出现——
**如果它们出现了，立刻停下，说明忽略规则坏了。**

**第 5 步：写提交信息**

格式是硬要求：标题 `Day N｜一句话`（竖线是**全角 ｜**，不是 `|`），正文**恰好两行**。

```bash
printf 'Day 14｜完成同伴互测与一次最小修复\n改了什么：（一句话说清改了什么）\n加了什么：（一句话说清新增了什么）\n' > /tmp/day14.txt
```

**第 6 步：提交**

```bash
git commit -F /tmp/day14.txt
```

> 为什么用 `-F 文件` 而不是 `-m "..."`？
> `-m` 写多行会在段落之间插入空行，正文就不止两行了；而且 Windows 终端容易把中文写成乱码。

**第 7 步：推送**

```bash
git push origin main
```

**第 8 步：双向核对**

```bash
git log --oneline -1        # 本地最新提交
git ls-remote origin main   # 远程 main 的真实 sha
```

两个 sha 一样 = 推送成功。不一样 = 没推上去，别猜，看报错。

### 这条路上的两个已知坑

**坑 1：不要在 PowerShell 里 push。**
本机系统 gitconfig 设了 `credential.helper=manager`，PowerShell 环境的 PATH 里找不到凭据助手，
`git push` 会**静默失败**——退出码 128，但 stdout / stderr 全空，非常难排查。用 Git Bash。

**坑 2：代理挂了（502）跟凭据无关。**
本环境预设了 `HTTP_PROXY` / `HTTPS_PROXY`，代理不稳时报：

```
fatal: unable to access '...': Error in the HTTP2 framing layer
fatal: unable to access '...': CONNECT tunnel failed, response 502
```

排查顺序（**不要一上来就怀疑账号密码**）：

```bash
env | grep -i proxy                                      # 看代理变量
curl -s -o /dev/null -w "状态=%{http_code}\n" --max-time 15 https://github.com
unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY      # 绕过代理再试
```

---

## 路径 B：GitHub 网页拖拽上传（真·手动）

不想碰命令行时用这个，但**代价比看上去大**。

### 步骤

1. 浏览器打开 `https://github.com/XingHo-VibeCoding/vibe-coding-program`
2. 确认当前登录的账号在该组织里有**写权限**（不是那个只读的连接器账号）
3. 点右上 **Add file** → **Upload files**
4. 把文件**拖进**虚线框
5. 填 commit message（同样写 `Day N｜…`）
6. 点 **Commit changes**

### 这条路上的四个坑

1. **不能拖文件夹。** 网页版只收文件。要上传子目录里的东西，得先点进那个目录再拖；
   你项目现在是平铺的（都在根目录），这一条暂时不影响。
2. **它不会帮你排除敏感文件。** 本地有 `.gitignore` 兜底，网页上传**没有兜底**——
   拖了什么就传什么。**千万别把 `.env` 拖进去。**
3. **它只做加法，不做减法。** 本地删掉的文件，网页版不会同步删除，
   容易造成「线上有一份、本地没有」的不一致。
4. **它会让本地和远程分叉。** 网页提交后远程多了一个提交，本地也有自己的提交，
   下次 `git push` 会被拒（`rejected - non-fast-forward`），得先 `git pull --rebase` 才能推。
   十几张 PNG 截图一张张拖，也很费时间。

---

## 两条路怎么选

| | 路径 A 本地终端 | 路径 B 网页拖拽 |
|---|---|---|
| 保留提交历史 | ✅ | ❌（每次一个网页提交） |
| 一次推完所有文件 | ✅ | ❌（逐文件） |
| 敏感文件兜底 | ✅ `.gitignore` 自动挡 | ❌ 全靠手别拖错 |
| 会不会造成分叉 | 不会 | 会（下次 push 要先 rebase） |
| 出错时能否排查 | 有明确报错 | 网页一般不报错，容易静默不一致 |

**结论：用路径 A。**

---

## ⚠️ 今天先别提交

你自己的规则是「**一天的任务全部做完、我核对完文件清单之后才提交**，中途不要边做边提交」。
今天 Day 14 的真人互测和最小修复**还没做**，现在提交等于把半天的活切成一个提交。

**等 Day 14 收尾时的待提交清单（预演）**：

| 文件 | 属哪天 |
|---|---|
| `M index.html`、`M concepts.js` | Day 11 收藏交互 + Day 13 四态 |
| `?? Day11-参考-*.png`（4 张） | Day 11 |
| `?? Day13-参考-*.png`（7 张） | Day 13 |
| `?? _verify-skill.html` | Day 12（临时验证页，**要不要提交需要你拍板**） |
| `?? Day14-测试清单.md`、`Day14-第2周周验证日.md`、`Day14-测试记录.md`（待产出） | Day 14 |
| 最小修复改动的文件 | Day 14 |

`.workbuddy/`（含记忆日志、发布源目录）**不会上传**，因为有 `.gitignore:119`。
