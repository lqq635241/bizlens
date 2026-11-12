import type { Graph, RawNode } from '../types'

function mermaidShape(n: RawNode): string {
  const label = n.label.replace(/["'[\]{}()|]/g, ' ').trim() || n.id
  switch (n.type) {
    case 'decision':
      return `{${label}}`
    case 'role':
      return `([${label}])`
    case 'start':
    case 'end':
      return `((${label}))`
    default:
      return `[${label}]`
  }
}

/** 导出为 Mermaid flowchart 代码 */
export function toMermaid(graph: Graph): string {
  const lines: string[] = ['flowchart TD']
  for (const n of graph.nodes) {
    lines.push(`    ${n.id}${mermaidShape(n)}`)
  }
  for (const e of graph.edges) {
    if (e.label) {
      const l = e.label.replace(/["'|]/g, ' ').trim()
      lines.push(`    ${e.from} -->|${l}| ${e.to}`)
    } else {
      lines.push(`    ${e.from} --> ${e.to}`)
    }
  }
  return lines.join('\n')
}

export function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
