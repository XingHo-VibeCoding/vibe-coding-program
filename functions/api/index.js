// ==========================================================
// 云函数 api —— 后端唯一入口（TECH_DESIGN 方案 B1：云函数中转）
//
// 路由：
//   GET  /api/health            -> 健康检查（不连库；保持 Day 15 已验证形状，见 api-contract §4.1）
//   GET  /api/concepts          -> 首页列表 + 计数（api-contract §4.2）
//   GET  /api/concepts/{slug}   -> 详情 6 段（api-contract §4.3）
//   POST /api/favorites         -> 收藏一个概念（api-contract §4.4；Day 18 新增，本项目唯一写接口）
//   GET  /api/favorites         -> 收藏列表，写后读回（api-contract §4.5；Day 19 新增）
//   PATCH  /api/favorites/{id}   -> 改一条收藏的备注（api-contract §4.6；Day 22 新增）
//   DELETE /api/favorites/{id}   -> 删一条收藏（api-contract §4.7；Day 22 新增）
//
// Day 22 起本项目「增删改查」四类操作齐了：查 = 4 个 GET，删改查收藏 = 上面 3 个，
// 增 = POST（Day 18）。
//
// 统一信封见 api-contract.md §2：
//   成功 { ok: true,  data,    error: null }
//   失败 { ok: false, data: null, error: { code, message } }  // message 只说人话
// ==========================================================

const { listConcepts } = require('./lib/handlers/listConcepts');
const { getConcept } = require('./lib/handlers/getConcept');
const { createFavorite } = require('./lib/handlers/createFavorite');
const { listFavorites } = require('./lib/handlers/listFavorites');
const { updateFavorite } = require('./lib/handlers/updateFavorite');
const { deleteFavorite } = require('./lib/handlers/deleteFavorite');
const { ApiError, toErrorBody } = require('./lib/errors');

// 从 HTTP 触发事件里解析出 { kind, slug }。
// 触发路径可能是 /api 或 /，事件里的 path 可能带或不带 /api 前缀，两种都兼容。
// Day 18 起按方法分流；Day 19 起 GET 走四个读接口（含 /api/favorites 读回）；
// Day 22 起 PATCH / DELETE 走 /api/favorites/{id}；
// 其余方法一律 404 兜底（批量写入等仍不做，见 api-contract §4.6 要点 4）。
function parseRoute(event) {
  const method = String(
    event.httpMethod || (event.requestContext && event.requestContext.httpMethod) || 'GET'
  ).toUpperCase();
  const rawPath = String(event.path || event.rawPath || '/');
  const segs = rawPath.toLowerCase().replace(/\/+$/, '').split('/').filter(Boolean);
  const base = segs[0] === 'api' ? segs.slice(1) : segs;

  if (method === 'GET') {
    if (base.length === 1 && base[0] === 'health') return { kind: 'health', method, rawPath };
    if (base.length === 1 && base[0] === 'concepts') return { kind: 'list', method, rawPath };
    if (base.length === 1 && base[0] === 'favorites') return { kind: 'listFavorites', method, rawPath };
    if (base.length === 2 && base[0] === 'concepts') {
      return {
        kind: 'detail',
        // 归一：转小写 + 去空白（库上有 CHECK slug = lower(slug)，PRD §7 第 12 项）
        slug: decodeURIComponent(base[1]).trim().toLowerCase(),
        method,
        rawPath,
      };
    }
    return { kind: 'not_found', method, rawPath };
  }

  if (method === 'POST') {
    if (base.length === 1 && base[0] === 'favorites') return { kind: 'createFavorite', method, rawPath };
    return { kind: 'not_found', method, rawPath };
  }

  // Day 22：改 / 删。同一个 /api/favorites 前缀网关路由即可覆盖，不需要新建网关路由。
  // 路径形状：/api/favorites/{id}（两段）。id 原样透传给 handler，由它校验是否为正整数。
  if (method === 'PATCH' || method === 'DELETE') {
    if (base.length === 2 && base[0] === 'favorites') {
      return {
        kind: method === 'PATCH' ? 'updateFavorite' : 'deleteFavorite',
        id: decodeURIComponent(base[1]),
        method,
        rawPath,
      };
    }
    return { kind: 'not_found', method, rawPath };
  }

  return { kind: 'not_found', method, rawPath };
}

// 解析请求体：HTTP 网关给的 body 通常是 JSON 字符串（必要时 base64 编码）。
// 解析不出来 = 请求格式不对 → INVALID_FIELD（中文人话），而不是 500。
function parseBody(event) {
  let raw = event.body;
  if (raw === undefined || raw === null || raw === '') return null;
  if (event.isBase64Encoded) {
    raw = Buffer.from(String(raw), 'base64').toString('utf8');
  }
  if (typeof raw !== 'string') return raw; // 本地测试直接传对象的情况
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new ApiError('INVALID_FIELD', 'body 不是合法 JSON');
  }
}

// CloudBase HTTP 函数的标准返回形状：网关按 statusCode/headers/body 组装响应
function respond(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  };
}

exports.main = async function (event = {}) {
  const startedAt = Date.now();
  const route = parseRoute(event);
  console.log(`[api] kind=${route.kind} method=${route.method} path=${route.rawPath}`);

  try {
    let payload;
    let status = 200;
    if (route.kind === 'health') {
      payload = { ok: true, service: 'ai-concept-daily', time: new Date().toISOString() };
    } else if (route.kind === 'list') {
      payload = await listConcepts();
    } else if (route.kind === 'detail') {
      payload = await getConcept(route.slug);
    } else if (route.kind === 'listFavorites') {
      payload = await listFavorites();
    } else if (route.kind === 'createFavorite') {
      payload = await createFavorite(parseBody(event));
      status = 201; // 创建成功用 201（api-contract §4.4 约定）
    } else if (route.kind === 'updateFavorite') {
      payload = await updateFavorite(route.id, parseBody(event));
    } else if (route.kind === 'deleteFavorite') {
      payload = await deleteFavorite(route.id);
    } else {
      throw new ApiError('NOT_FOUND', `path=${route.rawPath}`);
    }
    return respond(status, payload);
  } catch (err) {
    const { status: errStatus, body } = toErrorBody(err);
    // 技术细节（detail / message）只进日志，不进响应体
    console.error(`[api] kind=${route.kind} code=${body.error.code} detail=${(err && (err.detail || err.message)) || ''}`);
    return respond(errStatus, body);
  } finally {
    console.log(`[api] kind=${route.kind} duration=${Date.now() - startedAt}ms`);
  }
};
