<script setup>
import { computed, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const FAV_KEY = 'shijian-favorites'

const ids = ref([])
const poems = ref([])
const loading = ref(true)

const readFavorites = () => {
  try {
    const value = JSON.parse(localStorage.getItem(FAV_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const favorites = computed(() => {
  const byId = new Map(poems.value.map((poem) => [poem.id, poem]))
  return ids.value.map((id) => byId.get(id)).filter(Boolean)
})

const snippetOf = (poem) => poem.text.split('\n').slice(0, 2).join(' ')

const remove = (id) => {
  ids.value = ids.value.filter((item) => item !== id)
  localStorage.setItem(FAV_KEY, JSON.stringify(ids.value))
}

onMounted(async () => {
  ids.value = readFavorites()
  const module = await import('../../data/search.json')
  poems.value = module.default
  loading.value = false
})
</script>

<template>
  <section class="favorites">
    <header class="favorites__head">
      <h1 class="favorites__title">收藏</h1>
      <p class="favorites__intro">被你收起的诗词，按收藏时间倒序排列。</p>
    </header>

    <p class="favorites__status" aria-live="polite">
      <template v-if="loading">正在载入收藏…</template>
      <template v-else>共 {{ favorites.length }} 首</template>
    </p>

    <ul v-if="favorites.length" class="favorites__list">
      <li v-for="poem in favorites" :key="poem.id" class="favorites__item">
        <div class="favorites__body">
          <a class="favorites__item-title" :href="withBase('/poems/' + poem.slug)">
            {{ poem.title }}
          </a>
          <p class="favorites__meta">
            <span>{{ poem.dynasty }}代</span>
            <span>{{ poem.author }}</span>
            <span v-if="poem.rhythmic">{{ poem.rhythmic }}</span>
            <span v-else-if="poem.genre">{{ poem.genre }}</span>
          </p>
          <p class="favorites__text">{{ snippetOf(poem) }}</p>
        </div>
        <button type="button" class="favorites__remove" @click="remove(poem.id)">移除</button>
      </li>
    </ul>

    <div v-else-if="!loading" class="favorites__empty">
      <p class="favorites__empty-title">还没有收藏的诗词。</p>
      <p class="favorites__empty-hint">在诗词详情页点击「收藏」，喜欢的句子就会留在这里。</p>
      <div class="favorites__cta">
        <a :href="withBase('/search')">去检索</a>
        <a :href="withBase('/')">回首页</a>
      </div>
    </div>
  </section>
</template>
