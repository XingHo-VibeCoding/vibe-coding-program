-- ==========================================================================
-- seed.sql —— 每日一个 AI 概念详解网站 · 种子脚本（Day 16）
-- --------------------------------------------------------------------------
-- 数据来源：concepts.js 的 7 条真实内容（2026-09-16 ~ 09-22，Day 1~7），
--           逐字段迁移，未做任何改写。
--
-- 可重复执行：先按「子表 → 主表」顺序 DELETE 清空 5 张表，再 INSERT。
-- 跑多少遍结果都一样，不会报错、不会翻倍。
-- （Day 16 说明：没用 TRUNCATE 是因为 CloudBase 的工具通道把 TRUNCATE 归为 DDL，
--   会要求走迁移历史；DELETE 是纯数据操作，控制台 / 工具 / psql 里都能跑。
--   代价只是自增 id 会继续往后排，不影响任何业务——本脚本的外键全部按 slug 反查，
--   不依赖具体 id 值。）
-- 建表归 db/schema.sql 管，本脚本只负责灌数据（Day 16 拍板：先删后插方式）。
--
-- 在 CloudBase PostgreSQL 控制台的 SQL 编辑器里整份粘贴执行即可。
-- ==========================================================================

BEGIN;

DELETE FROM concept_quiz_points;
DELETE FROM concept_sources;
DELETE FROM concept_quizzes;
DELETE FROM concept_use_cases;
DELETE FROM concepts;

-- --------------------------------------------------------------------------
-- 1/5 主表：concepts（7 行）
-- 外键关联不用写死 id，一律按 slug 反查，重复执行不受自增编号影响
-- --------------------------------------------------------------------------
INSERT INTO concepts (slug, serial_no, published_on, title_zh, title_en, definition, analogy, why_matters, tags) VALUES
('001-large-language-model', 1, '2026-09-16', '大语言模型', 'Large Language Model',
 '读了很多很多文字、学会了猜下一个字是什么的程序。',
 '像一个只练过接龙的选手。你给他半句话，他接出下半句。接得多了，他接出来的东西看起来就像真的听懂了你在说什么。其实他一直在做同一件事：猜下一个字。',
 '现在能跟你对话的 AI 工具，底座都是它。明白它其实一直在「猜下一个字」，你就能理解两件事：为什么它写得那么顺，以及为什么它有时会一本正经地说错。',
 ARRAY['基础','模型']),
('002-token', 2, '2026-09-17', '词元', 'Token',
 'AI 读文字时用的最小字块，也是算长度、算钱的最小单位。',
 '像把一句话拆成一块块积木。它不认整句话，只认积木。你交上去的话有多长、要花多少钱，都是按「几块积木」来算的。',
 '同一段话，中文和英文切出来的块数不一样，所以你偶尔会觉得「明明没写多少字，怎么这么贵」。知道有「块」这件事，很多看起来奇怪的现象就说通了。',
 ARRAY['基础','计费']),
('003-prompt', 3, '2026-09-18', '提示词', 'Prompt',
 '你发给 AI 的那段话，它据此决定接下来怎么答。',
 '像点菜。说一句「随便」，端上来什么全看厨师心情；把「不要辣、少放盐、葱多放一点」说清楚，端上来的就八九不离十。同一个厨房，差别全在你写的那几行字。',
 '它是最省钱、见效最快的一招。换模型要花钱花时间，改提示词只花几分钟，而且往往能解决大半问题。',
 ARRAY['实用','上手']),
('004-hallucination', 4, '2026-09-19', '幻觉', 'Hallucination',
 'AI 很顺地说出并不存在的事，还说得很像真的。',
 '像背课文背串了行。句子照样押韵、照样流畅，听的人不翻书根本听不出来。它不是故意骗你，它只是一直在猜下一个字，猜得越顺越不像错。',
 '它会编出不存在的书名、论文、法条和网址，语气比真话还肯定。知道它有这个毛病，你才不会把它说的每一句都当事实，尤其不敢拿它去查关键信息。',
 ARRAY['风险','必知']),
('005-attention', 5, '2026-09-20', '注意力机制', 'Attention Mechanism',
 'AI 读一句话时，会判断哪些字之间关系更紧，把它们连起来看。',
 '像在嘈杂的教室里听人说话。你不会平均分配耳朵，而是自动转向正在讲话的那个人，其他声音被压下去。它读句子时用的也是这一招：给每个字分一份「该看多重」。',
 '它是让 AI 能读懂长句、能接住上下文的那个关键零件。没有它，句子读到后面就忘了前面提的是谁。',
 ARRAY['原理','进阶']),
