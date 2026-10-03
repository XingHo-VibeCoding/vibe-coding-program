-- ==========================================================================
-- schema.sql —— 每日一个 AI 概念详解网站 · 建表脚本（Day 16 建，Day 18 加收藏表）
-- --------------------------------------------------------------------------
-- 依据：TECH_DESIGN.md §4.2（表设计）、§4.4（索引与排序）
--       PRD.md §6.1（12 个字段的校验规则 → 落库方式见 TECH_DESIGN §4.5）
--       api-contract.md §4.2/§4.3（接口形状；date→published_on、
--       points 嵌套数组→子表，均由云函数做映射）
--       api-contract.md §4.4（Day 18 收藏接口 → favorites 表）
--
-- 可重复执行：先 DROP 再 CREATE（IF EXISTS 保证首次执行也不报错）。
-- 在 CloudBase PostgreSQL 控制台的 SQL 编辑器里整份粘贴执行即可。
--
-- 表清单（6 张）：
--   concepts             概念主表（页头 + 定义 / 类比 / 为什么重要 三段）
--   concept_use_cases    「什么时候用得上」场景（每概念 1~2 条）
--   concept_quizzes      「费曼提问」题干（每概念 ≥1 道）
--   concept_quiz_points  自查要点（挂在提问下，PRD §8.2 要求与提问一一对应）
--   concept_sources      来源链接（每概念 ≥1 条）
--   favorites            收藏（Day 18 新增；本项目唯一写接口的落库表）
--
-- ⚠️ 没有 trends 表 —— 那是训练营「今日热搜」案例的表；本项目概念标识是 slug。
-- ==========================================================================

BEGIN;

-- 先删后建：注意顺序，先删子表（其实 CASCADE 已兜底，显式写出更直观）
DROP TABLE IF EXISTS favorites            CASCADE;
DROP TABLE IF EXISTS concept_quiz_points CASCADE;
DROP TABLE IF EXISTS concept_sources      CASCADE;
DROP TABLE IF EXISTS concept_quizzes      CASCADE;
DROP TABLE IF EXISTS concept_use_cases    CASCADE;
DROP TABLE IF EXISTS concepts             CASCADE;

-- --------------------------------------------------------------------------
-- 主表：concepts
-- --------------------------------------------------------------------------
CREATE TABLE concepts (
    id            bigserial   PRIMARY KEY,                    -- 内部主键，无业务含义，序列自动分配
    slug          text        NOT NULL,                       -- URL 标识，形如 '007-rag'
    serial_no     integer     NOT NULL,                       -- 三位编号（1~999），排序与显示用
    published_on  date,                                        -- 发布日期；允许 NULL：缺日期时列表排末尾（PRD §7 第 8 项）
    title_zh      text        NOT NULL,                       -- 中文名
    title_en      text        NOT NULL,                       -- 英文名（与中文名相同也必须填）
    definition    text        NOT NULL,                       -- 一句话定义，≤ 60 字（PRD §6.1 第 5 条）
    analogy       text        NOT NULL,                       -- 生活化类比
    why_matters   text        NOT NULL,                       -- 为什么重要
    tags          text[],                                     -- 标签：本期只记录不筛选（TECH_DESIGN §4.2），故用数组不拆表
    created_at    timestamptz NOT NULL DEFAULT now(),         -- 运维时间戳，页面不展示
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT concepts_slug_key           UNIQUE (slug),                      -- URL 等值查找走这个索引
    CONSTRAINT concepts_serial_no_key      UNIQUE (serial_no),                  -- 编号全站唯一（PRD §7 第 7 项）
    CONSTRAINT concepts_slug_lower_ck      CHECK (slug = lower(slug)),          -- 大小写归一（PRD §7 第 12 项）
    CONSTRAINT concepts_serial_no_range_ck CHECK (serial_no >= 1 AND serial_no <= 999),
    CONSTRAINT concepts_title_zh_ck        CHECK (title_zh <> ''),              -- 比 NOT NULL 更严：空字符串也挡住
    CONSTRAINT concepts_title_en_ck        CHECK (title_en <> ''),
    CONSTRAINT concepts_definition_len_ck  CHECK (char_length(definition) <= 60)
);

