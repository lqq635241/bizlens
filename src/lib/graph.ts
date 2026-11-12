import type { Graph, NodeType, RawEdge, RawNode } from '../types'

const VALID_TYPES: NodeType[] = ['start', 'step', 'decision', 'state', 'role', 'end']

/** 校验并规范化 AI 返回的图数据，同时做分层自动布局 */
export function normalizeGraph(data: unknown, fallbackIdPrefix = 'n'): Graph {
  const d = data as Partial<Graph>
  if (!d || !Array.isArray(d.nodes) || d.nodes.length === 0) {
    throw new Error('AI 返回的流程图为空或格式不正确。')
  }

  const nodes: RawNode[] = d.nodes.slice(0, 60).map((n, i) => {
    const type = VALID_TYPES.includes((n as RawNode)?.type)
      ? (n as RawNode).type
      : 'step'
    return {
      id: String((n as RawNode)?.id ?? `${fallbackIdPrefix}${i}`),
      label: String((n as RawNode)?.label ?? `节点${i + 1}`).slice(0, 40),
      type,
      description: String((n as RawNode)?.description ?? ''),
    }
  })

  const idSet = new Set(nodes.map((n) => n.id))
  const edges: RawEdge[] = (Array.isArray(d.edges) ? d.edges : [])
    .filter((e) => e && idSet.has(String((e as RawEdge).from)) && idSet.has(String((e as RawEdge).to)))
    .map((e) => ({
      from: String((e as RawEdge).from),
      to: String((e as RawEdge).to),
      label: String((e as RawEdge).label ?? ''),
    }))

  // 兜底：确保孤立节点也可见（没有边时挂到第一个节点，避免画布空白）
  if (nodes.length > 1 && edges.length === 0) {
    for (let i = 1; i < nodes.length; i++) {
      edges.push({ from: nodes[i - 1].id, to: nodes[i].id, label: '' })
    }
  }

  return {
    title: String(d.title ?? '未命名业务'),
    summary: String(d.summary ?? ''),
    nodes,
    edges,
  }
}

/**
 * 简单分层布局：按最长路径层级分行（自上而下），每层内水平排开。
 * 对带环的图做迭代上限保护。
 */
export function layoutLevels(nodes: RawNode[], edges: RawEdge[]): Record<string, { x: number; y: number }> {
  const NODE_W = 240
  const NODE_H = 120
  const GAP_X = 60
  const GAP_Y = 80

  const inDeg = new Map<string, number>()
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => {
    inDeg.set(n.id, 0)
    adj.set(n.id, [])
  })
  edges.forEach((e) => {
    if (adj.has(e.from) && inDeg.has(e.to) && e.from !== e.to) {
      adj.get(e.from)!.push(e.to)
      inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1)
    }
  })

  const level = new Map<string, number>()
  const queue = nodes.filter((n) => (inDeg.get(n.id) ?? 0) === 0).map((n) => n.id)
  queue.forEach((id) => level.set(id, 0))

  // 拓扑式的层级传播（带上限防环）
  let frontier = [...queue]
  let guard = 0
  while (frontier.length && guard < nodes.length + 2) {
    const next: string[] = []
    for (const id of frontier) {
      const lv = level.get(id) ?? 0
      for (const to of adj.get(id) ?? []) {
        if ((level.get(to) ?? -1) < lv + 1) {
          level.set(to, lv + 1)
          next.push(to)
        }
      }
    }
    frontier = next
    guard++
  }

  // 没被赋层的节点（环内）按剩余顺序追加
  let nextLevel = Math.max(0, ...Array.from(level.values())) + 1
  nodes.forEach((n) => {
    if (!level.has(n.id)) level.set(n.id, nextLevel++)
  })

  // 分行排列
  const rows = new Map<number, string[]>()
  nodes.forEach((n) => {
    const lv = level.get(n.id) ?? 0
    if (!rows.has(lv)) rows.set(lv, [])
    rows.get(lv)!.push(n.id)
  })

  const pos: Record<string, { x: number; y: number }> = {}
  rows.forEach((ids, lv) => {
    const rowW = ids.length * NODE_W + (ids.length - 1) * GAP_X
    ids.forEach((id, i) => {
      pos[id] = { x: i * (NODE_W + GAP_X), y: lv * (NODE_H + GAP_Y) }
    })
    void rowW
  })
  return pos
}
