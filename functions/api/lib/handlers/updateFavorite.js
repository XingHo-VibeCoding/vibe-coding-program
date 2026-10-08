// ==========================================================
// PATCH /api/favorites/{id} —— 修改一条收藏的备注（api-contract.md §4.6，Day 22）
//
// 分层沿用 Day 19 重构后的口径：本文件只做业务编排，
//   表级 PATCH 与字段映射在 lib/repositories/favoritesRepo.js。
//
// 流程：
//   1. 校验路径参数 id：必须是正整数（否则 INVALID_ID 400，中文人话）
//   2. 校验请求体：只认 note；note 必须出现（PATCH 语义是「改」不是「清空」，
//      想清空备注传空字符串）、必须是字符串、≤ 200 字
//   3. 调数据层改；**回填 0 行 = 这个 id 不存在** → FAVORITE_NOT_FOUND 404
//      （这是清单「防呆检测」的核心：不许对不存在的 id 报成功）
//   4. 成功回 200，data 含改后的 note —— 前端可直接替换本地显示，无需再 GET 一次
//
// 为什么只允许改 note（清单硬要求）：slug 指向哪个概念属于「身份」，
//   改了等于换了一条收藏；concept_id 是外键更不该从接口层动。
//   想换收藏对象 = 删掉再收藏。
// ==========================================================

const { updateFavoriteNote } = require('../repositories/favoritesRepo');
const { ApiError } = require('../errors');

const MAX_NOTE_LEN = 200;

// 路径参数 id：只接受正整数字符串。
// 负数 / 0 / 小数 / 字母 一律拒——这类 id 一定是前端或手抖拼错的，
// 与其让它去数据库查一次（查不到还要再报一次错），不如入口就挡掉。
function parseId(raw) {
  const text = String(raw === undefined || raw === null ? '' : raw).trim();
  if (!/^\d+$/.test(text)) throw new ApiError('INVALID_ID', `id=${raw}`);
  const id = Number(text);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('INVALID_ID', `id=${raw}`);
  return id;
}

async function updateFavorite(idRaw, body) {
  const id = parseId(idRaw);

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError('INVALID_FIELD', `body 类型为 ${Array.isArray(body) ? 'array' : typeof body}`);
  }
  // 只认 note：传了别的字段说明理解错了接口，直接拒而不是默默忽略
  const extraKeys = Object.keys(body).filter((k) => k !== 'note');
  if (extraKeys.length) {
    throw new ApiError('PATCH_FIELD_NOT_ALLOWED', `出现不允许修改的字段: ${extraKeys.join(',')}`);
  }
  if (!Object.prototype.hasOwnProperty.call(body, 'note')) {
    throw new ApiError('MISSING_NOTE', 'body 缺 note');
  }
  if (typeof body.note !== 'string') {
    throw new ApiError('PATCH_INVALID_FIELD', `note 类型为 ${Array.isArray(body.note) ? 'array' : typeof body.note}`);
  }
  // 与 POST 同口径：去首尾空白；空串 = 明确清空备注（存成 null，与 GET 回 null 对齐）
  const note = body.note.trim() === '' ? null : body.note.trim();
  if (note !== null && note.length > MAX_NOTE_LEN) {
    throw new ApiError('FIELD_TOO_LONG', `note 长度 ${note.length}`);
  }

  const result = await updateFavoriteNote(id, note);
  // 回填 0 行：这个 id 在库里不存在 —— 回 404，绝不能回「修改成功」
  if (!result.hit) throw new ApiError('FAVORITE_NOT_FOUND', `id=${id}`);

  return {
    ok: true,
    data: result.row,
    error: null,
  };
}

module.exports = { updateFavorite, parseId };