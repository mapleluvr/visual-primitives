# Conformance Review — Loop Hardening 实现符合度审查

> 类型：符合度审查（Conformance Review）
> 日期：2026-07-02
> 审查对象：针对 `docs/review-proposal.md` + `docs/superpowers/specs/2026-07-02-review-proposal-loop-hardening-spec.md` 的实现
> 方法：逐项对照 spec 的 8 个 Goal、Non-Goal、契约、skill 接线、测试要求；跑通 `npm test`（61/61 绿）与 `npm run check`（含 diff 脚本）。

---

## 0. 总评

**符合度：高。** 提案与 spec 承诺的工作基本全部落地，且实现质量超出"能过测试"的程度——diff 脚本、`sample_colors`、references 契约、skill 接线都是实打实的。61 项测试全绿，`npm run check` 通过（已含 `scripts/masked-oracle-diff.ts`）。

主要发现：**1 处语义偏差（diff status 分级）**、**3 处轻微不一致（字段命名/输出形状与 spec 示例不完全一致）**、**2 处可加强项**。没有阻断性问题。

---

## 1. 逐项 Goal 核对（loop-hardening spec §Goals）

| # | Goal | 状态 | 证据 |
|---|---|---|---|
| 1 | `using-visual-primitives` 加二阶几何规程 | ✅ 完成 | `Second-Order Quantities Must Be Computed` 节，含 `gap = card2.left - card1.right = 412 - 330 = 82px` 列式 |
| 2 | 加 `sample_colors` 工具 | ✅ 完成 | `src/phase2.ts:368`、schema、extension 注册、4 项测试 |
| 3 | inline/SDR 的 Verify 接 `npm run oracle:diff` | ✅ 完成 | 两个 skill 均含 `npm run oracle:diff -- --manifest …/scripts/diff-manifest.json` |
| 4 | 加载式 `references/` 契约（draft/verdict/manifest/diff/screenshot） | ✅ 完成 | 5 个 md + manifest 模板 json，均被 skill 显式相对链接 |
| 5 | 稳定 `oracle-manifest.json` schema/模板 | ✅ 完成 | `references/oracle-manifest.md` + `oracle-manifest.template.json` |
| 6 | 循环预算与 escalation | ✅ 完成 | `refining-with-feedback` 含 "Default max feedback rounds: 3" + 复发/尺寸不符/exclusion 膨胀升级 |
| 7 | 声明 SDR 依赖 + 优雅回退 | ✅ 完成 | SDR skill "OPTIONAL ENVIRONMENT SUPPORT" + fallback；README 亦述 |
| 8 | roadmap 记录工具边界决策 | ✅ 完成 | roadmap 明列 overlay_grid / measure_distance 拒绝理由 + sample_colors 批准 |

**8/8 Goal 全部落地。**

---

## 2. diff 脚本符合度（对照原始设计 spec §masked-oracle-diff）

对照 `2026-07-01-aigc-oracle-web-reproduction-devskillpack-design.md` 的脚本契约：

**符合项（做得好）：**

- ✅ 同尺寸硬校验：`masked-oracle-diff.ts:636` 尺寸不符 `throw`，符合 spec "identical dimensions" 与 §6 待决问题里选定的 hard-fail 立场。
- ✅ mask 像素固定 `#303030`：`MASK_GRAY = 48`，gray/heatmap/overlay/preview 内均写 48，alpha 恒 255。符合 spec "Transparency is never used in diff.gray.png"。
- ✅ 25×25 稀疏矩阵三态：`coverage < minCellCoverage → null`；`score < stripeThreshold → 0`；否则 rounded score。完全符合 spec 稀疏规则。
- ✅ score 公式 `0.65*mean + 0.35*p90`：`computeMatrix` 一字不差。
- ✅ OKLab 作为首选感知色空间 + rgb fallback，矩阵变换系数正确。
- ✅ 连通域（4-邻域 BFS）+ 条纹检测（水平/垂直/双对角）+ `matrixRows/Cols` 映射，覆盖 spec 全部四类条纹。
- ✅ 全套 artifact 产出：`manifest.normalized.json` / `summary.json` / `VERDICT.md` / 两 mask / 两 preview / gray+heatmap+overlay / matrix.json+csv / components.json / stripes.json，与 spec 输出目录清单**逐一对齐**。
- ✅ 越界 exclusion 默认 `throw`（`resolveBox:165`），符合 spec "Out-of-bounds boxes fail by default"。
- ✅ 不输出 `delivery-review-ready`（只有 feedback-required / direct-inspection-required），符合 spec "script should not output delivery-review-ready"。

