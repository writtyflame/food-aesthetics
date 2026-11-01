// 本地开发适配服务：直接在 Node 里跑 worker.js（绕过 workerd / wrangler dev 的 Windows spawn 问题）
// 用法：node local-server.mjs   （AGNES_API_KEY 可放同目录 .env 或环境变量）
import worker from './worker.js'
import http from 'node:http'
import fs from 'node:fs'

const PORT = 8787
const env = { AGNES_API_KEY: process.env.AGNES_API_KEY || '' }

// 简易读取 .env（仅本地用）
try {
  const txt = fs.readFileSync(new URL('./.env', import.meta.url), 'utf8')
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([\w-]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) env[m[1]] = m[2]
  }
} catch { /* 没有 .env 也不影响启动 */ }

http.createServer(async (req, res) => {
  const url = `http://localhost:${PORT}${req.url}`
  const chunks = []
  for await (const c of req) chunks.push(c)
  const body = Buffer.concat(chunks)
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body: body.length ? body : undefined,
  })
  try {
    const response = await worker.fetch(request, env)
    const buf = Buffer.from(await response.arrayBuffer())
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(buf)
  } catch (e) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: String(e && e.stack || e) }))
  }
}).listen(PORT, () => {
  console.log(`[local-worker] listening on http://localhost:${PORT}  (AGNES_API_KEY ${env.AGNES_API_KEY ? 'set' : 'NOT set'})`)
})
