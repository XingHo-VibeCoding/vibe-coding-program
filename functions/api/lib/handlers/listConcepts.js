// ==========================================================
// GET /api/concepts —— 首页列表 + 顶部计数（api-contract.md §4.2）
//
// 分层（Day 19 重构）：
//   本文件只留**业务编排** —— 组装 items、算 completeCount / totalCount / latestDate、拼信封。
//   表级查询与字段映射搬到 lib/repositories/conceptsRepo.js。
//   行为与重构前逐字等价（由 .workbuddy 下打桩测试保证）。
//
// 要点：items 不返回正文（类比/为什么重要/提问/要点/来源），只带卡片 4 字段 + isComplete
// ==========================================================

const { findConceptSummaries, findCompletenessMap } = require('../repositories/conceptsRepo');

async function listConcepts() {
  const [summaries, completeMap] = await Promise.all([
    findConceptSummaries(),
    findCompletenessMap(),
  ]);

  let latestDate = null;
  const items = summaries.map((c) => {
    const date = c.date;
    if (date && (!latestDate || date > latestDate)) latestDate = date;
    return {
      slug: c.slug,
      serialNo: c.serialNo,
      date: date,
      titleZh: c.titleZh,
      titleEn: c.titleEn,
      definition: c.definition,
      isComplete: completeMap[c.slug] === true,
    };
  });

  return {
    ok: true,
    data: {
      items: items,
      completeCount: items.filter((i) => i.isComplete).length,
      totalCount: items.length,
      latestDate: latestDate,
    },
    error: null,
  };
}

module.exports = { listConcepts };
