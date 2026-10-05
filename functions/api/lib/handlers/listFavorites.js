// ==========================================================
// GET /api/favorites —— 收藏列表（api-contract.md §4.5，Day 19）
//
// 作用：把 Day 18 写进去的收藏读回来，让「写入 → 读回」闭环成立。
// 也是将来「收藏页」的数据源（前端接线仍未做，见 api-contract §6.4）。
//
// 分层（Day 19 重构）：本文件只留业务编排（拼信封、算 count）。
//   关联查询、排序、时间归一都搬到 lib/repositories/favoritesRepo.js。
//
// 不做：分页 / 筛选 / 排序参数（PRD §1.4 明确不做；收藏量级很小，一次查全够了）
// ==========================================================

const { findFavoriteItems } = require('../repositories/favoritesRepo');

async function listFavorites() {
  const items = await findFavoriteItems();
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
