/**
 * Cloudflare Worker — AI食物美学评测 API
 * 使用 Agnes AI (agnes-2.5-flash 多模态模型)
 * 
 * 部署方式：wrangler.toml + wrangler deploy
 * 环境变量：AGNES_API_KEY（在 Cloudflare 控制台添加）
 */

const EVALUATION_PROMPT = `你是一位专业的美食美学分析师，擅长从视觉角度评价菜品的摆盘美学。

请分析用户上传的菜品照片，从以下6个维度进行评分（每个维度1-10分），并给出整体评分（1-100分）和一个有趣的"餐桌人格"标签。

**输出格式要求（必须是合法JSON，不要有任何其他内容）：**
{
  "color": 7.5,
  "composition": 8.0,
  "texture": 6.5,
  "appetite": 8.5,
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
- 故事感：菜品传递的氛围和情绪
- 整体：综合以上维度加权打分

人格标签（选一个最贴切的）：
暖心治愈派、精致主义派、烟火街头派、自然本味派、冒险玩味派、氛围营造派、佛系干饭派

注意：对任何菜品都要找到亮点，给予鼓励性评价。`

async function handleEvaluate(request, env) {
  const apiKey = env.AGNES_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AGNES_API_KEY 未配置，请在 Cloudflare 控制台添加环境变量' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: '请求体解析失败' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  const imageB64 = body.image
  if (!imageB64) {
    return new Response(JSON.stringify({ error: '请上传菜品照片' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }

  try {
    const resp = await fetch('https://apihub.agnes-ai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'agnes-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageB64 } },
            { type: 'text', text: EVALUATION_PROMPT }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.7
      })
    })

    const result = await resp.json()
    
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message || 'API 请求失败' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const content = result?.choices?.[0]?.message?.content || ''

    // 提取 JSON
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    let data = {}
    if (start !== -1 && end !== -1) {
      try {
        data = JSON.parse(content.substring(start, end + 1))
      } catch (e) {
        console.error('JSON parse error:', e)
      }
    }

    // 补充默认值
    const defaults = {
      color: 6.0, composition: 6.0, texture: 6.0, appetite: 6.0,
      story: '这是一道充满生活气息的家常美味',
      overall_score: 65, persona_label: '佛系干饭派',
      persona_desc: '好好吃饭，认真生活',
      tips: ['下次可以试试不同的摆盘方式'],
      share_text: '快来测测你的餐桌人格！'
    }
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in data)) data[k] = v
    }

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
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
    
    if (url.pathname === '/api/evaluate' && request.method === 'POST') {
      return handleEvaluate(request, env)
    }
    
    if (url.pathname === '/api/health') {
      return new Response(JSON.stringify({ status: 'ok', model: 'agnes-2.5-flash' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    return new Response('Not Found', { status: 404 })
  }
}
