/**
 * Cloudflare Worker — AI食物美学评测 API
 * 使用 智谱 GLM-4V-Flash（永久免费的多模态视觉模型，OpenAI 兼容）
 *
 * 部署方式：wrangler.toml + wrangler deploy
 * 环境变量：GLM_API_KEY（在 Cloudflare 控制台添加，open.bigmodel.cn 免费注册获取）
 *
 * 路由：
 *   POST /evaluate | /api/evaluate   评测（base64 data URL 内联给 GLM，零图床依赖）
 *   GET  /img/<key>                  从 R2 直读图片（保留作兜底/调试）
 *   GET  /health | /api/health       健康检查
 */

const EVALUATION_PROMPT = `你是一位专业的美食美学分析师，擅长从视觉角度评价菜品的摆盘美学。

请分析用户上传的菜品照片，从以下6个维度进行评分（每个维度1-10分），并给出整体评分（1-100分）和一个有趣的"餐桌人格"标签。

**输出格式要求（必须是合法JSON，不要有任何其他内容）：**
{
  "color": 7.5,
  "composition": 8.0,
  "texture": 6.5,
  "appetite": 8.5,
  "story_score": 7.5,
  "story": "这道菜传递了家庭聚餐的温暖氛围，像周末下午的阳光一样舒服",
  "overall_score": 78,
  "persona_label": "暖心治愈派",
  "persona_desc": "你的餐桌是治愈系港湾，每一道菜都在说\"好好吃饭\"",
  "tips": [
    "可以尝试用暖色调餐盘增强温馨感",
    "适当增加一些绿色点缀会让色彩更丰富"
  ],
  "share_text": "AI给我的晚餐打了78分，说我是一个「暖心治愈派」食客～快来测测你的餐桌人格！"
}

评分标准：
- 色彩：食材颜色搭配是否和谐有层次
- 构图：菜品在画面中的布局是否有美感  
- 质感：不同食材质感的呈现是否丰富
- 食欲：看了是否让人产生想吃欲望
- 故事感：菜品传递的氛围和情绪（story_score 是分数，story 是文字描述）
- 整体：综合以上维度加权打分

人格标签（选一个最贴切的）：
暖心治愈派、精致主义派、烟火街头派、自然本味派、冒险玩味派、氛围营造派、佛系干饭派

注意：对任何菜品都要找到亮点，给予鼓励性评价。`

// 视觉模型：智谱 GLM-4V-Flash（永久免费，OpenAI 兼容，支持 base64 data URL 内联）
const VISION_ENDPOINT = 'https://open.bigmodel.cn/api/paas/v4/chat/completions'
const VISION_MODEL = 'glm-4v-flash'

const json = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
})

/**
 * 规范化前端传来的图片数据
 * 兼容：data URL / 纯 base64 / URL-safe base64 / 被 URL 编码过的 base64 / 带换行的 base64
 */
function normalizeImage(input) {
  if (typeof input !== 'string' || !input.trim()) return null

  let s = input.trim()
  // 被 URL 编码过的（%2B 等）先还原
  if (s.includes('%')) {
    try { s = decodeURIComponent(s) } catch { /* 忽略，继续按原样处理 */ }
  }
  // 去掉所有空白/换行
  s = s.replace(/\s+/g, '')

  let mime = 'image/jpeg'
  const m = s.match(/^data:([^;,]+);base64,(.*)$/i)
  if (m) {
    mime = m[1]
    s = m[2]
  }
  // URL-safe base64 -> 标准 base64
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  // 补齐 padding
  const pad = s.length % 4
  if (pad === 2) s += '=='
  else if (pad === 3) s += '='

  if (s.length < 32 || !/^[A-Za-z0-9+/=]+$/.test(s)) return null

  return { raw: s, mime, dataUrl: `data:${mime};base64,${s}` }
}

/**
 * 调用 GLM-4V-Flash，返回 { ok, status, data, errorText }
 * 图片以 base64 data URL 内联进 messages（GLM 直接读内联图，无需公网图床）。
 */
async function callVision(apiKey, image) {
  const resp = await fetch(VISION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: VISION_MODEL,
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: image.dataUrl } },
          { type: 'text', text: EVALUATION_PROMPT }
        ]
      }],
      max_tokens: 800,
      temperature: 0.7
    })
  })

  const text = await resp.text()
  let data = null
  try { data = JSON.parse(text) } catch { /* 非 JSON 响应 */ }

  return {
    ok: resp.ok,
    status: resp.status,
    data,
    errorText: data?.error?.message || data?.message || data?.error || (text || '').slice(0, 300)
  }
}

/**
 * 用 Worker 代理 R2 对象（保留作兜底/调试，当前主链路不依赖图床）
 */
