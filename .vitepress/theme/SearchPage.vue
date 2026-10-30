<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { withBase } from 'vitepress'
import taxonomy from '../../data/curation/taxonomy.json'

const poems = ref([])
const loading = ref(true)
const query = ref('')
const dynasty = ref('all')
const poet = ref('all')
const genre = ref('all')
const tag = ref('all')
const limit = ref(30)
const pinyinIndex = ref(null)
const pinyinLoading = ref(false)
let pinyinPromise = null

const suggestions = ['明月', '相思', '春风', '江南', '故乡']
const pinyinSuggestions = ['jingyesi', 'jys', 'sushi']
const tagSuggestions = ['思乡', '送别', '月亮', '秋', '豪迈', '咏怀']
const dynastyOptions = [
  { value: 'all', label: '全部' },
  { value: '唐', label: '唐' },
  { value: '宋', label: '宋' },
]

const poets = computed(() => {
  const map = new Map()
  for (const poem of poems.value) {
    if (!map.has(poem.authorSlug)) {
      map.set(poem.authorSlug, {
        slug: poem.authorSlug,
        name: poem.author,
        dynasty: poem.dynasty,
        count: 0,
      })
    }
    map.get(poem.authorSlug).count++
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh'),
  )
})

const poetOptions = computed(() =>
  poets.value.filter((item) => dynasty.value === 'all' || item.dynasty === dynasty.value),
)

const genreOptions = computed(() => {
  const counts = new Map()
  for (const poem of poems.value) {
    if (!poem.genre) continue
    if (dynasty.value !== 'all' && poem.dynasty !== dynasty.value) continue
    counts.set(poem.genre, (counts.get(poem.genre) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, count }))
})

const tagGroups = computed(() => {
  const counts = new Map()
  for (const poem of poems.value) {
    if (dynasty.value !== 'all' && poem.dynasty !== dynasty.value) continue
    for (const label of poem.labels || []) {
      counts.set(label, (counts.get(label) || 0) + 1)
    }
  }
  return taxonomy.dimensions
    .map((dim) => ({
      key: dim.key,
      label: dim.label,
      tags: dim.tags
        .map((name) => ({ name, count: counts.get(name) || 0 }))
        .filter((item) => item.count > 0),
    }))
    .filter((group) => group.tags.length)
})

const pinyinMap = computed(() => {
  const map = new Map()
  for (const entry of pinyinIndex.value || []) map.set(entry.id, entry)
  return map
})

const latinKeyword = computed(() => {
  const raw = query.value.trim()
  if (!/^[a-z\s]+$/i.test(raw) || !/[a-z]/i.test(raw)) return ''
  const keyword = raw
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/ü/g, 'u')
    .replace(/v/g, 'u')
  return keyword.length >= 2 ? keyword : ''
})

const ensurePinyinIndex = () => {
  if (pinyinIndex.value || pinyinPromise) return pinyinPromise
  pinyinLoading.value = true
  pinyinPromise = import('../../data/search-pinyin.json')
    .then((module) => {
      pinyinIndex.value = module.default
    })
    .catch(() => {
      pinyinIndex.value = []
    })
    .finally(() => {
      pinyinLoading.value = false
    })
  return pinyinPromise
}

const scoreOf = (poem, keyword) => {
  let score = 0
  if (poem.title === keyword) score += 500
  else if (poem.title.includes(keyword)) score += 200
  if (poem.author === keyword) score += 180
  else if (poem.author.includes(keyword)) score += 90
  if (poem.rhythmic && poem.rhythmic.includes(keyword)) score += 70
  if (poem.labels && poem.labels.includes(keyword)) score += 120
  if (poem.text.includes(keyword)) score += 20
  return score
}

const pinyinScoreOf = (entry, keyword) => {
  if (!entry) return 0
  let score = 0
  if (entry.title === keyword) score += 520
  else if (entry.title.startsWith(keyword)) score += 300
  else if (entry.title.includes(keyword)) score += 210
  if (entry.titleInitials === keyword) score += 260
  else if (entry.titleInitials.startsWith(keyword)) score += 150
  if (entry.author === keyword) score += 190
  else if (entry.author.includes(keyword)) score += 90
  if (entry.rhythmic === keyword || entry.rhythmicInitials === keyword) score += 130
  else if (entry.rhythmic.startsWith(keyword) || entry.rhythmicInitials.startsWith(keyword)) {
    score += 70
  }
  if (entry.text.includes(keyword)) score += 45
  else if (keyword.length >= 4 && entry.textInitials.includes(keyword)) score += 20
  return score
}

