import { defineConfig, type Plugin } from 'vite'  // 从 vite 中导入 defineConfig 和 Plugin 类型
import react from '@vitejs/plugin-react'  // 从 @vitejs/plugin-react 中导入 react 插件

/**
 * 本地 LLM 代理插件：把 POST /api/proxy 转发到目标模型 API。
 * 用于解决智谱等不允许浏览器跨域直连（无 CORS 响应头）的服务商。
 */
function llmProxy(): Plugin {  // 定义 llmProxy 函数，返回一个 Plugin 类型的对象
  return {
    name: 'bizlens-llm-proxy',  // 插件名称
    configureServer(server) {  // 配置开发服务器中间件
      server.middlewares.use('/api/proxy', async (req, res) => {  // 注册中间件，处理 /api/proxy 路径的请求
        try {  // 尝试执行代理请求
          const chunks: Buffer[] = []  // 初始化 Buffer 数组，用于接收请求体数据
          for await (const chunk of req) chunks.push(chunk as Buffer)  // 异步接收请求体数据
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as {  // 解析请求体为 JSON 对象
            url?: string  // 目标 URL
            headers?: Record<string, string>  // 请求头
            body?: unknown  // 请求体
          }
          const url = payload.url ?? ''  // 获取目标 URL，如果不存在则为空字符串
          if (!/^https?:\/\//.test(url)) {  // 检查 URL 是否有效
            res.statusCode = 400  // 设置响应状态码为 400 (Bad Request)
            res.end(JSON.stringify({ error: 'invalid url' }))  // 返回错误信息
            return  // 终止处理
          }
          const upstream = await fetch(url, {  // 向目标 URL 发起请求
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
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), llmProxy()],
  server: {
    port: 5173,
    host: true,
  },
})
