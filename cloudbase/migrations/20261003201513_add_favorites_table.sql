CREATE TABLE IF NOT EXISTS favorites (
    id          bigserial   PRIMARY KEY,
    concept_id  bigint      NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT favorites_concept_id_key UNIQUE (concept_id),
    CONSTRAINT favorites_note_len_ck    CHECK (note IS NULL OR char_length(note) <= 200)
);
