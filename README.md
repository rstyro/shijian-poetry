# 诗笺

> 诗成笺上，韵在行间。

「诗笺」是一个静态的古典诗词阅读站点，基于 VitePress 构建。收录唐诗 336 首、宋词 280 首，共 616 首作品、165 位诗人与词人。每首作品提供逐字注音、译文注释、四维标签、浏览器朗读、分享卡片与本地收藏，检索支持中文关键词及拼音全拼、首字母。

## 功能一览

- **首页**：每日一诗（唐、宋作品交替候选）、随便读一首、收录统计、朝代入口、热门诗人。
- **作品详情**：原文、逐字拼音（可整体开关，也可点按单字查看）、译文、注释、朗读、收藏、分享卡片、同诗人/同标签延伸阅读。
- **检索**：按标题、作者、词牌、正文、标签匹配；支持拼音全拼与首字母；可按朝代、诗人、体裁、标签筛选。
- **收藏**：保存在浏览器 `localStorage`，无账号、无后端，最多保留 300 首。
- **索引页**：诗人总览、诗人详情、唐诗/宋词分朝代索引。
- **SEO**：canonical、Open Graph/Twitter Card、JSON-LD（WebSite / Poem / Person / BreadcrumbList）、sitemap、robots。
- **主题**：默认暖宣纸亮色，可在浅色与深色之间切换。

## 技术栈

