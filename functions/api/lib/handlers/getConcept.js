// ==========================================================
// GET /api/concepts/{slug} —— 详情页 6 段（api-contract.md §4.3）
//
// 分层（Day 19 重构）：
//   本文件只留**业务编排** —— 判空（404）、组装 6 段响应、拼信封。
//   5 张表的查询串与字段映射搬到 lib/repositories/conceptsRepo.js。
//
// 顺序：子表一律 order=sort_order（TECH_DESIGN §9.1 迁移期四坑之一），
//   该排序已下沉到 repo，handler 不再关心。
// ==========================================================

const {
  findConceptRowBySlug,
  findIsCompleteBySlug,
  findUseCases,
  findQuizzesWithPoints,
  findSources,
} = require('../repositories/conceptsRepo');
const { ApiError } = require('../errors');

async function getConcept(slug) {
  if (!slug) throw new ApiError('MISSING_SLUG', '路径未携带 slug');

  const row = await findConceptRowBySlug(slug);
  if (!row) throw new ApiError('CONCEPT_NOT_FOUND', `slug=${slug}`);

  const isComplete = await findIsCompleteBySlug(slug);

  const [useCases, quiz, sources] = await Promise.all([
    findUseCases(row.id),
    findQuizzesWithPoints(row.id),
    findSources(row.id),
  ]);

  return {
    ok: true,
    data: {
      slug: row.slug,
      serialNo: row.serialNo,
      date: row.date,
      titleZh: row.titleZh,
      titleEn: row.titleEn,
      definition: row.definition,
      analogy: row.analogy,
      whyMatters: row.whyMatters,
      useCases: useCases,
      quiz: quiz,
      sources: sources,
      isComplete: isComplete,
    },
    error: null,
  };
}

module.exports = { getConcept };
