![visual-primitives](assets/visual-primitives-title.png)

<div align="center">

*显式坐标、可检查的图像证据、可复跑的前端复现工作流。*

<img src="https://img.shields.io/badge/version-0.2.0-EB0404?labelColor=181818" alt="Version: 0.2.0">
<img src="https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-181818" alt="platform: Linux | macOS | Windows">
<a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-FDFDFD?labelColor=181818" alt="License: MIT"></a>

<br>
<br>

<a href="#快速开始">快速开始</a> ｜
<a href="#核心思路">核心思路</a> ｜
<a href="#核心特性">功能</a> ｜
<a href="#命令行参考">CLI</a> ｜
<a href="#视觉证据与复现工作流">案例</a> ｜
<a href="#项目结构">结构</a> ｜
<a href="#文档">文档</a>

<a href="README.md">English</a>

</div>

---

`@mapleluvr/visual-primitives` 用一个统一版本的 package 提供：

- 与工作流无关的 `vp`（以及 `visual-primitives`）CLI，将明确给定的框和点转换为可检查的图像证据；
- 六个 Agent Skills，分别覆盖通用视觉证据和前端复现工作流。

需要 Node.js 22.18 或更高版本。系统不需要常驻后台服务或隐藏的会话状态。每个命令都在本地针对提供的图像文件确定性执行，完成单次有界图像处理操作，向 `stdout` 输出结构化 JSON 回执，并立即退出。

> [!IMPORTANT]
> `visual-primitives` 将明确的坐标转换为本地视觉证据工件（`.png` 裁剪图、带标签的预览叠加图、精确颜色采样）。它**不执行**目标检测、OCR、图像分割、自动生成边界框或盲目的 UI 推断。坐标由人类用户或具备推理能力的 Agent 提供，直接的视觉检查始终是解释所有生成工件的权威依据。

## 核心思路

<a id="证据模型"></a>

`visual-primitives` 将空间证据视为严格契约：

1. **归一化 vs 像素坐标**：归一化坐标（`0..999`）提供跨不同视口分辨率的无量纲空间参考；像素坐标提供与硬件缓冲区的 1:1 映射。
2. **确定性解析流水线**：边界框在单次确定性流水线中依次经历缩放、原点转换、边距扩充与边界截断。
3. **截断透明度**：每份回执均透明展示 `resolvedPixelBox`（实际裁剪矩形）与 `unclampedPixelBox`，并包含 `clamped` 布尔标志指明是否发生了边界截断。
4. **快速失败机制**：在 `crop-multi` 中，若任意一个框校验失败或在 `--no-clamp` 下越界，将零写入文件并直接以退出码 `2` 或 `1` 退出。
5. **无隐式状态**：命令不依赖或产生后台文件锁、临时数据库或隐藏会话；输出路径完全由显式配置或确定性算法决定。

## 核心特性

- **基于证据的检查**：根据显式坐标生成像素级精确的裁剪图和预览图，将视觉推理锚定在可验证的图像内容上，减少无依据的判断。
- **纯本地且零后台常驻**：基于 `sharp` 和原生 `libvips` 的独立 CLI；进程内执行，零后台守护进程、零网络请求、即开即用。
- **双坐标空间支持**：支持论文风格的千分位归一化坐标 `0..999`（遵循 *Thinking with Visual Primitives* 论文规范）与直接像素坐标。
- **灵活的坐标几何配置**：支持标准左上原点（`top-left`）或笛卡尔左下原点（`bottom-left`，y 轴向上），支持 `left-top-right-bottom`（`ltrb`）或 `left-bottom-right-top`（`lbrt`）元组。
- **原子级快速失败批量处理**：`vp crop-multi` 单次调用即可批量裁剪多个命名区域；若任意坐标或框体非法，立即干净中止，不产生部分残留文件。
- **CSS 级高精色彩采样**：`vp colors` 支持采样单像素或奇数 $N \times N$ 像素色块，返回 RGB、Hex、OKLab 空间坐标及色块均值统计，辅助精准还原设计样式。
- **跨 Harness 通用的 Agent Skill Set**：提供六个遵循开放 Agent Skills 标准的通用技能（可在各类 Agent Harness 中通用，包括 Pi、Claude Code、Cursor 等），覆盖通用视觉证据提取、Oracle Intake、单 Agent 循环、多子 Agent 编排、反馈综合与最终交付审查。
- **Masked Oracle Diff 引擎**：专用工作流辅助工具，对比 Oracle 参考设计与渲染实现，严格将纯代码绘制区域与获批的非代码图像排除项隔离。
- **双输入模式**：为交互式 Shell 提供符合人体工程学的 CLI flags，同时支持 `--json <file|->` 以便接入机器流水线与自动化脚本。
- **可预测的机器交互契约**：`stdout` 输出版本化 JSON 回执，`stderr` 输出人类可读摘要（可用 `--quiet` 抑制），具备固定退出码（`0` 成功，`1` 运行时/IO 错误，`2` 参数/校验错误）。