| 用途 | 方案 |
| --- | --- |
| 站点框架 | VitePress 1.6 + Vue 3.5 |
| 注音 | pinyin-pro |
| 繁简转换 | opencc-js |
| 数据来源 | [chinese-poetry](https://github.com/chinese-poetry/chinese-poetry) |
| 检索索引 | 构建期生成 JSON，检索页按需加载 |
| 运行环境 | Node.js 18+（开发环境使用 Node 24） |

## 快速开始

```bash
npm install

# 生成内容并启动开发服务器
npm run docs:dev

# 仅重新生成诗词页、诗人页、朝代页与索引数据
npm run content

# 生成静态站点（输出到 .vitepress/dist）
npm run docs:build

# 预览已构建的站点
npm run docs:preview
```

端口被占用时可追加参数，无需结束已有进程：

```bash
npm run docs:preview -- --port 4200
```

指定站点域名后再构建，才会输出 canonical、OG URL 与 sitemap：

```bash
SITE_URL=https://example.com npm run docs:build
```

PowerShell：

```powershell
$env:SITE_URL = "https://example.com"; npm run docs:build
```

## 目录结构

```text
.
├─ data/
│  ├─ source/                    # chinese-poetry 原始数据（繁体，提交）
│  │  ├─ tangshi.json
│  │  └─ songci.json
│  ├─ curation/                  # 人工维护的标注与校订（提交）
│  │  ├─ taxonomy.json           # 四维标签词表
│  │  ├─ tags.json               # 616 首标签
│  │  ├─ annotations.json        # 616 首译文与注释
│  │  └─ pinyin-overrides.json   # 多音字校订规则
│  ├─ home.json                  # 构建产物（忽略）
│  ├─ search.json                # 构建产物（忽略）
│  └─ search-pinyin.json         # 构建产物（忽略）
├─ scripts/
│  └─ build-content.mjs          # 内容构建脚本
├─ .vitepress/
│  ├─ config.mts                 # 站点、导航、SEO、主题配置
│  └─ theme/                     # 自定义主题与四个页面组件
├─ public/                       # favicon、og.png、robots.txt
├─ poems/                        # 构建产物（忽略）
├─ poets/                        # 构建产物（忽略）
├─ dynasties/                    # 构建产物（忽略）
├─ index.md                      # 首页
├─ search.md                     # 检索页
├─ favorites.md                  # 收藏页
└─ package.json
```

## 构建流程

`scripts/build-content.mjs` 负责把原始数据与人工标注合成为可渲染的页面和索引：

1. **清洗**：繁体转简体（OpenCC `t` → `cn`），合并空白，去除标题中的乐府曲辞前缀。
2. **去重**：按正文（忽略标点）去重，同作者、同题且正文相似度 ≥ 0.85 的异文只保留更完整的版本。
3. **注音**：使用 pinyin-pro 逐字注音，再应用 `pinyin-overrides.json` 中的校订规则。
4. **聚合**：生成诗人、朝代、同诗人/同标签推荐、每日一诗池与首页统计。
5. **产出**：生成 `poems/*.md`、`poets/*.md`、`dynasties/*.md` 以及 `data/home.json`、`data/search.json`、`data/search-pinyin.json`。
6. **校验**：标签必须命中词表；译文与注释不能为空；标注、拼音规则中未匹配到作品的条目会在构建结束时输出警告。

构建成功后终端会打印覆盖情况，例如：

```text
内容构建完成：唐诗 336 首 / 宋词 280 首 / 诗人 165 位 / 每日一诗池 24 首 / 标签覆盖 616 首 / 译文覆盖 616 首
```

标签词表分为四个维度：题材（17）、情绪（19）、场景（15）、时令（8）。标签、译文注释与拼音校订均按作品 slug 建立索引。

## 拼音注音与校订

pinyin-pro 无法覆盖全部多音字，因此 `data/curation/pinyin-overrides.json` 提供两级覆盖：

```json
{
  "charDefaults": [
    {
      "char": "应",
      "reading": "yīng",
      "exceptions": [{ "line": "遥知兄弟登高处，遍插茱萸少一人。", "reading": "yìng" }]
    }
  ],
  "lineRules": [
    {
      "line": "曲罢曾教善才服，妆成每被秋娘妒。",
      "fixes": [{ "char": "曲", "occurrence": 1, "reading": "qǔ" }]
    }
  ]
}
```

- `charDefaults`：为常用多音字指定全局默认读音，并允许按整行设置例外。
- `lineRules`：按整行、按第 N 次出现定位单字，用于默认规则覆盖不到的上下文。
- 行规则定位失败会直接中断构建；未被任何作品命中的规则会在构建结束时给出警告，便于清理过期配置。

目前已累计校订 421 处读音，包含 11 条单字默认规则与 187 条行规则。拼音仅作阅读辅助，不作为学术依据。

## 拼音检索

检索页对中文与拼音查询采用不同索引：

- 中文关键词使用随站点构建的 `data/search.json`，匹配标题、作者、词牌、正文与标签。
- 纯字母查询（至少 2 个字符）会按需加载 `data/search-pinyin.json`，支持全拼与首字母，例如 `jingyesi`、`jys`、`sushi`、`chuangqiankanyueguang`。
- 全拼与首字母均忽略声调，`ü`、`v` 统一按 `u` 处理。
- 为减少噪声，标题与词牌的首字母只接受完全匹配或前缀匹配；正文首字母仅在关键词不少于 4 个字符时参与匹配。

拼音索引是独立懒加载 chunk，中文检索不会加载它。检索页同时支持 `?q=` 深链。

## 收藏与本地数据

站点没有后端，以下状态只保存在当前浏览器：

| 键 | 用途 |
| --- | --- |
| `shijian-favorites` | 收藏的作品 id 列表 |
| `shijian-pinyin` | 拼音显示开关 |
| `shijian-vertical` | 竖排显示开关 |

分享卡片由 Canvas 在浏览器端绘制，可下载为 PNG 或复制当前链接。

## 页面路由

| 路径 | 页面 |
| --- | --- |
| `/` | 首页与每日一诗 |
| `/poems/<slug>` | 作品详情 |
| `/poets/`、`/poets/<slug>` | 诗人索引与诗人详情 |
| `/dynasties/tang`、`/dynasties/song` | 唐诗、宋词索引 |
| `/search` | 检索 |
| `/favorites` | 收藏（`noindex`，robots 中禁止抓取） |

## SEO 与部署

- 设置环境变量 `SITE_URL` 后，构建期会生成 canonical、`og:url`、绝对图片地址与 `sitemap.xml`；未设置时这些绝对地址会被省略。
- 首页输出 WebSite 结构化数据与站内搜索 Action，作品页输出 Poem + 面包屑，诗人页输出 Person。
- 构建产物为纯静态文件，位于 `.vitepress/dist`，可直接部署到任意静态托管服务；站点启用 `cleanUrls`。
- `public/robots.txt` 允许抓取全站，仅排除 `/favorites`。

## 数据与许可

- 代码以 [MIT License](./LICENSE) 发布。
- 诗词原文来自 chinese-poetry 项目，版权归原作者与整理者所有。
- 拼音由 pinyin-pro 生成并结合人工规则校订，仅供参考。

## 已知取舍

- 宋词标题采用「词牌·首句」形式，同词牌作品较多，跨作者检索时以词牌匹配为主。
- 每日一诗按词牌取首个匹配作品，个别词牌可能不是最广为流传的版本。
- 收藏、显示偏好均局限于当前浏览器，不跨设备同步。
- 原站为静态站点，检索在浏览器内完成；数据量大幅增长时需要重新评估索引体积与加载策略。