async function handleImage(env, key) {
  if (!env.BUCKET) return new Response('Not Found', { status: 404 })
  if (!/^eval\/[A-Za-z0-9._-]+$/.test(key)) {
    return new Response('Bad Request', { status: 400 })
  }
  const obj = await env.BUCKET.get(key)
  if (!obj) return new Response('Not Found', { status: 404 })

  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('etag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('Access-Control-Allow-Origin', '*')
  return new Response(obj.body, { headers })
}

/**
 * 把上游错误文本清洗成可读的一句（Cloudflare 错误页是 HTML，直接透传会是一堆标签）
 */
function cleanErrorText(raw) {
  return String(raw || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200)
}

/** 是否是「图片读不出来」类错误（换投递方式可能有救，而非额度/参数问题） */
function isImageLoadError(result) {
  const text = String(result.errorText || '')
  return /loading IMAGE data|while loading data|Non-base64 digit|invalid image|image.*(load|fetch|download)|failed to (load|fetch|download) image/i.test(text)
}

/**
 * 给前端的友好错误文案
 */
function friendlyError(result) {
  const text = String(result.errorText || '')
  const status = result.status || 0

  // 限流：429 或高频/并发类文案
  if (/rate limit|too many requests|429|请求频率|QPS|并发|frequency/i.test(text) || status === 429) {
    return {
      code: 'UPSTREAM_RATE_LIMITED',
      message: '上游免费接口限流（HTTP 429），请等待约 1 分钟后再试',
    }
  }
  // 额度/余额类
  if (/quota|余额|额度|余额不足|credit|insufficient/i.test(text)) {
    return {
      code: 'UPSTREAM_QUOTA',
      message: '上游模型额度不足（GLM 免费档有并发/频率限制），请稍后重试',
    }
  }
  if (isImageLoadError(result)) {
    return {
      code: 'IMAGE_LOAD_FAILED',
      message: '上游读取图片失败，请换一张更小、更常见的 JPG/PNG 图片再试',
    }
  }
  if (/401|unauthorized|invalid.*key|API key/i.test(text) || status === 401) {
    return {
      code: 'BAD_KEY',
      message: '后端 GLM_API_KEY 无效或未配置，请联系站长',
    }
  }
  return {
    code: 'UPSTREAM_ERROR',
    message: cleanErrorText(text) || `上游接口返回 HTTP ${status}`,
  }
}

/** 是否值得重试（仅限流类） */
function isRetryable(result) {
  const text = String(result.errorText || '')
  if (/quota|余额|额度|credit|insufficient/i.test(text)) return false
  if (isImageLoadError(result)) return false
  if (/401|unauthorized|invalid.*key|API key/i.test(text) || result.status === 401) return false
  return result.status === 429 || /rate limit|too many requests/i.test(text)
}

const sleep = ms => new Promise(r => setTimeout(r, ms))

/** 带退避重试的视觉模型调用（仅对限流类错误重试） */
async function callVisionWithRetry(apiKey, image) {
  const delays = [0, 2000, 6000]
  let result
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await sleep(delays[i])
    result = await callVision(apiKey, image)
    const failed = !result.ok || result.data?.error
    if (!failed) return result
    if (!isRetryable(result)) return result
    console.warn(`GLM 限流（${result.status}），第 ${i + 1}/${delays.length} 次尝试`)
  }
  return result
}

async function handleEvaluate(request, env) {
  const apiKey = env.GLM_API_KEY
  if (!apiKey) {
    return json({ error: '后端未配置 GLM_API_KEY（Cloudflare Worker 环境变量，open.bigmodel.cn 免费获取）' }, 500)
  }

  let body
  try {
    body = await request.json()
  } catch {
    return json({ error: '请求体解析失败' }, 400)
  }

  const image = normalizeImage(body.image)
  if (!image) {
    return json({ error: '图片数据格式不正确，请重新上传照片' }, 400)
  }

  try {
    // 主方案：base64 data URL 内联，GLM 直接读图，零图床依赖，不走 Worker 公网出口拉图。
    let result = await callVisionWithRetry(apiKey, image)

    if (!result.ok || result.data?.error) {
      console.error('GLM 调用失败:', result.status, cleanErrorText(result.errorText))
      const friendly = friendlyError(result)
      return json({
        error: friendly.message,
        code: friendly.code,
        upstreamStatus: result.status,
        transport: 'inline-base64'
      }, 502)
    }

    const content = result.data?.choices?.[0]?.message?.content || ''

    // 提取 JSON
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    let data = {}
    if (start !== -1 && end !== -1) {
      try {
        data = JSON.parse(content.substring(start, end + 1))
      } catch (e) {
        console.error('JSON parse error:', e, 'content:', content.substring(0, 500))
      }
    }

    // 兼容模型把 story 当分数返回的情况
    if (typeof data.story === 'number' && data.story_score === undefined) {
      data.story_score = data.story
      data.story = ''
    }

    // 补充默认值
    const defaults = {
      color: 6.0, composition: 6.0, texture: 6.0, appetite: 6.0, story_score: 6.0,
      story: '这是一道充满生活气息的家常美味',
      overall_score: 65, persona_label: '佛系干饭派',
      persona_desc: '好好吃饭，认真生活',
      tips: ['下次可以试试不同的摆盘方式'],
      share_text: '快来测测你的餐桌人格！'
    }
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in data) || data[k] === null || data[k] === '') data[k] = v
    }

    return json({ success: true, data, transport: 'inline-base64' })
  } catch (err) {
    console.error('handleEvaluate 异常:', err && err.stack || err)
    return json({ error: err.message || '服务异常' }, 500)
  }
}

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response('', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      })
    }

    const url = new URL(request.url)
    
    if ((url.pathname === '/api/evaluate' || url.pathname === '/evaluate') && request.method === 'POST') {
      return handleEvaluate(request, env)
    }

    // 图片代理：保留作兜底/调试（当前主链路不依赖图床）
    if (url.pathname.startsWith('/img/')) {
      return handleImage(env, decodeURIComponent(url.pathname.slice('/img/'.length)))
    }

    if (url.pathname === '/api/health' || url.pathname === '/health') {      return new Response(JSON.stringify({ status: 'ok', model: 'glm-4v-flash' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response('Not Found', { status: 404 })
  }
}
