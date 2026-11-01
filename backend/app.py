from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import base64
import json
import urllib.request
import time

app = Flask(__name__)
CORS(app)

QWEN_API_KEY = os.environ.get("QWEN_API_KEY", "")
QWEN_API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"

EVALUATION_PROMPT = """你是一位专业的美食美学分析师，擅长从视觉角度评价菜品的摆盘美学。

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
  "persona_desc": "你的餐桌是治愈系港湾，每一道菜都在说"好好吃饭""，
  "tips": [
    "可以尝试用暖色调餐盘增强温馨感",
    "适当增加一些绿色点缀会让色彩更丰富"
  ],
  "share_text": "AI给我的晚餐打了78分，说我是一个「暖心治愈派」食客～快来测测你的餐桌人格！"
}

**评分标准参考：**
- 色彩：食材颜色搭配是否和谐有层次
- 构图：菜品在画面中的布局是否有美感
- 质感：不同食材质感的呈现是否丰富
- 食欲：看了是否让人产生想吃欲望
- 故事感：菜品传递的氛围和情绪
- 整体：综合以上维度加权打分

**人格标签选择（从中选一个最贴切的）：**
暖心治愈派、精致主义派、烟火街头派、自然本味派、冒险玩味派、氛围营造派、佛系干饭派

注意：用户可能上传各种类型的食物（家常菜、餐厅菜、外卖、小吃等），请根据实际菜品类型给出客观且鼓励性的评价。即使菜品很普通，也要找到亮点。"""

@app.route("/api/evaluate", methods=["POST"])
def evaluate():
    data = request.get_json()
    image_b64 = data.get("image", "")
    
    if not image_b64:
        return jsonify({"error": "请上传菜品照片"}), 400
    
    if not QWEN_API_KEY:
        return jsonify({"error": "API Key 未配置"}), 500
    
    headers = {
        "Authorization": f"Bearer {QWEN_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "qwen-vl-max",
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": image_b64}},
                    {"type": "text", "text": EVALUATION_PROMPT}
                ]
            }
        ],
        "max_tokens": 1500,
        "temperature": 0.7
    }
    
    try:
        req = urllib.request.Request(
            QWEN_API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST"
        )
        
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
        
        content = result["choices"][0]["message"]["content"]
        
        # 提取JSON
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            json_str = content[start:end+1]
            eval_result = json.loads(json_str)
        else:
            eval_result = parse_fallback(content)
        
        # 补充默认值
        eval_result = ensure_defaults(eval_result)
        
        return jsonify({"success": True, "data": eval_result})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})

def parse_fallback(text):
    """如果AI返回的不是标准JSON，尝试解析"""
    try:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1:
            return json.loads(text[start:end+1])
    except:
        pass
    return {}

def ensure_defaults(data):
    defaults = {
        "color": 6.0,
        "composition": 6.0,
        "texture": 6.0,
        "appetite": 6.0,
        "story": "这是一道充满生活气息的家常美味",
        "overall_score": 65,
        "persona_label": "佛系干饭派",
        "persona_desc": "好好吃饭，认真生活",
        "tips": ["下次可以试试不同的摆盘方式"],
        "share_text": "快来测测你的餐桌人格！"
    }
    for k, v in defaults.items():
        if k not in data:
            data[k] = v
    return data

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
