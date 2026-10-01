DROP TABLE IF EXISTS concept_quiz_points CASCADE;
DROP TABLE IF EXISTS concept_sources CASCADE;
DROP TABLE IF EXISTS concept_quizzes CASCADE;
DROP TABLE IF EXISTS concept_use_cases CASCADE;
DROP TABLE IF EXISTS concepts CASCADE;

CREATE TABLE concepts (
    id            bigserial   PRIMARY KEY,
    slug          text        NOT NULL,
    serial_no     integer     NOT NULL,
    published_on  date,
    title_zh      text        NOT NULL,
    title_en      text        NOT NULL,
    definition    text        NOT NULL,
    analogy       text        NOT NULL,
    why_matters   text        NOT NULL,
    tags          text[],
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT concepts_slug_key           UNIQUE (slug),
    CONSTRAINT concepts_serial_no_key      UNIQUE (serial_no),
    CONSTRAINT concepts_slug_lower_ck      CHECK (slug = lower(slug)),
    CONSTRAINT concepts_serial_no_range_ck CHECK (serial_no >= 1 AND serial_no <= 999),
    CONSTRAINT concepts_title_zh_ck        CHECK (title_zh <> ''),
    CONSTRAINT concepts_title_en_ck        CHECK (title_en <> ''),
    CONSTRAINT concepts_definition_len_ck  CHECK (char_length(definition) <= 60)
);

CREATE TABLE concept_use_cases (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    content     text        NOT NULL
);

CREATE TABLE concept_quizzes (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    question    text        NOT NULL,
    CONSTRAINT concept_quizzes_question_ck CHECK (question ~ '[?？]$')
);

CREATE TABLE concept_quiz_points (
    id          bigserial   PRIMARY KEY,
    quiz_id     bigint      NOT NULL REFERENCES concept_quizzes(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    point       text        NOT NULL
);

CREATE TABLE concept_sources (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    sort_order  integer     NOT NULL,
    label       text        NOT NULL,
    url         text        NOT NULL,
    CONSTRAINT concept_sources_url_ck CHECK (url ~ '^https?://')
);

CREATE UNIQUE INDEX concepts_title_zh_published_on_key ON concepts (title_zh, published_on);
CREATE INDEX concepts_list_order_key ON concepts (published_on DESC, serial_no DESC);
