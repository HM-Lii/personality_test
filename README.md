# 人物志 · 历史人格镜

一个公开计分逻辑的本地人格测试原型，以五维情境照见你在历史中的身影：

- 25 道核心情境题；
- 根据候选接近程度追加 0–3 道自适应辨析题；
- 五因素连续人格轮廓；
- 57 位中国历史人物叙事原型；
- 支持双原型与回答证据解释；
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

人物校验会穷举25道核心题能够产生的1,048,576种五维分数组合，并运行200,000组正态模拟。
覆盖率命令要求核心计分与状态机达到100%行覆盖、100%函数覆盖和至少98%分支覆盖。

## 目录结构

```text
app.js                 # 浏览器入口（转发到 src/ui/main.mjs）
index.html             # 静态页面壳
styles.css             # 样式

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
  ui/                  # 浏览器 UI：渲染、存储、事件
    main.mjs
    storage.mjs
    utils.mjs
    radar.mjs
    render-home.mjs
    render-quiz.mjs
    render-result.mjs
    share.mjs

scripts/               # 本地服务与题库/人物校验
test/                  # 单元与流程测试
docs/                  # 阶段 A 等设计文档
```

## 重要说明

历史人物仅作为大众文化形象中的性格隐喻，并非对人物真实心理的学术结论。本项目是结构化娱乐测试，不是临床心理量表。

完整逻辑见 [TEST_LOGIC.md](./TEST_LOGIC.md)。零样本理论优化计划见 [docs/PHASE_A.md](./docs/PHASE_A.md)。
