import type { Settings } from '../types'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 发起模型请求。
 * proxyMode:
 *  - direct: 浏览器直连
 *  - proxy:  走本地代理（/api/proxy），适合智谱等不允许跨域直连的服务商
 *  - auto:   先直连，网络层失败（通常是被 CORS 拦截）时自动改走本地代理
 */
async function requestUpstream(
  settings: Settings,
  url: string,
  headers: Record<string, string>,
  body: unknown
): Promise<Response> {
  const direct = () =>
    fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
  const viaProxy = () =>
    fetch('/api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, headers, body }),
    })

  const mode = settings.proxyMode ?? 'auto'
  if (mode === 'direct') return direct()
  if (mode === 'proxy') return viaProxy()

  try {
    return await direct()
  } catch (e) {
    if (e instanceof TypeError) {
      // Failed to fetch —— 大概率是 CORS 拦截，自动改走本地代理
      return viaProxy()
    }
    throw e
  }
}

/** 调用 OpenAI 兼容的 chat/completions 接口 */
export async function chatCompletion(
  settings: Settings,
  messages: ChatMessage[],
  opts?: { json?: boolean }
): Promise<string> {
  const url = settings.baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: 0.2,
  }
  if (opts?.json) body.response_format = { type: 'json_object' }

  let res: Response
  try {
    res = await requestUpstream(settings, url, {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    }, body)
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error(
        '无法连接模型 API（浏览器请求被拦截）。请确认：1) Base URL 正确；2) 若服务商不支持浏览器跨域（如智谱），在「模型设置」中把请求方式切换为「本地代理」并重启开发服务器。'
      )
    }
    throw e
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `API 请求失败 (HTTP ${res.status})：${text.slice(0, 300) || res.statusText}`
    )
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI 返回了空内容，请检查模型名称是否正确。')
  }
  return content
}

/** 从 AI 返回的文本中鲁棒地提取 JSON 对象 */
export function extractJson<T = unknown>(text: string): T {
  let t = text.trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()

  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI 返回的内容中未找到 JSON，请重试或换一个模型。')
  }
  try {
    return JSON.parse(t.slice(start, end + 1)) as T
  } catch {
    throw new Error('AI 返回的 JSON 解析失败，请重试或换一个模型。')
  }
}
