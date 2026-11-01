// ===== 配置 =====
const API_BASE = ""; // 部署时在 Cloudflare 控制台填入 Worker URL，见 README // Cloudflare Worker 部署后替换为实际地址
const API_KEY_PLACEHOLDER = 'YOUR_QWEN_API_KEY';

// ===== 状态 =====
let currentImageBase64 = '';
let currentResult = null;

// ===== DOM =====
const $ = id => document.getElementById(id);

// ===== 页面切换 =====
function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(pageId).classList.add('active');
  window.scrollTo(0, 0);
}

// ===== 图片处理 =====
function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    currentImageBase64 = e.target.result;
    showPreview(currentImageBase64);
  };
  reader.readAsDataURL(file);
}

function showPreview(src) {
  const img = $('preview-img');
  img.src = src;
  img.style.display = 'block';
  $('upload-placeholder').style.display = 'none';
  $('change-photo-btn').style.display = 'block';
  $('drop-zone').classList.add('has-image');
  $('analyze-btn').disabled = false;
}

function resetUpload() {
  currentImageBase64 = '';
  $('preview-img').src = '';
  $('preview-img').style.display = 'none';
  $('upload-placeholder').style.display = 'flex';
  $('change-photo-btn').style.display = 'none';
  $('drop-zone').classList.remove('has-image');
  $('analyze-btn').disabled = true;
  $('file-input').value = '';
}

// ===== 拖拽上传 =====
const dropZone = $('drop-zone');
dropZone.addEventListener('click', () => $('file-input').click());
$('file-input').addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });

dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
});

$('change-photo-btn').addEventListener('click', e => {
  e.stopPropagation();
  resetUpload();
  $('file-input').click();
});

// ===== 加载文案 =====
const loadingTips = [
  '正在分析色彩搭配',
  '评估构图美学',
  '感受食材质感',
  '计算食欲指数',
  '品味餐桌故事',
  '生成美学报告',
  '即将完成…'
];
let tipIndex = 0;
let progressInterval = null;

function startLoading() {
  $('scan-preview').src = currentImageBase64;
  tipIndex = 0;
  let progress = 0;
  $('progress-fill').style.width = '0%';
  $('progress-pct').textContent = '0';
  
  progressInterval = setInterval(() => {
    progress += Math.random() * 8 + 2;
    if (progress > 95) progress = 95;
    $('progress-fill').style.width = progress + '%';
    $('progress-pct').textContent = Math.floor(progress);
    
    const newTip = Math.min(Math.floor(progress / 15), loadingTips.length - 1);
    if (newTip !== tipIndex) {
      tipIndex = newTip;
      $('loading-tip').textContent = loadingTips[tipIndex];
    }
  }, 300);
}

function stopLoading() {
  if (progressInterval) clearInterval(progressInterval);
  $('progress-fill').style.width = '100%';
  $('progress-pct').textContent = '100';
  $('loading-tip').textContent = '评测完成！';
}

// ===== 调用API =====
async function callAPI(imageBase64) {
  // 去掉 data:image/...;base64, 前缀
  const b64Data = imageBase64.split(',')[1];
  
  const resp = await fetch(API_BASE + '/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: 'data:image/png;base64,' + b64Data })
  });
  
  if (!resp.ok) throw new Error('请求失败');
  return await resp.json();
}

// ===== 提交分析 =====
$('analyze-btn').addEventListener('click', async () => {
  if (!currentImageBase64) return;
  
  showPage('page-loading');
  startLoading();
  
  try {
    const result = await callAPI(currentImageBase64);
    stopLoading();
    
    if (result.success && result.data) {
      currentResult = result.data;
      setTimeout(() => renderResult(currentResult), 300);
      showPage('page-result');
    } else {
      throw new Error(result.error || '分析失败');
    }
  } catch (err) {
    stopLoading();
    alert('评测出错：' + err.message + '\n\n请检查后端 API 是否正常运行，以及 Qwen API Key 是否正确配置。');
    showPage('page-upload');
  }
});

