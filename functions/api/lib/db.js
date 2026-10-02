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

module.exports = { get, RestError };
