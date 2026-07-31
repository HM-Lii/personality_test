# 未见 · 历史人格原型

一个公开计分逻辑的本地人格测试原型，以五维情境照见你在历史中的身影：

- 25 道核心情境题；
- 根据候选接近程度追加 0–3 道自适应辨析题；
- 五因素连续人格轮廓；
- 中国历史人物叙事原型（展示数量由人物库 `FIGURES.length` 动态生成）；
- 每位人物至少两条可追溯的关键维度证据链，包含史事、来源、可信度与争议；
- 比较第一、第二候选人的实际距离贡献，解释胜出维度与相关回答；
- 展示与第一名差距最大的维度，明确人格轮廓相似不等于能力、经历或立场相同；
- 全部数据保存在浏览器本地，不上传答案。

## 运行

需要 Node.js 18 或更高版本。

```powershell
npm start
```

打开 <http://127.0.0.1:4173>。

## 校验

```powershell
npm test
npm run test:coverage
npm run validate
```

人物证据链由 `npm run build:evidence` 生成，结构与来源标准见
[docs/figure-evidence-methodology.md](./docs/figure-evidence-methodology.md)。

人物校验会穷举25道核心题能够产生的1,048,576种五维分数组合，并运行200,000组正态模拟。
覆盖率命令要求核心计分与状态机达到100%行覆盖、100%函数覆盖和至少98%分支覆盖。

## 字体子集

全站展示衬线（标题、人名、印章、雷达分值等）使用自托管的 Noto Serif SC 子集，
保证各平台标题表现一致。子集由 `npm run build:font` 生成，从仓库源码中收集所有
可能以衬线渲染的字符（页面模板、数据 JSON、UI 文案、CSS），生成 woff2 子集。

```powershell
pip install fonttools brotli   # 一次性安装依赖
npm run build:font             # 生成 fonts/NotoSerifSC-subset.woff2
```

源字体缓存于 `fonts/.source/`（已 gitignore），重复构建不重复下载。
新增含中文的数据后需重新运行 `npm run build:font` 以更新子集覆盖。

## 目录结构

```text
app.js                 # 浏览器入口（转发到 src/ui/main.mjs）
index.html             # 静态页面壳
styles.css             # 样式入口（@import styles/*.css）
styles/                # 按页面/功能拆分的样式模块
  base.css             # 变量、重置、@font-face、全局元素
  topbar.css           # 顶栏导航
  home.css             # 首页 Hero
  seal-track.css       # 印章轨道
  quiz.css             # 答题页
  result.css           # 结果页 + 雷达图
  report-card.css      # 报告卡片（维度条、证据、对比、邻近、实验）
  scoring-modal.css    # 计分说明弹窗
  footer.css           # 页脚
  toast.css            # Toast 通知
  responsive.css       # 响应式断点
  ink-particles.css    # 浮动墨点
  animations.css       # 关键帧动画
  effects.css          # 印章效果、光影、渲染优化

src/
  core/                # 纯逻辑：计分、会话状态、结果组装
    scoring.mjs
    session.mjs
    result.mjs
  data/                # 题库、人物库、文案与索引
    questions.mjs
    figures.mjs
    dimension-copy.mjs
    catalog.mjs
    dimensions.mjs
    generated/         # 构建产物：figure-evidence.json、figures-rationale.json
  ui/                  # 浏览器 UI：渲染、存储、事件
    main.mjs
    app-state.mjs
    bootstrap.mjs
    reveal.mjs
    toast.mjs
    view-router.mjs
    quiz-controller.mjs
    keyboard.mjs
    storage.mjs
    utils.mjs
    radar.mjs
    render-home.mjs
    render-quiz.mjs
    render-result.mjs
    result/            # 结果页视图模型与分区渲染
      view-model.mjs
      sections/        # 9 个片段模块，签名统一为 (vm) => string
        hero.mjs
        profile.mjs
        interpretation.mjs
        why-figure.mjs
        answer-evidence.mjs
        contrast.mjs
        nearby.mjs
        historical-evidence.mjs
        experiments.mjs
    share.mjs
    share-card.mjs
    share-page.mjs

scripts/               # 本地服务、校验、构建脚本
  lib/                 # 脚本共享库
    thresholds.mjs     # 校验阈值常量
    simulation.mjs     # 模拟原语
    csv.mjs            # CSV 解析
    report.mjs         # 报告格式化
  data/                # 构建脚本的源数据
    evidence-source.mjs
    rationale-source.mjs
test/                  # 单元与流程测试
  golden/              # 渲染快照
docs/                  # 阶段 A 等设计文档
fonts/                 # 自托管字体子集
```

## 重要说明

历史人物仅作为大众文化形象中的性格隐喻，并非对人物真实心理的学术结论。本项目是结构化娱乐测试，不是临床心理量表。

完整逻辑见 [TEST_LOGIC.md](./TEST_LOGIC.md)。零样本理论优化计划见 [docs/PHASE_A.md](./docs/PHASE_A.md)。
