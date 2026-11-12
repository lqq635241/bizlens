/**
 * BizLens 生产模式服务器：
 * 1. 提供静态文件服务（dist/）
 * 2. 提供 /api/proxy 本地 LLM 代理（解决智谱等服务商不允许浏览器跨域直连的问题）
 *
 * 用法：npm run build && npm start   （默认端口 8080，可用 PORT 环境变量覆盖）
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dist = path.join(__dirname, 'dist')
const PORT = Number(process.env.PORT || 8080)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
}

async function handleProxy(req, res) {
  try {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    const url = payload.url ?? ''
    if (!/^https?:\/\//.test(url)) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'invalid url' }))
      return
    }
    const upstream = await fetch(url, {
      method: 'POST',
      headers: payload.headers ?? {},
      body: JSON.stringify(payload.body ?? {}),
    })
    res.statusCode = upstream.status
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') ?? 'application/json'
    )
    res.end(await upstream.text())
  } catch (e) {
    res.statusCode = 502
    res.end(JSON.stringify({ error: String(e) }))
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url?.startsWith('/api/proxy')) {
    await handleProxy(req, res)
    return
  }

  const urlPath = (req.url ?? '/').split('?')[0]
  let filePath = path.join(dist, urlPath === '/' ? 'index.html' : urlPath)
  if (!filePath.startsWith(dist) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(dist, 'index.html') // SPA fallback
  }
  const ext = path.extname(filePath)
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
})

server.listen(PORT, () => {
  console.log(`BizLens 已启动: http://localhost:${PORT}`)
})
