// ==========================================================
// DELETE /api/favorites/{id} —— 删除一条收藏（api-contract.md §4.7，Day 22）
//
// 分层同 updateFavorite：本文件只做业务编排。
//
// 流程：
//   1. 校验路径参数 id 为正整数（否则 INVALID_ID 400）
//   2. 调数据层删；**回填 0 行 = 这个 id 不存在** → FAVORITE_NOT_FOUND 404
//      清单「防呆检测」明确点名：删一个不存在的数据还报「成功」= 防呆缺失，必须修。
//      所以这里只认数据层回填的行数，不做任何"假装成功"的兜底。
//   3. 成功回 200，data 回被删掉那一条（id/slug/note/createdAt）——
//      前端可以直接把这一行从列表里去掉，不用再 GET 一次对账。
//
// 为什么不带请求体：删除没有参数可传，带了也是忽略，反而误导。
// ==========================================================

const { deleteFavoriteById } = require('../repositories/favoritesRepo');
const { ApiError } = require('../errors');
const { parseId } = require('./updateFavorite');

// parseId 住在 updateFavorite 里（两个接口的 id 规则完全一致，不重复第二份实现），
// 这里单独再包一层：让 DELETE 的入参在读代码时一眼可见是"只有路径参数"。
function parseOneId(idRaw) {
  return parseId(idRaw);
}

async function deleteFavorite(idRaw) {
  const id = parseOneId(idRaw);

  const result = await deleteFavoriteById(id);
  if (!result.hit) throw new ApiError('FAVORITE_NOT_FOUND', `id=${id}`);

  return {
    ok: true,
    data: result.row,
    error: null,
  };
}

module.exports = { deleteFavorite };