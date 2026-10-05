// ==========================================================
// repositories/conceptsRepo.js —— concepts 相关表的「数据访问层」
//
// 这一层只干一件事：**知道表结构**。
//   - 查哪张表、要哪几列、怎么过滤、怎么排序（PostgREST 查询串集中在此）
//   - 数据库列名（snake_case）→ 接口字段名（camelCase）的映射
// 它**不做**业务判断：不知道什么叫 404、不抛 ApiError、不拼响应信封。
//
// 分层（Day 19 重构，见 TECH_DESIGN §9.6）：
//   handler（业务：校验 / 错误码 / 组装响应）
//     → repositories（表级查询 + 字段映射，本文件）
//       → db.js（REST 传输：发请求 / 归错误）
//
// 注意：查询串一律保持不变，重构只搬家、不改行为（等价性由回归测试保证）。
// ==========================================================

const { get } = require('../db');

// published_on 可能是 Date 对象或字符串，统一成 'YYYY-MM-DD'
function toDateString(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

// 首页列表：主表摘要（不含正文 6 段）
// 排序 published_on DESC NULLS LAST + serial_no DESC
async function findConceptSummaries() {
  const rows = await get(
    'concepts',
    'select=id,slug,serial_no,published_on,title_zh,title_en,definition&order=published_on.desc.nullslast,serial_no.desc'
  );
  return rows.map((c) => ({
    slug: c.slug,
    serialNo: c.serial_no,
    date: toDateString(c.published_on),
    titleZh: c.title_zh,
    titleEn: c.title_en,
    definition: c.definition,
  }));
}

// 完整度视图 → { slug: isComplete }
async function findCompletenessMap() {
  const rows = await get('v_concept_completeness', 'select=slug,is_complete');
  const map = {};
  for (const v of rows) map[v.slug] = v.is_complete === true;
  return map;
}

// 详情主表：按 slug 等值取一行；查不到回 null（是不是 404 由 handler 判断）
async function findConceptRowBySlug(slug) {
  const eqSlug = encodeURIComponent(slug);
  const rows = await get('concepts', `select=*&slug=eq.${eqSlug}&limit=1`);
  if (!rows.length) return null;
  const r = rows[0];
  return {
    id: r.id, // 内部主键，仅供 handler 去查子表，不进响应体
    slug: r.slug,
    serialNo: r.serial_no,
    date: toDateString(r.published_on),
    titleZh: r.title_zh,
    titleEn: r.title_en,
    definition: r.definition,
    analogy: r.analogy,
    whyMatters: r.why_matters,
  };
}

// 完整度视图：按 slug 取单条 is_complete，缺行按 false 处理
async function findIsCompleteBySlug(slug) {
  const rows = await get('v_concept_completeness', `select=is_complete&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  return rows.length ? rows[0].is_complete === true : false;
}

// 详情子表「什么时候用得上」
async function findUseCases(conceptId) {
  const rows = await get('concept_use_cases', `select=content,sort_order&concept_id=eq.${conceptId}&order=sort_order,id`);
  return rows.map((r) => ({ content: r.content, sortOrder: r.sort_order }));
}

// 详情子表「费曼提问」+ 其下自查要点（一对多）
// 要点一次 in.() 查全后按 quiz_id 分组，避免逐题往返
async function findQuizzesWithPoints(conceptId) {
  const quizzes = await get('concept_quizzes', `select=id,question,sort_order&concept_id=eq.${conceptId}&order=sort_order,id`);
  if (!quizzes.length) return [];

  const ids = quizzes.map((q) => q.id).join(',');
  const points = await get('concept_quiz_points', `select=quiz_id,point,sort_order&quiz_id=in.(${ids})&order=quiz_id,sort_order,id`);
  const byQuiz = {};
  for (const p of points) {
    (byQuiz[p.quiz_id] = byQuiz[p.quiz_id] || []).push(p.point);
  }
  return quizzes.map((q) => ({
    question: q.question,
    points: byQuiz[q.id] || [],
    sortOrder: q.sort_order,
  }));
}

// 详情子表「来源」
async function findSources(conceptId) {
  const rows = await get('concept_sources', `select=label,url,sort_order&concept_id=eq.${conceptId}&order=sort_order,id`);
  return rows.map((r) => ({ url: r.url, label: r.label, sortOrder: r.sort_order }));
}

// 写接口前置：slug → 内部引用（确认概念存在，避免收藏到不存在的概念）
async function findConceptRefBySlug(slug) {
  const rows = await get('concepts', `select=id,slug&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!Array.isArray(rows) || !rows.length) return null;
  return { id: rows[0].id, slug: rows[0].slug };
}

module.exports = {
  findConceptSummaries,
  findCompletenessMap,
  findConceptRowBySlug,
  findIsCompleteBySlug,
  findUseCases,
  findQuizzesWithPoints,
  findSources,
  findConceptRefBySlug,
};
