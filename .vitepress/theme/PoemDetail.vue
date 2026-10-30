<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import taxonomy from '../../data/curation/taxonomy.json'

const { frontmatter, site } = useData()
const poem = computed(() => frontmatter.value.poem)
const related = computed(() => frontmatter.value.related || { poet: [], tag: [] })
const FAV_KEY = 'shijian-favorites'
const SHARE_FONT = '"Noto Serif SC", "Songti SC", "STSong", "SimSun", serif'
const SHARE_MAX_LINES = 18
const SHARE_BREAK = /[，。！？；、：,.!?;:]/

const showPinyin = ref(false)
const vertical = ref(false)
const saved = ref(false)
const copied = ref(false)
const speaking = ref(false)
const shareOpen = ref(false)
const shareImage = ref('')
const shareCopied = ref(false)

const lines = computed(() => poem.value?.lines || [])
const base = computed(() => site.value.base.replace(/\/$/, ''))

const labelGroups = computed(() =>
  taxonomy.dimensions
    .map((dim) => ({ ...dim, tags: poem.value?.labels?.[dim.key] || [] }))
    .filter((dim) => dim.tags.length),
)

const tagHref = (tag) => `${base.value}/search?tag=${encodeURIComponent(tag)}`

const readFavorites = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

onMounted(() => {
  const storedPinyin = localStorage.getItem('shijian-pinyin')
  const storedVertical = localStorage.getItem('shijian-vertical')
  if (storedPinyin !== null) showPinyin.value = storedPinyin === '1'
  if (storedVertical !== null) vertical.value = storedVertical === '1'
  saved.value = readFavorites().includes(poem.value.id)
  window.addEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  if (speaking.value) window.speechSynthesis?.cancel()
  window.removeEventListener('keydown', onEscape)
  document.body.style.overflow = ''
})

const onEscape = (event) => {
  if (event.key === 'Escape' && shareOpen.value) closeShare()
}

watch(shareOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})

const togglePinyin = () => {
  showPinyin.value = !showPinyin.value
  localStorage.setItem('shijian-pinyin', showPinyin.value ? '1' : '0')
}

const toggleVertical = () => {
  vertical.value = !vertical.value
  localStorage.setItem('shijian-vertical', vertical.value ? '1' : '0')
}

const toggleSaved = () => {
  const favorites = readFavorites()
  const index = favorites.indexOf(poem.value.id)
  if (index >= 0) favorites.splice(index, 1)
  else favorites.unshift(poem.value.id)
  localStorage.setItem(FAV_KEY, JSON.stringify(favorites.slice(0, 300)))
  saved.value = index < 0
}

const speak = () => {
  if (!('speechSynthesis' in window)) return
  if (speaking.value) {
    window.speechSynthesis.cancel()
    speaking.value = false
    return
  }
  const text = `${poem.value.title}。${poem.value.author}。${lines.value.map((line) => line.text).join('')}`
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.8
  utterance.onend = () => (speaking.value = false)
  utterance.onerror = () => (speaking.value = false)
  window.speechSynthesis.speak(utterance)
  speaking.value = true
}

const copyText = async () => {
  const text = `${poem.value.title}\n${poem.value.author}（${poem.value.dynasty}代）\n\n${lines.value
    .map((line) => line.text)
    .join('\n')}`
  try {
    await navigator.clipboard.writeText(text)
    copied.value = true
    setTimeout(() => (copied.value = false), 1600)
  } catch {
    copied.value = false
  }
}

const wrapText = (ctx, text, maxWidth) => {
  const rows = []
  let row = ''
  for (const char of text) {
    if (row && ctx.measureText(row + char).width > maxWidth) {
      let cut = -1
      for (let index = row.length - 1; index >= 0; index--) {
        if (SHARE_BREAK.test(row[index])) {
          cut = index + 1
          break
        }
      }
      if (cut > 0 && cut >= row.length * 0.55) {
        rows.push(row.slice(0, cut))
        row = row.slice(cut) + char
      } else {
        rows.push(row)
        row = char
      }
    } else {
      row += char
    }
  }
  if (row) rows.push(row)
  return rows.length ? rows : ['']
}

