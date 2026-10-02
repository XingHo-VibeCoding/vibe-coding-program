// ==========================================================
// GET /api/concepts —— 首页列表 + 顶部计数（api-contract.md §4.2）
//
// 读法（TECH_DESIGN §6.2 的 REST 等价实现）：
//   主表 + 完整度视图，经 PostgREST 两次查询后在函数内按 slug 连接
//   （视图与主表之间没有外键，PostgREST 无法 embed；7 条数据函数内连接零成本）
// 排序：published_on DESC NULLS LAST + serial_no DESC
//   （等效 TECH_DESIGN §4.4 的 ORDER BY COALESCE(...) DESC：日期缺失落末尾）
// 要点：items 不返回正文（类比/为什么重要/提问/要点/来源），只带卡片 4 字段 + isComplete
// ==========================================================

const { get } = require('../db');

function toDateString(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

async function listConcepts() {
  const [concepts, completeness] = await Promise.all([
    get('concepts', 'select=id,slug,serial_no,published_on,title_zh,title_en,definition&order=published_on.desc.nullslast,serial_no.desc'),
    get('v_concept_completeness', 'select=slug,is_complete'),
  ]);

  const completeMap = {};
  for (const v of completeness) completeMap[v.slug] = v.is_complete;

  let latestDate = null;
  const items = concepts.map((c) => {
    const date = toDateString(c.published_on);
    if (date && (!latestDate || date > latestDate)) latestDate = date;
    return {
      slug: c.slug,
      serialNo: c.serial_no,
      date: date,
      titleZh: c.title_zh,
      titleEn: c.title_en,
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
