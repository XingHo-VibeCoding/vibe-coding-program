-- ==========================================================
-- 完整度视图（TECH_DESIGN §4.3）—— isComplete 的唯一计算处
-- Day 17 建立；只新增视图，不改任何表结构
--
-- 判定口径（PRD §6.1 第 1～10、12 项）：
--   主表三段（定义 / 类比 / 为什么重要）非空
--   使用场景 ≥ 1 条；费曼提问 ≥ 1 道；来源 ≥ 1 条
--   每道提问的自查要点都 ≥ 3 条（取每题要点数的最小值）
--
-- 回滚（配对保存，CloudBase-发布清单 §5.3）：
--   DROP VIEW IF EXISTS public.v_published_concepts;
--   DROP VIEW IF EXISTS public.v_concept_completeness;
-- ==========================================================

CREATE OR REPLACE VIEW public.v_concept_completeness AS
SELECT
  c.id                                             AS concept_id,
  c.slug,
  (length(trim(c.definition)) > 0)                 AS has_definition,
  (length(trim(c.analogy)) > 0)                    AS has_analogy,
  (length(trim(c.why_matters)) > 0)                AS has_why_matters,
  COALESCE(uc.use_case_count, 0)                   AS use_case_count,
  COALESCE(q.quiz_count, 0)                        AS quiz_count,
  COALESCE(sc.source_count, 0)                     AS source_count,
  COALESCE(q.min_points_per_quiz, 0)               AS min_points_per_quiz,
  (
    length(trim(c.definition)) > 0
    AND length(trim(c.analogy)) > 0
    AND length(trim(c.why_matters)) > 0
    AND COALESCE(uc.use_case_count, 0) >= 1
    AND COALESCE(q.quiz_count, 0) >= 1
    AND COALESCE(sc.source_count, 0) >= 1
    AND COALESCE(q.min_points_per_quiz, 0) >= 3
  )                                                AS is_complete
FROM public.concepts c
LEFT JOIN (
  SELECT concept_id, count(*) AS use_case_count
  FROM public.concept_use_cases
  GROUP BY concept_id
) uc ON uc.concept_id = c.id
LEFT JOIN (
  SELECT concept_id, count(*) AS source_count
  FROM public.concept_sources
  GROUP BY concept_id
) sc ON sc.concept_id = c.id
LEFT JOIN (
  SELECT qu.concept_id,
         count(*)                        AS quiz_count,
         min(COALESCE(p.point_count, 0)) AS min_points_per_quiz
  FROM public.concept_quizzes qu
  LEFT JOIN (
    SELECT quiz_id, count(*) AS point_count
    FROM public.concept_quiz_points
    GROUP BY quiz_id
  ) p ON p.quiz_id = qu.id
  GROUP BY qu.concept_id
) q ON q.concept_id = c.id;

CREATE OR REPLACE VIEW public.v_published_concepts AS
SELECT count(*)::int AS complete_count
FROM public.v_concept_completeness
WHERE is_complete;
