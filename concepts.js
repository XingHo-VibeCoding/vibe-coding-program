/* ==========================================================================
 * concepts.js —— 概念数据文件
 * --------------------------------------------------------------------------
 * 这是全站唯一的数据来源。页面（index.html / concept.html）只负责「显示」，
 * 页面文件里不写死任何一条概念的内容。
 *
 * 日常维护动作（PRD.md §6.3）：
 *   新增一条概念 = 在下面的 CONCEPTS 数组末尾追加 1 条记录 → 保存文件 → 刷新首页。
 *   全程不需要打开、也不需要修改任何页面文件。
 *
 * 字段中英对照（PRD.md §6.1 的 12 个字段）
 *   slug        编号（URL 用）       必填  全站唯一，小写，形如 "003-transformer"
 *   serialNo    编号（排序与显示）    必填  三位数字，1～999，全站唯一
 *   date        日期                必填  格式 "YYYY-MM-DD"
 *   titleZh     中文名              必填
 *   titleEn     英文名              必填（与中文名相同也必须填）
 *   definition  一句话定义           必填  ≤ 60 字，不得出现未解释的新术语
 *   analogy     生活化类比           必填  2～4 句，不得出现技术词
 *   whyMatters  为什么重要           必填  2～3 句
 *   useCases    什么时候用得上        必填  1～2 条场景（数组）
 *   quiz        费曼提问             必填  ≥1 道，每道含 question 与 points
 *     └ points  自查要点             必填  3～5 条短句，与提问一一对应（数组）
 *   sources     来源                必填  ≥1 条，每条含 label 与 url
 *   tags        标签                可选  本期只在记录里存在，页面不展示、不筛选
 *
 * 内容纪律（PRD.md §5.7）
 *   1. 每段不超过 4 句。
 *   2. 定义段不得出现未解释的新术语；必须出现时，就地用一句话解释。
 *   3. 类比段不得出现技术词 —— 出现即视为不合格。
 *   4. 不出现「显然」「众所周知」这类默认读者有基础的表述。
 *
 * 当前内容状态
 *   首批 7 条真实内容已写入，原来那条「演示记录」已删除。
 *   7 条按依赖顺序编号：越靠后的概念，用到的词越依赖前面已经讲过的。
 *   日期 2026-09-16 ～ 2026-09-22，对应 Day 1 ～ Day 7。
 *   首页按日期倒序显示，所以读者第一次打开看到的是最新一条；
 *   想按顺序读，请从列表最下面一条开始。
 *
 * sources 里的链接都已在 2026-09-22 实测可达（arXiv 原始论文页 + 厂商官方文档）。
 *
 * 取数方式（Day 20 起：走真实公网接口）
 *   页面调用 fetchConceptList(callback) —— 这个函数名与回调形状从 Day 8 一直没变，
 *   Day 20 只是把里面的 setTimeout 换成了真的 fetch 调用公网接口
 *   （GET /api/concepts，见 api-contract.md §4.2）。
 *   因为接口形状对上了，index.html 一行都不用改。
 *
 * 数据来源说明（重要，别再当成mock）：
 *   下面 CONCEPTS 数组里的 7 条内容**仍然保留**，它们是数据库的种子数据，
 *   也是接口挂掉时的对照参考。页面现在显示的内容来自数据库，不是这个数组。
 *   要改内容请改数据库（改了刷新就变），不要只改这个数组。
 * ========================================================================== */


/* ==========================================================================
 * 一、数据区：所有概念记录都写在这里
 * ========================================================================== */