const filtered = computed(() => {
  const keyword = query.value.trim()
  const latin = latinKeyword.value
  let list = poems.value
  if (dynasty.value !== 'all') list = list.filter((item) => item.dynasty === dynasty.value)
  if (poet.value !== 'all') list = list.filter((item) => item.authorSlug === poet.value)
  if (genre.value !== 'all') list = list.filter((item) => item.genre === genre.value)
  if (tag.value !== 'all') list = list.filter((item) => item.labels?.includes(tag.value))
  if (!keyword) return list
  return list
    .map((item) => ({
      item,
      score: latin ? pinyinScoreOf(pinyinMap.value.get(item.id), latin) : scoreOf(item, keyword),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item)
})

const visible = computed(() => filtered.value.slice(0, limit.value))
const keyword = computed(() => query.value.trim())

const snippetOf = (poem, word) => {
  const lines = poem.text.split('\n')
  if (!word) return lines.slice(0, 2).join(' ')
  const index = lines.findIndex((line) => line.includes(word))
  if (index === -1) return lines.slice(0, 2).join(' ')
  const start = Math.max(0, index - 1)
  return lines.slice(start, start + 2).join(' ')
}

const segmentsOf = (text, word) => {
  if (!word) return [{ text, match: false }]
  const source = text.toLowerCase()
  const needle = word.toLowerCase()
  const result = []
  let cursor = 0
  while (cursor < text.length) {
    const found = source.indexOf(needle, cursor)
    if (found === -1) {
      result.push({ text: text.slice(cursor), match: false })
      break
    }
    if (found > cursor) result.push({ text: text.slice(cursor, found), match: false })
    result.push({ text: text.slice(found, found + needle.length), match: true })
    cursor = found + needle.length
  }
  return result
}

const reset = () => {
  query.value = ''
  dynasty.value = 'all'
  poet.value = 'all'
  genre.value = 'all'
  tag.value = 'all'
}

const syncUrl = () => {
  if (typeof window === 'undefined') return
  const params = new URLSearchParams()
  if (query.value.trim()) params.set('q', query.value.trim())
  if (dynasty.value !== 'all') params.set('dynasty', dynasty.value)
  if (poet.value !== 'all') params.set('poet', poet.value)
  if (genre.value !== 'all') params.set('genre', genre.value)
  if (tag.value !== 'all') params.set('tag', tag.value)
  const search = params.toString()
  window.history.replaceState(null, '', window.location.pathname + (search ? '?' + search : ''))
}

const readUrl = () => {
  const params = new URLSearchParams(window.location.search)
  query.value = params.get('q') || ''
  const urlDynasty = params.get('dynasty')
  dynasty.value = urlDynasty === '唐' || urlDynasty === '宋' ? urlDynasty : 'all'
  poet.value = params.get('poet') || 'all'
  genre.value = params.get('genre') || 'all'
  tag.value = params.get('tag') || 'all'
}

const tagExists = () =>
  tagGroups.value.some((group) => group.tags.some((item) => item.name === tag.value))

watch(latinKeyword, (value) => {
  if (value) ensurePinyinIndex()
})

watch([query, dynasty, poet, genre, tag], () => {
  if (!poems.value.length) return
  if (poet.value !== 'all' && !poetOptions.value.some((item) => item.slug === poet.value)) {
    poet.value = 'all'
    return
  }
  if (genre.value !== 'all' && !genreOptions.value.some((item) => item.value === genre.value)) {
    genre.value = 'all'
    return
  }
  if (tag.value !== 'all' && !tagExists()) {
    tag.value = 'all'
    return
  }
  limit.value = 30
  syncUrl()
})

const toggleTag = (value) => {
  tag.value = tag.value === value ? 'all' : value
}

onMounted(async () => {
  readUrl()
  if (latinKeyword.value) ensurePinyinIndex()
  const module = await import('../../data/search.json')
  poems.value = module.default
  if (poet.value !== 'all' && !poetOptions.value.some((item) => item.slug === poet.value)) {
    poet.value = 'all'
  }
  if (genre.value !== 'all' && !genreOptions.value.some((item) => item.value === genre.value)) {
    genre.value = 'all'
  }
  if (tag.value !== 'all' && !tagExists()) tag.value = 'all'
  loading.value = false
  syncUrl()
})
</script>

<template>
  <section class="search">
    <header class="search__head">
      <h1 class="search__title">检索</h1>
      <p class="search__intro">
        在 {{ poems.length || '—' }} 首唐诗宋词中查找诗句、题目、诗人、词牌、标签或拼音。
      </p>
    </header>

    <div class="search__panel">
      <div class="search__field">
        <input
          v-model="query"
          type="search"
          class="search__input"
          placeholder="搜索诗句、题目、诗人、标签，或拼音 jingyesi / jys……"
          aria-label="搜索关键词"
        />
        <button
          v-if="query || dynasty !== 'all' || poet !== 'all' || genre !== 'all' || tag !== 'all'"
          type="button"
          class="search__clear"
          @click="reset"
        >
          清除
        </button>
      </div>

      <div class="search__filters">
        <label class="search__filter">
          <span>朝代</span>
          <select v-model="dynasty">
            <option v-for="item in dynastyOptions" :key="item.value" :value="item.value">
              {{ item.label }}
            </option>
          </select>
        </label>
        <label class="search__filter">
          <span>诗人</span>
          <select v-model="poet">
            <option value="all">全部</option>
            <option v-for="item in poetOptions" :key="item.slug" :value="item.slug">
              {{ item.name }}（{{ item.count }}）
            </option>
          </select>
        </label>
        <label class="search__filter">
          <span>体裁</span>
          <select v-model="genre">
            <option value="all">全部</option>
            <option v-for="item in genreOptions" :key="item.value" :value="item.value">
              {{ item.value }}（{{ item.count }}）
            </option>
          </select>
        </label>
        <label class="search__filter search__filter--tag">
          <span>标签</span>
          <select v-model="tag">
            <option value="all">全部</option>
            <optgroup v-for="group in tagGroups" :key="group.key" :label="group.label">
              <option v-for="item in group.tags" :key="item.name" :value="item.name">
                {{ item.name }}（{{ item.count }}）
              </option>
            </optgroup>
          </select>
        </label>
      </div>

      <div class="search__hints">
        <span>试试</span>
        <button v-for="word in suggestions" :key="word" type="button" @click="query = word">
          {{ word }}
        </button>
      </div>

      <div class="search__hints search__hints--pinyin">
        <span>拼音</span>
        <button
          v-for="word in pinyinSuggestions"
          :key="word"
          type="button"
          @click="query = word"
        >
          {{ word }}
        </button>
      </div>

      <div class="search__hints search__hints--tags">
        <span>标签</span>
        <button
          v-for="word in tagSuggestions"
          :key="word"
          type="button"
          :class="{ 'is-active': tag === word }"
          :aria-pressed="tag === word"
          @click="toggleTag(word)"
        >
          {{ word }}
        </button>
      </div>
    </div>

    <p class="search__status" aria-live="polite">
      <template v-if="loading">正在载入索引…</template>
      <template v-else-if="pinyinLoading">正在载入拼音索引…</template>
      <template v-else>
        共 {{ filtered.length }} 首<template v-if="tag !== 'all'"> · 标签「{{ tag }}」</template
        ><template v-if="keyword"> · 关键词「{{ keyword }}」</template>
      </template>
    </p>

    <ul v-if="visible.length" class="search__results">
      <li v-for="poem in visible" :key="poem.slug" class="search__result">
        <a class="search__result-title" :href="withBase('/poems/' + poem.slug)">
          <template v-for="(segment, index) in segmentsOf(poem.title, keyword)" :key="index">
            <mark v-if="segment.match">{{ segment.text }}</mark>
            <template v-else>{{ segment.text }}</template>
          </template>
        </a>
        <p class="search__result-meta">
          <span>{{ poem.dynasty }}代</span>
          <span>{{ poem.author }}</span>
          <span v-if="poem.rhythmic">{{ poem.rhythmic }}</span>
          <span v-else-if="poem.genre">{{ poem.genre }}</span>
        </p>
        <p class="search__result-text">
          <template
            v-for="(segment, index) in segmentsOf(snippetOf(poem, keyword), keyword)"
            :key="index"
          >
            <mark v-if="segment.match">{{ segment.text }}</mark>
            <template v-else>{{ segment.text }}</template>
          </template>
        </p>
      </li>
    </ul>

    <p v-else-if="!loading && !pinyinLoading" class="search__empty">
      没有找到相关诗词，换个关键词（中文或拼音都可以），或清除筛选后再试。
    </p>

    <button
      v-if="filtered.length > visible.length"
      type="button"
      class="search__more"
      @click="limit += 30"
    >
      加载更多（还有 {{ filtered.length - visible.length }} 首）
    </button>
  </section>
</template>