('006-embedding', 6, '2026-09-21', '向量化', 'Embedding',
 '把一段文字变成一串数字，意思越接近，这两串数字就越像。',
 '像给每道菜按「甜度」「辣度」「油腻度」各打一个分。打完分你就有了坐标：糖醋排骨和拔丝地瓜离得近，和麻辣火锅离得远。文字也能这样打分，只不过它打的分不止三项。',
 '「找相似」这件事从此可以算了。搜索不一定要字面相同，意思接近也能找出来，这是很多 AI 功能背后真正的发动机。',
 ARRAY['原理','语义']),
('007-rag', 7, '2026-09-22', '检索增强生成', 'Retrieval-Augmented Generation',
 '回答之前先去你的资料里翻一遍，把翻到的内容一起交上去，再让它开口。',
 '像开卷考试和闭卷考试的区别。闭卷全靠平时记忆，记岔了就答错；开卷可以先翻到相关那几页，再照着写。同一套题，开卷出错的概率低得多。',
 '它是目前减少「AI 一本正经说错」最常用的一招，也是让 AI 用上你自己资料的标准做法。你不需要重新训练它，把资料准备好就行。',
 ARRAY['实用','进阶']);

-- --------------------------------------------------------------------------
-- 2/5 concept_use_cases（14 行：每概念 2 条）
-- --------------------------------------------------------------------------
INSERT INTO concept_use_cases (concept_id, sort_order, content) VALUES
((SELECT id FROM concepts WHERE slug = '001-large-language-model'), 1, '看到「大模型」「AI 原生」这类说法，想弄清到底指什么时'),
((SELECT id FROM concepts WHERE slug = '001-large-language-model'), 2, '用某个 AI 工具觉得它时好时坏，想知道原因时'),
((SELECT id FROM concepts WHERE slug = '002-token'), 1, '看到账单按「token」计价，不清楚怎么算出来时'),
((SELECT id FROM concepts WHERE slug = '002-token'), 2, '发现 AI 数不准字数，或者复述原文时悄悄改了几个字时'),
((SELECT id FROM concepts WHERE slug = '003-prompt'), 1, 'AI 给的结果总是不对味，想改一改它答话的方向时'),
((SELECT id FROM concepts WHERE slug = '003-prompt'), 2, '要它处理一批格式相近的内容，需要把要求写清楚时'),
((SELECT id FROM concepts WHERE slug = '004-hallucination'), 1, '让 AI 帮你查资料、找引用、给链接时'),
((SELECT id FROM concepts WHERE slug = '004-hallucination'), 2, '准备把 AI 的回答直接写进东西里之前'),
((SELECT id FROM concepts WHERE slug = '005-attention'), 1, '想弄明白 AI 为什么能接住「他」「它」「上面那条」这类指代时'),
((SELECT id FROM concepts WHERE slug = '005-attention'), 2, '想了解大模型和早期翻译工具差在哪时'),
((SELECT id FROM concepts WHERE slug = '006-embedding'), 1, '想让「搜意思」而不是「搜关键词」也能搜到时'),
((SELECT id FROM concepts WHERE slug = '006-embedding'), 2, '想理解「语义搜索」「相似推荐」是怎么做出来的'),
((SELECT id FROM concepts WHERE slug = '007-rag'), 1, '想让 AI 回答公司内部文档、自己的笔记里的问题时'),
((SELECT id FROM concepts WHERE slug = '007-rag'), 2, '发现 AI 对某个具体事实总答错，想给它「开卷」时');

-- --------------------------------------------------------------------------
-- 3/5 concept_quizzes（7 行：每概念 1 道）
-- --------------------------------------------------------------------------
INSERT INTO concept_quizzes (concept_id, sort_order, question) VALUES
((SELECT id FROM concepts WHERE slug = '001-large-language-model'), 1, '如果不能用「大语言模型」这四个字，你怎么向家里人解释它？'),
((SELECT id FROM concepts WHERE slug = '002-token'), 1, '为什么同一个意思，用中文问和用英文问，AI 花的钱可能不一样？'),
((SELECT id FROM concepts WHERE slug = '003-prompt'), 1, '同一件事，为什么换一种说法问 AI，结果会差很远？'),
((SELECT id FROM concepts WHERE slug = '004-hallucination'), 1, '如果不能用「幻觉」这个词，你怎么解释 AI 为什么会编造不存在的东西？'),
((SELECT id FROM concepts WHERE slug = '005-attention'), 1, '一句话里出现了「它」，AI 是怎么知道「它」指的是哪个东西的？'),
((SELECT id FROM concepts WHERE slug = '006-embedding'), 1, '如果两句话一个字都不一样，AI 凭什么判断它们意思相近？'),
((SELECT id FROM concepts WHERE slug = '007-rag'), 1, '为什么给 AI 一堆资料，它就比平时更少说错？');