-- --------------------------------------------------------------------------
-- 子表 1：concept_use_cases（「什么时候用得上」）
-- --------------------------------------------------------------------------
CREATE TABLE concept_use_cases (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,  -- 删概念自动清子行
    sort_order  integer     NOT NULL,                                            -- 段内条目顺序，接口按它 ORDER BY
    content     text        NOT NULL
);

-- --------------------------------------------------------------------------
-- 子表 2：concept_quizzes（「费曼提问」题干）
-- --------------------------------------------------------------------------
CREATE TABLE concept_quizzes (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    question    text        NOT NULL,
    CONSTRAINT concept_quizzes_question_ck CHECK (question ~ '[?？]$')           -- 「疑问句」的机器近似判定
);

-- --------------------------------------------------------------------------
-- 子表 3：concept_quiz_points（自查要点，挂在提问下而不是概念下）
-- 为什么挂 quiz_id：PRD §8.2 第 6 条要求「自查要点与提问一一对应」，
-- 多道提问各带要点时这种父子结构不用改表（TECH_DESIGN §4.2）。
-- --------------------------------------------------------------------------
CREATE TABLE concept_quiz_points (
    id          bigserial   PRIMARY KEY,
    quiz_id     bigint      NOT NULL REFERENCES concept_quizzes(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    point       text        NOT NULL
);

-- --------------------------------------------------------------------------
-- 子表 4：concept_sources（来源链接）
-- 只校验格式不校验可达性：外部链接 404 属外部原因（PRD §7 第 9 项）
-- --------------------------------------------------------------------------
CREATE TABLE concept_sources (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    label       text        NOT NULL,                                            -- 链接文字（与 concepts.js 的字段名一致）
    url         text        NOT NULL,
    CONSTRAINT concept_sources_url_ck CHECK (url ~ '^https?://')
);

-- --------------------------------------------------------------------------
-- 收藏表：favorites（Day 18 新增，本项目第一个也是唯一的写接口落库表）
-- --------------------------------------------------------------------------
-- 为什么用 concept_id 外键而非直接存 slug 文本：
--   本项目其余 4 张子表一律用 concept_id 外键，保持同一风格；
--   外键还能保证收藏的一定是真实存在的概念（slug 拼错根本插不进去）。
-- 防重复怎么实现：UNIQUE(concept_id) —— 一个概念只能收藏一次，
--   重复提交时数据库直接拒，云函数把唯一冲突转成 DUPLICATE_FAVORITE(409)。
-- 备注长度为何在表上也挡一次：接口层已校验 ≤200 字，
--   表上加 CHECK 是"最后一道闸"，任何绕过接口的写入也挡得住（与既有表风格一致）。
-- 注意：收藏是"人"的行为，本期无登录态 → 不记录用户（PRD §1.4 不做登录）。
-- --------------------------------------------------------------------------
CREATE TABLE favorites (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    note        text,                                                              -- 可选备注
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT favorites_concept_id_key UNIQUE (concept_id),                       -- 防重复的唯一约束
    CONSTRAINT favorites_note_len_ck    CHECK (note IS NULL OR char_length(note) <= 200)
);

-- --------------------------------------------------------------------------
-- 索引（TECH_DESIGN §4.4）
-- --------------------------------------------------------------------------
-- 复合唯一索引：同一天不许重复录入同一个概念
-- （对应训练营案例「(来源平台, 标题, 日期) 唯一索引」的本项目等价物）
CREATE UNIQUE INDEX concepts_title_zh_published_on_key
    ON concepts (title_zh, published_on);

-- 首页列表排序：日期倒序 + 编号倒序
CREATE INDEX concepts_list_order_key
    ON concepts (published_on DESC, serial_no DESC);

COMMIT;