## 快速开始

### 环境要求

- Node.js 22.18 或更高版本
- Linux、macOS 或 Windows
- 交互式终端或无头自动化环境
- 可选：支持 Agent Skills 的任意 Coding Agent Harness（如 [Pi](https://github.com/earendil-works/pi)、Claude Code、Cursor 等），用于驱动 Agent 自动化复现

### 安装

#### CLI 安装 (npm)

从 npm 全局安装两个等价的二进制别名（`vp` 与 `visual-primitives`）：

```bash
npm install -g @mapleluvr/visual-primitives
vp --help
visual-primitives --version
```

这两个命令别名完全等价。

#### 在 Pi 中安装 Skill Set

Skills 遵循开放的 Agent Skills 标准，跨各类 Agent Harness 通用。在 Pi 中，可直接通过内置命令安装以启用六个视觉复现与证据 Skills：

```bash
# 安装固定的 npm 版本
pi install npm:@mapleluvr/visual-primitives@0.2.0

# 或安装固定的 Git 发布 tag
pi install git:github.com/mapleluvr/visual-primitives@v0.2.0
```

> [!NOTE]
> Pi package 清单**仅暴露 Skills**，刻意不注册旧版插件工具。由于在某些环境中安装 Pi package 无法保证 npm 二进制进入系统 `PATH`，Agent Skills 会自动通过 `skills/_shared/run-vp.mjs` 调用内置 CLI；人类用户仍可直接使用全局安装的 `vp` 命令。

### 快速上手

创建工作目录，将一张至少 `1440 × 900` 的截图复制为其中的 `screenshot.png`，再运行下面的坐标示例。若使用其他尺寸或布局，先调整框和点；这些坐标不是自动检测结果。

```bash
mkdir vp-demo
cd vp-demo
```

#### 1. 在预览图上标注假设

在原图上绘制带标签的边界框，在得出视觉结论前验证坐标假设：

```bash
vp annotate screenshot.png \
  --box "header:0,0,1440,80:#00aaff" \
  --box "sidebar:0,80,260,900:#ff0055" \
  --box "content:260,80,1440,900" \
  --out preview.png
```

#### 2. 聚焦裁剪单个区域

裁剪精确的矩形边界框，进行高精度的局部视觉检查：

```bash
vp crop screenshot.png --box "40,30,240,180" --out header-card.png
```

使用千分位归一化坐标（0..999）：

```bash
vp crop screenshot.png --box "28,33,167,200" --space normalized-999 --out header-card.png
```

#### 3. 批量裁剪多个区域

单次原子调用裁剪多个带标签区域，输出文件将根据标签确定性命名：

```bash
vp crop-multi screenshot.png \
  --out-dir ./crops \
  --box "logo:20,20,120,60" \
  --box "search-bar:160,20,600,60" \
  --box "user-avatar:1380,20,1420,60"
```

#### 4. 围绕指定兴趣点裁剪

以显式坐标为中心提取正方形或矩形邻域：

```bash
# 使用半径（以 500, 300 为中心裁剪 160x160 正方形）
vp point screenshot.png --point "500,300" --radius 80 --out target-center.png

# 使用显式宽度与高度
vp point screenshot.png --point "500,300" --size 120x80 --out target-rect.png
```

#### 5. 采样 CSS 与 OKLab 颜色

采样精确像素点或色块均值，获取精确 CSS 样式数值：

```bash
vp colors screenshot.png \
  --patch 3 \
  --point "bg:10,10" \
  --point "brand-red:420,280" \
  --point "text-primary:100,50"
```

#### 6. 使用 JSON 输入接入流水线

使用 `--json` 从文件或 `stdin` 传入完整结构化负载：

```bash
vp crop --json crop-spec.json
cat crop-spec.json | vp crop --json -
```

```json
{
  "imagePath": "screenshot.png",
  "box": [40, 30, 240, 180],
  "coordinateSpace": "pixel",
  "outputPath": "header.png"
}
```

### 阅读回执

```bash
vp annotate screenshot.png --box "header:40,30,240,180" --out annotated.png
vp crop screenshot.png --box "40,30,240,180" --out header.png
vp colors screenshot.png --point "header-bg:80,50" --patch 3
```

每个成功执行的命令都会向 `stdout` 写入一份结构化 JSON 回执（摘要信息输出到 `stderr`）：

```json
{
  "imagePath": "/workspace/screenshot.png",
  "outputPath": "/workspace/header.png",
  "source": {
    "width": 1440,
    "height": 900,
    "format": "png"
  },
  "input": {
    "box": [40, 30, 240, 180],
    "coordinateSpace": "pixel",
    "origin": "top-left",
    "boxOrder": "left-top-right-bottom",
    "padding": 0,
    "clamp": true
  },
  "resolvedPixelBox": {
    "left": 40,
    "top": 30,
    "right": 240,
    "bottom": 180,
    "width": 200,
    "height": 150
  },
  "unclampedPixelBox": {
    "left": 40,
    "top": 30,
    "right": 240,
    "bottom": 180,
    "width": 200,
    "height": 150
  },
  "clamped": false
}
```

对于自动化 Agent 或无头流水线，`--json <file|->` 支持通过文件或 `stdin` 传入完整 JSON 负载，保留旧版工具的负载结构并默认使用千分位归一化坐标。

## 命令行参考

| 命令 | 用途 |
| --- | --- |
| `vp crop <image> --box <l,t,r,b> [options]` | 从源图像裁剪一个矩形区域。 |
| `vp crop-multi <image> --box <[label:]l,t,r,b> ...` | 单次原子调用批量裁剪多个带标签区域（快速失败）。 |
| `vp annotate <image> --box <[label:]l,t,r,b[:color]> ...` | 在同尺寸预览图上绘制带标签的边界框与描边。 |
| `vp point <image> --point <x,y> (--radius <n> \| --size <WxH>)` | 围绕显式坐标裁剪矩形或正方形邻域。 |
| `vp colors <image> --point <[label:]x,y> ...` | 采样精确像素或色块均值（RGB、Hex、OKLab、均值统计）。 |

### 通用选项

| 选项 | 取值 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `-i, --image <path>` | 文件路径 | 位置参数 1 | 源图像路径（支持 PNG、JPEG、WebP、AVIF、TIFF、GIF、SVG）。 |
| `-s, --space <space>` | `pixel` \| `normalized-999` | `pixel` | 坐标空间解释（支持 `px`、`999` 别名）。 |
| `--origin <origin>` | `top-left` \| `bottom-left` | `top-left` | 坐标原点（`bottom-left` 表示 y 轴向上增长）。 |
| `--box-order <order>` | `ltrb` \| `lbrt` | `ltrb` | 坐标元组顺序（`left-top-right-bottom` 或 `left-bottom-right-top`）。 |
| `--padding <n>` | 非负整数 | `0` | 在解析后的矩形外周额外扩充的像素外边距。 |
| `--no-clamp` | 标志 | 开启截断 | 超出图像边界的框直接报错，而非截断到图像范围。 |
| `--json <file\|->` | 文件路径或 `-` | 无 | 将完整输入作为 JSON 读取；忽略其他输入 flags。 |
| `--compact` | 标志 | 格式化输出 | 输出紧凑单行 JSON，而非格式化缩进。 |
| `-q, --quiet` | 标志 | 详细输出 | 抑制输出到 `stderr` 的单行人类可读摘要。 |
| `-h, --help` | 标志 | 无 | 显示全局或子命令用法帮助。 |
| `-v, --version` | 标志 | 无 | 显示当前安装的 package 版本。 |

### 退出状态码

| 退出码 | 含义 | 标准输出 (stdout) | 标准错误 (stderr) |
| :---: | --- | --- | --- |
| `0` | 执行成功 | 结构化 JSON 回执 | 单行摘要（除非指定 `--quiet`） |
| `1` | 运行时 / 图像 / IO 错误 | 空 | 详细错误信息 |
| `2` | 用法 / 参数校验错误 | 空 | 帮助提示或 Schema 校验失败信息 |

## 视觉证据与复现工作流

前端页面终究是给人看的，因此这些示例直接呈现对比效果，而非仅仅罗列抽象评分。
以下真实案例均由中端前端模型通过 `frontend-replication` $\rightarrow$ `inline-replication` 工作流单次通过（Single Pass）生成。

优质的还原效果源自对复现闭环的严格执行，而非单纯依赖模型性能。
能够可靠驱动该工作流的标准初始提示词如下：

```text
Replicate the frontend screenshot at <path> (viewport <W>x<H>). Follow the
frontend-replication workflow strictly.

- Match the oracle's exact pixel dimensions in the rendered screenshot.
- Render every code-drawable region in code (CSS/SVG): text, table columns,
  icons, badges, status pills, progress bars, and brand colors.
- Approved exclusions may be represented by placeholders or delegated image assets:
  avatars, album / cover art, organic illustrations, and dense logo marks.
- Keep code-drawable content inside the scoring domain; use exclusions only for
  tightly bounded regions that cannot be described as boxes and paths.
```

### 案例 1：快速且高精度的仪表盘原型复现

Oracle 是一张分析仪表盘设计稿，具有规整的栅格布局：导航侧边栏、顶部 KPI 指标行、两张图表卡片以及最近交易表格。

<p align="center">
  <img alt="仪表盘原型与单次生成渲染图对比" src="docs/visual-primitives/examples/pulse-side-by-side.png" width="100%">
</p>

<p align="center"><em>左：Oracle 原型（<code>1487x1058</code>）。右：单次渲染结果（<code>1487x1058</code>）。</em></p>

面对这种规整清晰的布局，工作流展现出立竿见影的高保真还原度：
- 侧边栏层级、KPI 统计卡片、收入折线区域图、流量环形图以及带有状态胶囊标签的交易表格准确就位。
- 语义化指示色（绿色上涨、红色下跌、琥珀色 Pending 胶囊）均通过 `vp colors` 精确复刻 hex 色值。
- 两者在分辨率尺寸及主要组件对齐上单次即达到像素级匹配。

### 案例 2：高密度真实场景（网易云音乐桌面端截图）

Oracle 是一张真实网易云音乐桌面客户端截图（`1448x940`）——这是一个极具挑战的目标：包含三栏复杂布局、多规格中文排版、徽标体系（`超清母带`、`VIP`）、标志性品牌红、复杂表格列对齐以及悬浮播放进度条。

<p align="center">
  <img alt="网易云音乐真实截图与单次渲染图对比" src="docs/visual-primitives/examples/netease-side-by-side.png" width="100%">
</p>

<p align="center"><em>左：真实客户端截图 Oracle（<code>1448x940</code>）。右：单次渲染结果（<code>1448x940</code>）。完整高分辨率图片可在 <a href="docs/visual-primitives/examples/"><code>docs/visual-primitives/examples/</code></a> 中查看。</em></p>

#### 排除边界 vs 代码绘制评分范围

`visual-primitives` 复现的核心设计准则是划清**代码可描述的结构 UI**与**需委托给图片资源的自然图像**之间的明确界限：

- **委托排除项（Exclusions）**：共有六个区域从代码评分范围中剔除，委托给占位图或资源处理——包括歌单封面图、两个用户头像、两首单曲封面缩略图以及旋转黑胶唱片。
- **纯代码绘制范围**：其余所有内容均严格纳入评分范围——布局骨架、表格列对齐、徽标排版系统、图标形状、搜索框和播放控制栏。

#### 直接检查发现的细节

即便在如此高密度下，单次生成依然保持了极佳的整体结构。通过直接视觉检查，仅发现几处细微局限：
1. **网易云 Logo 图标**：渲染代码使用粗略的 SVG 曲线进行拟合，而非完全一致的专有矢量曲率。
2. **进度条滑块**：红色圆点微偏于红/灰分界线上方约 2 像素，未完全居中。
3. **部分图标字重**：个别导航图标与原图相差一个字重等级。

视觉证据工具（`vp annotate`、`vp crop`、`masked-oracle-diff`）能够精准定位这些细小偏差，为下一轮迭代微调提供确定性依据。

## Skill Set

本 package 包含六个遵循开放 Agent Skills 标准的通用 Skills，可在各类 Coding Agent Harness（如 Pi、Claude Code、Cursor 以及自定义 Agent 系统）中通用：

| Skill | 定位 | 主要用途 |
| --- | --- | --- |
| `using-visual-primitives` | 通用基元指南 | 核心工具选型、坐标系选择、预览标注与直接视觉检查。 |
| `frontend-replication` | 复现总入口 | Oracle Intake、Run 工作区初始化、Manifest 配置与流程路由。 |
| `inline-replication` | 单 Agent 复现循环 | 针对中小页面的单 Agent 端到端复现。 |
| `subagent-driven-replication` | 多子 Agent 编排 | 高精度复杂页面复现，分工编排 Worker 与 Reviewer。 |
| `refining-with-feedback` | 迭代修正闭环 | 综合历史 Draft、未通过项与 Diff Verdict，生成针对性修复方案。 |
| `finalizing-replication` | 最终质检关卡 | 组织最终直接人工视觉检查与面向用户的交付审查。 |

### 内置启动器

在 Agent 执行环境中，Skills 通过跨平台的内置启动器调用 CLI：

```bash
node <skills-dir>/_shared/run-vp.mjs <command> [options]
```

这确保了即使宿主环境未将 npm 全局目录配置到 `PATH` 中，Agent 也能稳定无缝执行 CLI。

## 前端工作流 Helper：`masked-oracle-diff`

`masked-oracle-diff` 归 `frontend-replication` 工作流所有。它不是 `vp` 子命令，不是 npm binary，不是通用 core export，也不属于 `using-visual-primitives` 的职责。

加载 replication Skill 后，相对于已加载的 `frontend-replication` Skill 目录解析 `scripts/run-masked-oracle-diff.mjs`，再从 consumer project 调用这个 package-local runner：

```bash
node <frontend-replication-skill-dir>/scripts/run-masked-oracle-diff.mjs \
  --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

*(在当前仓库进行维护开发时，亦可运行 `npm run oracle:diff -- --manifest <path>`。)*

### 生成的工件

Helper 会在运行工作区中生成全套诊断证据：
- `diff.gray.png`：视觉差异热力图，高亮渲染偏差。
- `mask.png`：二值化掩码图，确认参评与排除区域。
- `matrix.json`：$25 \times 25$ 空间误差分布网格。
- `components/` 与 `stripes/`：按组件与横向条带细分的局部 Diff 证据。
- `summary.json`：汇总 Diff 指标与通过/未通过阈值。
- `VERDICT.md`：供人类与 Agent 阅读的最终判定总结报告。

> [!NOTE]
> 干净的 Diff 分数仅代表可以开启最终直接视觉检查；它**不能单独等同于交付验收**。直接视觉检查是不可逾越的最终防线。

## 项目结构

```text
visual-primitives/
├── src/                 # CLI、schema、裁剪和颜色处理
├── skills/              # 六个 Agent Skills
│   ├── _shared/         # 包内 CLI 启动器
│   └── frontend-replication/scripts/ # Masked Oracle Diff
├── scripts/             # 构建、打包冒烟和发布检查
├── tests/               # 合成图像与 CLI 合同测试
├── docs/                # 设计、真实案例和工作流记录
└── assets/              # README 标题图
```

## 复现运行工作区

复现工作流在标准化的目录结构下组织持久化工件：

```text
docs/visual-primitives/runs/<run-id>/
  oracles/       # 原始参考图、资源清单与 oracle-manifest.json
  annots/        # 由 vp annotate 生成的标注预览图
  cropped/       # 由 vp crop 与 vp crop-multi 提取的局部区域图
  rendered/      # 浏览器渲染截屏
  diffs/         # Masked Oracle Diff 热力图、矩阵与汇总
  drafts/        # 渐进式代码实现与 Draft Manifest
  verdict/       # 自动化验证生成的流程反馈判定
  scripts/       # 运行专属的截图与配置脚本
  final/         # 最终直接视觉检查记录与交付审查工件
```

## 支持范围

| 能力 | 当前边界 |
| --- | --- |
| 本地图像处理 | Node.js ≥22.18；Linux / macOS / Windows |
| 坐标来源 | 人或 Agent 明确给出；不做目标检测、OCR 或自动分割 |
| Pi 集成 | 只加载 Skills，不注册旧版原生 extension tools |
| Masked Oracle Diff | 属于前端复现工作流，不是 `vp` 子命令 |
| 分数与验收 | Diff 只提供诊断信号，最终仍需直接视觉检查 |
| 运行状态 | 无守护进程、无隐藏延续会话；按指定路径生成工件 |

## 版本策略

CLI 与 Skill Set 使用一个 package 版本和一个 Git tag。Package `X.Y.Z` 对应 tag `vX.Y.Z`。命令名、JSON 输入语义、退出码、已文档化的 Skill 资源和 helper 归属都属于受保护兼容契约。

## 从 `pi-visual-primitives` 迁移

版本 `0.2.0` 相较于旧版 `pi-visual-primitives` 完成了全面的架构重构：

1. **独立 CLI 架构**：旧版 TypeScript Extension Tools（`crop_bounding_box`、`sample_colors`）全面替换为高性能的 `vp` CLI 二进制。
2. **纯 Skills Pi Package**：Pi Package 清单仅加载 Skills，不再注册原生扩展工具。
3. **命令映射关系**：
   - `crop_bounding_box` $\rightarrow$ `vp crop`
   - `crop_multiple_bounding_boxes` $\rightarrow$ `vp crop-multi`
   - `annotate_bounding_boxes` $\rightarrow$ `vp annotate`
   - `crop_around_point` $\rightarrow$ `vp point`
   - `sample_colors` $\rightarrow$ `vp colors`
4. **运行环境去偶**：Agent 统一通过 `skills/_shared/run-vp.mjs` 调用，无需预先配置系统环境变量。
5. **职责边界收敛**：`masked-oracle-diff` 明确归属于 `frontend-replication`，不再污染通用基元工具集。

## 文档

- [架构设计与发布意图](docs/superpowers/work/vp-cli-skill-set-release/intent.md)
- [单 Package 架构决策 (ADR 0001)](docs/superpowers/work/vp-cli-skill-set-release/decisions/0001-single-package-architecture.md)
- [Package 与 CLI 边界契约](docs/superpowers/work/vp-cli-skill-set-release/contracts/package-and-cli-contract.md)
- [Skill Set 闭环强化审查](docs/skill-set-loop-review.md)
- [AIGC Oracle 前端复现规格说明](docs/superpowers/specs/2026-07-01-aigc-oracle-web-reproduction-devskillpack-design.md)
- [一致性审查报告](docs/conformance-review.md)
- [版本发布操作手册](RELEASE.md)
- [变更日志](CHANGELOG.md)

## 开发与验证

```bash
# 安装依赖
npm ci --ignore-scripts

# 类型检查与语法构建校验
npm run check

# 执行单元与集成测试
npm test

# 执行 Package 冒烟测试（构建真实 tarball，验证 CLI、全套 6 个 Skills 及启动器）
npm run package:smoke

# 安全审计
npm audit --audit-level=high
```

所有测试套件均通过 `sharp.create()` 在内存中动态生成合成测试图片，保持仓库轻量无冗余二进制文件。

CI 流水线在 Ubuntu、macOS 与 Windows 上对 Node 22.18.0 及 Node 24.x 持续运行。
版本发布严格受 Git Tag 门禁控制，并采用具备密码学真实性证明的 npm Trusted Publishing。

## 安全模型与证据边界

- **严格的 Schema 准入**：CLI 严格拒绝未知的 JSON 属性、非有限坐标值、越界枚举与冲突选项。
- **失败闭合机制**：遇到损坏的图像头、不可读文件或畸形坐标时，立即终止并返回清晰的诊断信息。
- **本地图像处理**：图像计算通过原生库完成，不进行 Shell 变量展开或动态脚本执行；这不等于通用安全沙箱。

## 许可证

基于 [MIT 许可证](LICENSE) 发布。

---

<div align="center">

**明确坐标，保留证据，亲眼检查。**

</div>