**⚠️ 偏差 1（语义，值得确认）— status 分级少了 `blocked`：**

- spec §Summary JSON 规定三态：`feedback-required` / `direct-inspection-required` / **`blocked`（inputs invalid）**。
- 实现 `masked-oracle-diff.ts:669` 只产出前两态；无效输入是直接 `throw`（进程退出码 1），而非产出一份 `status: "blocked"` 的 summary。
- **影响**：skill 层若期望读到 `summary.json.status === "blocked"` 来路由，会读不到——它拿到的是非零退出码 + stderr。功能上不算错（失败确实被表达了），但与 spec 的状态机契约不一致。
- **建议**：要么在 catch 里写一份 `blocked` summary 再退出，要么在 `references/masked-oracle-diff.md` 明确"无效输入以非零退出码表达，不产 summary"，让 skill 按退出码而非 status 字段判断。

---

## 3. `sample_colors` 符合度（对照 loop-hardening spec §sample_colors）

**符合项：**

- ✅ 输入形状：`imagePath` / `points[{label,point}]` / `coordinateSpace`(默认 normalized-999) / `origin` / `patchSize`(默认 1)。
- ✅ patchSize 偶数进位为奇：`normalizePatchSize:148` `size % 2 === 0 ? size + 1 : size`，符合 spec "Even values are rounded up to the next odd"。
- ✅ patch 裁剪到图像边界：`sampleColors:399-402` `Math.max/min` 夹取。
- ✅ 输出 rgb / hex / oklab / patch 均值。
- ✅ 只采样给定点，不自动找色——符合 Non-Goal 与工具边界。
- ✅ OKLab 实现与 diff 脚本**系数一致**（两份独立实现但矩阵相同），色值可跨工具比较。

**⚠️ 不一致（轻微，字段命名）：**

1. **patch 均值字段名**：spec 示例输出用 `patchMeanHex`（顶层），实现放在 `patch.meanHex` + `patch.meanRgb`。实现的结构其实**更合理**（把 patch 相关信息聚在一起），但与 spec 示例的扁平 `patchMeanHex` 不一致。
2. **`patch.size` vs `patchSize`**：spec 示例 `"patch": { "size": 3, "sampledPixels": 9 }`——实现符合（`patch.size` + `patch.sampledPixels`）。✅ 这项其实对齐了。
3. 实现额外返回了 `inputPoint`、`alpha`、`patch.bounds`——spec 未要求但有用，属良性超集。

**建议**：这些是文档/示例层面的小差异，不影响功能。若要严格对齐，更新 spec 示例即可（我倾向保留实现的 `patch.meanHex` 结构，改 spec）。

---

## 4. references 契约符合度

5 个契约文件全部创建并被 skill 链接。抽查：

- `oracle-manifest.md` + `.template.json`：兑现了原评审 §2.6 "manifest 有名无实" 的修复——现在有 schema、模板、被 gateway 引用。✅
- `screenshot-capture.md`：兑现原评审 §2.2 "截图捕获无机制"——按 spec 选择了"契约（文档）而非 helper"路线（Non-Goal 明确本轮不加浏览器自动化）。✅ 立场一致。
- `masked-oracle-diff.md`：把 CLI 命令 + manifest 示例 + 输出解读放进**加载式** references，兑现原评审 §2.1/§2.5 "契约放错地方"。✅

**这三点正是原始 `skill-set-loop-review.md` 的 P0/P1 核心，现已全部闭环。**

---

## 5. Non-Goal 遵守核对

