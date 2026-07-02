# Review Proposal — 工具取舍原则与 `using-visual-primitives` 二阶运算规程

> 类型：评审提案（Proposal），待审批后再改动 skill / 代码。
> 日期：2026-07-02
> 关联文档：`docs/skill-set-loop-review.md`（Loop 结构评审）、`docs/superpowers/specs/2026-07-01-aigc-oracle-web-reproduction-devskillpack-design.md`（设计 spec）
> 触发背景：讨论"是否新增 Grid / 测距 / 取色等工具"时，作者提供了 VLM 实测数据，结论收敛为一套成文的取舍标准。

---

## 1. 决策依据（实测数据）

作者在 1080p、16:9 图片内对候选 VLM 的实测：

| 操作类型 | 定义 | 实测误差 | 性质 |
|---|---|---|---|
| **绝对坐标估计** | 读出图上某点 / 某边的位置 | ~1% | 一阶感知，VLM 强项 |
| **距离 / 差值目测** | 直接"看出"两个位置之间的差 | ~10% | 二阶运算，被误当成一阶感知 |
| **精确色值** | 读出 hex / rgb | 不可靠 | VLM 结构性弱项 |

关键解读：

- 二阶量误差大，**不是因为 VLM 看不准距离**，而是因为它把"两个坐标相减"这一算术步骤，当成了一次直接目测——用两个各含 1% 误差的估计，经由一个**未显式执行的减法**合成结果，误差被放大且不可控。
- 因此：**问题不在能力，在方法。** VLM 同时拥有 1% 精度的坐标能力和可靠的算术能力，缺的只是"把二阶问题分解回一阶 + 显式计算"的指令。

---

## 2. 成文取舍原则

> **只补 VLM 的短板，不替代 VLM 的强项；能力够但方法错的，改 skill 而非加工具。**

| 操作类型 | VLM 表现 | 应对策略 | 原因 |
|---|---|---|---|
| 一阶感知（坐标、边缘、位置） | ~1% | **信任直接看，不加工具** | 已达标，加工具（如 grid）只增重且可能降精度 |
| 二阶运算（距离、差值、比值、偏移、对齐） | ~10% | **改 skill：提示"落坐标 → 列式 → 计算"** | 能力够，缺的是方法；工具会掩盖认知过程、不可迁移 |
| 结构性弱项（精确 hex 色值） | 不可靠 | **加工具（`sample_colors`）** | VLM 真的做不到，spec 已预留字段 |

### 2.1 为什么不加 `overlay_grid`

- Grid 的全部价值是"帮 agent 把视觉印象转成坐标"，但 1% 实测说明这个转换本来就够准——**为一个已达标的环节增加工序**。
- 网格线与刻度文字会**遮挡真实内容**，可能诱导 VLM 去"读刻度 + 内插"，把一次 1% 的直接感知降级成两段式读数，**反而引入新误差**。
- 与 skill 既有原则冲突：`Direct visual inspection takes priority`、`Think geometrics, write coordinates` 的本质是**信任直接感知**；grid 是"不信任直接感知"才需要的拐杖。
- 结论：cost/benefit 为负。**不加是正确决策。**

### 2.2 为什么不加 `measure_distance` 工具（改 skill 代替）

- 测距确有必要（二阶目测 10% 误差），但工具**在黑箱里做减法**，agent 学不到"距离是算出来的、不是看出来的"。
- 一旦遇到工具未覆盖的二阶问题（面积比、间距均匀性、多元素对齐），agent 会退回目测老路。
- 改 skill 教会的是**可迁移的方法**；加工具只解决一个孤立的点。
- 结论：**用 skill 规程覆盖，不新增工具。**

### 2.3 为什么仍推荐 `sample_colors`

- 精确色值是 VLM 的**结构性弱项**（能说"深蓝"，说不准 `#1a2b5c` vs `#1b2c5e`），而 CSS 复现恰恰要这个精度。
- 这不是"帮它做本来能做的事"，是"补它做不到的事"——落在原则表第三行。
- spec 的 **Color Sampling Requirement** 与 draft 契约的 `Color samples` 字段已预设其存在，只是未实现。
- 可与 diff 脚本闭环：`components.json` 报高差异中心 → `sample_colors` 对比 oracle/rendered 实际色值 → 写进 feedback draft。
- 结论：**这是唯一真正补齐能力短板的新工具，保留推荐。**（实现细节见 §4）

### 2.4 明确不做的工具（会滑向 CV 助手，踩 Non-Goal）

