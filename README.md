# 🍽 餐评师 · AI食物美学评测

> 上传菜品照片，AI从六个美学维度深度分析，生成你的餐桌人格报告。

## 在线体验

> [待部署后填写 GitHub Pages 链接]

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
│  index.html     │  ──POST──▶ │  /api/evaluate       │
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
# Cloudflare Worker
npm install -g wrangler
wrangler login
```

### 2. 配置 API Key

在 `backend/.env.example` 基础上，创建 `.env` 文件或在 Cloudflare 控制台添加环境变量：

```
AGNES_API_KEY=your_agnes_api_key_here
```

### 3. 本地运行

```bash
# 前端（静态文件服务）
npx serve frontend/ -p 3000

# 后端 Worker（本地）
cd backend
wrangler dev
```

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

1. 打开 `frontend/js/app.js`
2. 找到第一行，API_BASE 已经是 `/api`，因为 Worker 会处理相对路径
3. 如果部署在 Cloudflare，直接可用，无需修改

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
│   ├── wrangler.toml     # Worker 配置
│   ├── app.py            # Flask 本地开发版（备用）
│   ├── requirements.txt
│   └── .env.example
├── docs/
│   └── design.md         # 设计文档
└── README.md             # 本文件
```
