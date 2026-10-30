import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'
import * as OpenCC from 'opencc-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const toSimp = OpenCC.Converter({ from: 't', to: 'cn' })

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'))
const readJsonIfExists = (rel) =>
  fs.existsSync(path.join(root, rel)) ? readJson(rel) : null
const rmrf = (rel) => fs.rmSync(path.join(root, rel), { recursive: true, force: true })
const mkdir = (rel) => fs.mkdirSync(path.join(root, rel), { recursive: true })
const write = (rel, content) => {
  const abs = path.join(root, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, content)
}

const taxonomy = readJson('data/curation/taxonomy.json')
const curatedLabels = readJsonIfExists('data/curation/tags.json') || {}
const curatedAnnotations = readJsonIfExists('data/curation/annotations.json') || {}
const pinyinOverrides = readJsonIfExists('data/curation/pinyin-overrides.json') || {}

const charDefaultRules = (pinyinOverrides.charDefaults || []).map((rule) => {
  if ([...rule.char].length !== 1) throw new Error(`拼音默认规则必须是单字：${rule.char}`)
  return {
    char: rule.char,
    reading: rule.reading,
    exceptions: new Map((rule.exceptions || []).map((item) => [item.line, item.reading])),
  }
})
const exceptionKeys = new Set(
  charDefaultRules.flatMap((rule) => [...rule.exceptions.keys()].map((line) => `${rule.char}|${line}`)),
)
const usedExceptionKeys = new Set()
const lineRules = new Map(
  (pinyinOverrides.lineRules || []).map((rule) => [rule.line, rule.fixes || []]),
)
const usedLineRules = new Set()
const tagVocabulary = new Map(
  taxonomy.dimensions.map((dim) => [dim.key, new Set(dim.tags)]),
)
const flatLabels = (labels) =>
  labels ? taxonomy.dimensions.flatMap((dim) => labels[dim.key] || []) : []

function resolveLabels(slug) {
  const entry = curatedLabels[slug]
  if (!entry) return null
  const labels = {}
  for (const dim of taxonomy.dimensions) {
    const tags = (entry[dim.key] || []).filter(Boolean)
    for (const tag of tags) {
      if (!tagVocabulary.get(dim.key).has(tag)) {
        throw new Error(`标签「${tag}」不在词表 ${dim.key} 中（诗词 ${slug}）`)
      }
    }
    labels[dim.key] = tags
  }
  return labels
}

function resolveAnnotation(slug) {
  const entry = curatedAnnotations[slug]
  if (!entry) return null
  const translation = (Array.isArray(entry.translation) ? entry.translation : [entry.translation])
    .map((paragraph) => String(paragraph ?? '').trim())
    .filter(Boolean)
  const notes = (entry.notes || [])
    .map((note) => ({
      term: String(note?.term ?? '').trim(),
      text: String(note?.text ?? '').trim(),
    }))
    .filter((note) => note.term && note.text)
  if (!translation.length) throw new Error(`译文为空（诗词 ${slug}）`)
  if (!notes.length) throw new Error(`注释为空（诗词 ${slug}）`)
  return { translation, notes }
}

const HAN = /[\u3400-\u9fff]/
const GENRE = /^(五言|七言|乐府|古体|近体|绝句|律诗|排律|词|曲)/
const TITLE_PREFIX = /^(鼓吹曲辞|横吹曲辞|相和歌辞|杂曲歌辞|琴曲歌辞|郊庙歌辞|舞曲歌辞|近代曲辞|杂歌谣辞|新乐府辞)\s+/
const escapeHtml = (value) =>
  String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cleanText = (value) => toSimp(String(value ?? '')).replace(/\s+/g, ' ').trim()
const cleanTitle = (value) => cleanText(value).replace(TITLE_PREFIX, '').replace(/\s+/g, ' ').trim()
const textKey = (paragraphs) => paragraphs.join('').replace(/[，。！？；、：,.!?;:\s]/g, '')
const titleKey = (title) =>
  title
    .replace(/\s+/g, '')
    .replace(/(二首|三首|四首|五首|十首)/g, '')
    .replace(/[一二三四五六七八九十]+$/, '')
    .replace(/词$/, '')
