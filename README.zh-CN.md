# Pi Visual Primitives

[English](README.md)

Pi Visual Primitives 是一个 Pi 扩展包，为 Agent 提供视觉证据工作流辅助工具。适用场景包括图片、截图、渲染 UI、参考设计、视觉效果、前端视觉复现、视觉对比和视觉 QA，只要任务需要从视觉外观中得出结论，就可以使用它。

视觉证据需求会触发这个包。坐标可以由用户提供，也可以由 Agent 在证据工作流中选择或估计；随后这些坐标会被转换成本地裁剪图、标注图、点裁剪图和颜色采样结果，供 Agent 直接查看、复用和推理。

这个设计受到 “Thinking with Visual Primitives” 思路启发：点和 bounding box 可以作为视觉推理中的具体空间参照。检测、OCR、分割、自动生成 box、自动推断 UI 元素等能力留在工具契约之外；本包负责把用户提供或 Agent 估计的区域转换成可检查的本地证据产物。

## 功能

- 为截图分析、前端视觉复现、视觉对比和视觉 QA 创建视觉证据产物。
- 标注或裁剪 header、card、sidebar、form、button、chart、footer 等 UI 区域。
- 从本地图片裁剪一个 bounding box。
- 从同一张图片批量裁剪多个 box，并生成确定性的输出文件名。
- 创建和原图同尺寸的标注预览图，带 box 边框和可选 label。
- 围绕明确的点进行裁剪，必须提供 radius 或 width/height。
- 使用 `sample_colors` 在指定点采样精确颜色，支持 CSS 级颜色精度。
- 支持论文风格的 `0-999` 归一化坐标。
- 支持直接像素坐标。
- 支持 top-left 和 bottom-left 坐标原点。
- 支持 `[left, top, right, bottom]` 和 `[left, bottom, right, top]` 两种 box 顺序。
- 支持可选 padding。
- 支持可选边界 clamp。
- 返回包含 source dimensions 和 resolved pixel box 的结构化 metadata。

## 安装

从仓库 checkout 安装依赖：

```bash
cd pi-visual-primitives
npm install
```

在 Pi 中临时使用：

```bash
pi -e ./pi-visual-primitives
```

作为 Pi package 安装，让 Pi 同时加载扩展工具和 Skill：

```bash
pi install ./pi-visual-primitives
```

然后在 Pi 中运行 `/reload`。

## 技能集

本包在 `skills/` 下提供一组 Pi Skill：

- `skills/using-visual-primitives/SKILL.md`：通用视觉证据工作，包括标记、裁剪、对比、对齐和分析图像。
- `skills/frontend-replication/SKILL.md`：基于 oracle 图片的前端复现入口 skill。
- `skills/inline-replication/SKILL.md`：由父 Agent 自行执行的复现循环。
- `skills/subagent-driven-replication/SKILL.md`：由 Orchestrator 编排 subagent 的复现循环。该路线可使用 `pi-subagents`、`subagent-driven-development` 和 superpowers workflow；如果环境不可用，则使用 `inline-replication`。
- `skills/refining-with-feedback/SKILL.md`：把过程性 verdict 转换为下一轮 feedback draft。
- `skills/finalizing-replication/SKILL.md`：最终直接检查和交付审查。

独立视觉证据任务使用 `using-visual-primitives`；截图 oracle 驱动的网页复现使用 `frontend-replication`。

## 视觉证据工作流示例

对于 `Recreate this dashboard screenshot and match the spacing` 这样的任务，Agent 应该先识别截图，判断哪些视觉结论需要证据，标注 `sidebar`、`header`、`primary-card`、`button` 等主要区域，裁剪关键区域进行聚焦检查，实现 UI，然后在渲染后对比 reference/current 的对应区域。

对于截图和渲染 UI，优先使用 `coordinateSpace: "pixel"`。只有当来源明确使用论文/模型风格的 visual primitive 坐标时，才使用默认的 `normalized-999`。

## 完整示例

前端是用来看的。两组 render 都是一个中档前端模型（GPT 5.5）在 `frontend-replication` -> `inline-replication` 驱动下完成的一次性输出。

这些结果依赖工作流被真正执行。经过A/B实验可以发现工作流对于复现以下结果来说，是非常必要的。使用的Prompt示例：

```text
Replicate the frontend screenshot at <path> (viewport <W>x<H>). Follow the
frontend-replication workflow strictly.

- Match the oracle's exact pixel dimensions in the rendered screenshot.
- Render every code-drawable region in code (CSS/SVG): text, song/artist names,
  table columns, icons, badges, status pills, progress bars, and brand colors.
- Approved exclusions may be represented by placeholders or delegated image assets: avatars, album / cover art, organic illustrations, and dense logo marks.
- Keep code-drawable content inside the scoring domain; use exclusions only for
  tightly bounded regions that cannot be described as boxes and paths.
```

