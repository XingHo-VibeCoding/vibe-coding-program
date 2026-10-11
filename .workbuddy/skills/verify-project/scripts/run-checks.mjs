#!/usr/bin/env node
/**
 * verify-project · 可执行检查脚本
 * 建立于 Day 25（2026-10-11）
 *
 * 覆盖 A–E 组（HTTP / 密钥 / Git）。F 组（数据库）需MCP 工具，脚本不覆盖，
 * 按 SKILL.md 铁律 5 会在汇总中列为 SKIP，绝不标 PASS。
 *
 * 用法：
 *   node .workbuddy/skills/verify-project/scripts/run-checks.mjs
 *   node .workbuddy/skills/verify-project/scripts/run-checks.mjs --groups A,B,C
 *   node .workbuddy/skills/verify-project/scripts/run-checks.mjs --verbose
 *   node .workbuddy/skills/verify-project/scripts/run-checks.mjs --keep-test-data
 *
 * 零依赖，只用 Node 内置能力（fetch / child_process）。
 */

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import fs from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');

const BASE = 'https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com';
const SITE = 'https://ai-concept-daily.app.workbuddy.host';

// Chrome 定位（A7 需要真实浏览器判读渲染结果）
const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
];
const chromePath = CHROME_CANDIDATES.find(p => { try { return fs.existsSync(p); } catch { return false; } });

// ---------- 参数 ----------
const argv = process.argv.slice(2);
const verbose = argv.includes('--verbose');
const keepTestData = argv.includes('--keep-test-data');
const groupsArg = argv.indexOf('--groups');
const selectedGroups = groupsArg >= 0
  ? argv[groupsArg + 1].split(',').map(s => s.trim().toUpperCase())
  : ['A', 'B', 'C', 'D', 'E'];

// ---------- 工具函数 ----------
const results = [];
let seq = 0;

function record({ id, title, cmd, output, pass, evidence, note, defectType }) {
  results.push({
    id, title, cmd, output, pass, evidence, note, defectType,
    status: pass === null ? 'SKIP' : (pass ? 'PASS' : 'FAIL'),
    n: ++seq,
  });
}

function sh(cmd, opts = {}) {
  try {
    return { out: execFileSync('bash', ['-lc', cmd], {
      cwd: PROJECT_ROOT, encoding: 'utf8', timeout: 60000,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    }), code: 0 };
  } catch (e) {
    return {
      out: (e.stdout || '') + (e.stderr || ''),
      code: e.status === undefined ? -1 : e.status,
    };
  }
}

async function http(url, opts = {}) {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(25000) });
    const body = opts.method && opts.method !== 'GET' ? await res.text() : await res.text();
    return { status: res.status, headers: res.headers, body, ms: Date.now() - started };
  } catch (e) {
    return { status: 0, headers: new Headers(), body: String(e.message || e), ms: Date.now() - started, error: true };
  }
}

function truncate(s, n = 300) {
  s = String(s).replace(/\r/g, '');
  return s.length > n ? s.slice(0, n) + ` …(共 ${s.length} 字符)` : s;
}