const similarity = (a, b) => {
  const setA = new Set([...a])
  const setB = new Set([...b])
  let common = 0
  for (const char of setA) if (setB.has(char)) common++
  return common / (setA.size + setB.size - common)
}
const clipText = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, '')
  return text.length > length ? `${text.slice(0, length)}…` : text
}
const trimTail = (value) => String(value ?? '').replace(/[，、；：！？。…]+$/, '')
const excerptOf = (value, length) => {
  const text = String(value ?? '').replace(/\s+/g, '')
  if (!text) return ''
  let result = ''
  for (const sentence of text.match(/[^。！？；!?;]+[。！？；!?;]?/g) || []) {
    if ((result + sentence).length > length) break
    result += sentence
  }
  if (result) return trimTail(result)
  return `${trimTail(clipText(text, length))}…`
}

const famousTangTitles = [
  '静夜思', '春晓', '登鹳雀楼', '望庐山瀑布', '早发白帝城', '相思', '山居秋暝',
  '春望', '登高', '江雪', '悯农', '游子吟', '清明', '枫桥夜泊', '凉州词',
  '出塞', '黄鹤楼送孟浩然之广陵', '赠汪伦', '九月九日忆山东兄弟', '咏柳',
  '回乡偶书', '竹里馆', '鹿柴', '鸟鸣涧', '独坐敬亭山', '秋夕', '泊秦淮',
  '乌衣巷', '寻隐者不遇', '乐游原', '无题', '锦瑟', '望岳', '使至塞上',
]
const famousSongTitles = [
  '虞美人', '水调歌头', '念奴娇', '声声慢', '如梦令', '青玉案', '雨霖铃',
  '江城子', '一剪梅', '醉花阴', '卜算子', '蝶恋花', '满江红', '浣溪沙',
]
const famousTitleSet = new Set([...famousTangTitles, ...famousSongTitles])
const titleScore = (title) =>
  (famousTitleSet.has(title) ? 1000 : 0) + (200 - title.replace(/\s+/g, '').length)
const relatedScore = (poem) => {
  const famous =
    famousTitleSet.has(poem.title) || (poem.rhythmic && famousSongTitles.includes(poem.rhythmic))
  return (famous ? 1000 : 0) - poem.title.replace(/\s+/g, '').length
}
const hanOnly = (text) => [...text].filter((ch) => HAN.test(ch)).join('')

const slugCounts = new Map()
function uniqueSlug(base, fallback) {
  const cleaned = base || fallback
  const seen = slugCounts.get(cleaned) || 0
  slugCounts.set(cleaned, seen + 1)
  return seen === 0 ? cleaned : `${cleaned}-${seen + 1}`
}

function toSlug(text, fallback) {
  const han = hanOnly(text)
  if (!han) return fallback
  const syllables = pinyin(han, { toneType: 'none', type: 'array' })
  const base = syllables.join('-').toLowerCase()
  return base || fallback
}

function buildLine(text) {
  const chars = [...text]
  const syllables = pinyin(text, { toneType: 'symbol', type: 'array' })
  const aligned =
    syllables.length === chars.length
      ? syllables
      : chars.map((ch) => (HAN.test(ch) ? pinyin(ch, { toneType: 'symbol' }) : ch))

  for (const rule of charDefaultRules) {
    const exception = rule.exceptions.get(text)
    if (exception) usedExceptionKeys.add(`${rule.char}|${text}`)
    chars.forEach((ch, index) => {
      if (ch === rule.char) aligned[index] = exception || rule.reading
    })
  }

  const fixes = lineRules.get(text)
  if (fixes) {
    for (const fix of fixes) {
      const positions = []
      chars.forEach((ch, index) => {
        if (ch === fix.char) positions.push(index)
      })
      const position = positions[fix.occurrence || 0]
      if (position === undefined) {
        throw new Error(`拼音行规则无法定位「${fix.char}」第 ${(fix.occurrence || 0) + 1} 次：${text}`)
      }
      aligned[position] = fix.reading
    }
    usedLineRules.add(text)
  }

  return { text, pinyin: aligned }
}