-- --------------------------------------------------------------------------
-- 4/5 concept_quiz_points（25 行：每道提问 3~4 条，按提问 sort_order=1 挂靠）
-- --------------------------------------------------------------------------
INSERT INTO concept_quiz_points (quiz_id, sort_order, point) VALUES
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '001-large-language-model' AND q.sort_order = 1), 1, '说出它是在「猜下一个字」'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '001-large-language-model' AND q.sort_order = 1), 2, '说出它是靠读过大量文字学会的'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '001-large-language-model' AND q.sort_order = 1), 3, '举一个日常例子，比如接着往下写、自动补全'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '001-large-language-model' AND q.sort_order = 1), 4, '不把它说成「真的理解了」，而是说「看起来很懂」'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '002-token' AND q.sort_order = 1), 1, '说出 AI 是按「块」来算长度和费用的'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '002-token' AND q.sort_order = 1), 2, '说出中英文切出来的块数不同'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '002-token' AND q.sort_order = 1), 3, '说明这不是因为哪种语言更好，只是切法不同'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '002-token' AND q.sort_order = 1), 4, '能举一个按单位计价的日常例子，比如打车按公里'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '003-prompt' AND q.sort_order = 1), 1, '说出 AI 是照着你的输入往下接的'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '003-prompt' AND q.sort_order = 1), 2, '说出你给的信息越具体，它能猜中的范围就越小'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '003-prompt' AND q.sort_order = 1), 3, '举一个自己踩过的坑：问得笼统，答得也笼统'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '004-hallucination' AND q.sort_order = 1), 1, '说出它是在「猜下一个字」，不是在「查资料」'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '004-hallucination' AND q.sort_order = 1), 2, '说出它顺不顺口和真不真没关系'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '004-hallucination' AND q.sort_order = 1), 3, '说出关键信息必须自己去核对'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '004-hallucination' AND q.sort_order = 1), 4, '举一个它编过的东西，比如书名、网址、人名'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '005-attention' AND q.sort_order = 1), 1, '说出它会看整句，判断字与字的关联强弱'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '005-attention' AND q.sort_order = 1), 2, '说出它会给不同位置分配不同的分量'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '005-attention' AND q.sort_order = 1), 3, '用一个日常场景把这件事讲给别人听，比如在吵闹的教室里听人说话'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '006-embedding' AND q.sort_order = 1), 1, '说出文字会先变成一串数字'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '006-embedding' AND q.sort_order = 1), 2, '说出这串数字代表的是「意思」，不是「字面」'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '006-embedding' AND q.sort_order = 1), 3, '举一个日常的坐标例子，比如按口味给菜打分'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '007-rag' AND q.sort_order = 1), 1, '说出它回答前会先去找相关内容'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '007-rag' AND q.sort_order = 1), 2, '说出找到的内容会一起送进去当参考'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '007-rag' AND q.sort_order = 1), 3, '说出这不等于它「学会了」，只是这次拿到了参考'),
((SELECT q.id FROM concept_quizzes q JOIN concepts c ON c.id = q.concept_id WHERE c.slug = '007-rag' AND q.sort_order = 1), 4, '举一个开卷考试的类比');

-- --------------------------------------------------------------------------
-- 5/5 concept_sources（8 行：003-prompt 有 2 条，其余各 1 条）
-- 链接均于 2026-09-22 实测可达（arXiv 原始论文页 + 厂商官方文档）
-- --------------------------------------------------------------------------
INSERT INTO concept_sources (concept_id, sort_order, label, url) VALUES
((SELECT id FROM concepts WHERE slug = '001-large-language-model'), 1, 'A Survey of Large Language Models（arXiv 原始论文页）', 'https://arxiv.org/abs/2303.18223'),
((SELECT id FROM concepts WHERE slug = '002-token'), 1, 'Neural Machine Translation of Rare Words with Subword Units（子词切分的原始论文）', 'https://arxiv.org/abs/1508.07909'),
((SELECT id FROM concepts WHERE slug = '003-prompt'), 1, 'Anthropic 官方文档：提示词工程概览', 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview'),
((SELECT id FROM concepts WHERE slug = '003-prompt'), 2, 'Language Models are Few-Shot Learners（arXiv 原始论文页）', 'https://arxiv.org/abs/2005.14165'),
((SELECT id FROM concepts WHERE slug = '004-hallucination'), 1, 'Survey of Hallucination in Natural Language Generation（arXiv 综述原始页）', 'https://arxiv.org/abs/2202.03629'),
((SELECT id FROM concepts WHERE slug = '005-attention'), 1, 'Attention Is All You Need（arXiv 原始论文页）', 'https://arxiv.org/abs/1706.03762'),
((SELECT id FROM concepts WHERE slug = '006-embedding'), 1, 'Efficient Estimation of Word Representations in Vector Space（arXiv 原始论文页）', 'https://arxiv.org/abs/1301.3781'),
((SELECT id FROM concepts WHERE slug = '007-rag'), 1, 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks（arXiv 原始论文页）', 'https://arxiv.org/abs/2005.11401');

COMMIT;