| Non-Goal | 遵守 | 备注 |
|---|---|---|
| 无 UI 检测 / OCR / 边缘 / 分割 / 自动 box | ✅ | 未引入任何 CV 识别 |
| 无 `overlay_grid` | ✅ | roadmap 明确拒绝并记理由 |
| 无 `measure_distance` 工具 | ✅ | 改由二阶 skill 规程覆盖 |
| 本轮不加浏览器截图 helper | ✅ | 仅加 `screenshot-capture.md` 契约 |
| 不硬依赖 `pi-subagents`/superpowers | ✅ | 声明为 optional + fallback |

**全部遵守。** 工具边界原则（"只把坐标变图或变数，永不从图认坐标"）在实现中被严格贯彻。

---

## 6. 测试符合度（对照 spec §Validation）

spec 要求的 6 类测试覆盖：

- ✅ sample_colors schema（points / patchSize）
- ✅ sample_colors 像素采样（pixel 坐标）
- ✅ sample_colors 归一化坐标转换（测试含 normalized bottom-left）
- ✅ extension 注册 + prompt guidance
- ✅ README/package 测试（二阶规则、references、CLI 接线、sample_colors、SDR 可选依赖、roadmap 决策）
- ✅ 既有 crop/annotate/diff 测试保持绿

`tests/masked-oracle-diff.test.ts` 有 22 处 assert。**61/61 全绿。**

**⚠️ 可加强项 1（测试深度）**：diff 测试建议确认是否覆盖 spec §Integration 要求的**语义断言**——"VERDICT.md 指认未遮罩失配、且不归咎被遮罩失配"。存在性断言容易，语义断言（遮罩内的差异**不**进 components）才是 mask 正确性的关键。建议确认此项在 22 个 assert 内。

---

## 7. 与原始评审的闭环情况

原 `skill-set-loop-review.md` 的建议清单落实度：

| 原优先级 | 建议 | 现状 |
|---|---|---|
| P0 | 解决双 base skill 冲突 | ✅ legacy `visual-primitives` 已删除 |
| P0 | draft/verdict 契约落 references | ✅ 已建并链接 |
| P1 | 截图捕获契约 | ✅ `screenshot-capture.md` |
| P1 | oracle-manifest schema | ✅ md + template |
| P1 | skill 接 diff | ✅ inline + SDR 均接 |
| P2 | 声明外部依赖 | ✅ optional + fallback |
| P2 | 循环预算/escalation | ✅ max 3 rounds + 升级条件 |
| P2 | Verify 用上 point-crop/量化/取色 | ◐ 部分——`sample_colors` 接入了取色；point-crop 复查与二阶量化在 skill 有原则但可更显式绑进 Verify 步骤 |

**原评审 8 条建议：7 条完全闭环，1 条部分闭环。**

---

## 8. 可加强项汇总（非阻断）

1. **diff `blocked` status**（§2 偏差1）：无效输入未产 `status:"blocked"` summary，与 spec 状态机不符。建议 catch 写 blocked summary，或在 reference 里注明按退出码判断。
2. **diff 测试的语义断言**（§6）：确认"遮罩内差异不进 components / VERDICT 不归咎遮罩区"被断言，而非仅断言 artifact 存在。
3. **sample_colors 输出字段与 spec 示例对齐**（§3）：`patch.meanHex` vs spec 的 `patchMeanHex`——建议改 spec 迁就更合理的实现结构。
4. **Verify 显式绑定 point-crop/二阶量化**（§7）：`crop_around_point` 复查高差异 `components.json` 中心、对齐用二阶列式——目前是 skill 通则，可在 inline Verify 步骤里点名，让"diff 报格子 → 回图复查 → 列式量化"闭环更硬。

---

## 9. 结论

这一版实现**忠实且高质量地兑现了 review-proposal 与 loop-hardening spec**。Loop 从"有叙述无引擎"变成"引擎、入口、数据格式齐备"：diff 脚本产出确定性证据、skill 真正调用它、契约进入加载式 references、工具边界原则被贯彻。

唯一值得在合并前拍板的是 **§8.1 的 `blocked` status 语义**——它是 skill 与脚本之间的接口契约，其余三项属打磨。

建议动作：
- 合并前：决定 `blocked` 的表达方式（改脚本 or 改 reference 说明）。
- 合并后打磨：确认 diff 语义测试、对齐 sample_colors 字段文档、Verify 步骤点名 point-crop/二阶量化。
