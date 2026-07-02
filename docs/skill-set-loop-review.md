# Skill Set Loop Review — `pi-visual-primitives`

> 审查对象：以 `using-visual-primitives` 为使用基础、从 `frontend-replication` 展开的前端复现工作循环（Loop）。
> 审查日期：2026-07-02
> 审查范围：全部 7 个 SKILL.md、设计 spec、两份 roadmap、`src/`、`package.json`、`tests/package.test.ts`。
> 状态：评审意见，待审批。`masked-oracle-diff` 脚本正由作者实现中，本文档聚焦脚本之外的架构问题。

---

## 0. Loop 结构还原

```
visual-primitives (legacy, 仍在加载)
using-visual-primitives ── REQUIRED base ──┐
                                            ▼
frontend-replication (gateway: workspace + oracle intake + route)
      ├── inline-replication ─────────────┐
      └── subagent-driven-replication ─────┤   Draft → Code → Verify → Verdict
                                            ▼
              refining-with-feedback (verdict + DraftHistory → next draft) ──┐
                                            ▼                                 │
              finalizing-replication (clean diff → final inspect → handoff)   │
                        └── fail → verdict → refining-with-feedback ──────────┘
```

工作区契约在所有 skill 中一致：

```
oracles/ annots/ cropped/ rendered/ diffs/ drafts/ verdict/ scripts/ final/
```

状态模型（spec → refining 一致）：

```
Draft_n = f(DraftHistory=[Draft_0 … Draft_{n-1}], LatestVerdict=Verdict_{n-1}, OraclePairs)
```

**结论**：Loop 闭合正确，路由自洽，状态模型连贯。作为流程文档，结构是扎实的。问题在于「引擎」与「入口/数据格式」尚未落地。

---

## 1. Pros（做得好的地方）

1. **关注点分离干净。** Gateway（路由）/ 执行（inline vs subagent）/ 精化 / 收尾，四层各自狭窄，无职责重叠。
2. **累积式 draft history 是核心亮点。** "保留已确认事实，只修订被证据挑战的部分" + 追加式编号 draft，正确规避了"修 issue N 时回归 issue N-1"的典型问题。
3. **"直接目视是解释者，脚本只是证据" 的原则在各 skill 中一致强化**，不是只声明一次。这是对待 CV 输出的正确认识论姿态。
4. **description 只写触发条件**（何时加载），不复述工作流——符合发现（discovery）卫生。
5. **verdict 分类体系严谨**（blockers / fix-now / optional / accepted-exclusions / rejected-exclusions / mask-problems），且写入端（verdict）与读取端（refining）对称解析。这种对称性是 Loop 可执行的关键。

---

## 2. Cons / 定义不充分之处

### 2.1 Verify 的引擎不存在（承重缺口，作者正在补）

- 每个 skill 都把 "masked diff evidence" 当作 Verify 核心：`inline-replication` 要求 "Store diff outputs under `diffs/`"，`finalizing-replication` 以 "gray/heatmap/matrix evidence" 为放行闸。
- 但 `masked-oracle-diff` **仅存在于 spec 文档**，无 `scripts/`、无 `src/oracle-diff.ts`，任何 SKILL.md 都不引用它。
- **更关键：skill 从不写出调用命令。** 即便脚本落地，`inline-replication` 的 Verify 段也没有 `node scripts/masked-oracle-diff.ts --manifest …` 之类的具体指令——**脚本会存在，但 Loop 不会去调用它**。这属于脚本之外的、需单独修复的"接线"问题。

### 2.2 "截图捕获" 无机制（Loop 最脆弱环节）

- diff 要求 oracle / rendered **像素级同尺寸**（脚本 hard-fail）。
- 但 package 无任何东西负责"渲染网页 → 目标 viewport 截图"。`Code Execution` 只说 "capture into `rendered/`"，浏览器自动化又是明确 Non-Goal。
- 结果：**最易出错的一步（同 viewport 精确截图）完全甩给 agent 且零指导**；尺寸不符 → diff 直接拒跑。

### 2.3 subagent 路线依赖仓库外的 skill

- `subagent-driven-replication` 将 `pi-subagents` 标为 **REQUIRED SUB-SKILL**，并把 Code Execution 路由到 `subagent-driven-development` / "superpowers workflows"。
- 三者均不在本仓库，README / package.json 亦未声明 → 在缺失环境下该路线**静默断裂**。

### 2.4 两个 base skill 同时加载

- `package.json` 用 `"skills": ["./skills"]` 整目录暴露，legacy `visual-primitives` 与新 `using-visual-primitives` 同时激活。
- 两者触发词高度重叠（都命中 screenshots / bounding boxes / frontend visual reproduction / visual QA）。
- **风险**：agent 命中 legacy 单体 skill 后停在其中，**永不进入新 Loop**。README / roadmap / package.test 目前仍把 `visual-primitives` 当作"那个 skill"。

### 2.5 `references/` 已规划但从未建立

- spec 规划了 `references/marking-images.md` / `draft-contract.md` / `verdict-contract.md` / `masked-oracle-diff.md` 等——**一个都没建**。
- 后果：**Draft Markdown Contract** 与 **Verdict Contract**（spec 里的精确模板）只活在 spec 文档，runtime 读不到。各 skill 仅散文描述字段，从不给出可复制模板 → **格式漂移会直接破坏 `refining-with-feedback` 的 verdict 解析**（解析依赖固定分组标题）。

### 2.6 `oracle-manifest.json` 有名无实（无 schema）

