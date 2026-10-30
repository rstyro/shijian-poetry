import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import HomeSections from './HomeSections.vue'
import PoemDetail from './PoemDetail.vue'
import SearchPage from './SearchPage.vue'
import FavoritesPage from './FavoritesPage.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('PoemDetail', PoemDetail)
    app.component('HomeSections', HomeSections)
    app.component('SearchPage', SearchPage)
    app.component('FavoritesPage', FavoritesPage)
  },
} satisfies Theme
