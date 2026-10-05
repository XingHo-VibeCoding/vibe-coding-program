// ==========================================================
// repositories/favoritesRepo.js —— favorites 表的「数据访问层」
//
// 与 conceptsRepo 同层：只管表结构（查哪张表 / 哪几列 / 怎么排序 / 字段映射）。
// 业务判断（重复收藏该回什么码、缺字段该回什么码）在 handler。
//
// 唯一一处「替 handler 提前判断」的例外：
//   PostgreSQL 唯一约束冲突（23505）是**数据库层**的事实，业务层不该懂 PG 错误码，
//   所以在这里翻译成明确的 DuplicateFavoriteError 再抛给上层。
// ==========================================================

const { get, insert, RestError } = require('../db');

// 数据层信号：同一概念被重复收藏（唯一约束冲突）
class DuplicateFavoriteError extends Error {
  constructor(detail) {
    super('duplicate favorite');
    this.name = 'DuplicateFavoriteError';
    this.detail = detail || '';
  }
}

// 收藏列表：favorites 关联 concepts 取 slug（服务端内嵌关联，前端不用发两次请求）
// 排序交给服务端：createdAt 倒序 —— 刚写完的那条一定在最前面，方便肉眼核对
// 显式写 id.desc 兜底，保证同一时间戳下顺序稳定可复现
const LIST_QUERY = 'select=id,note,created_at,concepts(slug)&order=created_at.desc,id.desc';

async function findFavoriteItems() {
  const rows = await get('favorites', LIST_QUERY);
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row) => {
    const concept = row.concepts || null;
    return {
      id: row.id,
      // 理论上不会为 null（concept_id 是 NOT NULL + FK）；真出现也只回 null，不编造 slug
      slug: concept && concept.slug ? concept.slug : null,
      // 没填备注 → null（契约 §4.5 要点 3：前端只判 null 一种情况）
      note: row.note === undefined ? null : row.note,
      // PostgREST 原样回的是「+08:00 偏移 + 5 位小数秒」，统一成 UTC 的 …Z
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
  });
}

// 插入一条收藏，返回映射后的新行 { id, note, createdAt }
// 重复收藏（唯一约束冲突）→ 抛 DuplicateFavoriteError，由 handler 转成业务码
async function insertFavorite({ conceptId, note }) {
  let created;
  try {
    created = await insert('favorites', { concept_id: conceptId, note });
  } catch (err) {
    if (err instanceof RestError && err.code === 'PGW_CONFLICT') {
      throw new DuplicateFavoriteError(`concept_id=${conceptId}`);
    }
    throw err;
  }
  return {
    id: created.id,
    note: created.note,
    createdAt: created.created_at ? new Date(created.created_at).toISOString() : null,
  };
}

module.exports = { findFavoriteItems, insertFavorite, DuplicateFavoriteError };