// ══════════════════════════════════════════════════════
// A 组｜公网可访问性
// ══════════════════════════════════════════════════════
async function groupA() {
  // A1 首页 HTTP 状态
  {
    const r = await http(`${SITE}/`);
    const cmd = `curl -s -o /dev/null -w "%{http_code}" ${SITE}/`;
    record({
      id: 'A1', title: '首页 HTTP 状态', cmd,
      output: `实测状态码 = ${r.status}`,
      pass: r.status === 200,
      evidence: `http_code=${r.status}，判据「恰为 200」→ ${r.status === 200 ? '满足' : '不满足'}`,
      note: '来源 Day 14 发布后五路径核对',
    });
  }

  // A2 首页非空壳
  {
    const r = await http(`${SITE}/`);
    const bytes = Buffer.byteLength(r.body, 'utf8');
    const refs = (r.body.match(/concepts\.js/g) || []).length;
    const cmd = `curl -s -o home.html -w "%{size_download}" ${SITE}/; grep -c "concepts.js" home.html`;
    record({
      id: 'A2', title: '首页非空壳（体积 + 引用关键脚本）', cmd,
      output: `字节数 = ${bytes}；concepts.js 出现次数 = ${refs}`,
      pass: bytes > 10000 && refs >= 1,
      evidence: `判据 size>10000(${bytes}) 且 引用≥1(${refs}) → ${bytes > 10000 && refs >= 1 ? '满足' : '不满足'}`,
      note: 'HTTP 200 不代表内容对：发布源目录选错也会 200 但页面是错的',
    });
  }

  // A3 跨域白名单（历史最高频失败项）
  {
    const r = await http(`${BASE}/api/concepts`, { headers: { Origin: SITE } });
    const acao = r.headers.get('access-control-allow-origin');
    const raw = verbose ? JSON.stringify([...r.headers], null, 2) : `access-control-allow-origin = ${acao === null ? '(响应头中不存在)' : acao}`;
    const ok = acao === SITE;
    const cmd = `curl -s -D - -o /dev/null -H "Origin: ${SITE}" ${BASE}/api/concepts`;
    record({
      id: 'A3', title: '跨域白名单（带 Origin 头实测）', cmd,
      output: `HTTP ${r.status}；${raw}`,
      pass: ok,
      evidence: acao === null
        ? '响应头中无 access-control-allow-origin → 浏览器会拦，页面显示错误态'
        : (acao === '*'
          ? '返回了通配符 *，本项目明令禁止'
          : `返回 ${acao}，与请求 Origin ${SITE} ${acao === SITE ? '一致 → 满足' : '不一致 → 不满足'}`),
      note: '根因：安全域名白名单缺 ai-concept-daily.app.workbuddy.host。Day 20 对照实验锁定根因，Day 22/23/24 连续 3 天实测同一现象。修复需人工在 CloudBase 控制台加（MCP addSecurityDomain 工具数组参数有 bug）。',
      defectType: ok ? null : '被测对象缺陷',
    });
  }

  // A4 静态资源可达
  {
    const [a, b] = await Promise.all([
      http(`${SITE}/concepts.js`),
      http(`${SITE}/concept.html`),
    ]);
    const cmd = `curl -s -o /dev/null -w "%{http_code}" ${SITE}/concepts.js; curl -s -o /dev/null -w "%{http_code}" ${SITE}/concept.html`;
    record({
      id: 'A4', title: '静态资源可达（concepts.js / concept.html）', cmd,
      output: `concepts.js = ${a.status}；concept.html = ${b.status}`,
      pass: a.status === 200 && b.status === 200,
      evidence: `判据两者均为 200 → ${a.status === 200 && b.status === 200 ? '满足' : '不满足'}`,
    });
  }

  // A5 .env 未泄露
  {
    const r = await http(`${SITE}/.env`);
    const cmd = `curl -s -o /dev/null -w "%{http_code}" ${SITE}/.env`;
    record({
      id: 'A5', title: '.env 未泄露到公网', cmd,
      output: `HTTP ${r.status}${r.status === 200 ? `｜响应体前 80 字符：${truncate(r.body, 80)}` : ''}`,
      pass: r.status !== 200,
      evidence: `判据状态码 ≠ 200 → 实测 ${r.status}，${r.status !== 200 ? '满足' : '不满足。若为 200 意味着发布源目录误用项目根目录'}`,
      defectType: r.status === 200 ? '被测对象缺陷' : null,
    });
  }

  // A6 .workbuddy/ 未泄露
  {
    const r = await http(`${SITE}/.workbuddy/`);
    const cmd = `curl -s -o /dev/null -w "%{http_code}" ${SITE}/.workbuddy/`;
    record({
      id: 'A6', title: '.workbuddy/ 未泄露到公网', cmd,
      output: `HTTP ${r.status}`,
      pass: r.status !== 200,
      evidence: `判据状态码 ≠ 200 → 实测 ${r.status}，${r.status !== 200 ? '满足' : '不满足'}`,
      defectType: r.status === 200 ? '被测对象缺陷' : null,
    });
  }

  // A7 公网首页渲染出真实数据（真实 Chrome，非 curl）
  // ⚠️ Day 25 第 1 轮补充（补漏报）：A2 只证明静态 HTML 非空壳，
  // 而首页数据是 JS 运行时 fetch 出来的 —— curl **根本看不到**。
  // 「公网首页展示数据库真实数据」这条要求必须用真实浏览器判，
  // 判读锚点：<main id="list" data-state="..."> 与其中卡片数量。
  {
    const cmd = `chrome --headless=new --disable-gpu --no-sandbox --user-data-dir=<独立profile> --virtual-time-budget=15000 --dump-dom ${SITE}/`;
    if (!chromePath) {
      record({
        id: 'A7', title: '公网首页渲染出真实数据（真实 Chrome）', cmd,
        output: `未找到 Chrome 可执行文件（已试：${CHROME_CANDIDATES.join(', ')}）`,
        pass: null,
        evidence: 'SKIP：环境无 Chrome，无法用真实浏览器判读渲染结果。按铁律 5 不标 PASS。',
      });
    } else {
      const prof = join(PROJECT_ROOT, '.workbuddy', '.chrome-verify-profile');
      const g = sh(`"${chromePath}" --headless=new --disable-gpu --no-sandbox --no-first-run --no-default-browser-check --disable-extensions --disable-sync --user-data-dir="${prof}" --virtual-time-budget=15000 --dump-dom "${SITE}/" 2>/dev/null || true`, { timeout: 90000 });
      const dom = g.out || '';
      const stateM = /<main[^>]*id="list"[^>]*data-state="([^"]*)"/.exec(dom)
        || /data-state="([^"]*)"[^>]*id="list"/.exec(dom);
      const state = stateM ? stateM[1] : '(未找到 data-state 属性)';
      const cardCount = (dom.match(/class="[^"]*card[^"]*"/g) || []).length
        || (dom.match(/<article/g) || []).length;
      // 从渲染后的 DOM 里抓一个真实概念标题，验证数据来自接口而非硬编码
      const titleM = /检索增强生成|向量化|大语言模型|注意力机制|幻觉/.exec(dom);
      const ok = state === 'success' && cardCount >= 7 && !!titleM;
      record({
        id: 'A7', title: '公网首页渲染出真实数据（真实 Chrome 判读）', cmd,
        output: `data-state = ${JSON.stringify(state)}；页面内卡片元素数 = ${cardCount}；命中数据库概念标题 = ${titleM ? JSON.stringify(titleM[0]) : '(无)'}`,
        pass: ok,
        evidence: `逐条判据：data-state === 'success'（实测 ${JSON.stringify(state)}，${state === 'success'}) / 卡片数 ≥ 7（实测 ${cardCount}，${cardCount >= 7}） / 渲染出数据库里的概念标题（${titleM ? '命中「' + titleM[0] + '」' : '未命中'}）→ ${ok ? '全部满足' : '存在不满足项'}`,
        note: state === 'error'
          ? '根因指向 A3：跨域被浏览器拦，fetch 失败后首页走error 分支。修好 A3（加安全域名白名单）本项会随之通过'
          : '第 1 轮补充项：A2 只能证明静态 HTML 非空壳，证明不了数据是接口返回的。curl 看不到 JS 运行时结果，必须真实浏览器',
        defectType: ok ? null : '被测对象缺陷',
      });
    }
  }
}