// ===== 渲染结果 =====
function renderResult(data) {
  // 总分
  const score = data.overall_score || 65;
  $('score-number').textContent = score;
  const circumference = 2 * Math.PI * 52; // r=52
  const offset = circumference * (1 - score / 100);
  setTimeout(() => {
    $('ring-fill').style.strokeDashoffset = offset;
  }, 100);
  
  // 人格标签
  $('persona-emoji').textContent = getPersonaEmoji(data.persona_label);
  $('persona-name').textContent = data.persona_label || '佛系干饭派';
  $('persona-desc').textContent = data.persona_desc || '好好吃饭，认真生活';
  
  // 故事
  $('story-text').textContent = data.story || '这是一道充满生活气息的家常美味';
  
  // 六个维度
  const dims = ['color', 'composition', 'texture', 'appetite', 'story'];
  dims.forEach(dim => {
    const val = (data[dim] || 6) * 10; // 1-10 scale -> percentage
    const bar = $('bar-' + dim);
    const scoreEl = $('score-' + dim);
    setTimeout(() => {
      bar.style.width = Math.min(val, 100) + '%';
    }, 200);
    scoreEl.textContent = (data[dim] || 6).toFixed(1);
  });
  
  // 建议
  const tipsList = $('tips-list');
  tipsList.innerHTML = '';
  (data.tips || ['下次可以尝试不同的摆盘方式']).forEach(tip => {
    const li = document.createElement('li');
    li.textContent = tip;
    tipsList.appendChild(li);
  });
  
  // 原图
  $('result-photo').src = currentImageBase64;
}

function getPersonaEmoji(label) {
  const map = {
    '暖心治愈派': '🍲',
    '精致主义派': '🍷',
    '烟火街头派': '🍢',
    '自然本味派': '🥗',
    '冒险玩味派': '🌶️',
    '氛围营造派': '🕯️',
    '佛系干饭派': '🍚'
  };
  return map[label] || '🍽';
}

// ===== 分享 =====
$('share-btn').addEventListener('click', () => {
  $('share-modal').classList.add('show');
  generateSharePoster();
});

$('share-close').addEventListener('click', () => {
  $('share-modal').classList.remove('show');
});

$('share-modal').addEventListener('click', e => {
  if (e.target === $('share-modal')) $('share-modal').classList.remove('show');
});

function generateSharePoster() {
  const canvas = $('share-canvas');
  const ctx = canvas.getContext('2d');
  const W = 750, H = 1334;
  canvas.width = W;
  canvas.height = H;
  
  const data = currentResult;
  const score = data.overall_score || 65;
  
  // 背景渐变
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, '#faf6f1');
  grad.addColorStop(1, '#fde8d0');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  
  // 顶部装饰弧
  ctx.fillStyle = '#c0621a';
  ctx.beginPath();
  ctx.arc(W/2, -100, 300, 0, Math.PI * 2);
  ctx.fill();
  
  // 照片区域
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // 圆角矩形裁切照片
    roundRect(ctx, 37.5, 80, W - 75, 360, 20);
    ctx.fillStyle = '#ddd';
    ctx.fill();
    ctx.clip();
    // 等比缩放填充
    const scale = Math.max((W - 75) / img.width, 360 / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, (W - 75 - sw) / 2, 80 + (360 - sh) / 2, sw, sh);
    ctx.restore();
    
    // 边框
    roundRect(ctx, 37.5, 80, W - 75, 360, 20);
    ctx.strokeStyle = 'rgba(192,98,26,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    drawPosterContent(ctx, W, H, data, score);
  };
  img.src = currentImageBase64;
}