function normalizePoem(raw, family, index, titleText) {
  const author = cleanText(raw.author) || '佚名'
  const dynasty = family === 'tang' ? '唐' : '宋'
  const rhythmic = family === 'song' ? cleanText(raw.rhythmic) : ''
  const paragraphs = (raw.paragraphs || []).map(cleanText).filter(Boolean)
  const tags = (raw.tags || [])
    .map(cleanText)
    .filter((tag) => tag && !tag.includes('三百首'))
    .slice(0, 3)
  const lines = paragraphs.map(buildLine)
  const id = `${family}-${String(index + 1).padStart(3, '0')}`
  const genre = family === 'song' ? '词' : tags.find((tag) => GENRE.test(tag)) || ''
  const finalTitle =
    family === 'song'
      ? `${rhythmic}·${paragraphs[0].split(/[，。！？；、]/)[0].slice(0, 12)}`
      : titleText
  const slug = uniqueSlug(toSlug(finalTitle, id), id)

  return {
    id,
    family,
    slug,
    title: finalTitle,
    author,
    dynasty,
    rhythmic: family === 'song' ? rhythmic : '',
    genre,
    labels: resolveLabels(slug),
    annotation: resolveAnnotation(slug),
    lines,
  }
}

function collect(rawList, family) {
  const byText = new Map()
  for (const raw of rawList) {
    const paragraphs = (raw.paragraphs || []).map(cleanText).filter(Boolean)
    if (!paragraphs.length) continue
    const titleText = cleanTitle(raw.title || raw.rhythmic || '无题')
    const key = textKey(paragraphs)
    const kept = byText.get(key)
    if (!kept || titleScore(titleText) > titleScore(kept.titleText)) {
      byText.set(key, { raw, titleText })
    }
  }
  const poems = [...byText.values()].map((item, index) =>
    normalizePoem(item.raw, family, index, item.titleText),
  )

  // 同作者、同题、正文高度相似的异文只保留一个（优先保留更完整的版本）
  const merged = []
  for (const poem of poems) {
    const body = textKey(poem.lines.map((line) => line.text))
    const twin = merged.find(
      (item) =>
        item.author === poem.author &&
        titleKey(item.title) === titleKey(poem.title) &&
        similarity(textKey(item.lines.map((line) => line.text)), body) >= 0.85,
    )
    if (!twin) {
      merged.push(poem)
    } else if (body.length > textKey(twin.lines.map((line) => line.text)).length) {
      merged[merged.indexOf(twin)] = poem
    }
  }
  merged.forEach((poem, index) => {
    poem.id = `${family}-${String(index + 1).padStart(3, '0')}`
  })
  return merged
}

const tangPoems = collect(readJson('data/source/tangshi.json'), 'tang')
const songPoems = collect(readJson('data/source/songci.json'), 'song')
const allPoems = [...tangPoems, ...songPoems]

// 诗人聚合
const poetMap = new Map()
for (const poem of allPoems) {
  const key = `${poem.dynasty}|${poem.author}`
  if (!poetMap.has(key)) {
    poetMap.set(key, {
      name: poem.author,
      dynasty: poem.dynasty,
      family: poem.family,
      poems: [],
    })
  }
  poetMap.get(key).poems.push(poem)
}
const poets = [...poetMap.values()]
const poetSlugBase = new Map()
for (const poet of poets) {
  const base = toSlug(poet.name, `poet-${poetSlugBase.size + 1}`)
  poetSlugBase.set(poet, base)
}
const baseUsage = new Map()
for (const base of poetSlugBase.values()) baseUsage.set(base, (baseUsage.get(base) || 0) + 1)
for (const poet of poets) {
  const base = poetSlugBase.get(poet)
  poet.slug = baseUsage.get(base) > 1 ? `${base}-${poet.family}` : base
}
const poetByKey = new Map(poets.map((poet) => [`${poet.dynasty}|${poet.name}`, poet]))
for (const poem of allPoems) {
  poem.authorSlug = poetByKey.get(`${poem.dynasty}|${poem.author}`).slug
}

