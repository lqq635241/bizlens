import type { Granularity } from '../types'

const BASE_OUTPUT_FORMAT = `只输出一个严格的 JSON 对象（不要输出任何其他文字），格式如下：
{
  "title": "业务名称",
  "summary": "一句话概括这个业务",
  "nodes": [
    { "id": "n1", "label": "简短节点名（12字以内）", "type": "start|step|decision|state|role|end", "description": "补充说明，可为空字符串" }
  ],
  "edges": [
    { "from": "n1", "to": "n2", "label": "流转条件，可为空字符串" }
  ]
}

通用规则：
1. type 含义：start=流程起点，step=业务步骤，decision=判断/分支，state=业务状态，role=参与的角色或外部系统，end=终点/结果。
2. decision 节点的每条出边必须带 label 说明分支条件（如"通过"、"拒绝"、"超时"）。
3. edges 的 from/to 必须引用 nodes 中存在的 id。
4. 确保流程是一个连通的整体。`

const GRANULARITY_RULES: Record<Granularity, string> = {
  brief: `粒度要求（简洁模式）：
- 节点数量控制在 5~12 个，只保留主干流程，让人 10 秒看懂全局。`,

  standard: `粒度要求（标准模式）：
- 节点数量控制在 10~25 个。
- 覆盖主流程和主要的判断分支；每个 decision 的"拒绝/失败"分支要画出后续走向（驳回、重试或终止），不要只画成功路径。`,

  detailed: `粒度要求（精细模式）：
- 节点数量控制在 20~45 个，宁多勿漏。
- 把复杂步骤拆分为可独立执行的最小动作步骤（如"提交申请"拆为"填写表单 → 上传凭证 → 系统校验"）。
- 必须覆盖以下内容，缺失视为不合格：
  1) 每个关键步骤的异常、拒绝、失败分支及其后续走向（重试、驳回、人工介入、终止）；
  2) 超时、催办、自动升级等时间相关规则；
  3) 通知触达环节（短信、站内信、邮件等）；
  4) 涉及的外部系统或角色交互（用 role 或 state 节点表达）。
- 每个节点尽量在 description 里补充执行者或操作细节。`,
}

/** 按粒度生成解析系统提示词 */
export function analyzeSystemPrompt(granularity: Granularity): string {
  return `你是一位资深业务分析师。请把用户提供的业务描述梳理成结构化的流程图数据。

${BASE_OUTPUT_FORMAT}

${GRANULARITY_RULES[granularity]}`
}

export const REFINE_SYSTEM_PROMPT = `你是一位资深业务分析师。你会收到一份"当前业务流程图的 JSON 数据"和一条"用户的调整指令"。

请根据指令修改流程图，只输出修改后的完整 JSON（不要输出任何其他文字），格式与输入完全一致：
{
  "title": "业务名称",
  "summary": "一句话概括",
  "nodes": [{ "id": "n1", "label": "...", "type": "start|step|decision|state|role|end", "description": "..." }],
  "edges": [{ "from": "n1", "to": "n2", "label": "..." }]
}

规则：
1. 保留未被指令涉及的节点和边，不要凭空删除。
2. 新增节点时使用未占用的新 id（如 n100 起步）。
3. decision 节点的出边必须带分支条件 label。
4. edges 的 from/to 必须引用 nodes 中存在的 id。
5. 如果指令要求"更精细"，把复杂步骤拆分为更小的动作步骤，并补充异常分支、超时处理和通知环节。`