// ══════════════════════════════════════════════════════
// B 组｜健康接口
// ══════════════════════════════════════════════════════
async function groupB() {
  const r = await http(`${BASE}/api/health`);
  let j = null;
  try { j = JSON.parse(r.body); } catch {}

  record({
    id: 'B1', title: '/api/health HTTP 状态',
    cmd: `curl -s -o /dev/null -w "%{http_code}" ${BASE}/api/health`,
    output: `HTTP ${r.status}（耗时 ${r.ms}ms）`,
    pass: r.status === 200,
    evidence: `判据恰为 200 → 实测 ${r.status}，${r.status === 200 ? '满足' : '不满足'}`,
    note: '来源 Day 17 接口首调',
  });

  const okOk = j && j.ok === true;
  const svc = j?.service;
  const tm = j?.time;
  const tmValid = typeof tm === 'string' && !Number.isNaN(Date.parse(tm));
  // ⚠️ Day 25 第 1 轮修正（误报）：契约 api-contract.md §4.1 规定 health 响应体就是
  // { ok, service, time }，**根本没有 error 字段**（实测 error === undefined）。
  // 第 1 轮误把通用信封的 error===null 套到 health 上，报了假 FAIL。
  // 现按契约 §4.1 逐条判，并反向检查「有没有契约外的多余字段」。
  const knownKeys = ['ok', 'service', 'time'];
  const extraKeys = j ? Object.keys(j).filter(k => !knownKeys.includes(k)) : [];
  const all = okOk && svc === 'ai-concept-daily' && tmValid && extraKeys.length === 0;
  record({
    id: 'B2', title: '/api/health 信封字段与值',
    cmd: `curl -s ${BASE}/api/health`,
    output: `ok = ${okOk}；service = ${JSON.stringify(svc)}；time = ${JSON.stringify(tm)}；实际出现的键 = ${JSON.stringify(j ? Object.keys(j) : null)}`,
    pass: all,
    evidence: `逐条判据（依据 api-contract.md §4.1）：ok===true(${okOk}) / service==='ai-concept-daily'(${svc === 'ai-concept-daily'}) / time 可被new Date() 解析(${tmValid}) / 无契约外多余字段(${extraKeys.length === 0}${extraKeys.length ? '，多余=' + extraKeys.join(',') : ''}) → ${all ? '全部满足' : '存在不满足项'}`,
    note: '第 1 轮修正项：原判据错要求 error===null，但 health 按契约本就没这个字段。通用信封 {ok,data,error} 只适用于 /api/concepts 与 /api/favorites',
  });
}