自动检测 UI 元素、OCR、边缘/轮廓检测、自动分割、自动生成候选 box。加入即从"视觉证据工具"退化为"CV 库"，违背 roadmap 的 Deferred candidates 立场。

---

## 3. 提案 A：修改 `skills/using-visual-primitives/SKILL.md`（二阶运算规程）

**位置建议**：置于 "Aligning Images" 与 "Analyzing Images" 之间，或作为 "Analyzing Images" 的一个子节。

**拟新增文本（草案）**：

```markdown
## Second-Order Quantities Must Be Computed, Not Eyeballed

Distance, gap, size difference, alignment offset, and ratio are second-order
quantities: they are derived from multiple coordinates, not read directly.

Direct coordinate perception is accurate (about 1% error in typical
screenshots), but eyeballing a difference between two positions is
significantly less accurate (about 10% error), because it collapses an
arithmetic step into a single visual guess.

Procedure for any second-order quantity:

1. Estimate each endpoint or edge coordinate separately, using direct
   perception.
2. Write the arithmetic explicitly, for example:
   `gap = card2.left - card1.right = 412 - 330 = 82px`.
3. Report the computed result, not the visual impression.

Alignment checks follow the same rule: record both edge coordinates,
subtract to get the offset, and treat `|offset| <= tolerance` as aligned.
Do not report "looks aligned" without the computed offset.
```

**理由**：把 CoT 用在几何上——先落坐标（强项）、再列式、再算（可靠），避免感知层直接吐出运算结果（弱项）。此规程同时被 replication Loop 的 Verify 复用：baseline / offset 判断正是二阶量，也正是 diff 脚本 stripe 检测的成因。

---

## 4. 提案 B：新增工具 `sample_colors`（可选，待审批）

**目的**：补齐 VLM 精确色值短板，兑现 spec 的 Color Sampling Requirement。

**输入（草案，复用现有坐标解析约定）**：

```jsonc
{
  "imagePath": "oracle.png",
  "points": [
    { "label": "header-bg", "point": [130, 40] },
    { "label": "cta-button", "point": [620, 340] }
  ],
  "coordinateSpace": "pixel",      // 复用 normalized-999 / pixel
  "origin": "top-left",            // 复用现有 origin
  "patchSize": 3                   // 可选：取 NxN 邻域均值，抗抗锯齿噪声；默认 1
}
```

**输出**：每点返回 `{ label, resolvedPixelPoint, hex, rgb, oklab, patchMeanHex }`。

**实现路径（低成本）**：
- 复用 `src/phase2.ts` 的 `normalizeToolPath` + `src/crop.ts` 的坐标解析（把 point 解析成像素坐标，与 `crop_around_point` 同源）。
- 用 `sharp(imagePath).raw()` 读像素缓冲，取该点（或 patch 均值）RGBA。
- RGB → OKLab 转换与 diff 脚本共用一份实现，避免重复（若 diff 脚本已实现 oklab，直接 import）。

**边界与 Non-Goal 守则**：只**读**用户/agent 给定坐标处的像素值，**不识别、不检测**。坐标仍由 agent 判断产生。

---

## 5. 统一设计约束（建议写入 roadmap，固化未来取舍）

> 所有工具只做两类事：
> 1. **把坐标变成图**（crop / annotate / 未来的对比图）；
> 2. **把坐标变成数**（sample_colors；测距改由 skill 规程完成）。
>
> **永远不从图里"认"出坐标。** 坐标的产生始终是 agent 的判断；工具只提供尺子、放大镜和调色板。
>
> 推论：
> - VLM 一阶强项（坐标）→ 不加工具。
> - VLM 二阶方法问题（距离等）→ 改 skill，显式列式计算。
> - VLM 结构性弱项（精确色值）→ 加工具。

---

## 6. 审批清单

| # | 提案 | 类型 | 状态 |
|---|---|---|---|
| A | `using-visual-primitives` 增加"二阶运算必须计算"规程（§3） | 改 skill | ☐ 待审批 |
| B | 新增 `sample_colors` 工具（§4） | 加工具 | ☐ 待审批 |
| C | 明确**不**新增 `overlay_grid`（§2.1） | 决策记录 | ☐ 待确认 |
| D | 明确**不**新增 `measure_distance` 工具，改由 §3 skill 规程覆盖（§2.2） | 决策记录 | ☐ 待确认 |
| E | 统一设计约束写入 roadmap（§5） | 改文档 | ☐ 待审批 |

审批后我再执行对应的 skill / 代码 / 文档改动。
