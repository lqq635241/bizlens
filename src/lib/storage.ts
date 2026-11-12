import type { Graph, Settings } from '../types'

const SETTINGS_KEY = 'bizlens.settings'
const GRAPH_KEY = 'bizlens.lastGraph'

export const DEFAULT_SETTINGS: Settings = {
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  model: 'deepseek-chat',
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(s: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function saveLastGraph(g: Graph | null) {
  if (g) localStorage.setItem(GRAPH_KEY, JSON.stringify(g))
  else localStorage.removeItem(GRAPH_KEY)
}

export function loadLastGraph(): Graph | null {
  try {
    const raw = localStorage.getItem(GRAPH_KEY)
    return raw ? (JSON.parse(raw) as Graph) : null
  } catch {
    return null
  }
}
