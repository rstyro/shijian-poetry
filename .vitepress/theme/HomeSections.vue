<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter, withBase } from 'vitepress'
import home from '../../data/home.json'

const router = useRouter()
const dayIndex = ref(0)
const dateLabel = ref('')

onMounted(() => {
  const now = new Date()
  const yearStart = new Date(now.getFullYear(), 0, 0)
  const dayOfYear = Math.floor((now - yearStart) / 86400000)
  dayIndex.value = dayOfYear % home.dailyPool.length
  dateLabel.value = `${now.getMonth() + 1} 月 ${now.getDate()} 日`
})

const daily = computed(() => home.dailyPool[dayIndex.value] || home.dailyPool[0])
const stats = home.stats

const randomPoem = () => {
  const slugs = home.randomSlugs
  router.go('/poems/' + slugs[Math.floor(Math.random() * slugs.length)])
}

const statItems = computed(() => [
  { label: '收录诗词', value: stats.poems },
  { label: '诗人', value: stats.poets },
  { label: '唐诗', value: stats.tang },
  { label: '宋词', value: stats.song },
])
</script>

<template>
  <div class="home-sections">
    <section id="daily" class="home-block">
      <header class="home-block__head">
        <h2 class="home-block__title">每日一诗</h2>
        <span class="home-block__aside">{{ dateLabel }}</span>
      </header>

      <article class="daily-card">
        <div class="daily-card__main">
          <p class="daily-card__meta">{{ daily.dynasty }}代 · {{ daily.author }}</p>
          <h3 class="daily-card__title">{{ daily.title }}</h3>
          <div class="daily-card__lines">
            <p v-for="(line, index) in daily.lines" :key="index">{{ line }}</p>
          </div>
          <div class="daily-card__actions">
            <a class="home-btn home-btn--solid" :href="withBase('/poems/' + daily.slug)">读全诗</a>
            <button type="button" class="home-btn home-btn--ghost" @click="randomPoem">随便读一首</button>
          </div>
        </div>
        <div class="daily-card__side" aria-hidden="true">
          <span class="seal">诗</span>
          <p class="daily-card__side-text">
            {{ stats.poems }} 首诗词<br />
            {{ stats.poets }} 位诗人
          </p>
        </div>
      </article>
    </section>

    <section class="home-block">
      <ul class="stat-strip">
        <li v-for="item in statItems" :key="item.label">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </li>
      </ul>
    </section>

    <section class="home-block">
      <header class="home-block__head">
        <h2 class="home-block__title">按朝代</h2>
      </header>
      <div class="dynasty-grid">
        <a
          v-for="dynasty in home.dynasties"
          :key="dynasty.key"
          class="dynasty-card"
          :href="withBase('/dynasties/' + dynasty.key)"
        >
          <span class="dynasty-card__name">{{ dynasty.title }}</span>
          <span class="dynasty-card__count">{{ dynasty.count }} 首</span>
          <span class="dynasty-card__poets">{{ dynasty.poetCount }} 位诗人</span>
          <span class="dynasty-card__arrow" aria-hidden="true">→</span>
        </a>
      </div>
    </section>

    <section class="home-block">
      <header class="home-block__head">
        <h2 class="home-block__title">热门诗人</h2>
        <a class="home-block__aside home-block__link" :href="withBase('/poets/')">全部诗人</a>
      </header>
      <ul class="poet-chips">
        <li v-for="poet in home.topPoets" :key="poet.slug">
          <a :href="withBase('/poets/' + poet.slug)">
            {{ poet.name }}
            <span>{{ poet.dynasty }} · {{ poet.count }}</span>
          </a>
        </li>
      </ul>
    </section>

    <section class="home-block home-notes">
      <div class="home-note">
        <h3>逐字注音</h3>
        <p>每首诗可一键显示拼音，多音字按上下文标注，读不准时先看注音。</p>
      </div>
      <div class="home-note">
        <h3>浏览器朗读</h3>
        <p>使用系统语音朗读全诗，不加载额外音频，离线也能听。</p>
      </div>
      <div class="home-note">
        <h3>本地收藏</h3>
        <p>收藏保存在当前浏览器，不需要注册账号，也不会上传任何阅读记录。</p>
      </div>
    </section>
  </div>
</template>