var CONCEPTS = [

  /* ------------------------------------------------------------------
   * 01 · 大语言模型
   * ------------------------------------------------------------------ */
  {
    slug: '001-large-language-model',
    serialNo: 1,
    date: '2026-09-16',
    titleZh: '大语言模型',
    titleEn: 'Large Language Model',
    definition: '读了很多很多文字、学会了猜下一个字是什么的程序。',
    analogy: '像一个只练过接龙的选手。你给他半句话，他接出下半句。'
           + '接得多了，他接出来的东西看起来就像真的听懂了你在说什么。'
           + '其实他一直在做同一件事：猜下一个字。',
    whyMatters: '现在能跟你对话的 AI 工具，底座都是它。'
              + '明白它其实一直在「猜下一个字」，你就能理解两件事：'
              + '为什么它写得那么顺，以及为什么它有时会一本正经地说错。',
    useCases: [
      '看到「大模型」「AI 原生」这类说法，想弄清到底指什么时',
      '用某个 AI 工具觉得它时好时坏，想知道原因时',
    ],
    quiz: [
      {
        question: '如果不能用「大语言模型」这四个字，你怎么向家里人解释它？',
        points: [
          '说出它是在「猜下一个字」',
          '说出它是靠读过大量文字学会的',
          '举一个日常例子，比如接着往下写、自动补全',
          '不把它说成「真的理解了」，而是说「看起来很懂」',
        ],
      },
    ],
    sources: [
      { label: 'A Survey of Large Language Models（arXiv 原始论文页）', url: 'https://arxiv.org/abs/2303.18223' },
    ],
    tags: ['基础', '模型'],
  },

  /* ------------------------------------------------------------------
   * 02 · 词元
   * ------------------------------------------------------------------ */
  {
    slug: '002-token',
    serialNo: 2,
    date: '2026-09-17',
    titleZh: '词元',
    titleEn: 'Token',
    definition: 'AI 读文字时用的最小字块，也是算长度、算钱的最小单位。',
    analogy: '像把一句话拆成一块块积木。它不认整句话，只认积木。'
           + '你交上去的话有多长、要花多少钱，都是按「几块积木」来算的。',
    whyMatters: '同一段话，中文和英文切出来的块数不一样，'
              + '所以你偶尔会觉得「明明没写多少字，怎么这么贵」。'
              + '知道有「块」这件事，很多看起来奇怪的现象就说通了。',
    useCases: [
      '看到账单按「token」计价，不清楚怎么算出来时',
      '发现 AI 数不准字数，或者复述原文时悄悄改了几个字时',
    ],
    quiz: [
      {
        question: '为什么同一个意思，用中文问和用英文问，AI 花的钱可能不一样？',
        points: [
          '说出 AI 是按「块」来算长度和费用的',
          '说出中英文切出来的块数不同',
          '说明这不是因为哪种语言更好，只是切法不同',
          '能举一个按单位计价的日常例子，比如打车按公里',
        ],
      },
    ],
    sources: [
      { label: 'Neural Machine Translation of Rare Words with Subword Units（子词切分的原始论文）', url: 'https://arxiv.org/abs/1508.07909' },
    ],
    tags: ['基础', '计费'],
  },

  /* ------------------------------------------------------------------
   * 03 · 提示词
   * ------------------------------------------------------------------ */
  {
    slug: '003-prompt',
    serialNo: 3,
    date: '2026-09-18',
    titleZh: '提示词',
    titleEn: 'Prompt',
    definition: '你发给 AI 的那段话，它据此决定接下来怎么答。',
    analogy: '像点菜。说一句「随便」，端上来什么全看厨师心情；'
           + '把「不要辣、少放盐、葱多放一点」说清楚，端上来的就八九不离十。'
           + '同一个厨房，差别全在你写的那几行字。',
    whyMatters: '它是最省钱、见效最快的一招。'
              + '换模型要花钱花时间，改提示词只花几分钟，而且往往能解决大半问题。',
    useCases: [
      'AI 给的结果总是不对味，想改一改它答话的方向时',
      '要它处理一批格式相近的内容，需要把要求写清楚时',
    ],
    quiz: [
      {
        question: '同一件事，为什么换一种说法问 AI，结果会差很远？',
        points: [
          '说出 AI 是照着你的输入往下接的',
          '说出你给的信息越具体，它能猜中的范围就越小',
          '举一个自己踩过的坑：问得笼统，答得也笼统',
        ],
      },
    ],
    sources: [
      { label: 'Anthropic 官方文档：提示词工程概览', url: 'https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview' },
      { label: 'Language Models are Few-Shot Learners（arXiv 原始论文页）', url: 'https://arxiv.org/abs/2005.14165' },
    ],
    tags: ['实用', '上手'],
  },

  /* ------------------------------------------------------------------
   * 04 · 幻觉
   * ------------------------------------------------------------------ */
  {
    slug: '004-hallucination',
    serialNo: 4,
    date: '2026-09-19',
    titleZh: '幻觉',
    titleEn: 'Hallucination',
    definition: 'AI 很顺地说出并不存在的事，还说得很像真的。',
    analogy: '像背课文背串了行。句子照样押韵、照样流畅，'
           + '听的人不翻书根本听不出来。'
           + '它不是故意骗你，它只是一直在猜下一个字，猜得越顺越不像错。',
    whyMatters: '它会编出不存在的书名、论文、法条和网址，语气比真话还肯定。'
              + '知道它有这个毛病，你才不会把它说的每一句都当事实，'
              + '尤其不敢拿它去查关键信息。',
    useCases: [
      '让 AI 帮你查资料、找引用、给链接时',
      '准备把 AI 的回答直接写进东西里之前',
    ],
    quiz: [
      {
        question: '如果不能用「幻觉」这个词，你怎么解释 AI 为什么会编造不存在的东西？',
        points: [
          '说出它是在「猜下一个字」，不是在「查资料」',
          '说出它顺不顺口和真不真没关系',
          '说出关键信息必须自己去核对',
          '举一个它编过的东西，比如书名、网址、人名',
        ],
      },
    ],
    sources: [
      { label: 'Survey of Hallucination in Natural Language Generation（arXiv 综述原始页）', url: 'https://arxiv.org/abs/2202.03629' },
    ],
    tags: ['风险', '必知'],
  },

  /* ------------------------------------------------------------------
   * 05 · 注意力机制
   * ------------------------------------------------------------------ */
  {
    slug: '005-attention',
    serialNo: 5,
    date: '2026-09-20',
    titleZh: '注意力机制',
    titleEn: 'Attention Mechanism',
    definition: 'AI 读一句话时，会判断哪些字之间关系更紧，把它们连起来看。',
    analogy: '像在嘈杂的教室里听人说话。你不会平均分配耳朵，'
           + '而是自动转向正在讲话的那个人，其他声音被压下去。'
           + '它读句子时用的也是这一招：给每个字分一份「该看多重」。',
    whyMatters: '它是让 AI 能读懂长句、能接住上下文的那个关键零件。'
              + '没有它，句子读到后面就忘了前面提的是谁。',
    useCases: [
      '想弄明白 AI 为什么能接住「他」「它」「上面那条」这类指代时',
      '想了解大模型和早期翻译工具差在哪时',
    ],
    quiz: [
      {
        question: '一句话里出现了「它」，AI 是怎么知道「它」指的是哪个东西的？',
        points: [
          '说出它会看整句，判断字与字的关联强弱',
          '说出它会给不同位置分配不同的分量',
          '用一个日常场景把这件事讲给别人听，比如在吵闹的教室里听人说话',
        ],
      },
    ],
    sources: [
      { label: 'Attention Is All You Need（arXiv 原始论文页）', url: 'https://arxiv.org/abs/1706.03762' },
    ],
    tags: ['原理', '进阶'],
  },

  /* ------------------------------------------------------------------
   * 06 · 向量化
   * ------------------------------------------------------------------ */
  {
    slug: '006-embedding',
    serialNo: 6,
    date: '2026-09-21',
    titleZh: '向量化',
    titleEn: 'Embedding',
    definition: '把一段文字变成一串数字，意思越接近，这两串数字就越像。',
    analogy: '像给每道菜按「甜度」「辣度」「油腻度」各打一个分。'
           + '打完分你就有了坐标：糖醋排骨和拔丝地瓜离得近，和麻辣火锅离得远。'
           + '文字也能这样打分，只不过它打的分不止三项。',
    whyMatters: '「找相似」这件事从此可以算了。'
              + '搜索不一定要字面相同，意思接近也能找出来，'
              + '这是很多 AI 功能背后真正的发动机。',
    useCases: [
      '想让「搜意思」而不是「搜关键词」也能搜到时',
      '想理解「语义搜索」「相似推荐」是怎么做出来的',
    ],
    quiz: [
      {
        question: '如果两句话一个字都不一样，AI 凭什么判断它们意思相近？',
        points: [
          '说出文字会先变成一串数字',
          '说出这串数字代表的是「意思」，不是「字面」',
          '举一个日常的坐标例子，比如按口味给菜打分',
        ],
      },
    ],
    sources: [
      { label: 'Efficient Estimation of Word Representations in Vector Space（arXiv 原始论文页）', url: 'https://arxiv.org/abs/1301.3781' },
    ],
    tags: ['原理', '语义'],
  },

  /* ------------------------------------------------------------------
   * 07 · 检索增强生成
   * ------------------------------------------------------------------ */
  {
    slug: '007-rag',
    serialNo: 7,
    date: '2026-09-22',
    titleZh: '检索增强生成',
    titleEn: 'Retrieval-Augmented Generation',
    definition: '回答之前先去你的资料里翻一遍，把翻到的内容一起交上去，再让它开口。',
    analogy: '像开卷考试和闭卷考试的区别。闭卷全靠平时记忆，记岔了就答错；'
           + '开卷可以先翻到相关那几页，再照着写。'
           + '同一套题，开卷出错的概率低得多。',
    whyMatters: '它是目前减少「AI 一本正经说错」最常用的一招，'
              + '也是让 AI 用上你自己资料的标准做法。'
              + '你不需要重新训练它，把资料准备好就行。',
    useCases: [
      '想让 AI 回答公司内部文档、自己的笔记里的问题时',
      '发现 AI 对某个具体事实总答错，想给它「开卷」时',
    ],
    quiz: [
      {
        question: '为什么给 AI 一堆资料，它就比平时更少说错？',
        points: [
          '说出它回答前会先去找相关内容',
          '说出找到的内容会一起送进去当参考',
          '说出这不等于它「学会了」，只是这次拿到了参考',
          '举一个开卷考试的类比',
        ],
      },
    ],
    sources: [
      { label: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks（arXiv 原始论文页）', url: 'https://arxiv.org/abs/2005.11401' },
    ],
    tags: ['实用', '进阶'],
  },

];


/* ==========================================================================
 * 二、数据访问函数
 * --------------------------------------------------------------------------
 * 页面只通过下面这几个函数取数据，不许自己去翻 CONCEPTS 数组。
 * 这样将来（Day 23）换成从数据库读，只需要改这一处，页面文件一行都不用动。
 * 依据：TECH_DESIGN.md §5.1
 * ========================================================================== */

/**
 * 判断一条记录是否「写完了」。
 * 依据 PRD.md §6.1：第 1～10、12 项必填字段缺任意一项，该条视为未写完。
 * 未写完的记录在首页仍然可见，但不计入「已更新 N 个概念」。
 *
 * @param {object} c 一条概念记录
 * @returns {boolean} true = 写完了
 */
function isConceptComplete(c) {
  if (!c) return false;

  // 必填的文字类字段：不能为空字符串
  var textFields = [c.slug, c.date, c.titleZh, c.titleEn, c.definition, c.analogy, c.whyMatters];
  for (var i = 0; i < textFields.length; i++) {
    var v = textFields[i];
    if (v === null || v === undefined || String(v).trim() === '') return false;
  }

  // 必填的编号：必须是数字
  if (typeof c.serialNo !== 'number') return false;

  // 必填的数组字段：至少 1 条
  if (!Array.isArray(c.useCases) || c.useCases.length < 1) return false;
  if (!Array.isArray(c.sources) || c.sources.length < 1) return false;

  // 费曼提问：至少 1 道，且每道提问的自查要点至少 3 条
  if (!Array.isArray(c.quiz) || c.quiz.length < 1) return false;
  for (var j = 0; j < c.quiz.length; j++) {
    var q = c.quiz[j];
    if (!q || q.question === null || q.question === undefined || String(q.question).trim() === '') return false;
    if (!Array.isArray(q.points) || q.points.length < 3) return false;
  }

  return true;
}

/**
 * 取全部概念，按日期倒序（最新的在最前面）。
 * 日期缺失或空字符串的记录会自动落到列表末尾，且不影响其它记录排序。
 * 依据 PRD.md §5.2 / TECH_DESIGN.md §4.4
 *
 * @returns {Array} 排好序的概念数组（新数组，不会改动 CONCEPTS 本身）
 */
function getConceptList() {
  var list = CONCEPTS.slice();

  list.sort(function (a, b) {
    var da = a.date || '';
    var db = b.date || '';
    if (da !== db) return da > db ? -1 : 1; // 日期大的在前 = 最新的在前

    // 日期相同时，编号大的在前
    var sa = typeof a.serialNo === 'number' ? a.serialNo : 0;
    var sb = typeof b.serialNo === 'number' ? b.serialNo : 0;
    return sb - sa;
  });

  return list;
}

/**
 * 按 slug 取单条概念。
 * slug 会统一转成小写再比较，避免同一个概念出现两个页面。
 * 依据 PRD.md §7 第 12 项 / TECH_DESIGN.md §7.2 第 12 项
 *
 * @param {string} slug 地址栏里的 ?id= 值，例如 "003-transformer"
 * @returns {object|null} 找到就返回该条记录，找不到返回 null
 */
function getConceptBySlug(slug) {
  if (slug === null || slug === undefined || String(slug).trim() === '') return null;

  var key = String(slug).trim().toLowerCase();
  for (var i = 0; i < CONCEPTS.length; i++) {
    if (String(CONCEPTS[i].slug).toLowerCase() === key) return CONCEPTS[i];
  }
  return null;
}


/* ==========================================================================
 * 三、真实接口数据源（Day 20 接入，替换 Day 8 的 mock 版）
 * --------------------------------------------------------------------------
 * 这一层从 Day 8 的 setTimeout 假异步，换成了真正的网络请求。
 * 函数名与回调形状**故意保持不变**（fetchConceptList(onDone) 仍是
 * 「拿到排好序的数组就调 onDone」），所以 index.html 一行都不用改 ——
 * 这正是 Day 8 埋这层时预留的位置。
 *
 * 接口契约见 api-contract.md：
 *   GET  {API_BASE}/api/concepts  -> { ok, data: { items, completeCount,
 *                                       totalCount, latestDate }, error }
 *   GET  {API_BASE}/api/favorites -> { ok, data: { items, count }, error }
 *   POST {API_BASE}/api/favorites -> 201，同上
 *
 * 跨域（Day 20 实测结论，重要）：
 *   页面在 ai-concept-daily.app.workbuddy.host，接口在网关域名，两个域不同，
 *   浏览器会拦。已确认网关三条 API 路由的 EnableSafeDomain 都是 true，
 *   也就是说**网关会自动补CORS 响应头**——但前提是「安全域名白名单」
 *   里有你的页面域名。白名单格式是 host（不带协议），本地调试还要带端口。
 *   配好后不需要改后端代码，也不需要用 * 通配符。
 * ========================================================================== */

/* 接口根地址。生产环境就这一个值；本地调试同一个地址，不用改。 */
var API_BASE = 'https://ai-concept-daily-d2ex3o18b05e6dd-1498895639.ap-shanghai.app.tcloudbase.com';

/* 网络请求最长等多久（毫秒）。超时按失败处理，页面会显示错误态。 */
var API_TIMEOUT_MS = 12000;

/**
 * 把 fetch 包一层：统一超时 + 统一拆信封。
 * 页面只关心「拿到数据」或「拿到Error」，不关心 HTTP 状态码。
 *
 * @param  {string}   url    完整请求地址
 * @param  {object}   opts   fetch 的第二个参数（method / headers / body）
 * @param  {function} onDone 成功回调，参数是信封里的 data
 * @param  {function} onFail 失败回调，参数是一个 Error（消息已翻译成中文）
 */
function apiRequest(url, opts, onDone, onFail) {
  /* 浏览器没有 fetch 时（比如很老的浏览器）直接判失败，不静默卡住 */
  if (typeof fetch !== 'function') {
    onFail(new Error('当前浏览器不支持 fetch，无法读取接口数据。'));
    return;
  }

  var done = false;
  function finish(fn, arg) {
    if (done) return;   /* 超时和真实回包只认先到的那一个 */
    done = true;
    fn(arg);
  }

  var timer = setTimeout(function () {
    finish(onFail, new Error('接口请求超时（' + (API_TIMEOUT_MS / 1000) + ' 秒），请检查网络后刷新。'));
  }, API_TIMEOUT_MS);

  fetch(url, opts).then(function (res) {
    return res.text().then(function (text) {
      var body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch (e) {
        throw new Error('接口返回的不是合法 JSON（HTTP ' + res.status + '）。');
      }
      /* 统一信封：失败时 error.message 已经是中文人话，直接往上抛。
         把 code 挂到 Error 上，调用方可以按错误码分支处理
         （比如 409「已经收藏过了」要当成功，而不是当失败）。

         Day 23 审计补充：**网关层错误不走云函数**，信封形状不同 ——
         { code:"INVALID_PATH", message:"Invalid path...docs.cloudbase.net..." }
         是全英文的。原来这里会把那句英文原样抛出去，首页就会显示
         一串英文和文档链接。认出这种形状，换成中文再抛。 */
      if (!body || body.ok !== true) {
        var failErr;
        if (body && !body.ok && body.code && body.message && !body.error) {
          console.warn('[concepts] 网关层错误（非云函数返回）：', body);
          failErr = new Error('接口地址不存在，请检查访问的地址是否正确。');
          failErr.code = 'GW_' + body.code;
        } else {
          var code = (body && body.error && body.error.code) || ('HTTP_' + res.status);
          var msg = (body && body.error && body.error.message) || '接口调用失败（' + code + '）。';
          failErr = new Error(msg);
          failErr.code = code;
        }
        failErr.status = res.status;
        throw failErr;
      }
      finish(function () {
        clearTimeout(timer);
        onDone(body.data);
      });
    });
  }).catch(function (err) {
    clearTimeout(timer);
    /* fetch 本身的网络失败（断网、DNS、跨域被拦）都会落到这里。
       注意：如果 err 是上面带 code 抛出来的信封错误，原样透传，不要改写。 */
    if (err && err.code) { finish(onFail, err); return; }
    var m = (err && err.message) || '网络请求失败。';
    /* 跨域被拦时 err.message 通常是 'Failed to fetch'。
       Day 23 审计发现：原来这里会把排查话术（「确认白名单里是页面域名
       不带 https」）直接显示给终端用户 —— 那是给作者看的调试口诀，
       不是给使用者看的。这里改成中性文案，**原始信息只进 console**。 */
    if (/failed to fetch|networkerror|load failed/i.test(m)) {
      console.warn('[concepts] 请求未送达接口（可能是断网或跨域未放行）：', m);
      m = '网络连不上，请检查网络后刷新页面。';
    }
    var netErr = new Error(m);
    netErr.code = 'NETWORK_ERROR';   /* 与接口错误码区分开，便于排查 */
    finish(onFail, netErr);
  });
}

/**
 * 异步取全部概念 —— 现在走真实接口 GET /api/concepts。
 * 等待期间，调用方应该显示「加载中」。
 *
 * 接口返回的 items 已经按 published_on DESC + serial_no DESC 排好序，
 * 与本地 getConceptList() 的排序规则一致，所以这里直接用接口顺序。
 *
 * @param {function} onDone  取数完成后的回调，参数是排好序的概念数组
 * @param {function} [onFail] 取数失败的回调，参数是一个 Error（可选，兼容旧调用方）
 */
function fetchConceptList(onDone, onFail) {
  /* 没传 onFail 的旧调用方：不能给它一个假空数组 —— 那会让页面显示
     「还没有写入任何概念」，把「接口挂了」说成「没内容」，是误导。
     这里直接把错误抛到控制台，页面走错误态。 */
  var fail = onFail || function (err) {
    console.error('[concepts] 取数失败且调用方未提供 onFail：', err);
    throw err;
  };

  apiRequest(
    API_BASE + '/api/concepts',
    { method: 'GET', headers: { 'Accept': 'application/json' } },
    function (data) {
      var items = (data && Array.isArray(data.items)) ? data.items : [];
      onDone(items);
    },
    function (err) {
      console.error('[concepts] 读取概念列表失败：', err);
      fail(err);
    }
  );
}


/* ==========================================================================
 * 四、收藏服务（Day 20 接入真实写接口，替换 Day 11 的 mock 版）
 * --------------------------------------------------------------------------
 * Day 11 时这里只改内存状态；现在改成真的调POST /api/favorites，
 * 写入 CloudBase PostgreSQL。接口 201 之后，数据库里就真的多一行。
 *
 * 两条接口分工明确（Day 22 起两条都有了，契约见 api-contract §4.6 / §4.7）：
 *   收藏   POST   {API_BASE}/api/favorites         传slug          → 201
 *   取消   DELETE {API_BASE}/api/favorites/{id}    不带请求体      → 200 + 被删的那一行
 *
 * ⚠️ DELETE 要的是**收藏 id**，不是 slug。而 GET /api/concepts 不返回 favoriteId，
 *    所以取消功能的前提是「知道这条 slug 对应的 id」——由下面的 favIdsBySlug
 *    从 GET /api/favorites 建立。没建立到就不让取消，并给出能照做的提示，
 *    **绝不能拿 slug 去当 id 用**，那会误删别人那一行。
 *
 * 成功时调 onDone(是否已收藏)，页面据此更新按钮外观，形状与 Day 11 的 mock 版一致。
 * ========================================================================== */

/* 故障注入开关：保留 Day 11 的验收开关（?favfail=1），
   用来验收「失败提示」那条路径，不影响正常流程。 */
var FAVORITE_FORCE_FAIL = false;

/* slug -> 收藏 id 的对照表，Day 24 新增。
   DELETE /api/favorites/{id} 要的是 id（契约§4.7），而列表接口不返回 favoriteId，
   所以只能从 GET /api/favorites 的读回结果里建这张表。
   读不到就不建 —— 取消时查不到 id 就明确提示「先刷新页面」，不猜。 */
var favIdsBySlug = {};

/* 取某个 slug 的收藏 id；没有就返回 null。 */
function getFavoriteId(slug) {
  var id = favIdsBySlug[String(slug)];
  return (typeof id === 'number') ? id : null;
}

/**
 * 取消收藏 —— 走真实接口 DELETE /api/favorites/{id}（契约 §4.7）。
 *
 * ⚠️ 与 POST 的区别，踩过的坑记在这里：
 *   POST 是按 slug「幂等」的（重复收藏回 409，当成功处理）；
 *   DELETE 是按 id「破坏性」的 —— id 错了就删错那一行，而且不可撤销。
 *   所以这里多一道校验：没有 id 就直接失败，绝不拿 slug 硬凑。
 *
 * @param {string}   slug    概念编号
 * @param {function} onDone  成功回调，参数固定false（已取消）
 * @param {function} onError 失败回调，参数是一个 Error
 */
function removeFavoriteMock(slug, onDone, onError) {
  /* 保留 Mock 后缀：与上面的 toggleFavoriteMock 命名成对，
     也提醒「这一层将来可能换回真实现」。 */

  if (FAVORITE_FORCE_FAIL) {
    onError(new Error('取消收藏请求失败（?favfail=1 强制注入）'));
    return;
  }

  var id = getFavoriteId(slug);

  /* 没查到 id 就不能发请求。原因通常是「读回收藏列表那一步失败了」，
     给一句能照做的提示，而不是拿 slug 当 id 去试。 */
  if (id === null) {
    onError(new Error('不知道这条收藏的编号，请刷新页面再试一次。'));
    return;
  }

  apiRequest(
    API_BASE + '/api/favorites/' + id,
    { method: 'DELETE', headers: { 'Accept': 'application/json' } },
    function (data) {
      /* 成功：把本地对照表里的这条也清掉，
         否则用户再点一次会拿着一个已失效的 id 去删（后端会回 404）。 */
      delete favIdsBySlug[String(slug)];
      onDone(false);
    },
    function (err) {
      /* 404 = 那一行已经不在了。对「取消」这个目标而言已经达成，
         当成功处理，避免用户看到「没能取消收藏」这种吓人提示。
         同样要把对照表清掉，否则会一直拿着过期 id 重试。 */
      if (err && (err.code === 'FAVORITE_NOT_FOUND' || err.code === 'NOT_FOUND')) {
        delete favIdsBySlug[String(slug)];
        onDone(false);
        return;
      }
      console.error('[concepts] 取消收藏失败：', err);
      onError(err);
    }
  );
}

/**
 * 收藏一个概念 —— 走真实接口 POST /api/favorites。
 *
 * @param {string}   slug    概念编号，例如 "007-rag"
 * @param {function} onDone  成功回调，参数是布尔「是否已收藏」
 * @param {function} onError 失败回调，参数是一个 Error
 */
function toggleFavoriteMock(slug, onDone, onError) {
  /* 保留旧名toggleFavoriteMock：index.html 就是按这个名字调用的，
     改名就要动页面文件。今天的纪律是页面逻辑一行不改。 */

  if (FAVORITE_FORCE_FAIL) {
    /* 故障注入：立刻走失败路径，用来验收页面的失败提示 */
    onError(new Error('收藏请求失败（?favfail=1 强制注入）'));
    return;
  }

  apiRequest(
    API_BASE + '/api/favorites',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ slug: slug })
    },
    function (data) {
      /* POST 201 的 data 形状是「新建的那一行」{ id, slug, note, createdAt }」
         （见 api-contract §4.4）；GET 的 data 才是 { items, count }（§4.5）。
         两者形状不同，别混用。 */
      /* Day 24：记下这条收藏的 id，否则用户随后点「取消」时无 id 可删。 */
      if (data && data.slug === slug && typeof data.id === 'number') {
        favIdsBySlug[String(slug)] = data.id;
      }
      onDone(!!(data && data.slug === slug));
    },
    function (err) {
      /* 409「已经收藏过了」不是错误状态 —— 结果就是「已收藏」，
         不该让页面弹「没能收藏」。这里把它转成成功回调。
         判断依据是 apiRequest 抛出的 Error 上带的 code（见下）。 */
      if (err && err.code === 'DUPLICATE_FAVORITE') {
        onDone(true);
        return;
      }
      console.error('[concepts] 收藏写入失败：', err);
      onError(err);
    }
  );
}