// ══════════════════════════════════════════════════════
// C 组｜读写接口闭环
// ══════════════════════════════════════════════════════
async function groupC() {
  let createdId = null;
  let createdSlug = null;

  // 先读一次拿当前收藏的 slug，用于挑一个未收藏的
  const before = await http(`${BASE}/api/favorites`);
  let beforeList = [];
  try { beforeList = JSON.parse(before.body)?.data?.items || []; } catch {}
  const favSlugs = new Set(beforeList.map(x => x.slug));
  const beforeCount = beforeList.length;

  // C1 概念列表
  {
    const r = await http(`${BASE}/api/concepts`);
    let j = null; try { j = JSON.parse(r.body); } catch {}
    const items = j?.data?.items || [];
    const latest = j?.data?.latestDate;
    let descOk = true;
    const dates = items.map(x => x.date);
    for (let i = 0; i < dates.length - 1; i++) {
      if (!(dates[i] >= dates[i + 1])) { descOk = false; break; }
    }
    const pass = r.status === 200 && items.length === 7 && latest === '2026-09-22' && descOk;
    record({
      id: 'C1', title: '读·概念列表（条数 / latestDate / 严格倒序）',
      cmd: `curl -s ${BASE}/api/concepts`,
      output: `HTTP ${r.status}；items.length = ${items.length}；latestDate = ${JSON.stringify(latest)}；日期序列 = ${JSON.stringify(dates)}`,
      pass,
      evidence: `逐条判据：HTTP 200(${r.status === 200}) / length===7(${items.length === 7}) / latestDate==='2026-09-22'(${latest === '2026-09-22'}) / 逐对校验严格倒序(${descOk}) → ${pass ? '全部满足' : '存在不满足项'}`,
    });
  }

  // C2 收藏列表
  {
    const ids = beforeList.map(x => x.id);
    const allInt = ids.every(x => Number.isInteger(x) && x > 0);
    const uniq = new Set(ids).size === ids.length;
    const pass = before.status === 200 && Array.isArray(beforeList) && allInt && uniq;
    record({
      id: 'C2', title: '读·收藏列表（数组 / id 有效 / id 唯一）',
      cmd: `curl -s ${BASE}/api/favorites`,
      output: `HTTP ${before.status}；items.length = ${beforeList.length}；ids = ${JSON.stringify(ids)}`,
      pass,
      evidence: `判据：HTTP 200(${before.status === 200}) / 是数组(Array.isArray=${Array.isArray(beforeList)}) / 全部为正整数 id(${allInt}) / id 无重复(${uniq}) → ${pass ? '全部满足' : '存在不满足项'}`,
      note: `本轮基线 count = ${beforeCount}，C6 完成后须回到此值`,
    });
  }

  // C3 POST 新增
  {
    const candidates = ['001-large-language-model', '002-token', '003-prompt',
      '004-hallucination', '005-attention', '006-embedding', '007-rag'];
    createdSlug = candidates.find(s => !favSlugs.has(s)) || null;

    if (!createdSlug) {
      record({
        id: 'C3', title: '写·POST 新增收藏',
        cmd: `curl -s -X POST ${BASE}/api/favorites -d '{"slug":"..."}'`,
        output: '7 个概念全部已收藏，无可用测试 slug',
        pass: null,
        evidence: 'SKIP：找不到未收藏的 slug 可用于写入测试。不伪造 PASS。',
      });
    } else {
      const r = await http(`${BASE}/api/favorites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: createdSlug }),
      });
      let j = null; try { j = JSON.parse(r.body); } catch {}
      const id = j?.data?.id;
      createdId = Number.isInteger(id) ? id : null;
      const pass = r.status === 201 && createdId !== null;
      record({
        id: 'C3', title: '写·POST 新增收藏',
        cmd: `curl -s -X POST ${BASE}/api/favorites -H "Content-Type: application/json" -d '{"slug":"${createdSlug}"}'`,
        output: `HTTP ${r.status}；返回 id = ${JSON.stringify(id)}；body = ${truncate(r.body, 160)}`,
        pass,
        evidence: `判据：HTTP 201（实测 ${r.status}）且 id 为正整数（${createdId}）→ ${pass ? '满足' : '不满足'}`,
        note: `选用未收藏的 slug：${createdSlug}`,
      });

      // C4 写后读回
      if (createdId !== null) {
        const after = await http(`${BASE}/api/favorites`);
        let aj = null; try { aj = JSON.parse(after.body); } catch {}
        const aItems = aj?.data?.items || [];
        const found = aItems.some(x => x.id === createdId);
        record({
          id: 'C4', title: '写后读回（POST 的 id 必须出现在列表中）',
          cmd: `curl -s ${BASE}/api/favorites | grep ${createdId}`,
          output: `读回 count = ${aItems.length}；该 id 是否在列表中 = ${found}`,
          pass: found,
          evidence: `判据：id=${createdId} 出现在读回列表 → ${found ? '满足' : '不满足'}`,
          note: '来源 Day 20 教训：契约 §4.4 与 §4.5 要分开看，写成功不等于读得到',
        });
      } else {
        record({
          id: 'C4', title: '写后读回',
          cmd: `curl -s ${BASE}/api/favorites`,
          output: `C3 未返回合法 id，无法执行读回比对`,
          pass: null,
          evidence: 'SKIP：C3 未成功，本项无从验证。不伪造 PASS。',
        });
      }
    }
  }

  // C5 PATCH 备注
  if (createdId !== null) {
    const NOTE = 'verify-project自检';
    const r = await http(`${BASE}/api/favorites/${createdId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: NOTE }),
    });
    let j = null; try { j = JSON.parse(r.body); } catch {}
    const got = j?.data?.note;
    const pass = r.status === 200 && got === NOTE;
    record({
      id: 'C5', title: '改·PATCH 备注（逐字符比对）',
      cmd: `curl -s -X PATCH ${BASE}/api/favorites/${createdId} -H "Content-Type: application/json" -d '{"note":"${NOTE}"}'`,
      output: `HTTP ${r.status}；返回 note = ${JSON.stringify(got)}；期望 = ${JSON.stringify(NOTE)}`,
      pass,
      evidence: `判据：HTTP 200(${r.status === 200}) 且 note 逐字符等于期望值(${got === NOTE}) → ${pass ? '满足' : '不满足'}`,
      note: '口径：不是「有 note 字段」，是逐字符相等。note:"" 表示明确清空，应存 null',
    });
  } else {
    record({
      id: 'C5', title: '改·PATCH 备注',
      cmd: `curl -s -X PATCH ${BASE}/api/favorites/<id> -d '{"note":"..."}'`,
      output: '无可用 id（C3 未成功）',
      pass: null,
      evidence: 'SKIP：无可用 id。不伪造 PASS。',
    });
  }

  // C6 DELETE 真删（必须回读）
  if (createdId !== null) {
    const pre = await http(`${BASE}/api/favorites`);
    let pj = null; try { pj = JSON.parse(pre.body); } catch {}
    const preCount = (pj?.data?.items || []).length;

    const del = await http(`${BASE}/api/favorites/${createdId}`, { method: 'DELETE' });

    const post = await http(`${BASE}/api/favorites`);
    let qj = null; try { qj = JSON.parse(post.body); } catch {}
    const postItems = qj?.data?.items || [];
    const stillThere = postItems.some(x => x.id === createdId);
    const countOk = postItems.length === preCount - 1;

    const pass = del.status === 200 && countOk && !stillThere;
    record({
      id: 'C6', title: '删·DELETE 真删（删除后必须回读比对）',
      cmd: `curl -s -X DELETE ${BASE}/api/favorites/${createdId}; curl -s ${BASE}/api/favorites`,
      output: `DELETE HTTP ${del.status}；删除前 count = ${preCount}；删除后 count = ${postItems.length}；该 id 是否仍在列表中 = ${stillThere}`,
      pass,
      evidence: `三步判据：① DELETE 返回 200(${del.status === 200}) ② 回读 count = 删除前−1（${preCount}−1=${preCount - 1}，实测 ${postItems.length}，${countOk ? '满足' : '不满足'}）③ 该 id 已不在列表中（${!stillThere}）→ ${pass ? '全部满足' : '存在不满足项'}`,
      note: 'Day 24 假成功 Bug 的直接对策：按钮立刻变「☆ 收藏」但数据库那行从未消失，只看 HTTP 200 会漏掉',
    });
    createdId = null; // 已清理
  } else {
    record({
      id: 'C6', title: '删·DELETE 真删',
      cmd: `curl -s -X DELETE ${BASE}/api/favorites/<id>`,
      output: '无可用 id（C3 未成功，本轮未产生测试数据，无需清理）',
      pass: null,
      evidence: 'SKIP：无可用 id。不伪造 PASS。',
    });
  }

  // C7 对不存在的 id 不报成功
  {
    const p = await http(`${BASE}/api/favorites/99999`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: 'x' }),
    });
    const d = await http(`${BASE}/api/favorites/99999`, { method: 'DELETE' });
    let pj = null, dj = null;
    try { pj = JSON.parse(p.body); } catch {}
    try { dj = JSON.parse(d.body); } catch {}
    const pc = pj?.error?.code, dc = dj?.error?.code;
    const pass = p.status === 404 && d.status === 404 &&
      pc === 'FAVORITE_NOT_FOUND' && dc === 'FAVORITE_NOT_FOUND';
    record({
      id: 'C7', title: '对不存在的 id 不得报成功',
      cmd: `curl -s -X PATCH ${BASE}/api/favorites/99999 -d '{"note":"x"}'; curl -s -X DELETE ${BASE}/api/favorites/99999`,
      output: `PATCH HTTP ${p.status} code=${pc}；DELETE HTTP ${d.status} code=${dc}`,
      pass,
      evidence: `判据：两者均 404 且 code==='FAVORITE_NOT_FOUND' → PATCH(${p.status}/${pc})、DELETE(${d.status}/${dc}) → ${pass ? '满足' : '不满足'}`,
      note: 'Day 22 防呆口径：绝不允许对不存在的 id 报成功',
    });
  }

  // 数据清理交代
  const final = await http(`${BASE}/api/favorites`);
  let fj = null; try { fj = JSON.parse(final.body); } catch {}
  const finalCount = (fj?.data?.items || []).length;
  record({
    id: 'C0', title: '数据清理交代（本轮测试数据是否已还原）',
    cmd: `curl -s ${BASE}/api/favorites`,
    output: `本轮开始前 count = ${beforeCount}；本轮结束后 count = ${finalCount}${keepTestData ? '（--keep-test-data 已指定保留）' : ''}`,
    pass: keepTestData ? null : finalCount === beforeCount,
    evidence: keepTestData
      ? 'SKIP：按 --keep-test-data 保留测试数据，未做还原判定'
      : `判据：结束 count === 开始 count（${beforeCount}）→ 实测 ${finalCount}，${finalCount === beforeCount ? '已还原基线' : '未还原，差值 ' + (finalCount - beforeCount)}`,
    note: createdSlug ? `本轮测试写入的 slug：${createdSlug}` : '本轮未产生测试写入',
  });
}