const poemsByAuthor = new Map()
for (const poem of allPoems) {
  if (!poemsByAuthor.has(poem.authorSlug)) poemsByAuthor.set(poem.authorSlug, [])
  poemsByAuthor.get(poem.authorSlug).push(poem)
}

function relatedOf(poem) {
  const poet = [...(poemsByAuthor.get(poem.authorSlug) || [])]
    .filter((item) => item.id !== poem.id)
    .sort((a, b) => relatedScore(b) - relatedScore(a))
    .slice(0, 4)
    .map(({ slug, title }) => ({ slug, title }))

  const ownTags = new Set(flatLabels(poem.labels))
  const tag = allPoems
    .filter((item) => item.id !== poem.id && item.authorSlug !== poem.authorSlug)
    .map((item) => ({
      item,
      shared: flatLabels(item.labels).filter((label) => ownTags.has(label)),
    }))
    .filter((entry) => entry.shared.length)
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length || relatedScore(b.item) - relatedScore(a.item),
    )
    .slice(0, 4)
    .map(({ item, shared }) => ({
      slug: item.slug,
      title: item.title,
      author: item.author,
      dynasty: item.dynasty,
      tags: shared.slice(0, 2),
    }))

  return { poet, tag }
}

const stats = {
  poems: allPoems.length,
  poets: poets.length,
  tang: tangPoems.length,
  song: songPoems.length,
}

// ---------- 检索索引（由检索页按需加载） ----------
const latinize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
    .replace(/[^a-z]/g, '')

const pinyinParts = (text) =>
  pinyin(hanOnly(text), { toneType: 'none', type: 'array' }).map(latinize)

const pinyinEntryOf = (poem) => {
  const titleParts = pinyinParts(poem.title)
  const authorParts = pinyinParts(poem.author)
  const rhythmicParts = poem.rhythmic ? pinyinParts(poem.rhythmic) : []
  const textParts = poem.lines.flatMap((line) => line.pinyin.map(latinize))
  return {
    id: poem.id,
    title: titleParts.join(''),
    titleInitials: titleParts.map((part) => part[0] || '').join(''),
    author: authorParts.join(''),
    rhythmic: rhythmicParts.join(''),
    rhythmicInitials: rhythmicParts.map((part) => part[0] || '').join(''),
    text: textParts.join(''),
    textInitials: textParts.map((part) => part[0] || '').join(''),
  }
}

write('data/search-pinyin.json', JSON.stringify(allPoems.map(pinyinEntryOf)))

write(
  'data/search.json',
  JSON.stringify(
    allPoems.map(({ id, slug, title, author, authorSlug, dynasty, genre, rhythmic, lines, labels }) => ({
      id,
      slug,
      title,
      author,
      authorSlug,
      dynasty,
      genre,
      rhythmic,
      labels: flatLabels(labels),
      text: lines.map((line) => line.text).join('\n'),
    })),
  ),
)

// ---------- 生成诗词详情页 ----------
rmrf('poems')
for (const poem of allPoems) {
  const kind = poem.rhythmic || poem.genre || ''
  const translation = poem.annotation ? poem.annotation.translation.join('') : ''
  const excerpt = excerptOf(translation, 52)
  const description = `${poem.author}《${poem.title}》${poem.dynasty}代${kind || '作品'}。${
    excerpt ? `${excerpt}。` : ''
  }含原文、拼音注音、译文注释、朗读与收藏。`
  const frontmatter = {
    layout: 'doc',
    sidebar: false,
    aside: false,
    prev: false,
    next: false,
    pageClass: 'poem-page',
    title: poem.title,
    description,
    poem,
    related: relatedOf(poem),
  }
  const yaml = Object.entries(frontmatter)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')
  write(`poems/${poem.slug}.md`, `---\n${yaml}\n---\n\n<PoemDetail />\n`)
}