const buildShareImage = () => {
  const width = 1080
  const inner = 888
  const titleLineHeight = 74
  const poemLineHeight = 68
  const measure = document.createElement('canvas').getContext('2d')
  if (!measure) return ''

  measure.font = `600 54px ${SHARE_FONT}`
  measure.letterSpacing = '4px'
  const titleLines = wrapText(measure, poem.value.title, inner)

  measure.font = `40px ${SHARE_FONT}`
  measure.letterSpacing = '2px'
  const sourceLines = lines.value.map((line) => line.text)
  const wrapped = sourceLines.flatMap((line) => wrapText(measure, line, inner))
  const truncated = wrapped.length > SHARE_MAX_LINES
  const poemLines = truncated ? wrapped.slice(0, SHARE_MAX_LINES) : wrapped

  const metaParts = [`${poem.value.dynasty}代`, poem.value.author]
  if (poem.value.rhythmic) metaParts.push(poem.value.rhythmic)
  else if (poem.value.genre) metaParts.push(poem.value.genre)
  const meta = metaParts.join(' · ')

  const blockHeight =
    64 +
    64 +
    titleLines.length * titleLineHeight +
    24 +
    40 +
    45 +
    2 +
    50 +
    poemLines.length * poemLineHeight +
    (truncated ? poemLineHeight : 0) +
    54 +
    2 +
    34 +
    30 +
    (truncated ? 48 : 0)
  const height = Math.max(1200, blockHeight + 192)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = '#faf7f0'
  ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = '#e6dfd1'
  ctx.lineWidth = 2
  ctx.strokeRect(28, 28, width - 56, height - 56)
  ctx.strokeStyle = 'rgba(156, 59, 42, 0.14)'
  ctx.lineWidth = 1
  ctx.strokeRect(40, 40, width - 80, height - 80)

  let y = (height - blockHeight) / 2

  ctx.font = `600 40px ${SHARE_FONT}`
  ctx.letterSpacing = '8px'
  const brandWidth = ctx.measureText('诗笺').width
  const groupX = (width - (64 + 18 + brandWidth)) / 2
  ctx.fillStyle = '#9c3b2a'
  ctx.beginPath()
  ctx.roundRect(groupX, y, 64, 64, 9)
  ctx.fill()
  ctx.fillStyle = '#faf7f0'
  ctx.font = `38px ${SHARE_FONT}`
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('诗', groupX + 32, y + 35)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#1f1f1f'
  ctx.font = `600 40px ${SHARE_FONT}`
  ctx.letterSpacing = '8px'
  ctx.fillText('诗笺', groupX + 82, y + 34)
  y += 128

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#1f1f1f'
  ctx.font = `600 54px ${SHARE_FONT}`
  ctx.letterSpacing = '4px'
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y + 54)
    y += titleLineHeight
  }

  y += 24
  ctx.fillStyle = '#7a7a7a'
  ctx.font = `28px ${SHARE_FONT}`
  ctx.letterSpacing = '3px'
  ctx.fillText(meta, width / 2, y + 28)
  y += 40

  y += 45
  ctx.fillStyle = '#9c3b2a'
  ctx.fillRect(width / 2 - 40, y, 80, 2)
  y += 50

  ctx.fillStyle = '#3f3f3f'
  ctx.font = `40px ${SHARE_FONT}`
  ctx.letterSpacing = '2px'
  for (const line of poemLines) {
    ctx.fillText(line, width / 2, y + 48)
    y += poemLineHeight
  }
  if (truncated) {
    ctx.fillStyle = '#7a7a7a'
    ctx.fillText('……', width / 2, y + 48)
    y += poemLineHeight
  }

  y += 54
  ctx.fillStyle = '#e6dfd1'
  ctx.fillRect((width - inner) / 2, y, inner, 2)
  y += 34
  ctx.fillStyle = '#7a7a7a'
  ctx.font = `26px ${SHARE_FONT}`
  ctx.letterSpacing = '6px'
  ctx.fillText('诗成笺上，韵在行间', width / 2, y + 26)
  if (truncated) {
    y += 48
    ctx.font = `22px ${SHARE_FONT}`
    ctx.letterSpacing = '2px'
    ctx.fillText(`全诗 ${sourceLines.length} 句 · 完整诗文见诗笺`, width / 2, y + 22)
  }

  return canvas.toDataURL('image/png')
}

const openShare = async () => {
  shareCopied.value = false
  shareOpen.value = true
  if (document.fonts?.ready) await document.fonts.ready
  shareImage.value = buildShareImage()
}

const closeShare = () => {
  shareOpen.value = false
  shareImage.value = ''
}

const downloadCard = () => {
  if (!shareImage.value) return
  const safeTitle = poem.value.title.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 40)
  const link = document.createElement('a')
  link.href = shareImage.value
  link.download = `诗笺-${safeTitle}.png`
  link.click()
}

const copyShareLink = async () => {
  try {
    await navigator.clipboard.writeText(window.location.href)
    shareCopied.value = true
    setTimeout(() => (shareCopied.value = false), 1600)
  } catch {
    shareCopied.value = false
  }
}

const isHan = (char) => /[\u3400-\u9fff]/.test(char)
</script>

