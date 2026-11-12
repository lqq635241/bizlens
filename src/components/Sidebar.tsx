import { useState } from 'react'
import type { Granularity, ProxyMode, Settings } from '../types'
import { GRANULARITY_LABEL } from '../types'
import { DEFAULT_SETTINGS } from '../lib/storage'

interface Props {
  settings: Settings
  onSettingsChange: (s: Settings) => void
  inputText: string
  onInputTextChange: (t: string) => void
  granularity: Granularity
  onGranularityChange: (g: Granularity) => void
  loading: boolean
  error: string | null
  hasGraph: boolean
  onAnalyze: () => void
  onRefine: (instruction: string) => void
  onExportMermaid: () => void
  onDownloadMermaid: () => void
  onExportPng: () => void
  onSaveProject: () => void
  onLoadProject: (file: File) => void
  onReset: () => void
}

const EXAMPLES = [
  {
    name: '电商退款流程',
    text: `用户在电商平台购买商品后申请退款。
首先用户在订单页发起退款申请，填写退款原因。
客服在 24 小时内审核申请：
- 如果商品未发货，直接同意全额退款，系统原路退回支付渠道；
- 如果商品已发货，需要用户先寄回商品，仓库验收合格后才会退款，验收不合格则退回给用户并关闭申请。
退款申请提交后超过 72 小时未处理，系统自动升级给主管处理。
整个过程结束后用户会收到短信通知。`,
  },
  {
    name: '员工请假审批',
    text: `公司员工在 OA 系统提交请假申请，选择请假类型（事假/病假/年假）和起止日期。
审批流根据请假天数自动路由：
- 1 天以内：直属主管审批即可；
- 1 到 3 天：直属主管审批后还需要部门经理审批；
- 3 天以上：需要再加一级 HRBP 审批。
病假需要上传病假条附件，附件不齐会被驳回补充。
审批全部通过后，OA 自动同步考勤系统并通知员工；任一环节驳回，申请回到员工修改后可重新提交。`,
  },
]

/** 常见服务商预设（Base URL 均为 OpenAI 兼容地址） */
const PRESETS: { name: string; baseUrl: string; model: string; cors?: boolean }[] = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', cors: true },
  { name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', cors: true },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', cors: true },
]

const PROXY_LABEL: Record<ProxyMode, string> = {
  auto: '自动（推荐）',
  direct: '浏览器直连',
  proxy: '本地代理',
}

/** 对话式调整的快捷指令 */
const QUICK_TIPS = [
  '更精细一点，把复杂步骤拆成子步骤',
  '补充异常、拒绝和失败分支',
  '增加超时催办和通知环节',
  '给关键步骤标注负责的角色或系统',
]