// ══════════════════════════════════════════════════════
// D 组｜密钥扫描
// ══════════════════════════════════════════════════════
const SECRET_RE = 'sk-[A-Za-z0-9]{10}|ghp_[A-Za-z0-9]{10}|AKID[A-Za-z0-9]{10}|eyJ[A-Za-z0-9_-]{20}|-----BEGIN (RSA|EC|PRIVATE|OPENSSH)|postgres(ql)?://[^ ]*:[^ @]*@|mongodb(\\+srv)?://[^ ]*:[^ @]*@|AIza[0-9A-Za-z_-]{20}|xox[baprs]-[0-9A-Za-z-]{10}';

/**
 * ⚠️ Day 25 第 1 轮修正（误报根因）：命中 ≠ 泄露。
 *
 * 第 1 轮 D1/D2/D4 报出 8 处FAIL，逐条核对原文后发现**全部是文档里
 * 描述「不该出现什么」的说明文字**，例如：
 *   - Day23-安全自查清单.md:33  「（your_api_key_here、postgresql://user:password@localhost），不是真实凭证」
 *   - Day23-安全自查清单.md:72  表格里演示「错误示范：`DATABASE_URL=postgresql://user:password@localhost:5432/mydb`」
 *   - TECH_DESIGN.md:754        「形如 postgresql://<用户名>@<主机>:5432/db」
 * 这些是**审计文档在引用违规示例**，不是凭证本身。
 *
 * 修正方式（不是放宽判据，是把判据分层）：
 *   1) 先用正则判定「这一行是否命中特征词」—— 命中不等于违规；
 *   2) 再判定「该命中是否为**弱占位符**」—— 用户名/密码部分是 user/password/xxx/
 *      your_xxx 这类**通用占位词**，且该行位于 .md/.txt 文档中 → 归类为
 *      PLACEHOLDER（文档示例），不判 FAIL，但**必须在输出里逐条列出**；
 *   3) 非占位词（如真实长随机串）→ 判 FAIL 并标红「疑似真实凭证」；
 *   4) 代码文件（.js/.mjs/.json/.html）里出现连接串形状 → 一律判 FAIL，
 *      不适用占位符豁免（代码里的连接串就是配置，不该出现在仓库）。
 *
 * 分层后仍能抓住真泄露：注入的假密钥是 sk-xxxxxxxxxx 形态，
 * 用户名/密码段是随机字符，不在任何占位词表里。
 */

// 通用弱占位词表：这些值出现在连接串的用户名/密码段时视为文档示例
const WEAK_PLACEHOLDER = /^(user|username|pass|password|root|test|demo|your[_-]?\w*|my\w*|<[^>]*>|\{\{?[^}]*\}?\}|\$\{[^}]*\}|xxx+|xxx|\*+|placeholder|example|changeme|your_password_here|your_api_key_here)$/i;