<template>
  <article v-if="poem" class="poem">
    <header class="poem__header">
      <p class="poem__meta">
        <span>{{ poem.dynasty }}代</span>
        <a :href="base + '/poets/' + poem.authorSlug">{{ poem.author }}</a>
        <span v-if="poem.rhythmic" class="poem__tag">{{ poem.rhythmic }}</span>
        <span v-if="poem.genre && !poem.rhythmic" class="poem__tag">{{ poem.genre }}</span>
      </p>
      <h1 class="poem__title">{{ poem.title }}</h1>
      <div v-if="labelGroups.length" class="poem__labels">
        <div v-for="dim in labelGroups" :key="dim.key" class="poem__label-row">
          <span class="poem__label-dim">{{ dim.label }}</span>
          <a
            v-for="tag in dim.tags"
            :key="tag"
            class="poem__label"
            :href="tagHref(tag)"
          >{{ tag }}</a>
        </div>
      </div>
    </header>

    <div class="poem__toolbar" role="toolbar" aria-label="阅读工具">
      <button type="button" :class="{ 'is-active': showPinyin }" :aria-pressed="showPinyin" @click="togglePinyin">
        注音
      </button>
      <button type="button" :class="{ 'is-active': vertical }" :aria-pressed="vertical" @click="toggleVertical">
        竖排
      </button>
      <button type="button" :class="{ 'is-active': speaking }" :aria-pressed="speaking" @click="speak">
        {{ speaking ? '停止' : '朗读' }}
      </button>
      <button type="button" :class="{ 'is-active': saved }" :aria-pressed="saved" @click="toggleSaved">
        {{ saved ? '已收藏' : '收藏' }}
      </button>
      <button type="button" @click="copyText">{{ copied ? '已复制' : '复制' }}</button>
      <button type="button" @click="openShare">分享</button>
    </div>

    <div class="poem__body" :class="{ 'is-vertical': vertical }">
      <p v-for="(line, index) in lines" :key="index" class="poem__line">
        <template v-for="(char, charIndex) in [...line.text]" :key="charIndex">
          <ruby v-if="showPinyin && isHan(char) && line.pinyin[charIndex]">
            {{ char }}<rt>{{ line.pinyin[charIndex] }}</rt>
          </ruby>
          <span v-else>{{ char }}</span>
        </template>
      </p>
    </div>

    <section v-if="poem.annotation" class="poem__notes">
      <section class="poem__section">
        <h2 class="poem__section-title">译文</h2>
        <p
          v-for="(paragraph, index) in poem.annotation.translation"
          :key="index"
          class="poem__translation"
        >{{ paragraph }}</p>
      </section>
      <section class="poem__section">
        <h2 class="poem__section-title">注释</h2>
        <dl class="poem__note-list">
          <div v-for="(note, index) in poem.annotation.notes" :key="index" class="poem__note">
            <dt>{{ note.term }}</dt>
            <dd>{{ note.text }}</dd>
          </div>
        </dl>
      </section>
    </section>

    <section v-if="related.poet.length || related.tag.length" class="poem__related">
      <div v-if="related.poet.length" class="poem__related-group">
        <h2 class="poem__related-title">更多{{ poem.author }}的作品</h2>
        <ul class="poem__related-list">
          <li v-for="item in related.poet" :key="item.slug">
            <a :href="base + '/poems/' + item.slug">{{ item.title }}</a>
          </li>
        </ul>
      </div>
      <div v-if="related.tag.length" class="poem__related-group">
        <h2 class="poem__related-title">同标签诗词</h2>
        <ul class="poem__related-list">
          <li v-for="item in related.tag" :key="item.slug">
            <a :href="base + '/poems/' + item.slug">
              <span class="poem__related-name">{{ item.title }}</span>
              <span class="poem__related-meta">{{ item.author }} · {{ item.dynasty }}代</span>
              <span class="poem__related-tags">{{ item.tags.join(' · ') }}</span>
            </a>
          </li>
        </ul>
      </div>
    </section>

    <footer class="poem__footer">
      <p v-if="poem.annotation">译文、注释由 AI 辅助整理，仅供参考。</p>
      <p>拼音由 pinyin-pro 自动标注，多音字与古音可能存在偏差，仅供参考。</p>
    </footer>

    <Teleport to="body">
      <div v-if="shareOpen" class="share-modal" role="dialog" aria-modal="true" aria-label="分享卡片">
        <div class="share-modal__backdrop" @click="closeShare"></div>
        <div class="share-modal__panel">
          <header class="share-modal__head">
            <p class="share-modal__title">分享卡片</p>
            <button type="button" class="share-modal__close" aria-label="关闭" @click="closeShare">
              关闭
            </button>
          </header>
          <div class="share-modal__preview">
            <img v-if="shareImage" :src="shareImage" :alt="`${poem.title}分享卡片`" />
            <p v-else class="share-modal__loading">正在生成卡片…</p>
          </div>
          <div class="share-modal__actions">
            <button type="button" class="is-primary" :disabled="!shareImage" @click="downloadCard">
              下载图片
            </button>
            <button type="button" @click="copyShareLink">
              {{ shareCopied ? '链接已复制' : '复制链接' }}
            </button>
          </div>
          <p class="share-modal__hint">1080 像素宽 PNG，适合分享到社交平台。</p>
        </div>
      </div>
    </Teleport>
  </article>
</template>
