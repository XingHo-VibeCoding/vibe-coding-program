// ==========================================================
// POST /api/favorites —— 收藏一个概念（api-contract.md §4.4，Day 18）
//
// 本项目第一个写接口。流程分四步：
//   1. 校验请求体：slug 必填 / 必须字符串 / 不超过 64 字；note 可选 / 字符串 / 不超过 200 字
//      （任一不合格直接拒，message 全是中文人话 —— 清单「缺必填字段被拒且提示是中文」）
//   2. 用 slug 在 concepts 表查内部 id（查不到 → CONCEPT_NOT_FOUND 404）
//   3. 插入 favorites。concept_id 上有 UNIQUE 约束，重复插入会撞 23505，
//      捕获后转成 DUPLICATE_FAVORITE 409 —— 清单「重复提交被拒」，且不会写入第二行
//   4. 返回 { ok:true, data:{ id, slug, note, createdAt }, error:null }
//
// 为什么响应回 slug 不回 concept_id：内部主键不外泄，前端只认 slug。
// ==========================================================

const { get, insert, RestError } = require('../db');
const { ApiError } = require('../errors');

const MAX_SLUG_LEN = 64;
const MAX_NOTE_LEN = 200;

// slug：必填 + 必须字符串 + 去空白转小写 + 长度上限
function normalizeSlug(raw) {
  if (raw === undefined || raw === null) {
    throw new ApiError('MISSING_FIELD', 'body 缺 slug');
  }
  if (typeof raw !== 'string') {
    throw new ApiError('INVALID_FIELD', `slug 类型为 ${Array.isArray(raw) ? 'array' : typeof raw}`);
  }
  const slug = raw.trim().toLowerCase();
  if (slug === '') throw new ApiError('MISSING_FIELD', 'slug 为空白');
  if (slug.length > MAX_SLUG_LEN) throw new ApiError('FIELD_TOO_LONG', `slug 长度 ${slug.length}`);
  return slug;
}

// note：可选；给了就必须是字符串；纯空白视同没填；超长拒
function normalizeNote(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== 'string') {
    throw new ApiError('INVALID_FIELD', `note 类型为 ${Array.isArray(raw) ? 'array' : typeof raw}`);
  }
  const note = raw.trim();
  if (note === '') return null;
  if (note.length > MAX_NOTE_LEN) throw new ApiError('FIELD_TOO_LONG', `note 长度 ${note.length}`);
  return note;
}

async function createFavorite(body) {
  // 请求体本身必须是「对象」：数组 / 字符串 / 数字都不接受
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('INVALID_FIELD', `body 类型为 ${Array.isArray(body) ? 'array' : typeof body}`);
  }

  const slug = normalizeSlug(body.slug);
  const note = normalizeNote(body.note);

  // slug → 内部 id（顺带确认这个概念真的存在，避免收藏到不存在的概念）
  const rows = await get('concepts', `select=id,slug&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  const concept = Array.isArray(rows) && rows.length ? rows[0] : null;
  if (!concept) throw new ApiError('CONCEPT_NOT_FOUND', `slug=${slug}`);

  let created;
  try {
    created = await insert('favorites', { concept_id: concept.id, note });
  } catch (err) {
    // 唯一约束冲突 = 这个概念已经收藏过了（属业务拒绝，不是服务器故障）
    if (err instanceof RestError && err.code === 'PGW_CONFLICT') {
      throw new ApiError('DUPLICATE_FAVORITE', `concept_id=${concept.id}`);
    }
    throw err;
  }

  return {
    ok: true,
    data: {
      id: created.id,
      slug: concept.slug,
      note: created.note === undefined ? note : created.note,
      // 统一成 UTC 的 ISO 8601：PostgREST 默认回 "+08:00" 偏移 + 5 位小数秒，
      // 与契约 §4.4 示例（…Z）形状不一致，故显式转一次。
      createdAt: created.created_at ? new Date(created.created_at).toISOString() : null,
    },
    error: null,
  };
}

module.exports = { createFavorite };