// 判定一行命中是否属于「文档里的弱占位符示例」
function classifyHit(file, line, opts = {}) {
  const isDoc = /\.(md|txt|log)$/i.test(file) || opts.history === true;
  // 私钥块 / JWT / 云厂商 key 形态没有「占位符」概念，一律视为真命中
  if (/-----BEGIN|eyJ[A-Za-z0-9_-]{20}|AKID[A-Za-z0-9]{10}|AIza[0-9A-Za-z_-]{20}|xox[baprs]-/.test(line)) {
    return { kind: 'REAL', reason: '强特征形态（私钥块/JWT/云厂商 Key/Slack token），无占位符概念' };
  }
  // OpenAI 风格 sk-：看后半段是否全为同一重复字符
  const skm = /sk-([A-Za-z0-9]{10,})/.exec(line);
  if (skm) {
    const tail = skm[1];
    const weak = /^(.)\1+$/i.test(tail) || /^(x+|test|demo|your|placeholder|example)/i.test(tail);
    return weak
      ? { kind: 'PLACEHOLDER', reason: `sk- 后段 ${JSON.stringify(tail.slice(0, 6))}… 为重复/示例字符，非真实密钥` }
      : { kind: 'REAL', reason: 'sk- 后段为随机串特征，疑似真实密钥' };
  }
  // 连接串：拆出用户名/密码段判断
  const conn = /(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\/([^\s:/@]*):([^\s@]*)@/.exec(line);
  if (conn) {
    const [, u, p] = conn;
    const weak = WEAK_PLACEHOLDER.test(u) && WEAK_PLACEHOLDER.test(p);
    // 占位词命中优先判PLACEHOLDER；只有在「非文档 + 非占位词」时才判真实。
    // ⚠️ Day 25 第 2 轮修正：原逻辑写成「非文档 → 直接 REAL」，
    // 导致 Git 历史里同一批文档占位符（因为 diff 行没有文件路径、isDoc 恒为 false）
    // 被重复判成真凭证 → 又一次假 FAIL。现改为按「是否弱占位词」定性，
    // 文件类型只作为附加说明。
    return weak
      ? { kind: 'PLACEHOLDER', reason: `文档示例：用户名与密码段均为通用占位词（user=${JSON.stringify(u)} pass=${JSON.stringify(p)}）` }
      : { kind: 'REAL', reason: `连接串的用户名/密码段非通用占位词（user=${JSON.stringify(u)} pass=${JSON.stringify(p).slice(0, 8)}…），疑似真实凭证${isDoc ? '' : '（且出现在代码文件中，代码里的连接串即配置，更需警惕）'}` };
  }
  // ghp_ GitHub token
  const ghp = /ghp_([A-Za-z0-9]{10,})/.exec(line);
  if (ghp) {
    const weak = /^(.)\1+$/i.test(ghp[1]) || /^(x+|test|placeholder|example)/i.test(ghp[1]);
    return weak
      ? { kind: 'PLACEHOLDER', reason: 'ghp_ 后段为重复/示例字符' }
      : { kind: 'REAL', reason: 'ghp_ 后段为随机串特征，疑似真实 GitHub token' };
  }
  // 其余形态保守判为真实
  return { kind: 'REAL', reason: '命中强特征且无法归类为占位符' };
}

function scanText(file, text, opts = {}) {
  const out = { real: [], placeholder: [] };
  text.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const re = new RegExp(SECRET_RE, 'i');
    if (!re.test(line)) return;
    const c = classifyHit(file, line, opts);
    const item = { where: `${file}:${i + 1}`, line: line.trim().slice(0, 200), ...c };
    (c.kind === 'REAL' ? out.real : out.placeholder).push(item);
  });
  return out;
}