/**
 * 读回收藏列表 —— GET /api/favorites（Day 19 已有，Day 20 接进页面）。
 * 用途：页面刷新后能把「已收藏」的真实状态读回来，不再只靠内存变量。
 *
 * @param {function} onDone  成功回调，参数是已收藏的 slug 数组
 * @param {function} [onFail] 失败回调（可选）
 */
function fetchFavoriteSlugs(onDone, onFail) {
  apiRequest(
    API_BASE + '/api/favorites',
    { method: 'GET', headers: { 'Accept': 'application/json' } },
    function (data) {
      var items = (data && Array.isArray(data.items)) ? data.items : [];
      var slugs = [];
      /* Day 24 新增：顺手建 slug -> id 对照表，供取消收藏用。
         原来只把 slug 取出来就丢了 id，DELETE 找不到该删哪一行。 */
      for (var i = 0; i < items.length; i++) {
        if (items[i] && items[i].slug) {
          slugs.push(items[i].slug);
          if (typeof items[i].id === 'number') {
            favIdsBySlug[String(items[i].slug)] = items[i].id;
          }
        }
      }
      onDone(slugs);
    },
    function (err) {
      console.warn('[concepts] 读回收藏列表失败（不影响浏览）：', err);
      if (onFail) onFail(err); else onDone([]);
    }
  );
}
