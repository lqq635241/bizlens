import { Handle, Position, type NodeProps } from '@xyflow/react'
import { NODE_TYPE_LABEL, type NodeType } from '../types'

const TYPE_STYLE: Record<NodeType, { bg: string; border: string; badge: string }> = {
  start: { bg: '#ecfdf5', border: '#10b981', badge: '#047857' },
  step: { bg: '#eff6ff', border: '#3b82f6', badge: '#1d4ed8' },
  decision: { bg: '#fffbeb', border: '#f59e0b', badge: '#b45309' },
  state: { bg: '#f0fdfa', border: '#14b8a6', badge: '#0f766e' },
  role: { bg: '#faf5ff', border: '#8b5cf6', badge: '#6d28d9' },
  end: { bg: '#fef2f2', border: '#ef4444', badge: '#b91c1c' },
}

export default function NodeCard(props: NodeProps) {
  const data = props.data as { label: string; type: NodeType; description?: string }
  const style = TYPE_STYLE[data.type] ?? TYPE_STYLE.step

  return (
    <div
      className="biz-node"
      style={{ background: style.bg, borderColor: style.border }}
      title={data.description || undefined}
    >
      <Handle type="target" position={Position.Top} style={{ background: style.border }} />
      <span className="biz-node-badge" style={{ background: style.badge }}>
        {NODE_TYPE_LABEL[data.type] ?? '步骤'}
      </span>
      <div className="biz-node-label">{data.label}</div>
      {data.description ? <div className="biz-node-desc">{data.description}</div> : null}
      <Handle type="source" position={Position.Bottom} style={{ background: style.border }} />
    </div>
  )
}
