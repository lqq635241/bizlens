export type NodeType = 'start' | 'step' | 'decision' | 'state' | 'role' | 'end'

export interface RawNode {
  id: string
  label: string
  type: NodeType
  description?: string
}

export interface RawEdge {
  from: string
  to: string
  label?: string
}

export interface Graph {
  title: string
  summary: string
  nodes: RawNode[]
  edges: RawEdge[]
  /** 节点位置快照（保存/恢复项目文件用） */
  positions?: Record<string, { x: number; y: number }>
}

export type ProxyMode = 'auto' | 'direct' | 'proxy'
export type Granularity = 'brief' | 'standard' | 'detailed'

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  brief: '简洁（主干）',
  standard: '标准（含主要分支）',
  detailed: '精细（子步骤+异常分支）',
}

export interface Settings {
  baseUrl: string
  apiKey: string
  model: string
  /** auto=直连失败自动走本地代理（默认），direct=仅直连，proxy=仅本地代理 */
  proxyMode?: ProxyMode
}

export const NODE_TYPE_LABEL: Record<NodeType, string> = {
  start: '起点',
  step: '步骤',
  decision: '判断',
  state: '状态',
  role: '角色/系统',
  end: '终点',
}
