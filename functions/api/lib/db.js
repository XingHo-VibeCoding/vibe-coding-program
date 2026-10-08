// ==========================================================
// lib/db.js —— CloudBase PostgreSQL REST 客户端（PostgREST 协议）
//
// 口径变更（2026-10-02，平台限制倒逼）：
//   免费档共享集群不提供 TCP 直连（无内网地址、外网地址能力未开放），
//   云函数改走官方 REST API：
//     https://<envId>.api.tcloudbasegateway.com/v1/rdb/rest/<表或视图>
//   文档：docs.cloudbase.net/database/postgresql/http/query（仅支持 public schema）
//
// 安全：凭证只读环境变量 CLOUDBASE_API_KEY（service_role）；
//   绝不写死代码、绝不进前端、绝不进响应体。
// 注入防护：查询全部走 PostgREST 参数（服务端按 $1 占位符语义参数化），
//   字符串值经 encodeURIComponent 编码，等价于原 SQL 参数化方案。
// ==========================================================

const ENV_ID = process.env.TCB_ENV_ID || 'ai-concept-daily-d2ex3o18b05e6dd';
const BASE_URL = `https://${ENV_ID}.api.tcloudbasegateway.com/v1/rdb/rest`;
const TIMEOUT_MS = 8000;

// code 只用于函数内部分支：PGW_DOWN → 用户看到 DB_UNAVAILABLE；PGW_BUG → INTERNAL_ERROR
class RestError extends Error {
  constructor(code, message, detail) {
    super(message);
    this.name = 'RestError';
    this.code = code;
    this.detail = detail || ''; // 只进日志
  }
}

function getApiKey() {
  if (!process.env.CLOUDBASE_API_KEY) {
    throw new RestError('PGW_DOWN', 'CLOUDBASE_API_KEY 未配置');
  }
  return process.env.CLOUDBASE_API_KEY;
}

// 读取一张表或视图。query 为 PostgREST 查询串（不含 ?），
// 例：'slug=eq.007-rag&select=content,sort_order&order=sort_order,id'
async function get(table, query) {
  const key = getApiKey();
  const url = `${BASE_URL}/${table}${query ? '?' + query : ''}`;
  let res;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    // 网络层失败（DNS / 超时 / 拒连）→ 统一按"库暂时不可用"处理
    throw new RestError('PGW_DOWN', (e && e.message) || '网络请求失败', String((e && e.cause) || ''));
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const detail = `HTTP ${res.status} ${body.slice(0, 200)}`;
    // 401/403 = 凭证或授权问题；5xx = 平台侧故障；都归 DB_UNAVAILABLE（细节只进日志）
    const code = (res.status === 401 || res.status === 403 || res.status >= 500) ? 'PGW_DOWN' : 'PGW_BUG';
    throw new RestError(code, `PostgREST HTTP ${res.status}`, detail);
  }
  return res.json();
}

// 向一张表插入一行，返回插入后的行。
// PostgREST 写法：POST <base>/<table> + Prefer: return=representation（让服务端回吐新行）。
// 与 get() 共用凭证、超时与错误分类口径。
// 注意：写权限由 API Key（service_role）决定；若平台对 REST 网关限只读，这里会以 403 抛出
//      （会归到 PGW_DOWN → 用户看到 DB_UNAVAILABLE），届时需要换方案。
async function insert(table, row) {
  const key = getApiKey();
  const url = `${BASE_URL}/${table}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new RestError('PGW_DOWN', (e && e.message) || '网络请求失败', String((e && e.cause) || ''));
  }

  // 先取文本再解析：成功和失败都要读 body（失败体里带 PostgreSQL 错误码）
  const text = await res.text().catch(() => '');

  if (!res.ok) {
    const detail = `HTTP ${res.status} ${text.slice(0, 200)}`;
    let pgCode = '';
    try {
      pgCode = (JSON.parse(text) || {}).code || '';
    } catch (e) {
      /* 非 JSON 错误体，忽略 */
    }
    // 23505 = unique_violation：唯一约束冲突。收藏接口靠它识别「重复收藏」，
    // 由上层 handler 转成业务码 DUPLICATE_FAVORITE（而不是笼统的 500）。
    if (res.status === 409 || pgCode === '23505') {
      throw new RestError('PGW_CONFLICT', '唯一约束冲突', detail);
    }
    // 401/403（凭证/授权，含"写权限未开放"）/ 5xx → 按"库暂时不可用"处理
    const code = res.status === 401 || res.status === 403 || res.status >= 500 ? 'PGW_DOWN' : 'PGW_BUG';
    throw new RestError(code, `PostgREST HTTP ${res.status}`, detail);
  }

  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = null;
  }
  return Array.isArray(parsed) ? parsed[0] || {} : parsed || {};
}

// 向一张表更新一行（Day 22 新增，供 PATCH /api/favorites/{id} 用）。
// PostgREST 写法：PATCH <base>/<table>?<query>，body 为要改的列。
// 必须带 Prefer: return=representation —— 否则服务端不回行，我们无法区分
// 「改成功」和「这一行不存在」，防呆就废了（id 不存在必须回 404 而不是假成功）。
async function update(table, query, patch) {
  const key = getApiKey();
  const url = `${BASE_URL}/${table}${query ? '?' + query : ''}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(patch),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new RestError('PGW_DOWN', (e && e.message) || '网络请求失败', String((e && e.cause) || ''));
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const detail = `HTTP ${res.status} ${text.slice(0, 200)}`;
    const code = (res.status === 401 || res.status === 403 || res.status >= 500) ? 'PGW_DOWN' : 'PGW_BUG';
    throw new RestError(code, `PostgREST HTTP ${res.status}`, detail);
  }

  let parsed = [];
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = [];
  }
  return Array.isArray(parsed) ? parsed : [];
}

// 删除一行（Day 22 新增，供 DELETE /api/favorites/{id} 用）。
// PostgREST 写法：DELETE <base>/<table>?<query>。
// 同样带 Prefer: return=representation —— 靠回填的行数判断「真的删到了」还是「本来就没有」。
async function remove(table, query) {
  const key = getApiKey();
  const url = `${BASE_URL}/${table}${query ? '?' + query : ''}`;
  let res;
  try {
    res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: 'application/json',
        Prefer: 'return=representation',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new RestError('PGW_DOWN', (e && e.message) || '网络请求失败', String((e && e.cause) || ''));
  }

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    const detail = `HTTP ${res.status} ${text.slice(0, 200)}`;
    const code = (res.status === 401 || res.status === 403 || res.status >= 500) ? 'PGW_DOWN' : 'PGW_BUG';
    throw new RestError(code, `PostgREST HTTP ${res.status}`, detail);
  }

  let parsed = [];
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    parsed = [];
  }
  return Array.isArray(parsed) ? parsed : [];
}

module.exports = { get, insert, update, remove, RestError };
