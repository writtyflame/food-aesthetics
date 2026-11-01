var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var EVALUATION_PROMPT = `\u4F60\u662F\u4E00\u4F4D\u4E13\u4E1A\u7684\u7F8E\u98DF\u7F8E\u5B66\u5206\u6790\u5E08\uFF0C\u64C5\u957F\u4ECE\u89C6\u89C9\u89D2\u5EA6\u8BC4\u4EF7\u83DC\u54C1\u7684\u6446\u76D8\u7F8E\u5B66\u3002

\u8BF7\u5206\u6790\u7528\u6237\u4E0A\u4F20\u7684\u83DC\u54C1\u7167\u7247\uFF0C\u4ECE\u4EE5\u4E0B6\u4E2A\u7EF4\u5EA6\u8FDB\u884C\u8BC4\u5206\uFF08\u6BCF\u4E2A\u7EF4\u5EA61-10\u5206\uFF09\uFF0C\u5E76\u7ED9\u51FA\u6574\u4F53\u8BC4\u5206\uFF081-100\u5206\uFF09\u548C\u4E00\u4E2A\u6709\u8DA3\u7684"\u9910\u684C\u4EBA\u683C"\u6807\u7B7E\u3002

**\u8F93\u51FA\u683C\u5F0F\u8981\u6C42\uFF08\u5FC5\u987B\u662F\u5408\u6CD5JSON\uFF0C\u4E0D\u8981\u6709\u4EFB\u4F55\u5176\u4ED6\u5185\u5BB9\uFF09\uFF1A**
{
  "color": 7.5,
  "composition": 8.0,
  "texture": 6.5,
  "appetite": 8.5,
  "story": "\u8FD9\u9053\u83DC\u4F20\u9012\u4E86\u5BB6\u5EAD\u805A\u9910\u7684\u6E29\u6696\u6C1B\u56F4\uFF0C\u50CF\u5468\u672B\u4E0B\u5348\u7684\u9633\u5149\u4E00\u6837\u8212\u670D",
  "overall_score": 78,
  "persona_label": "\u6696\u5FC3\u6CBB\u6108\u6D3E",
  "persona_desc": "\u4F60\u7684\u9910\u684C\u662F\u6CBB\u6108\u7CFB\u6E2F\u6E7E\uFF0C\u6BCF\u4E00\u9053\u83DC\u90FD\u5728\u8BF4"\u597D\u597D\u5403\u996D"",
  "tips": [
    "\u53EF\u4EE5\u5C1D\u8BD5\u7528\u6696\u8272\u8C03\u9910\u76D8\u589E\u5F3A\u6E29\u99A8\u611F",
    "\u9002\u5F53\u589E\u52A0\u4E00\u4E9B\u7EFF\u8272\u70B9\u7F00\u4F1A\u8BA9\u8272\u5F69\u66F4\u4E30\u5BCC"
  ],
  "share_text": "AI\u7ED9\u6211\u7684\u665A\u9910\u6253\u4E8678\u5206\uFF0C\u8BF4\u6211\u662F\u4E00\u4E2A\u300C\u6696\u5FC3\u6CBB\u6108\u6D3E\u300D\u98DF\u5BA2\uFF5E\u5FEB\u6765\u6D4B\u6D4B\u4F60\u7684\u9910\u684C\u4EBA\u683C\uFF01"
}

\u8BC4\u5206\u6807\u51C6\uFF1A
- \u8272\u5F69\uFF1A\u98DF\u6750\u989C\u8272\u642D\u914D\u662F\u5426\u548C\u8C10\u6709\u5C42\u6B21
- \u6784\u56FE\uFF1A\u83DC\u54C1\u5728\u753B\u9762\u4E2D\u7684\u5E03\u5C40\u662F\u5426\u6709\u7F8E\u611F  
- \u8D28\u611F\uFF1A\u4E0D\u540C\u98DF\u6750\u8D28\u611F\u7684\u5448\u73B0\u662F\u5426\u4E30\u5BCC
- \u98DF\u6B32\uFF1A\u770B\u4E86\u662F\u5426\u8BA9\u4EBA\u4EA7\u751F\u60F3\u5403\u6B32\u671B
- \u6545\u4E8B\u611F\uFF1A\u83DC\u54C1\u4F20\u9012\u7684\u6C1B\u56F4\u548C\u60C5\u7EEA
- \u6574\u4F53\uFF1A\u7EFC\u5408\u4EE5\u4E0A\u7EF4\u5EA6\u52A0\u6743\u6253\u5206

\u4EBA\u683C\u6807\u7B7E\uFF08\u9009\u4E00\u4E2A\u6700\u8D34\u5207\u7684\uFF09\uFF1A
\u6696\u5FC3\u6CBB\u6108\u6D3E\u3001\u7CBE\u81F4\u4E3B\u4E49\u6D3E\u3001\u70DF\u706B\u8857\u5934\u6D3E\u3001\u81EA\u7136\u672C\u5473\u6D3E\u3001\u5192\u9669\u73A9\u5473\u6D3E\u3001\u6C1B\u56F4\u8425\u9020\u6D3E\u3001\u4F5B\u7CFB\u5E72\u996D\u6D3E

\u6CE8\u610F\uFF1A\u5BF9\u4EFB\u4F55\u83DC\u54C1\u90FD\u8981\u627E\u5230\u4EAE\u70B9\uFF0C\u7ED9\u4E88\u9F13\u52B1\u6027\u8BC4\u4EF7\u3002`;
async function handleEvaluate(request, env) {
  const apiKey = env.AGNES_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "AGNES_API_KEY \u672A\u914D\u7F6E\uFF0C\u8BF7\u5728 Cloudflare \u63A7\u5236\u53F0\u6DFB\u52A0\u73AF\u5883\u53D8\u91CF" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "\u8BF7\u6C42\u4F53\u89E3\u6790\u5931\u8D25" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  const imageB64 = body.image;
  if (!imageB64) {
    return new Response(JSON.stringify({ error: "\u8BF7\u4E0A\u4F20\u83DC\u54C1\u7167\u7247" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
  try {
    const resp = await fetch("https://apihub.agnes-ai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "agnes-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: imageB64 } },
            { type: "text", text: EVALUATION_PROMPT }
          ]
        }],
        max_tokens: 1500,
        temperature: 0.7
      })
    });
    const result = await resp.json();
    if (result.error) {
      return new Response(JSON.stringify({ error: result.error.message || "API \u8BF7\u6C42\u5931\u8D25" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    const content = result?.choices?.[0]?.message?.content || "";
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    let data = {};
    if (start !== -1 && end !== -1) {
      try {
        data = JSON.parse(content.substring(start, end + 1));
      } catch (e) {
        console.error("JSON parse error:", e);
      }
    }
    const defaults = {
      color: 6,
      composition: 6,
      texture: 6,
      appetite: 6,
      story: "\u8FD9\u662F\u4E00\u9053\u5145\u6EE1\u751F\u6D3B\u6C14\u606F\u7684\u5BB6\u5E38\u7F8E\u5473",
      overall_score: 65,
      persona_label: "\u4F5B\u7CFB\u5E72\u996D\u6D3E",
      persona_desc: "\u597D\u597D\u5403\u996D\uFF0C\u8BA4\u771F\u751F\u6D3B",
      tips: ["\u4E0B\u6B21\u53EF\u4EE5\u8BD5\u8BD5\u4E0D\u540C\u7684\u6446\u76D8\u65B9\u5F0F"],
      share_text: "\u5FEB\u6765\u6D4B\u6D4B\u4F60\u7684\u9910\u684C\u4EBA\u683C\uFF01"
    };
    for (const [k, v] of Object.entries(defaults)) {
      if (!(k in data)) data[k] = v;
    }
    return new Response(JSON.stringify({ success: true, data }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}
__name(handleEvaluate, "handleEvaluate");
var worker_default = {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response("", {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type"
        }
      });
    }
    const url = new URL(request.url);
    if (url.pathname === "/api/evaluate" && request.method === "POST") {
      return handleEvaluate(request, env);
    }
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok", model: "agnes-2.5-flash" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    return new Response("Not Found", { status: 404 });
  }
};
export {
  worker_default as default
};
//# sourceMappingURL=worker.js.map