function drawPosterContent(ctx, W, H, data, score) {
  const personaEmoji = getPersonaEmoji(data.persona_label);
  const cx = W / 2;
  
  // 大评分
  ctx.fillStyle = '#c0621a';
  ctx.font = 'bold 120px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(score, cx, 540);
  
  ctx.fillStyle = '#7a5c4f';
  ctx.font = '24px "Noto Sans SC", sans-serif';
  ctx.fillText('综合评分', cx, 610);
  
  // 人格标签
  ctx.fillStyle = '#c0621a';
  ctx.font = 'bold 36px "Noto Serif SC", serif';
  ctx.fillText(personaEmoji + '  ' + (data.persona_label || '餐评师认证'), cx, 690);
  
  // 描述
  ctx.fillStyle = '#7a5c4f';
  ctx.font = '22px "Noto Sans SC", sans-serif';
  wrapText(ctx, data.persona_desc || '好好吃饭，认真生活', cx, 740, W - 100, 32);
  
  // 维度条
  const dims = [
    { name: '色彩和谐度', key: 'color', emoji: '🎨' },
    { name: '构图美感', key: 'composition', emoji: '📐' },
    { name: '质感对比', key: 'texture', emoji: '✨' },
    { name: '食欲指数', key: 'appetite', emoji: '🔥' },
    { name: '餐桌故事', key: 'story', emoji: '📖' }
  ];
  
  let yPos = 830;
  dims.forEach(dim => {
    const val = ((data[dim.key] || 6) / 10 * 100).toFixed(0);
    ctx.fillStyle = '#2c1810';
    ctx.font = '22px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(dim.emoji + ' ' + dim.name, 50, yPos);
    
    // 进度条背景
    ctx.fillStyle = '#e8ddd0';
    roundRect(ctx, 240, yPos - 14, W - 300, 12, 6);
    ctx.fill();
    
    // 进度条填充
    ctx.fillStyle = '#c0621a';
    roundRect(ctx, 240, yPos - 14, (W - 300) * parseInt(val) / 100, 12, 6);
    ctx.fill();
    
    ctx.fillStyle = '#c0621a';
    ctx.font = 'bold 20px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(val + '%', W - 50, yPos);
    
    yPos += 44;
  });
  
  // 故事文字
  yPos += 16;
  ctx.fillStyle = '#7a5c4f';
  ctx.font = 'italic 20px "Noto Serif SC", serif';
  ctx.textAlign = 'center';
  wrapText(ctx, '"' + (data.story || '这是一道有故事的美食') + '"', cx, yPos, W - 80, 30);
  
  // 底部品牌
  yPos = H - 80;
  ctx.fillStyle = '#a08070';
  ctx.font = '18px "Noto Sans SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('AI食物美学评测 · 餐评师', cx, yPos);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const chars = text.split('');
  let line = '';
  let ly = y;
  for (let c of chars) {
    const testLine = line + c;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line !== '') {
      ctx.fillText(line, x, ly);
      line = c;
      ly += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, ly);
}

// ===== 复制分享文案 =====
$('copy-btn').addEventListener('click', () => {
  const text = currentResult?.share_text || 'AI给我的晚餐打了' + (currentResult?.overall_score || 0) + '分，说我是一个「' + (currentResult?.persona_label || '') + '」食客～快来测测你的餐桌人格！';
  navigator.clipboard.writeText(text).then(() => {
    $('copy-btn').textContent = '✅ 已复制';
    setTimeout(() => { $('copy-btn').textContent = '复制文字'; }, 2000);
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    $('copy-btn').textContent = '✅ 已复制';
    setTimeout(() => { $('copy-btn').textContent = '复制文字'; }, 2000);
  });
});

// ===== 再测一次 =====
$('retake-btn').addEventListener('click', () => {
  resetUpload();
  currentResult = null;
  // 重置维度条
  document.querySelectorAll('.dim-bar-fill').forEach(bar => bar.style.width = '0%');
  // 重置圆环
  $('ring-fill').style.strokeDashoffset = 327;
  showPage('page-upload');
});

// ===== Canvas 下载 =====
// 点击海报图片触发下载
$('share-img').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = '餐评师-report.png';
  link.href = $('share-canvas').toDataURL('image/png');
  link.click();
});