- 该文件在 gateway / inline / refining / finalizing 中被反复读写，是**跨 skill 的核心状态载体**。
- 但**无 schema、无模板、无校验**——每个 skill 只说"读它/建它"，无人定义其结构。它本应承载 viewport（正好喂给截图契约）、oracle pairs、派生描述、证据路径。
- 相当于 Loop 的"数据库"没有表结构。

### 2.7 缺少循环终止 / 逃生硬约束

- spec 有很好的 escalation 条件（无法对齐 viewport、反复 feedback 对同一原因结论不一致、需产品决策…），但**未进入任何 skill**。
- `refining-with-feedback` 可无限循环，无"最多 N 轮"或"同一 finding 连续出现即升级用户"的硬闸。视觉逼近极易陷入"永远差一点"的死循环。

---

## 3. 构造但未充分利用的内容

| 资产 | 状态 | 未被利用之处 |
|---|---|---|
| `crop_around_point` | 已实装真工具 | Verify 阶段（基线错位、阴影边缘、图标中心等**点缺陷**）从不调用 |
| `resolvedPixelBox` 的 width/height/area 量化 | base skill 教得细 | replication draft 天天记坐标，却从不用它出**尺寸差 verdict** |
| 25×25 matrix / stripe detection | spec 定义（脚本未建） | stripe = 基线/全局偏移信号，是 spec 最精巧的证据，目前完全未实现 |
| `components.json` → 取色点闭环 | spec 一句话 | diff 可交出高差异坐标驱动 color sampling，形成"diff→去哪采样→写进 draft"闭环 |
| `normalized-999` 坐标体系 | 全套机制 | replication 全程 pixel-native，此机制在复现路径上是死重，仅 paper/oracle 输入时有用 |

---

## 4. 总体看法

Skill Set **架构合理，但当前中心是空的**。spec 异常详尽，相对已交付内容属过度规范。skill 是一套工作流的「叙述」，而其「机制」（diff 引擎 + 截图捕获）尚未落地。

当前 agent 可进入 `frontend-replication`、建工作区、写出漂亮的 draft/verdict、走完整个 Loop——却**产不出任何一份确定性 diff 证据**，因为 Verify 没有引擎。它退化为"看两张图凭感觉判断"，正是 spec 立志要超越的不可靠基线。

让 Loop 真正落地的三件事（按优先级）：

1. **`masked-oracle-diff` 脚本** — 作者进行中 ✅
2. **把 skill 接到脚本上** — 在 inline / subagent 的 Verify 段加入具体 CLI 命令 + manifest 示例；补齐 spec 承诺的 `references/masked-oracle-diff.md` / `draft-contract.md` / `verdict-contract.md`。否则脚本落地但 Loop 仍不调用。
3. **解决双 base skill 冲突与截图捕获缺口** — 退休或收窄 legacy `visual-primitives`；给出同 viewport 截图指导（或 helper），因 diff hard-require 同尺寸。

次要设计异味：**verdict/draft 契约应存于已加载的 `references/`，而非 runtime 永不读取的 spec 文档**。知识已存在，只是放错了地方。

---

## 5. 建议清单（供审批）

| 优先级 | 建议 | 理由 | 涉及文件 |
|---|---|---|---|
| **P0** | 解决双 base skill 冲突（删除 / 收窄 description / 显式列表三选一） | 否则 agent 可能根本进不了 Loop | `package.json`, `skills/visual-primitives/`, `skills/using-visual-primitives/`, `tests/package.test.ts` |
| **P0** | draft/verdict 契约落到 `references/` | 格式漂移会直接搞坏 verdict 解析 | `skills/frontend-replication/references/draft-contract.md`, `verdict-contract.md` |
| **P1** | 截图捕获契约 / 可选 helper | diff hard-require 同尺寸，此步现在无保障 | `skills/inline-replication/SKILL.md`, 可选 `scripts/capture.ts` |
| **P1** | `oracle-manifest` schema + 模板 | 跨 skill 核心状态却无表结构 | `src/oracle-manifest-schema.ts`, `skills/frontend-replication/references/oracle-manifest.md` |
| **P1** | 脚本落地后，把 skill 接到 diff（CLI + manifest 示例进 Verify 段；补 `references/masked-oracle-diff.md`） | 否则脚本存在但 Loop 不调用 | `skills/inline-replication/SKILL.md`, `skills/subagent-driven-replication/SKILL.md`, `skills/frontend-replication/references/` |
| **P2** | 声明外部依赖（`pi-subagents` / superpowers） | 防 subagent 路线静默断裂 | `README.md`, `package.json`, `skills/subagent-driven-replication/SKILL.md` |
| **P2** | 循环预算 / escalation 落地 | 防死循环 | `skills/refining-with-feedback/SKILL.md` |
| **P2** | 让 Verify 真正用上 point-crop / 量化 / 取色闭环 | 已造资产未被利用 | `skills/inline-replication/SKILL.md` |

---

## 6. 待决问题（需作者拍板）

1. **diff 遇到尺寸不符时的行为**：
   - (a) hard-fail，status=blocked（spec 默认，最确定）
   - (b) hard-fail 但在 VERDICT.md 给出缩放系数 + 建议 viewport
   - (c) 自动把 rendered 缩放到 oracle 尺寸（方便但引入重采样噪声，污染确定性评分——不推荐）

2. **legacy `visual-primitives` 处置**：删除 / 收窄 description / package.json 显式列表——三选一。

3. **截图捕获**：仅写文字契约，还是提供最小 Playwright helper（不违反当前 Non-Goal 的前提下作为可选项）。