排除边界由“文本模型用代码渲染什么”决定。用代码渲染所有可代码绘制区域，让可代码绘制的区域被用于工作流内自评估完成度。批准的排除区域可以用占位图或委托图像资产表示。

### 简单任务：快速且准确

Oracle 是一个分析仪表盘 mockup：sidebar、KPI 行、两个 chart card 和 transaction table 组成的规则布局。

![仪表盘 mockup 与单次 render 对照](docs/visual-primitives/examples/pulse-side-by-side.png)

*左：oracle mockup。右：单次 render。*

在这种干净、规则的布局上，工作流甚至不需要进入 feedback loop。第一次 render 已经接近 oracle：sidebar、stat cards、revenue area chart、traffic donut、transaction table 以及彩色 status pill 都落在正确位置；绿色上升、红色下降、琥珀色 pending 等语义色也被复现。简单目标通常能在一轮中快速得到准确结果。

### 复杂任务：密集真实截图

Oracle 是一张网易云音乐桌面端截图（`1448x940`），难度更高：三大区域、几十个可代码绘制 icon、`超清母带` / `VIP` badge、品牌红、多字号中文排版、右对齐表格列和浮动进度条。

![网易云音乐截图与单次 render 对照](docs/visual-primitives/examples/netease-side-by-side.png)

*左：作为 oracle 的真实截图。右：单次 render。完整分辨率示例都在 [`docs/visual-primitives/examples/`](docs/visual-primitives/examples/) 下。*

这次 run 中有六个区域被委托出 code-replication scope 作为 exclusions：歌单封面、两个头像、两个曲目缩略图和旋转黑胶。工作流把有机的、想象驱动的图像交给图像资产或占位图，同时让结构化 UI 内容留在代码评分域。

即使在这种密度下，单次 render 仍然保持了整体结构：布局骨架、表格对齐、badge 系统、品牌红和 icon glyph 都足够接近，剩余差异需要聚焦检查才能发现。近看可见的是小面积细节，而不是布局失败：

- **网易云 logo mark** 只是近似绘制，render 在红色圆形内画了一个粗略 glyph，而不是精确的耳机/音符标志，尺寸和字重也略有偏差。
- **进度条旋钮** 比红/灰分界线高了几个像素，没有完全居中。
- 少数 icon 的 font-weight 差一个档位。

网易云 logo mark 在这次 run 中保留在 code-replication scope 内，所以粗略 SVG 近似是一个可见 limitation。更严格的生产 run 可以把密集品牌标志声明为窄 exclusion candidate，和头像、封面图一起处理。评分域应保留给文本模型能够描述并准确渲染的结构化 UI 细节。

## Masked Oracle Diff CLI

`masked-oracle-diff` 会比较 oracle image 和 rendered image，同时排除经过窄边界论证的非代码可精确绘制区域。exclusion box 之外的所有像素都会进入评分域。

运行方式：

