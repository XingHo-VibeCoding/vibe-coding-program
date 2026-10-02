// ==========================================================
// 云函数 api —— 阶段 1 后端唯一入口（TECH_DESIGN 方案 B1：云函数中转）
//
// 路由（全部 GET）：
//   /api/health            -> 健康检查（不连库；保持 Day 15 已验证形状，见 api-contract §4.1）
//   /api/concepts          -> 首页列表 + 计数（api-contract §4.2）
//   /api/concepts/{slug}   -> 详情 6 段（api-contract §4.3）
//
// 统一信封见 api-contract.md §2：
//   成功 { ok: true,  data,    error: null }
//   失败 { ok: false, data: null, error: { code, message } }  // message 只说人话
// ==========================================================

const { listConcepts } = require('./lib/handlers/listConcepts');
const { getConcept } = require('./lib/handlers/getConcept');
const { ApiError, toErrorBody } = require('./lib/errors');

// 从 HTTP 触发事件里解析出 { kind, slug }。
// 触发路径可能是 /api 或 /，事件里的 path 可能带或不带 /api 前缀，两种都兼容。
function parseRoute(event) {
  const method = String(
    event.httpMethod || (event.requestContext && event.requestContext.httpMethod) || 'GET'
  ).toUpperCase();
  const rawPath = String(event.path || event.rawPath || '/');
  const segs = rawPath.toLowerCase().replace(/\/+$/, '').split('/').filter(Boolean);
  const base = segs[0] === 'api' ? segs.slice(1) : segs;

  if (method !== 'GET') return { kind: 'not_found', method, rawPath };
  if (base.length === 1 && base[0] === 'health') return { kind: 'health', method, rawPath };
  if (base.length === 1 && base[0] === 'concepts') return { kind: 'list', method, rawPath };
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
    if (route.kind === 'health') {
      payload = { ok: true, service: 'ai-concept-daily', time: new Date().toISOString() };
    } else if (route.kind === 'list') {
      payload = await listConcepts();
    } else if (route.kind === 'detail') {
      payload = await getConcept(route.slug);
    } else {
      throw new ApiError('NOT_FOUND', `path=${route.rawPath}`);
    }
    return respond(200, payload);
  } catch (err) {
    const { status, body } = toErrorBody(err);
    // 技术细节（detail / message）只进日志，不进响应体
    console.error(`[api] kind=${route.kind} code=${body.error.code} detail=${(err && (err.detail || err.message)) || ''}`);
    return respond(status, body);
  } finally {
    console.log(`[api] kind=${route.kind} duration=${Date.now() - startedAt}ms`);
  }
};
