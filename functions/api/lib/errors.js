// ==========================================================
// lib/errors.js —— 错误码 → {HTTP 状态, 用户可见人话} 的唯一映射处
// 口径：api-contract.md §3；技术细节只进日志，绝不写进响应体
// ==========================================================

const TABLE = {
  MISSING_SLUG: { status: 400, message: '没有指定要看哪个概念' },
  CONCEPT_NOT_FOUND: { status: 404, message: '这个概念我还没写' },
  DB_UNAVAILABLE: { status: 503, message: '内容暂时打不开，稍后再试' },
  INTERNAL_ERROR: { status: 500, message: '页面出了点问题，稍后再试' },
  // 未登记路径的兜底（api-contract v0.3 已登记此码；接口正常流程不会触发）
  NOT_FOUND: { status: 404, message: '接口不存在' },
};

// 业务错误：code 给前端分支用，detail 只进日志
class ApiError extends Error {
  constructor(code, detail) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.detail = detail || '';
  }
}

// 连接层错误 → DB_UNAVAILABLE；其余未知异常 → INTERNAL_ERROR
// PGW_DOWN：REST 网关不可达 / 凭证或授权问题 / 平台 5xx；PGW_BUG：我们构造的请求有误（4xx）
const DB_DOWN_CODES = [
  'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET',
  '28P01', '3D000', // 原 TCP 方案的数据库错误码，保留
  'PGW_DOWN',
];

function isDbConnError(err) {
  return DB_DOWN_CODES.includes(err && err.code);
}

// 把任意异常统一转成 { status, body }；body 永远是人话信封，不含堆栈/表名/SQL
function toErrorBody(err) {
  if (err instanceof ApiError) {
    const row = TABLE[err.code] || TABLE.INTERNAL_ERROR;
    return {
      status: row.status,
      body: { ok: false, data: null, error: { code: err.code, message: row.message } },
    };
  }
  if (isDbConnError(err)) {
    return {
      status: TABLE.DB_UNAVAILABLE.status,
      body: { ok: false, data: null, error: { code: 'DB_UNAVAILABLE', message: TABLE.DB_UNAVAILABLE.message } },
    };
  }
  return {
    status: TABLE.INTERNAL_ERROR.status,
    body: { ok: false, data: null, error: { code: 'INTERNAL_ERROR', message: TABLE.INTERNAL_ERROR.message } },
  };
}

module.exports = { ApiError, toErrorBody };