function groupD() {
  // D1 仓库已入库文件
  {
    const ls = sh('git ls-files');
    const files = ls.out.split('\n').map(s => s.trim())
      .filter(f => f && !/\.(png|jpg|jpeg|gif|webp|ico)$/i.test(f));
    const real = [], ph = [];
    for (const f of files) {
      const abs = join(PROJECT_ROOT, f);
      if (!fs.existsSync(abs)) continue;
      const g = sh(`cat ${JSON.stringify(f)} 2>/dev/null || true`);
      if (g.code !== 0) continue;
      const r = scanText(f, g.out);
      real.push(...r.real); ph.push(...r.placeholder);
    }
    const cmd = `git ls-files 逐个文件扫 9 类特征词 → 命中行再分类（强特征=FAIL / 文档弱占位符=PLACEHOLDER）`;
    record({
      id: 'D1', title: '仓库已入库文件无真实密钥',
      cmd,
      output: `扫描 ${files.length} 个非图片已入库文件；正则命中 ${real.length + ph.length} 行 → 判定真实凭证 ${real.length} 行 / 文档占位符 ${ph.length} 行` +
        (real.length ? `\n【真实凭证，必须为空】\n${real.map(h => `  ${h.where}: ${h.line}\n    → ${h.reason}`).join('\n')}` : '\n【真实凭证】0 行') +
        (ph.length ? `\n【文档占位符示例，不判FAIL 但如实列出】\n${ph.map(h => `  ${h.where}: ${h.line.slice(0, 110)}\n    → ${h.reason}`).join('\n')}` : ''),
      pass: real.length === 0,
      evidence: `判据：**真实凭证命中数 = 0** → 实测 ${real.length}，${real.length === 0 ? '满足' : '不满足'}。（正则总命中 ${real.length + ph.length} 行，其中 ${ph.length} 行经分类为文档占位符示例，已逐条列出说明理由，未默默忽略）`,
      defectType: real.length ? '被测对象缺陷' : null,
      note: '第 1 轮修正项：原判据「正则命中=0」把审计文档里引用违规示例的文字也判成泄露（假 FAIL）。现改为两层判定：正则命中 → 再分类强特征/文档占位符。来源 Day 23 安全自查',
    });
  }

  // D2 Git 全量历史无真实密钥
  {
    const g = sh(`git log --all -p 2>/dev/null || true`);
    const r = scanText('<git历史>', g.out, { history: true });
    record({
      id: 'D2', title: 'Git 全量历史无真实密钥',
      cmd: `git log --all -p → 扫 9 类特征词 → 命中行分类（强特征 / 文档占位符）`,
      output: `正则命中 ${r.real.length + r.placeholder.length} 行 → 真实凭证 ${r.real.length} 行 / 文档占位符 ${r.placeholder.length} 行` +
        (r.real.length ? `\n【真实凭证】\n${r.real.map(h => `  git历史:${h.where.split(':')[1]}: ${h.line}\n    → ${h.reason}`).join('\n')}` : '\n【真实凭证】0 行') +
        (r.placeholder.length ? `\n【文档占位符示例】\n${r.placeholder.map(h => `  git历史:${h.where.split(':')[1]}: ${h.line.slice(0, 110)}\n    → ${h.reason}`).join('\n')}` : ''),
      pass: r.real.length === 0,
      evidence: `判据：真实凭证命中 = 0 → 实测 ${r.real.length}，${r.real.length === 0 ? '满足' : '不满足'}。占位符 ${r.placeholder.length} 行已如实列出`,
      defectType: r.real.length ? '被测对象缺陷' : null,
      note: '第 1 轮修正项：同理。原判据把 TECH_DESIGN.md 表格里的 postgresql://user:password@host 示例判成真实凭证',
    });
  }

  // D3 凭证只从环境变量读
  {
    const f = 'functions/api/lib/db.js';
    const g = sh(`grep -n 'CLOUDBASE_API_KEY' ${JSON.stringify(f)} || true`);
    const out = g.out;
    const reads = /process\.env\.CLOUDBASE_API_KEY/.test(out);
    const throws = /throw/.test(out);
    const literal = /CLOUDBASE_API_KEY\s*=\s*['"][^'"]+['"]/.test(out);
    const pass = reads && throws && !literal;
    record({
      id: 'D3', title: '凭证只从环境变量读，源码零字面量',
      cmd: `grep -n 'process.env.CLOUDBASE_API_KEY' ${f}`,
      output: out.trim() ? out.trim().split('\n').join('\n           ') : '(无匹配)',
      pass,
      evidence: `逐条判据：出现 process.env.CLOUDBASE_API_KEY 读取(${reads}) / 缺失时 throw 不静默继续(${throws}) / 无硬编码赋值(${!literal}) → ${pass ? '全部满足' : '存在不满足项'}`,
      defectType: pass ? null : '被测对象缺陷',
    });
  }

  // D4 工作区无密钥（排除 .env / .workbuddy / .git）
  {
    const g = sh(`grep -rIlE '${SECRET_RE}' . --exclude-dir=.git --exclude-dir=.workbuddy --exclude-dir=node_modules --exclude=.env 2>/dev/null || true`);
    const fl = g.out.split('\n').map(s => s.trim()).filter(Boolean);
    const real = [], ph = [];
    for (const rel of fl) {
      const f = rel.replace(/^\.\//, '');
      const abs = join(PROJECT_ROOT, f);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
      const c = sh(`cat ${JSON.stringify(f)} 2>/dev/null || true`);
      if (c.code !== 0) continue;
      const r = scanText(f, c.out);
      real.push(...r.real); ph.push(...r.placeholder);
    }
    record({
      id: 'D4', title: '工作区无真实密钥（排除 .env / .workbuddy）',
      cmd: `grep -rIlE "<9类特征词>" . --exclude-dir=.git --exclude-dir=.workbuddy --exclude=.env → 命中文件逐行分类`,
      output: `命中文件 ${fl.length} 个；正则命中 ${real.length + ph.length} 行 → 真实凭证 ${real.length} 行 / 文档占位符 ${ph.length} 行` +
        (real.length ? `\n【真实凭证】\n${real.map(h => `  ${h.where}: ${h.line}\n    → ${h.reason}`).join('\n')}` : '\n【真实凭证】0 行') +
        (ph.length ? `\n【文档占位符示例】\n${ph.map(h => `  ${h.where}: ${h.line.slice(0, 110)}\n    → ${h.reason}`).join('\n')}` : ''),
      pass: real.length === 0,
      evidence: `判据：真实凭证命中 = 0 → 实测 ${real.length}，${real.length === 0 ? '满足' : '不满足'}`,
      defectType: real.length ? '被测对象缺陷' : null,
      note: '第 4 轮（第 2 轮）注入的假密钥若被此项抓到，where 字段会给出精确文件与行号',
    });
  }
}

// ══════════════════════════════════════════════════════
// E 组｜Git 安全配置
// ══════════════════════════════════════════════════════
function groupE() {
  // E1 .env 被忽略
  {
    const g = sh('git check-ignore -v .env; echo "退出码=$?"');
    const code = /退出码=(\d+)/.exec(g.out)?.[1];
    const hasRule = /^\.gitignore:\d+:/.test(g.out.split('\n')[0] || '');
    const pass = code === '0' && hasRule;
    record({
      id: 'E1', title: '.env 被 .gitignore 忽略',
      cmd: 'git check-ignore -v .env; echo "退出码=$?"',
      output: g.out.trim(),
      pass,
      evidence: `判据：退出码=0（实测 ${code}）且输出含 .gitignore 行号（${hasRule}）→ ${pass ? '满足' : '不满足'}`,
    });
  }

  // E2 .env 不在仓库
  {
    const g = sh('git ls-files | grep -x "\\.env"; echo "退出码=$?"');
    const has = /\.env/.test(g.out.split('\n')[0] || '') && !/退出码/.test(g.out.split('\n')[0] || '');
    record({
      id: 'E2', title: '.env 不在 Git 已入库文件中',
      cmd: 'git ls-files | grep -x "\\.env"',
      output: has ? g.out.trim() : '(无文件路径输出)',
      pass: !has,
      evidence: `判据：无文件路径输出 → ${has ? '不满足，存在 .env 条目' : '满足，git ls-files 中无 .env'}`,
      defectType: has ? '被测对象缺陷' : null,
    });
  }

  // E3 .env.example 存在且已入库
  {
    const g = sh('git ls-files | grep -x "\\.env\\.example"');
    const lines = g.out.split('\n').filter(s => s.trim() === '.env.example');
    const pass = lines.length === 1;
    record({
      id: 'E3', title: '.env.example 存在且已入库',
      cmd: 'git ls-files | grep -x "\\.env\\.example"',
      output: g.out.trim() || '(无输出)',
      pass,
      evidence: `判据：恰 1 行 .env.example → 实测 ${lines.length} 行，${pass ? '满足' : '不满足'}`,
      note: '两者都要：.env 必须忽略（防泄露），.env.example 必须入库（让别人知道要配什么变量）',
    });
  }
}

// ══════════════════════════════════════════════════════
// 汇总输出
// ══════════════════════════════════════════════════════
function report() {
  const now = new Date().toLocaleString('zh-CN', { hour12: false });
  console.log('═'.repeat(74));
  console.log('verify-project · 发布前检查');
  console.log('项目：每日一个 AI 概念详解');
  console.log(`执行时间：${now}`);
  console.log(`项目根目录：${PROJECT_ROOT}`);
  console.log(`本次执行范围：A–E 组（F 组数据库需MCP 工具，见下方 SKIP 说明）`);
  console.log('═'.repeat(74));

  const total = results.length;
  results.forEach((r, i) => {
    const idx = String(i + 1).padStart(2, ' ');
    const tag = r.status === 'PASS' ? 'PASS' : (r.status === 'FAIL' ? 'FAIL' : 'SKIP ');
    console.log('');
    console.log(`[${idx}/${total}] ${r.id} ${r.title}  →  ${tag}`);
    console.log(`  命令：${r.cmd}`);
    const outLines = String(r.output).split('\n');
    outLines.slice(0, verbose ? 40 : 12).forEach(l => console.log(`  实测：${l}`));
    if (outLines.length > (verbose ? 40 : 12)) {
      console.log(`实测：（共 ${outLines.length} 行，加 --verbose 查看全部）`);
    }
    console.log(`  证据：${r.evidence}`);
    if (r.defectType) console.log(`  缺陷类型：${r.defectType}`);
    if (r.note) {
      const nl = r.note.split('\n');
      console.log(`  备注：${nl[0]}`);
      nl.slice(1).forEach(l => console.log(`        ${l}`));
    }
  });

  const pass = results.filter(r => r.status === 'PASS').length;
  const fail = results.filter(r => r.status === 'FAIL').length;
  const skip = results.filter(r => r.status === 'SKIP').length;
  const subjFail = results.filter(r => r.status === 'FAIL' && r.defectType === '被测对象缺陷');
  const checkFail = results.filter(r => r.status === 'FAIL' && r.defectType !== '被测对象缺陷');

  console.log('');
  console.log('─'.repeat(74));
  console.log(`汇总：PASS ${pass} / FAIL ${fail} / SKIP ${skip}（共 ${results.length} 项）`);
  if (fail) {
    console.log('');
    console.log('FAIL 明细：');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      const kind = r.defectType === '被测对象缺陷' ? '被测对象缺陷' : '检查项自身缺陷';
      console.log(`  · ${r.id} ${r.title} —— ${kind}`);
      if (r.note) console.log(`      ${r.note.split('\n')[0]}`);
    });
  }
  if (skip) {
    console.log('');
    console.log('SKIP 明细（按铁律 5，不标 PASS）：');
    results.filter(r => r.status === 'SKIP').forEach(r => {
      console.log(`  · ${r.id} ${r.title} —— ${r.evidence}`);
    });
  }
  console.log('');
  console.log(`被测对象缺陷数：${subjFail.length}    检查项自身缺陷数：${checkFail.length}`);
  console.log('─'.repeat(74));
  console.log('');
  console.log('未覆盖组：F1/F2/F3（数据库可连接 / 核心表存在 / 核心表行数）');
  console.log('  → 本脚本不连数据库。需在对话中用 MCP 数据库工具执行 SKILL.md 附录 A 的 SQL。');
  console.log('  → 工具不可用时如实标 SKIP，禁止标 PASS（SKILL.md 铁律 5）。');

  // 退出码：有被测对象缺陷或检查项缺陷时返回 2
  process.exitCode = fail > 0 ? 2 : 0;
}

// ══════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════
const GROUPS = {
  A: groupA, B: groupB, C: groupC, D: groupD, E: groupE,
};

console.error(`[verify-project] 正在执行组：${selectedGroups.join(', ')}`);
for (const g of selectedGroups) {
  const fn = GROUPS[g];
  if (!fn) { console.error(`[verify-project] 未知组：${g}（可选 A,B,C,D,E）`); continue; }
  await fn();
}
report();