export default function Sidebar(props: Props) {
  const {
    settings, onSettingsChange, inputText, onInputTextChange,
    granularity, onGranularityChange,
    loading, error, hasGraph, onAnalyze, onRefine,
    onExportMermaid, onDownloadMermaid, onExportPng, onSaveProject, onLoadProject, onReset,
  } = props

  const [showSettings, setShowSettings] = useState(() => !settings.apiKey)
  const [instruction, setInstruction] = useState('')
  const [fileInputRef, setFileInputRef] = useState<HTMLInputElement | null>(null)

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    onSettingsChange({ ...settings, baseUrl: p.baseUrl, model: p.model })
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-header">
          <h1 className="brand">BizLens</h1>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSettings((v) => !v)}
          >
            ⚙ 模型设置
          </button>
        </div>

        {showSettings && (
          <div className="settings">
            <div className="preset-row">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  className={`btn btn-sm preset-btn${settings.baseUrl === p.baseUrl ? ' preset-active' : ''}`}
                  onClick={() => applyPreset(p)}
                  title={p.cors ? '支持浏览器直连' : '不支持浏览器直连，需走本地代理'}
                >
                  {p.name}{p.cors ? '' : ' ⚠'}
                </button>
              ))}
            </div>
            <label className="field">
              <span>API Base URL</span>
              <input
                type="text"
                value={settings.baseUrl}
                placeholder="https://api.deepseek.com/v1"
                onChange={(e) => onSettingsChange({ ...settings, baseUrl: e.target.value })}
              />
            </label>
            <label className="field">
              <span>API Key</span>
              <input
                type="password"
                value={settings.apiKey}
                placeholder="sk-..."
                onChange={(e) => onSettingsChange({ ...settings, apiKey: e.target.value })}
              />
            </label>
            <label className="field">
              <span>模型名称</span>
              <input
                type="text"
                value={settings.model}
                placeholder="deepseek-chat / glm-4-flash / ..."
                onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
              />
            </label>
            <label className="field">
              <span>请求方式</span>
              <select
                value={settings.proxyMode ?? 'auto'}
                onChange={(e) =>
                  onSettingsChange({ ...settings, proxyMode: e.target.value as ProxyMode })
                }
              >
                {(Object.keys(PROXY_LABEL) as ProxyMode[]).map((m) => (
                  <option key={m} value={m}>{PROXY_LABEL[m]}</option>
                ))}
              </select>
            </label>
            <p className="hint">
              带 ⚠ 的服务商（如智谱 GLM）不允许浏览器跨域直连，保持「自动」即可：直连失败会自动走本地代理。
              Key 仅保存在你的浏览器本地。
              <button className="link-btn" onClick={() => onSettingsChange({ ...DEFAULT_SETTINGS })}>
                恢复默认
              </button>
            </p>
          </div>
        )}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-title">
          业务描述
          <span className="sidebar-title-right">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.name}
                className="link-btn"
                onClick={() => onInputTextChange(ex.text)}
              >
                示例：{ex.name}
              </button>
            ))}
          </span>
        </div>
        <textarea
          className="input-area"
          value={inputText}
          placeholder="粘贴 PRD、需求描述、会议纪要或业务流程的聊天记录……&#10;&#10;AI 会提取其中的角色、步骤、判断分支和状态。"
          onChange={(e) => onInputTextChange(e.target.value)}
          rows={10}
        />
        <label className="field granularity-row">
          <span>梳理粒度</span>
          <select
            value={granularity}
            onChange={(e) => onGranularityChange(e.target.value as Granularity)}
          >
            {(Object.keys(GRANULARITY_LABEL) as Granularity[]).map((g) => (
              <option key={g} value={g}>{GRANULARITY_LABEL[g]}</option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-primary"
          disabled={loading || !inputText.trim() || !settings.apiKey}
          onClick={onAnalyze}
        >
          {loading ? 'AI 正在梳理…' : '开始梳理'}
        </button>
        {!settings.apiKey && <p className="hint">请先在「模型设置」中填写 API Key。</p>}
        {error && <div className="error-box">{error}</div>}
      </div>

      {hasGraph && (
        <div className="sidebar-section">
          <div className="sidebar-title">对话式调整</div>
          <div className="tip-row">
            {QUICK_TIPS.map((tip) => (
              <button
                key={tip}
                className="btn btn-sm tip-btn"
                onClick={() => setInstruction(tip)}
                title="点击填入输入框，可修改后发送"
              >
                {tip}
              </button>
            ))}
          </div>
          <textarea
            className="input-area input-area-sm"
            rows={2}
            value={instruction}
            placeholder="例如：把退款环节单独展开 / 增加一个风控审核环节"
            onChange={(e) => setInstruction(e.target.value)}
          />
          <button
            className="btn"
            disabled={loading || !instruction.trim()}
            onClick={() => {
              onRefine(instruction.trim())
              setInstruction('')
            }}
          >
            {loading ? 'AI 正在修改…' : '应用调整'}
          </button>
          <div className="export-row">
            <button className="btn btn-ghost btn-sm" onClick={onExportPng}>
              导出 PNG
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onExportMermaid}>
              复制 Mermaid
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onDownloadMermaid}>
              下载 .mmd
            </button>
          </div>
          <div className="export-row">
            <button className="btn btn-ghost btn-sm" onClick={onSaveProject}>
              保存项目
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileInputRef?.click()}
            >
              导入项目
            </button>
            <button className="btn btn-ghost btn-sm btn-danger" onClick={onReset}>
              清空
            </button>
          </div>
          <input
            ref={setFileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onLoadProject(file)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </aside>
  )
}