// ---------- 生成诗人页 ----------
rmrf('poets')
const poetsByDynasty = new Map()
for (const poet of poets) {
  if (!poetsByDynasty.has(poet.dynasty)) poetsByDynasty.set(poet.dynasty, [])
  poetsByDynasty.get(poet.dynasty).push(poet)
}
for (const poet of poets) {
  const list = poet.poems
    .map((poem) => `<li><a href="/poems/${poem.slug}">${escapeHtml(poem.title)}</a></li>`)
    .join('\n')
  const featured = poet.poems
    .slice(0, 3)
    .map((poem) => `《${clipText(poem.title, 12)}》`)
    .join('')
  const poetDescription = `${poet.name}（${poet.dynasty}代）作品 ${poet.poems.length} 首${
    featured ? `，包括${featured}` : ''
  }。提供原文、拼音注音、译文注释与朗读。`
  const poetMeta = {
    name: poet.name,
    slug: poet.slug,
    dynasty: poet.dynasty,
    count: poet.poems.length,
  }
  write(
    `poets/${poet.slug}.md`,
    `---\nlayout: doc\nsidebar: false\naside: false\nprev: false\nnext: false\npageClass: poet-page\ntitle: ${JSON.stringify(poet.name)}\ndescription: ${JSON.stringify(poetDescription)}\npoet: ${JSON.stringify(poetMeta)}\n---\n\n# ${poet.name}\n\n<p class="page-meta">${poet.dynasty}代 · ${poet.poems.length} 首</p>\n\n<ul class="poem-list">\n${list}\n</ul>\n`,
  )
}
const poetIndexSections = [...poetsByDynasty.entries()]
  .map(([dynasty, list]) => {
    const sorted = [...list].sort((a, b) => b.poems.length - a.poems.length)
    const items = sorted
      .map(
        (poet) =>
          `<li><a href="/poets/${poet.slug}">${escapeHtml(poet.name)}</a><span>${poet.poems.length} 首</span></li>`,
      )
      .join('\n')
    return `## ${dynasty}代\n\n<ul class="poem-list poem-list--chips">\n${items}\n</ul>`
  })
  .join('\n\n')
write(
  'poets/index.md',
  `---\nlayout: doc\nsidebar: false\naside: false\nprev: false\nnext: false\npageClass: poets-page\ntitle: 诗人\ndescription: 共 ${stats.poets} 位唐代与宋代诗人，按朝代分组，可直达每位诗人的全部作品。\n---\n\n# 诗人\n\n<p class="page-meta">共 ${stats.poets} 位</p>\n\n${poetIndexSections}\n`,
)

// ---------- 生成朝代页 ----------
rmrf('dynasties')
const dynastyMeta = [
  { key: 'tang', title: '唐诗', heading: '唐代诗歌', family: 'tang', description: '唐诗三百首' },
  { key: 'song', title: '宋词', heading: '宋代词作', family: 'song', description: '宋词三百首' },
]
for (const meta of dynastyMeta) {
  const list = (poetsByDynasty.get(meta.family === 'tang' ? '唐' : '宋') || []).sort(
    (a, b) => b.poems.length - a.poems.length,
  )
  const count = meta.family === 'tang' ? stats.tang : stats.song
  const items = list
    .map(
      (poet) =>
        `<li><a href="/poets/${poet.slug}">${escapeHtml(poet.name)}</a><span>${poet.poems.length} 首</span></li>`,
    )
    .join('\n')
  const topNames = list.slice(0, 4).map((poet) => poet.name).join('、')
  const dynastyDescription = `${meta.description}共 ${count} 首，收录${topNames}等 ${list.length} 位${
    meta.family === 'tang' ? '诗人' : '词人'
  }的作品，提供原文、拼音注音、译文注释与朗读。`
  const dynastyMeta = { key: meta.key, title: meta.title, count, poets: list.length }
  write(
    `dynasties/${meta.key}.md`,
    `---\nlayout: doc\nsidebar: false\naside: false\nprev: false\nnext: false\npageClass: poets-page\ntitle: ${JSON.stringify(meta.title)}\ndescription: ${JSON.stringify(dynastyDescription)}\ndynasty: ${JSON.stringify(dynastyMeta)}\n---\n\n# ${meta.heading}\n\n<p class="page-meta">${count} 首 · ${list.length} 位诗人</p>\n\n<ul class="poem-list poem-list--chips">\n${items}\n</ul>\n`,
  )
}

