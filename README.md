# 🍽 餐评师 · AI食物美学评测

> 上传菜品照片，AI从六个美学维度深度分析，生成你的餐桌人格报告。

## 在线体验

> https://writtyflame.github.io/food-aesthetics/

---

## 产品功能

- **📸 拍照/上传** — 支持拖拽或点击上传菜品照片
- **🤖 AI 深度分析** — 调用 Agnes AI `agnes-2.5-flash` 多模态模型进行六维评分
- **🎯 六维美学报告** — 色彩和谐度、构图美感、质感对比、食欲指数、餐桌故事感、综合评分
- **🏷 餐桌人格标签** — 暖心治愈派 / 精致主义派 / 烟火街头派 等 7 种人格
- **📤 分享海报** — 自动生成精美分享图，一键复制文案
- **🔄 再测一次** — 随时重新评测

---

## 技术架构

```
前端 (GitHub Pages)          后端 (Cloudflare Workers)
┌─────────────────┐         ┌──────────────────────┐
│  index.html     │  ──POST──▶ │  /evaluate / /api/evaluate │
│  css/style.css  │  (base64)  │  → Agnes AI VL API   │
│  js/app.js      │  ◀──JSON── │  → 返回评分结果      │
└─────────────────┘         └──────────────────────┘
```

- **前端**：纯 HTML/CSS/JS，零依赖，PWA 友好
- **后端**：Cloudflare Worker（JavaScript），无服务器成本
- **AI**：Agnes AI `agnes-2.5-flash`（免费，支持图片理解）

---

## 本地开发

### 1. 安装依赖

```bash
# Cloudflare Worker CLI（仅部署时需要）
npm install -g wrangler
wrangler login
```

### 2. 配置 API Key

在 `backend/.env.example` 基础上，创建 `.env` 文件（仅本地运行后端需要；部署后在 Cloudflare 控制台配置）：

```
AGNES_API_KEY=your_agnes_api_key_here
```

### 3. 本地运行

> ⚠️ **Windows 注意**：直接用 `wrangler dev` 在本机会报 `spawn EFTYPE`（workerd 原生二进制无法被 spawn），无法启动。
> 仓库内置了 `backend/local-server.mjs`，用 Node 直接跑 `worker.js`，效果等同本地 Worker，规避该问题。

```bash
# 后端（本地适配服务，端口 8787，自动读取 backend/.env 的 AGNES_API_KEY）
cd backend
node local-server.mjs
# 或：调试 Worker 本身报错时，看实时日志
#   npx wrangler tail cantingshi-api   （需 wrangler 已登录）

# 前端（静态文件服务，端口 8080）
cd frontend
python -m http.server 8080
# 或：npx serve frontend/ -p 8080
```

打开 http://localhost:8080 即可预览。

### 4. 前后端联调：切换 API_BASE

前端 `frontend/js/app.js` 第一行 `API_BASE` 决定请求打到哪：

- **本地联调**：设为 `http://localhost:8787`（配合上面 `local-server.mjs`）
- **部署/线上**：设为 `https://cantingshi-api.906143430.workers.dev`

> 改完记得：**本地测试 → 改回线上地址 → 再 push / wrangler deploy**，否则线上会连到本地。

---

## 部署步骤

### Part 1：注册 Agnes AI，获取 API Key

1. 访问 https://platform.agnes-ai.com/
2. 注册/登录账号（支持邮箱或手机号）
3. 进入 Dashboard → API Keys → 创建新密钥
4. 复制保存，格式类似 `agnes_xxxxxxxxxxxx`

### Part 2：GitHub Pages — 部署前端

1. 注册 GitHub：https://github.com/signup
2. 创建新仓库（Public），名称建议：`food-aesthetics`
3. 将本项目推送到仓库：
   ```bash
   cd D:\workplaces\AI\cepingwebsite
   git add .
   git commit -m "feat: 餐评师 v1.0"
   git remote add origin https://github.com/YOUR_USERNAME/food-aesthetics.git
   git push -u origin main
   ```
4. 进入仓库 Settings → Pages，Source 选 `main` 分支，点击 Save
5. 等待 1-2 分钟，获得 GitHub Pages 链接

### Part 3：Cloudflare Workers — 部署后端

1. 注册 Cloudflare：https://dash.cloudflare.com/sign-up
2. 安装 Wrangler CLI：
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. 在 `backend/` 目录初始化：
   ```bash
   cd D:\workplaces\AI\cepingwebsite\backend
   wrangler init food-api --type javascript
   ```
4. 将本项目的 `worker.js` 和 `wrangler.toml` 覆盖生成的文件
5. 在 Cloudflare 控制台添加环境变量：
   - 进入项目 → Settings → Variables
   - 添加 `AGNES_API_KEY` = 你的 Agnes API Key
6. 部署：
   ```bash
   wrangler deploy
   ```
7. 记录你的 Worker URL，格式：`https://food-api.xxx.workers.dev`

### Part 4：连接前后端

