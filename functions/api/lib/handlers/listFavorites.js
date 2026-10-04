// ==========================================================
// GET /api/favorites —— 收藏列表（api-contract.md §4.5，Day 19）
//
// 作用：把 Day 18 写进去的收藏读回来，让「写入 → 读回」闭环成立。
// 也是将来「收藏页」的数据源（前端接线仍未做，见 api-contract §6.4）。
//
// 三件事：
//   1. 一次查全：favorites 关联 concepts 取 slug（服务端关联，前端不用发两次请求）
//   2. 排序由服务端做：createdAt 倒序 —— 刚写完的那条一定在最前面，方便肉眼核对
//   3. 形状对齐契约：只回 slug 不回 concept_id；createdAt 统一成 UTC 的 ISO 8601
//
// 不做：分页 / 筛选 / 排序参数（PRD §1.4 明确不做；收藏量级很小，一次查全够了）
// ==========================================================

const { get } = require('../db');

// PostgREST 的「内嵌关联」写法：favorites.concept_id → concepts.id 是一对一，
// 所以 concepts(...) 返回的是**对象**（不是数组）；FK 为空时是 null。
// 显式写 order：先按收藏时间倒序，时间相同再按 id 倒序，保证顺序稳定可复现。
const QUERY = 'select=id,note,created_at,concepts(slug)&order=created_at.desc,id.desc';

async function listFavorites() {
  const rows = await get('favorites', QUERY);
  const list = Array.isArray(rows) ? rows : [];

  const items = list.map((row) => {
    const concept = row.concepts || null;
    return {
      id: row.id,
      // 理论上不会为 null（concept_id 是 NOT NULL + FK）；真出现也只回 null，不编造 slug
      slug: concept && concept.slug ? concept.slug : null,
      // 没填备注 → null（契约 §4.5 要点 3：前端只判 null 一种情况）
      note: row.note === undefined ? null : row.note,
      // 与 §4.4 同一处理：PostgREST 回的是 "+08:00 + 5 位小数秒"，统一成 …Z
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    };
  });

  return {
    ok: true,
    data: {
      items,
      // 本期无分页，返回条数即收藏总数（契约 §4.5）
      count: items.length,
    },
    error: null,
  };
}

module.exports = { listFavorites };