// ---------- 首页数据 ----------
const dailyPool = []
const usedDaily = new Set()
const pickDaily = (poem) => {
  if (!poem || usedDaily.has(poem.id) || dailyPool.length >= 24) return
  usedDaily.add(poem.id)
  dailyPool.push({
    slug: poem.slug,
    title: poem.title,
    author: poem.author,
    dynasty: poem.dynasty,
    lines: poem.lines.slice(0, 4).map((line) => line.text),
  })
}
const dailyCandidates = []
for (let i = 0; i < Math.max(famousTangTitles.length, famousSongTitles.length); i += 1) {
  if (famousTangTitles[i]) dailyCandidates.push(['tang', 'title', famousTangTitles[i]])
  if (famousSongTitles[i]) dailyCandidates.push(['song', 'rhythmic', famousSongTitles[i]])
}
for (const [family, field, name] of dailyCandidates) {
  pickDaily(allPoems.find((poem) => poem.family === family && poem[field] === name))
}

const topPoets = [...poets]
  .sort((a, b) => b.poems.length - a.poems.length || a.name.localeCompare(b.name, 'zh'))
  .slice(0, 16)
  .map((poet) => ({ name: poet.name, slug: poet.slug, dynasty: poet.dynasty, count: poet.poems.length }))

write(
  'data/home.json',
  JSON.stringify(
    {
      stats,
      dailyPool,
      randomSlugs: allPoems.map((poem) => poem.slug),
      dynasties: dynastyMeta.map((meta) => ({
        key: meta.key,
        title: meta.title,
        heading: meta.heading,
        count: meta.family === 'tang' ? stats.tang : stats.song,
        poetCount: (poetsByDynasty.get(meta.family === 'tang' ? '唐' : '宋') || []).length,
      })),
      topPoets,
    },
    null,
    2,
  ),
)

const labeledPoems = allPoems.filter((poem) =>
  taxonomy.dimensions.some((dim) => poem.labels?.[dim.key]?.length),
)
const staleLabelSlugs = Object.keys(curatedLabels).filter(
  (slug) => !allPoems.some((poem) => poem.slug === slug),
)
if (staleLabelSlugs.length) {
  console.warn(`标注文件中有 ${staleLabelSlugs.length} 个 slug 未匹配到诗词：${staleLabelSlugs.join(', ')}`)
}

const annotatedPoems = allPoems.filter((poem) => poem.annotation)
const staleAnnotationSlugs = Object.keys(curatedAnnotations).filter(
  (slug) => !allPoems.some((poem) => poem.slug === slug),
)
if (staleAnnotationSlugs.length) {
  console.warn(
    `译文注释文件中有 ${staleAnnotationSlugs.length} 个 slug 未匹配到诗词：${staleAnnotationSlugs.join(', ')}`,
  )
}

const unusedExceptionKeys = [...exceptionKeys].filter((key) => !usedExceptionKeys.has(key))
if (unusedExceptionKeys.length) {
  console.warn(`拼音例外行未匹配（${unusedExceptionKeys.length}）：${unusedExceptionKeys.join(' | ')}`)
}
const unusedLineRules = [...lineRules.keys()].filter((line) => !usedLineRules.has(line))
if (unusedLineRules.length) {
  console.warn(`拼音行规则未匹配（${unusedLineRules.length}）：${unusedLineRules.join(' | ')}`)
}

console.log(
  `内容构建完成：唐诗 ${stats.tang} 首 / 宋词 ${stats.song} 首 / 诗人 ${stats.poets} 位 / 每日一诗池 ${dailyPool.length} 首 / 标签覆盖 ${labeledPoems.length} 首 / 译文覆盖 ${annotatedPoems.length} 首`,
)