```bash
npm run oracle:diff -- --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

CLI 会把 `diff.gray.png`、mask、preview、`25 x 25` matrix、components、stripes、`summary.json` 和 `VERDICT.md` 写入 manifest 的 `outputDir`。

## 工具：`crop_bounding_box`

从源图片裁剪一个已提供的 bounding box。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `imagePath` | `string` | required | 源图片路径。相对路径按 Pi 当前工作目录解析。前导 `@` 会被忽略。 |
| `box` | `[number, number, number, number]` | required | Bounding box 坐标。 |
| `coordinateSpace` | `"normalized-999" \| "pixel"` | `"normalized-999"` | 按论文风格归一化坐标或直接像素坐标解释。 |
| `origin` | `"top-left" \| "bottom-left"` | `"top-left"` | 坐标原点。Bottom-left 表示 y 轴向上增长。 |
| `boxOrder` | `"left-top-right-bottom" \| "left-bottom-right-top"` | `"left-top-right-bottom"` | 输入 box 的坐标顺序。 |
| `outputPath` | `string` | generated | 输出 PNG 路径。相对路径按 Pi 当前工作目录解析。 |
| `padding` | `number` | `0` | 在 resolved box 周围增加的像素 padding。 |
| `clamp` | `boolean` | `true` | 把越界 box 裁到图片边界内。设为 false 时，越界 box 会失败。 |

## 工具：`crop_multiple_bounding_boxes`

从同一张源图片裁剪多个 box。它复用 `crop_bounding_box` 的坐标选项，并采用 fail-fast 行为。

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `imagePath` | `string` | required | 源图片路径。 |
| `boxes` | `Array<{ box, label?, outputPath? }>` | required | 要裁剪的 box。每个条目可以包含 label 和单独的输出路径。 |
| `outputDir` | `string` | generated beside source | 当 box 没有提供 `outputPath` 时，用于生成裁剪文件的目录。 |
| `coordinateSpace` | `"normalized-999" \| "pixel"` | `"normalized-999"` | 所有 box 共享的坐标解释。 |
| `origin` | `"top-left" \| "bottom-left"` | `"top-left"` | 所有 box 共享的坐标原点。 |
| `boxOrder` | `"left-top-right-bottom" \| "left-bottom-right-top"` | `"left-top-right-bottom"` | 所有 box 共享的坐标顺序。 |
| `padding` | `number` | `0` | 所有 box 共享的像素 padding。 |
| `clamp` | `boolean` | `true` | 共享的边界 clamp 行为。 |

示例：

```json
{
  "imagePath": "scene.png",
  "outputDir": "scene-crops",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "title", "box": [10, 20, 180, 80] },
    { "label": "button", "box": [220, 300, 380, 360] }
  ]
}
```

## 工具：`annotate_bounding_boxes`

创建一张带 box 标注的预览图。输出图片保持源图尺寸，并返回 resolved box metadata。

示例：

```json
{
  "imagePath": "scene.png",
  "outputPath": "scene-annotated.png",
  "coordinateSpace": "pixel",
  "boxes": [
    { "label": "target", "box": [50, 40, 250, 180] }
  ]
}
```

用它来验证 coordinate space、origin 或 box order 假设，再进行视觉判断。

## 工具：`sample_colors`

在源图片的指定点采样精确像素色或 patch 平均色。适合需要 CSS 级颜色精度的场景。

示例：

```json
{
  "imagePath": "scene.png",
  "coordinateSpace": "pixel",
  "patchSize": 3,
  "points": [
    { "label": "header-bg", "point": [130, 40] },
    { "label": "cta-button", "point": [620, 340] }
  ]
}
```

工具返回 resolved pixel points、RGB、hex、OKLab、patch size、sampled pixel count 和 patch mean hex。调色板和主色发现留在 point-sampling contract 之外。

## 工具：`crop_around_point`

围绕一个指定点裁剪区域。调用必须通过 `radius` 或 `size` 提供明确裁剪尺寸。

Radius 示例：

```json
{
  "imagePath": "scene.png",
  "point": [500, 500],
  "radius": 80,
  "outputPath": "scene-point.png"
}
```

明确 size 示例：

```json
{
  "imagePath": "scene.png",
  "point": [120, 90],
  "size": { "width": 60, "height": 40 },
  "coordinateSpace": "pixel"
}
```

坐标选项与 `crop_bounding_box` 一致。

### 归一化 visual-primitive box

```json
{
  "imagePath": "scene.png",
  "box": [120, 80, 420, 360]
}
```

这会使用默认的 `coordinateSpace: "normalized-999"`，匹配 visual-primitives 论文约定。

### 像素 box

```json
{
  "imagePath": "scene.png",
  "box": [50, 40, 250, 180],
  "coordinateSpace": "pixel",
  "outputPath": "scene-object.png"
}
```

### Bottom-left 坐标系

```json
{
  "imagePath": "plot.png",
  "box": [10, 20, 60, 80],
  "coordinateSpace": "pixel",
  "origin": "bottom-left",
  "boxOrder": "left-bottom-right-top"
}
```

工具会把它转换成图像处理库需要的 top-left 像素矩形。

### 严格边界检查

```json
{
  "imagePath": "scene.png",
  "box": [-10, 0, 100, 100],
  "coordinateSpace": "pixel",
  "clamp": false
}
```

这个调用会失败，因为 box 超出了图片边界。

## 返回 Metadata

工具返回文本中包含输出路径和 resolved crop rectangle。结构化详情包括：

- `imagePath`
- `outputPath`
- `source.width`
- `source.height`
- `source.format`
- `input.box`
- `input.coordinateSpace`
- `input.origin`
- `input.boxOrder`
- `input.padding`
- `input.clamp`
- `resolvedPixelBox`
- `unclampedPixelBox`
- `clamped`

## 开发

运行测试：

```bash
npm test
```

运行语法检查：

```bash
npm run check
```

测试使用 `sharp.create()` 生成临时 PNG fixture，因此仓库不需要额外的二进制测试 fixture。

## 许可证

MIT