1. 打开 `frontend/js/app.js`，确认第一行 `API_BASE` 指向你的 Worker 地址
2. 默认已填线上 Worker：`https://cantingshi-api.906143430.workers.dev`
3. 本地联调时改回 `http://localhost:8787`（详见上方「本地开发」小节），联调完再改回线上地址

---

## 图片存储（R2）配置

> **为什么需要 R2**：Agnes 的 `image_url.url` 只接受公网可访问的图片 URL，**不支持 base64 / data URL**。若直接把 base64 发给模型，模型看不到图，会返回非 JSON 文本，导致分数恒为默认值（65 / 佛系干饭派）。因此 Worker 先把图片上传到 Cloudflare R2 公开桶，再把公开 URL 交给模型。

### 1. 控制台配置

1. 打开 [Cloudflare R2](https://dash.cloudflare.com) → **R2 Object Storage** → **Create bucket**，桶名如 `food-images`，Location 选 Automatic
2. 进入桶 → **Settings** → **Public access** → **Allow Access**，记下生成的公开域名 `https://pub-<hash>.r2.dev`
3. 复制 **Account ID**（地址栏 `https://dash.cloudflare.com/<account-id>/...`，或 API Tokens 页顶部）

### 2. 配置文件

`backend/wrangler.toml` 需包含：

```toml
account_id = "<你的 Account ID>"
workers_dev = true

[vars]
R2_PUBLIC_URL = "https://pub-<hash>.r2.dev"

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "food-images"
```

`backend/worker.js` 中的 `uploadToR2()` 负责：base64 → 二进制 → `env.BUCKET.put(...)` → 拼公开 URL。无需手动改代码，配置正确即可。

### 3. 部署与验证

```bash
cd backend
wrangler deploy          # 部署后 Worker 即挂载 R2 绑定
```

> ⚠️ 本机直连 Cloudflare auth server 会被墙，报 `auth token has expired`；**走系统代理**即可（`wrangler deploy` 默认读取 `HTTP_PROXY`）。

验证 R2 公开访问是否生效（不消耗 Agnes 额度）：

```bash
echo "probe" | wrangler r2 object put food-images/test-probe.txt --pipe --remote
# 浏览器/curl 打开 https://pub-<hash>.r2.dev/test-probe.txt 应返回 probe
wrangler r2 object delete food-images/test-probe.txt --remote
```

---

## 需要注册的服务

| 服务 | 用途 | 费用 | 注册链接 |
|------|------|------|---------|
| Agnes AI | AI 图像分析 API | **免费**（20 RPM，1500次/5h） | https://platform.agnes-ai.com/ |
| GitHub | 前端托管 + 版本管理 | 免费 | https://github.com |
| Cloudflare | 后端 API 托管 | 免费（每日10万次请求） | https://cloudflare.com |

---

## Agnes AI API 说明

- **Base URL**: `https://apihub.agnes-ai.com/v1`
- **模型**: `agnes-2.5-flash`（支持文本+图片理解）
- **认证**: `Authorization: Bearer <API_KEY>`
- **免费额度**: 20 RPM，Starter 计划 1500 请求/5小时
- **文档**: https://agnes-ai.com/doc/overview

---

## 测评维度说明

| 维度 | 说明 |
|------|------|
| 色彩和谐度 | 食材颜色搭配是否协调，是否有食欲的色彩组合 |
| 构图美感 | 菜品在画面中的构图，是否有美学意识 |
| 质感对比 | 食材之间质感差异（脆/软/糯/滑等）的呈现 |
| 食欲指数 | 第一眼看下去是否让人产生想吃欲望 |
| 餐桌故事感 | 这道菜传递了什么氛围和情绪 |
| 整体评分 | 综合加权得分（1-100） |

## 餐桌人格标签

- 🍲 **暖心治愈派** — 家常·温暖·幸福感
- 🍷 **精致主义派** — 优雅·仪式感·审美
- 🍢 **烟火街头派** — 接地气·热情·满足
- 🥗 **自然本味派** — 健康·清淡·本真
- 🌶️ **冒险玩味派** — 新奇·创意·有趣
- 🕯️ **氛围营造派** — 浪漫·情调·仪式感
- 🍚 **佛系干饭派** — 随性·真实·自在

---

## 文件结构

```
cepingwebsite/
├── frontend/
│   ├── index.html        # 主页面（上传/加载/结果三屏）
│   ├── css/
│   │   └── style.css     # 全部样式（暖色调美食风）
│   └── js/
│       └── app.js        # 前端逻辑（上传/调用API/渲染/分享）
├── backend/
│   ├── worker.js         # Cloudflare Worker 主程序（Agnes AI）
│   ├── local-server.mjs  # 本地开发适配服务（Node 直接跑 worker.js，规避 Windows wrangler dev 问题）
│   ├── wrangler.toml     # Worker 配置
│   ├── app.py            # Flask 本地开发版（备用）
│   ├── requirements.txt
│   └── .env.example
├── docs/
│   └── design.md         # 设计文档
└── README.md             # 本文件
```
