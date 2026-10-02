// ==========================================================
// GET /api/concepts/{slug} —— 详情页 6 段（api-contract.md §4.3）
//
// 读法：主表按 slug 等值过滤 + 4 张子表按 concept_id / quiz_id 过滤，
//   全部走 PostgREST 参数（服务端参数化，等效原 SQL 的 $1 占位符）；
//   自查要点一对多挂在提问下（PRD §8.2 第 6 条），一次 in.() 取全后按 quiz_id 分组。
// 顺序：子表一律 order=sort_order（TECH_DESIGN §9.1 迁移期四坑之一）
// ==========================================================

const { get } = require('../db');
const { ApiError } = require('../errors');

function toDateString(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

async function getConcept(slug) {
  if (!slug) throw new ApiError('MISSING_SLUG', '路径未携带 slug');
  const eqSlug = encodeURIComponent(slug);

  const mainRows = await get('concepts', `select=*&slug=eq.${eqSlug}&limit=1`);
  if (!mainRows.length) throw new ApiError('CONCEPT_NOT_FOUND', `slug=${slug}`);
  const row = mainRows[0];

  const viewRows = await get('v_concept_completeness', `select=is_complete&slug=eq.${eqSlug}&limit=1`);

  const [useCases, quizzes, sources] = await Promise.all([
    get('concept_use_cases', `select=content,sort_order&concept_id=eq.${row.id}&order=sort_order,id`),
    get('concept_quizzes', `select=id,question,sort_order&concept_id=eq.${row.id}&order=sort_order,id`),
    get('concept_sources', `select=label,url,sort_order&concept_id=eq.${row.id}&order=sort_order,id`),
  ]);

  // 自查要点：一次 in.() 查全，按 quiz_id 分组（不逐题查询，少 3~4 次往返）
  let quiz = [];
  if (quizzes.length) {
    const ids = quizzes.map((q) => q.id).join(',');
    const points = await get('concept_quiz_points', `select=quiz_id,point,sort_order&quiz_id=in.(${ids})&order=quiz_id,sort_order,id`);
    const byQuiz = {};
    for (const p of points) {
      (byQuiz[p.quiz_id] = byQuiz[p.quiz_id] || []).push(p.point);
    }
    quiz = quizzes.map((q) => ({
      question: q.question,
      points: byQuiz[q.id] || [],
      sortOrder: q.sort_order,
    }));
  }

  return {
    ok: true,
    data: {
      slug: row.slug,
      serialNo: row.serial_no,
      date: toDateString(row.published_on),
      titleZh: row.title_zh,
      titleEn: row.title_en,
      definition: row.definition,
      analogy: row.analogy,
      whyMatters: row.why_matters,
      useCases: useCases.map((r) => ({ content: r.content, sortOrder: r.sort_order })),
      quiz: quiz,
      sources: sources.map((r) => ({ url: r.url, label: r.label, sortOrder: r.sort_order })),
      isComplete: viewRows.length ? viewRows[0].is_complete === true : false,
    },
    error: null,
  };
}

module.exports = { getConcept };
