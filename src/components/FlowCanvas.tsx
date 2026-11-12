import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react'
import { toPng } from 'html-to-image'
import '@xyflow/react/dist/style.css'
import NodeCard from './NodeCard'
import { layoutLevels } from '../lib/graph'
import { download } from '../lib/mermaid'
import { NODE_TYPE_LABEL, type Graph, type NodeType } from '../types'

const nodeTypes = { biz: NodeCard }

interface Props {
  graph: Graph | null
  nodes: Node[]
  edges: Edge[]
  setNodes: (updater: (ns: Node[]) => Node[]) => void
  setEdges: (updater: (es: Edge[]) => Edge[]) => void
  onEditNode: (id: string, patch: { label?: string; type?: NodeType; description?: string }) => void
  onDeleteNodes: (ids: string[]) => void
  onDeleteEdges: (pairs: { source: string; target: string }[]) => void
  onAddNode: (position: { x: number; y: number }, connectFromId?: string) => void
  exportApiRef: MutableRefObject<(() => Promise<void>) | null>
}

interface ContextMenu {
  x: number
  y: number
  flowPos: { x: number; y: number }
  nodeId?: string
}

interface EditForm {
  id: string
  label: string
  type: NodeType
  description: string
}

export default function FlowCanvas({
  graph, nodes, edges, setNodes, setEdges,
  onEditNode, onDeleteNodes, onDeleteEdges, onAddNode, exportApiRef,
}: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()
  const [menu, setMenu] = useState<ContextMenu | null>(null)
  const [editing, setEditing] = useState<EditForm | null>(null)

  // graph 变化时同步画布：已有节点保留拖拽位置，新节点用自动布局 / 项目快照位置
  useEffect(() => {
    if (!graph) return
    const layout = layoutLevels(graph.nodes, graph.edges)
    setNodes((prev) => {
      const prevPos = new Map(prev.map((n) => [n.id, n.position]))
      return graph.nodes.map((n) => ({
        id: n.id,
        type: 'biz' as const,
        position:
          prevPos.get(n.id) ??
          graph.positions?.[n.id] ??
          layout[n.id] ??
          { x: 0, y: 0 },
        data: { label: n.label, type: n.type, description: n.description },
      }))
    })
    setEdges(() =>
      graph.edges.map((e, i) => ({
        id: `e${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: e.label || undefined,
        style: { strokeWidth: 1.5, stroke: '#94a3b8' },
        labelStyle: { fontSize: 11, fill: '#64748b' },
        labelBgStyle: { fill: '#fff' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      }))
    )
  }, [graph, setNodes, setEdges])

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((ns) => applyNodeChanges(changes, ns)),
    [setNodes]
  )
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges]
  )

  const openMenuAt = (
    e: { preventDefault: () => void; clientX: number; clientY: number },
    nodeId?: string
  ) => {
    e.preventDefault()
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    setMenu({ x: e.clientX, y: e.clientY, flowPos, nodeId })
  }

  const closeMenu = () => setMenu(null)

  const menuAction = (action: 'edit' | 'delete' | 'addConnected' | 'addHere') => {
    if (!menu) return
    if (action === 'edit' && menu.nodeId) {
      const node = graph?.nodes.find((n) => n.id === menu.nodeId)
      if (node) {
        setEditing({ id: node.id, label: node.label, type: node.type, description: node.description ?? '' })
      }
    } else if (action === 'delete' && menu.nodeId) {
      onDeleteNodes([menu.nodeId])
    } else if (action === 'addConnected' && menu.nodeId) {
      onAddNode({ x: menu.flowPos.x, y: menu.flowPos.y + 140 }, menu.nodeId)
    } else if (action === 'addHere') {
      onAddNode({ x: menu.flowPos.x, y: menu.flowPos.y })
    }
    closeMenu()
  }

  const saveEditing = () => {
    if (!editing) return
    onEditNode(editing.id, {
      label: editing.label.trim() || '未命名',
      type: editing.type,
      description: editing.description.trim(),
    })
    setEditing(null)
  }

  // 导出 PNG（注册给侧边栏按钮调用）
  const exportPng = useCallback(async () => {
    if (!graph || graph.nodes.length === 0) return
    const W = 1280
    const H = 960
    const bounds = getNodesBounds(nodes)
    const vp = getViewportForBounds(bounds, W, H, 0.2, 2, 0.12)
    const el = wrapperRef.current?.querySelector('.react-flow__viewport') as HTMLElement | null
    if (!el) return
    const dataUrl = await toPng(el, {
      backgroundColor: '#f8fafc',
      width: W,
      height: H,
      style: {
        width: `${W}px`,
        height: `${H}px`,
        transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
      },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${graph.title || 'bizlens'}.png`
    a.click()
  }, [graph, nodes])
  exportApiRef.current = exportPng

  if (!graph) {
    return (
      <div className="canvas-empty">
        <div className="canvas-empty-icon">🗺️</div>
        <h2>把业务描述丢进来，让 AI 帮你画出来</h2>
        <p>
          在左侧粘贴 PRD、需求描述或业务聊天记录，点击「开始梳理」，
          <br />
          AI 会提取角色、步骤、判断分支和状态，生成交互式流程画布。
        </p>
      </div>
    )
  }

  return (
    <div className="canvas-wrap" ref={wrapperRef} onClick={closeMenu}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeContextMenu={(e, node) => openMenuAt(e, node.id)}
        onPaneContextMenu={(e) => openMenuAt(e)}
        onNodeDoubleClick={(_, node) => {
          const n = graph.nodes.find((x) => x.id === node.id)
          if (n) setEditing({ id: n.id, label: n.label, type: n.type, description: n.description ?? '' })
        }}
        onNodesDelete={(deleted) => onDeleteNodes(deleted.map((n) => n.id))}
        onEdgesDelete={(deleted) =>
          onDeleteEdges(deleted.map((e) => ({ source: e.source, target: e.target })))
        }
        deleteKeyCode={['Delete', 'Backspace']}
        nodesDraggable
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
      </ReactFlow>

      <div className="canvas-tip">
        双击节点编辑文字 · 右键节点/画布：编辑、删除、新增 · Delete 键删除选中项
      </div>

      {menu && (
        <div
          className="ctx-menu"
          style={{ left: menu.x, top: menu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {menu.nodeId && (
            <>
              <button className="ctx-item" onClick={() => menuAction('edit')}>✏️ 编辑节点</button>
              <button className="ctx-item" onClick={() => menuAction('addConnected')}>➕ 在下方添加并连接</button>
              <button className="ctx-item ctx-danger" onClick={() => menuAction('delete')}>🗑 删除节点</button>
              <div className="ctx-divider" />
            </>
          )}
          <button className="ctx-item" onClick={() => menuAction('addHere')}>➕ 在此处添加节点</button>
        </div>
      )}

      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑节点</h3>
            <label className="field">
              <span>名称</span>
              <input
                autoFocus
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && saveEditing()}
              />
            </label>
            <label className="field">
              <span>类型</span>
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as NodeType })}
              >
                {(Object.keys(NODE_TYPE_LABEL) as NodeType[]).map((t) => (
                  <option key={t} value={t}>{NODE_TYPE_LABEL[t]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>说明</span>
              <textarea
                rows={3}
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </label>
            <div className="modal-actions">
              <button className="btn" style={{ width: 'auto' }} onClick={() => setEditing(null)}>取消</button>
              <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveEditing}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
