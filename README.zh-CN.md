# Visual Primitives

[English](README.md)

`@mapleluvr/visual-primitives` 用一个统一版本的 package 提供：

- 与工作流无关的 `vp` CLI，将明确给定的框和点转换为可检查的图像证据；
- 六个 Agent Skills，分别覆盖通用视觉证据和前端复现工作流。

需要 Node.js 22.18 或更高版本。这个 package 不负责目标检测、OCR、图像分割、自动生成框或自动推断 UI 元素。坐标由用户或 agent 提供，生成的图像仍需直接视觉检查后才能解释。

## 安装 CLI

从 npm 全局安装两个等价的命令别名：

```bash
npm install -g @mapleluvr/visual-primitives
vp --help
visual-primitives --version
```

公开命令面严格包含五个子命令：

| 命令 | 用途 |
| --- | --- |
| `vp crop` | 裁剪一个矩形区域。 |
| `vp crop-multi` | 从同一张图裁剪多个区域。 |
| `vp annotate` | 在同尺寸预览图上绘制带标签的框。 |
| `vp point` | 按明确的点和半径或尺寸裁剪。 |
| `vp colors` | 在明确的点采样精确颜色。 |

运行 `vp <command> --help` 查看完整 flags 和 JSON 输入文档。

## CLI 示例

Flag 模式默认使用像素坐标：

```bash
vp annotate screenshot.png --box "header:40,30,240,180" --out annotated.png
vp crop screenshot.png --box "40,30,240,180" --out header.png
vp crop-multi screenshot.png \
  --box "header:40,30,240,180" \
  --box "button:280,220,420,280" \
  --out-dir crops
vp point screenshot.png --point "80,50" --radius 30 --out detail.png
vp colors screenshot.png --point "header-bg:80,50" --patch 3
```

归一化千分位坐标使用 `--space normalized-999`；y 轴向上时使用 `--origin bottom-left`；左下原点的框顺序使用 `--box-order left-bottom-right-top`。

成功命令会向 stdout 写出一个 JSON 值。摘要和 warning 写到 stderr，可用 `--quiet` 抑制。用法错误退出码为 `2`；图像或文件系统运行时错误退出码为 `1`。

### JSON 兼容模式

`--json <file|->` 接受原先五个 Pi tool 的 payload 形状。JSON 模式保留 `normalized-999` 默认值，并拒绝未知字段、错误类型、非有限数值、非法枚举、互斥字段和不适用于命令的字段。

```bash
vp crop --json crop.json
```

```json
{
  "imagePath": "screenshot.png",
  "box": [40, 30, 240, 180],
  "coordinateSpace": "pixel",
  "outputPath": "header.png"
}
```

## 在 Pi 中安装 Skill Set

安装固定 npm 版本：

```bash
pi install npm:@mapleluvr/visual-primitives@0.2.0
```

或者安装固定 Git tag：

```bash
pi install git:github.com/mapleluvr/visual-primitives@v0.2.0
```

Pi package manifest 只加载 Skills，不注册 visual-primitives extension。

Pi package 安装不保证 npm binary 会进入系统 `PATH`。因此 agent 指南通过 `skills/_shared/run-vp.mjs` 调用 package 内的 CLI；人类用户仍可使用全局安装的 `vp`。

## Skill Set

Package 包含六个可发现的 Skills：

- `using-visual-primitives`：五个 `vp` 命令的选择和使用、坐标约定、直接检查与二阶测量。
- `frontend-replication`：oracle 驱动前端复现的入口。
- `inline-replication`：父 agent 执行的复现循环。
- `subagent-driven-replication`：由父会话编排 worker 和 reviewer 的循环。
- `refining-with-feedback`：整合 DraftHistory 与 verdict。
- `finalizing-replication`：最终直接检查与交付路由。

独立的图像和截图证据任务使用 `using-visual-primitives`。包含 oracle intake、实现轮次、masked scoring、verdict 或交付审查时使用 `frontend-replication`。专用 Skills 引用通用命令和坐标指南，不重复定义它们。

## 前端工作流 Helper

`masked-oracle-diff` 归 `frontend-replication` 工作流所有。它不是 `vp` 子命令，不是 npm binary，不是通用 core export，也不属于 `using-visual-primitives` 的职责。

加载 replication Skill 后，相对于已加载的 `frontend-replication` Skill 目录解析 `scripts/run-masked-oracle-diff.mjs`，再从 consumer project 调用这个 package-local runner：

```bash
node <frontend-replication-skill-dir>/scripts/run-masked-oracle-diff.mjs --manifest docs/visual-primitives/runs/<run-id>/scripts/diff-manifest.json
```

在本 package checkout 中工作的仓库维护者也可以使用 `npm run oracle:diff -- --manifest <path>`；consumer project 不需要这个 npm script。Runner、源码和构建后的 runtime 都位于 `skills/frontend-replication/scripts/`。Helper 会写出 mask、preview、diff 图、matrix、components、stripes、`summary.json` 和 `VERDICT.md`。干净的 diff 只会打开最终直接检查，不能自行宣布交付成功。

## 版本策略

CLI 与 Skill Set 使用一个 package 版本和一个 Git tag。Package `X.Y.Z` 对应 tag `vX.Y.Z`。命令名、JSON 输入语义、退出码、已文档化的 Skill 资源和 helper 归属都属于受保护兼容契约。

## 从 `pi-visual-primitives` 迁移

旧 package 通过 Pi extension 注册 `crop_bounding_box`、`sample_colors` 等 TypeScript tools。`0.2.0` 用独立的五命令 CLI 和只包含 Skills 的 Pi package 取代该运行面。

1. 从 Pi settings 移除旧 package，或使用之前安装时的 source identity 卸载。
2. 安装上面的 `npm:@mapleluvr/visual-primitives@0.2.0` 或固定 Git tag。
3. 将旧 extension tool 调用替换为 `vp crop`、`vp crop-multi`、`vp annotate`、`vp point` 和 `vp colors`。
4. Agent 执行时使用 `using-visual-primitives` 说明的 package-local launcher，不假设 `vp` 在 `PATH` 中。
5. 将 masked oracle diff 工作保留在 frontend replication Skill family 内。

## 开发

```bash
npm ci --ignore-scripts
npm run check
npm test
npm run package:smoke
npm audit --audit-level=high
```

`npm run package:smoke` 会创建并安装临时 tarball，在生成的 PNG 上运行两个 binary aliases 和五个命令，验证六个 Skills，在从 `PATH` 移除 package bins 后执行 package-local launcher，并检查 frontend helper 的归属。

CI 在 Ubuntu、Windows 和 macOS 上测试 Node 22.18.0 与 Node 24.x。发布仅由 tag 触发，并使用 npm Trusted Publishing 和 provenance。首次发布先决条件、失败重跑行为和需要单独授权的 live steps 记录在 [RELEASE.md](RELEASE.md)。创建或推送 release tag 是需要单独授权的发布动作；普通 commit 不会发布 package。

## 许可证

[MIT](LICENSE)
