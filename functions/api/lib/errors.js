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

  // ---- Day 18 新增：写接口（POST /api/favorites）专属（api-contract v0.4 §3）----
  MISSING_FIELD: { status: 400, message: '请指定要收藏的概念' },
  INVALID_FIELD: { status: 400, message: '收藏的内容格式不对' },
  FIELD_TOO_LONG: { status: 400, message: '备注最多 200 字' },
  DUPLICATE_FAVORITE: { status: 409, message: '这个概念你已经收藏过了' },

  // ---- Day 22 新增：改 / 删接口（PATCH、DELETE /api/favorites/{id}）专属（api-contract v0.6 §3）----
  FAVORITE_NOT_FOUND: { status: 404, message: '这条收藏已经不在了' },
  // id 不是正整数（清单「防呆检测」要求的另一种情况）
  INVALID_ID: { status: 400, message: '收藏编号不对，请刷新页面重试' },
  // 场景化的必填 / 类型校验码（Day 22）：
  // 原 MISSING_FIELD=「请指定要收藏的概念」、INVALID_FIELD=「收藏的内容格式不对」
  // 是写死了 POST 场景的人话。PATCH 里复用会让用户看到驴唇不对马嘴的提示
  //（改备注却提示"要收藏的概念"）。故拆成 create_* / patch_* 两组。
  MISSING_NOTE: { status: 400, message: '请填写要改的备注内容' },
  PATCH_INVALID_FIELD: { status: 400, message: '备注格式不对，只能是文字' },
  PATCH_FIELD_NOT_ALLOWED: { status: 400, message: '只能改备注，其他内容不能改' },
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
