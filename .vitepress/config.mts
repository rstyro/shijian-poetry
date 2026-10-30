import { defineConfig } from 'vitepress'

const siteName = '诗笺'
const siteDescription = '唐诗宋词三百首，逐字注音、译文注释、朗读、检索与收藏'
const homeTitle = '诗笺 · 诗成笺上，韵在行间'
const siteUrl = (process.env.SITE_URL || '').replace(/\/+$/, '')
const base = siteUrl ? `${new URL(siteUrl).pathname.replace(/\/+$/, '')}/` : '/'

const pagePath = (relativePath) => {
  const clean = relativePath.replace(/index\.md$/, '').replace(/\.md$/, '')
  return `/${clean.replace(/^\/+/, '')}`
}

const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: siteUrl + item.path,
  })),
})

export default defineConfig({
  lang: 'zh-CN',
  title: siteName,
  titleTemplate: ':title | 诗笺',
  description: siteDescription,
  base,
  cleanUrls: true,
  srcExclude: ['README.md'],
  // VitePress 运行时支持 light 初始值，类型声明只写了 dark
  // @ts-expect-error
  appearance: { initialValue: 'light' },
  base: '/shijian-poetry/',
  sitemap: siteUrl
    ? {
        hostname: siteUrl,
        transformItems: (items) => items.filter((item) => !/^favorites\/?$/.test(item.url)),
      }
    : undefined,
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}seal.svg` }],
    ['meta', { name: 'theme-color', content: '#f7f2e7' }],
    ['meta', { name: 'author', content: siteName }],
    ['meta', { property: 'og:site_name', content: siteName }],
  ],
  transformHead({ pageData }) {
    const fm = pageData.frontmatter || {}
    const path = pagePath(pageData.relativePath)
    const isHome = path === '/'
    const title = isHome ? homeTitle : `${pageData.title || siteName} | ${siteName}`
    const description = fm.description || siteDescription
    const url = siteUrl ? siteUrl + path : ''
    const image = siteUrl ? `${siteUrl}/og.png` : ''
    const head = []

    if (fm.pageClass === 'favorites-page') {
      head.push(['meta', { name: 'robots', content: 'noindex,follow' }])
    } else {
      head.push(['meta', { name: 'robots', content: 'index,follow,max-image-preview:large' }])
    }

    head.push(
      ['meta', { property: 'og:type', content: fm.poem ? 'article' : 'website' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    )

    if (url) {
      head.push(
        ['link', { rel: 'canonical', href: url }],
        ['meta', { property: 'og:url', content: url }],
      )
    }

    if (image) {
      head.push(
        ['meta', { property: 'og:image', content: image }],
        ['meta', { property: 'og:image:width', content: '1200' }],
        ['meta', { property: 'og:image:height', content: '630' }],
        ['meta', { property: 'og:image:alt', content: homeTitle }],
        ['meta', { name: 'twitter:image', content: image }],
      )
    }

    if (fm.poem) {
      head.push([
        'meta',
        { property: 'article:section', content: fm.poem.dynasty === '唐' ? '唐诗' : '宋词' },
      ])
    }

    const graph = []

    if (isHome) {
      const website = {
        '@type': 'WebSite',
        name: siteName,
        alternateName: '诗笺 · 唐诗宋词三百首',
        description: siteDescription,
        inLanguage: 'zh-CN',
      }
      if (siteUrl) {
        website.url = `${siteUrl}/`
        website['@id'] = `${siteUrl}/#website`
        website.potentialAction = {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${siteUrl}/search?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        }
      }
      graph.push(website)
    }

    if (fm.poem) {
      const poem = fm.poem
      const labels = poem.labels ? Object.values(poem.labels).flat().filter(Boolean) : []
      const poemData = {
        '@type': 'Poem',
        name: poem.title,
        headline: poem.title,
        description,
        inLanguage: 'zh-CN',
        author: {
          '@type': 'Person',
          name: poem.author,
          ...(siteUrl ? { url: `${siteUrl}/poets/${poem.authorSlug}` } : {}),
        },
        isPartOf: {
          '@type': 'Collection',
          name: poem.dynasty === '唐' ? '唐诗三百首' : '宋词三百首',
        },
        text: poem.lines.map((line) => line.text).join('\n'),
        ...(labels.length ? { keywords: labels.join(',') } : {}),
        ...(poem.genre || poem.rhythmic
          ? { genre: [...new Set([poem.genre, poem.rhythmic].filter(Boolean))] }
          : {}),
        ...(url ? { url } : {}),
      }
      graph.push(poemData)

      if (siteUrl) {
        graph.push(
          breadcrumb([
            { name: '首页', path: '/' },
            {
              name: poem.dynasty === '唐' ? '唐诗' : '宋词',
              path: `/dynasties/${poem.dynasty === '唐' ? 'tang' : 'song'}`,
            },
            { name: poem.author, path: `/poets/${poem.authorSlug}` },
            { name: poem.title, path },
          ]),
        )
      }
    } else if (fm.poet) {
      graph.push({
        '@type': 'Person',
        name: fm.poet.name,
        description,
        inLanguage: 'zh-CN',
        ...(url ? { url } : {}),
      })
      if (siteUrl) {
        graph.push(
          breadcrumb([
            { name: '首页', path: '/' },
            { name: '诗人', path: '/poets/' },
            { name: fm.poet.name, path },
          ]),
        )
      }
    } else if (fm.dynasty && siteUrl) {
      graph.push(
        breadcrumb([
          { name: '首页', path: '/' },
          { name: fm.dynasty.title, path },
        ]),
      )
    } else if (siteUrl && (path === '/poets/' || path === '/search')) {
      graph.push(
        breadcrumb([
          { name: '首页', path: '/' },
          { name: path === '/poets/' ? '诗人' : '检索', path },
        ]),
      )
    }

    if (graph.length) {
      head.push([
        'script',
        { type: 'application/ld+json' },
        JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(
          /</g,
          '\\u003c',
        ),
      ])
    }

    return head
  },
  themeConfig: {
    logo: '/seal.svg',
    siteTitle: '诗笺',
    nav: [
      { text: '首页', link: '/' },
      { text: '唐诗', link: '/dynasties/tang' },
      { text: '宋词', link: '/dynasties/song' },
      { text: '诗人', link: '/poets/' },
      { text: '检索', link: '/search' },
      { text: '收藏', link: '/favorites' },
    ],
    footer: {
      message: '诗成笺上，韵在行间',
      copyright: `Copyright © ${new Date().getFullYear()} <a href="https://github.com/rstyro">rstyro</a> · 数据来自 chinese-poetry`,
    },
    docFooter: { prev: false, next: false },
    outline: false,
    darkModeSwitchLabel: '外观',
    lightModeSwitchTitle: '切换到浅色',
    darkModeSwitchTitle: '切换到深色',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    lastUpdated: false,
  },
})
