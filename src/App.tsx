import { useCallback, useRef, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Edge, Node } from '@xyflow/react'
import Sidebar from './components/Sidebar'
import FlowCanvas from './components/FlowCanvas'
import { chatCompletion, extractJson } from './lib/llm'
import { analyzeSystemPrompt, REFINE_SYSTEM_PROMPT } from './lib/prompt'
import { normalizeGraph } from './lib/graph'
import { download, toMermaid } from './lib/mermaid'
import { loadSettings, loadLastGraph, saveLastGraph, saveSettings } from './lib/storage'
import type { Granularity, Graph, NodeType, Settings } from './types'

export default function App() {
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings())
  const [inputText, setInputText] = useState('')
  const [granularity, setGranularity] = useState<Granularity>('standard')
  const [graph, setGraph] = useState<Graph | null>(() => loadLastGraph())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nodes, setNodesState] = useState<Node[]>([])
  const [edges, setEdgesState] = useState<Edge[]>([])
  const pngExportRef = useRef<(() => Promise<void>) | null>(null)

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(s)
    saveSettings(s)
  }, [])

  const setGraphSafe = useCallback(
    (value: Graph | null | ((g: Graph | null) => Graph | null)) => {
      setGraph((prev) => {
        const next =
          typeof value === 'function' ? (value as (g: Graph | null) => Graph | null)(prev) : value
        saveLastGraph(next)
        return next
      })
    },
    []
  )

  const setNodes = useCallback((updater: (ns: Node[]) => Node[]) => {
    setNodesState((ns) => updater(ns))
  }, [])
  const setEdges = useCallback((updater: (es: Edge[]) => Edge[]) => {
    setEdgesState((es) => updater(es))
  }, [])

  /* ---------- 画布编辑：编辑 / 删除 / 新增 ---------- */

  const handleEditNode = useCallback(
    (id: string, patch: { label?: string; type?: NodeType; description?: string }) => {
      setGraphSafe(
        (g) =>
          g && {
            ...g,
            nodes: g.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
          }
      )
    },
    [setGraphSafe]
  )

  const handleDeleteNodes = useCallback(
    (ids: string[]) => {
      setGraphSafe(
        (g) =>
          g && {
            ...g,
            nodes: g.nodes.filter((n) => !ids.includes(n.id)),
            edges: g.edges.filter((e) => !ids.includes(e.from) && !ids.includes(e.to)),
            positions: Object.fromEntries(
              Object.entries(g.positions ?? {}).filter(([k]) => !ids.includes(k))
            ),
          }
      )
    },
    [setGraphSafe]
  )

  const handleDeleteEdges = useCallback(
    (pairs: { source: string; target: string }[]) => {
      setGraphSafe(
        (g) =>
          g && {
            ...g,
            edges: g.edges.filter(
              (e) => !pairs.some((p) => p.source === e.from && p.target === e.to)
            ),
          }
      )
    },
    [setGraphSafe]
  )

  const handleAddNode = useCallback(
    (position: { x: number; y: number }, connectFromId?: string) => {
      setGraphSafe((g) => {
        if (!g) return g
        const id = `u${Date.now()}`
        return {
          ...g,
          nodes: [...g.nodes, { id, label: '新步骤', type: 'step', description: '' }],
          edges: connectFromId
            ? [...g.edges, { from: connectFromId, to: id, label: '' }]
            : g.edges,
          positions: { ...(g.positions ?? {}), [id]: position },
        }
      })
    },
    [setGraphSafe]
  )

  /* ---------- AI 调用 ---------- */

  const run = useCallback(
    async (messages: { role: 'system' | 'user'; content: string }[]) => {
      setLoading(true)
      setError(null)
      try {
        let content: string
        try {
          content = await chatCompletion(settings, messages, { json: true })
        } catch (e) {
          // 某些供应商不支持 response_format，去掉后重试一次
          const msg = e instanceof Error ? e.message : String(e)
          if (/response_format|400/i.test(msg)) {
            content = await chatCompletion(settings, messages)
          } else {
            throw e
          }
        }
        const raw = extractJson(content)
        const g = normalizeGraph(raw)
        setGraphSafe(g)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    },
    [settings, setGraphSafe]
  )

  const handleAnalyze = useCallback(() => {
    void run([
      { role: 'system', content: analyzeSystemPrompt(granularity) },
      { role: 'user', content: `请梳理以下业务描述：\n\n${inputText.trim()}` },
    ])
  }, [run, inputText, granularity])

  const handleRefine = useCallback(
    (instruction: string) => {
      if (!graph) return
      void run([
        { role: 'system', content: REFINE_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `当前流程图 JSON：\n${JSON.stringify(graph)}\n\n调整指令：${instruction}`,
        },
      ])
    },
    [run, graph]
  )

  /* ---------- 导出 / 保存 / 加载 ---------- */

  const handleExportMermaid = useCallback(() => {
    if (!graph) return
    const code = toMermaid(graph)
    navigator.clipboard
      .writeText(code)
      .then(() => alert('Mermaid 代码已复制到剪贴板'))
      .catch(() => download('bizlens-flow.mmd', code))
  }, [graph])

  const handleDownloadMermaid = useCallback(() => {
    if (!graph) return
    download(`${graph.title || 'bizlens-flow'}.mmd`, toMermaid(graph))
  }, [graph])

  const handleExportPng = useCallback(() => {
    void pngExportRef.current?.()
  }, [])

  const handleSaveProject = useCallback(() => {
    if (!graph) return
    const positions: Record<string, { x: number; y: number }> = {}
    nodes.forEach((n) => {
      positions[n.id] = n.position
    })
    const data = {
      app: 'bizlens',
      version: 1,
      savedAt: new Date().toISOString(),
      graph: { ...graph, positions },
    }
    download(`${graph.title || 'bizlens'}.bizlens.json`, JSON.stringify(data, null, 2))
  }, [graph, nodes])

  const handleLoadProject = useCallback(
    async (file: File) => {
      try {
        const data = JSON.parse(await file.text()) as {
          graph?: Partial<Graph>
          positions?: Record<string, { x: number; y: number }>
        }
        const rawGraph = data.graph ?? data
        const g = normalizeGraph(rawGraph)
        setGraphSafe({ ...g, positions: data.graph?.positions ?? data.positions })
        setError(null)
      } catch (e) {
        setError(
          '项目文件解析失败：' + (e instanceof Error ? e.message : String(e))
        )
      }
    },
    [setGraphSafe]
  )

  const handleReset = useCallback(() => {
    setGraphSafe(null)
    setInputText('')
    setError(null)
    setNodesState([])
    setEdgesState([])
  }, [setGraphSafe])

  return (
    <div className="app">
      <Sidebar
        settings={settings}
        onSettingsChange={setSettings}
        inputText={inputText}
        onInputTextChange={setInputText}
        granularity={granularity}
        onGranularityChange={setGranularity}
        loading={loading}
        error={error}
        hasGraph={!!graph}
        onAnalyze={handleAnalyze}
        onRefine={handleRefine}
        onExportMermaid={handleExportMermaid}
        onDownloadMermaid={handleDownloadMermaid}
        onExportPng={handleExportPng}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProject}
        onReset={handleReset}
      />
      <main className="main">
        {graph && (
          <div className="graph-header">
            <h2>{graph.title}</h2>
            {graph.summary && <p>{graph.summary}</p>}
          </div>
        )}
        <ReactFlowProvider>
          <FlowCanvas
            graph={graph}
            nodes={nodes}
            edges={edges}
            setNodes={setNodes}
            setEdges={setEdges}
            onEditNode={handleEditNode}
            onDeleteNodes={handleDeleteNodes}
            onDeleteEdges={handleDeleteEdges}
            onAddNode={handleAddNode}
            exportApiRef={pngExportRef}
          />
        </ReactFlowProvider>
      </main>
    </div>
  )
}
