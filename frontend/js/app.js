// ===== 配置 =====
const API_BASE = "https://cantingshi-api.906143430.workers.dev";

// 上传前压缩：长边最大 1024px，输出 JPEG，避免 base64 过大 / 格式兼容问题
const MAX_SIDE = 1024;
const JPEG_QUALITY = 0.85;

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
// 读文件 -> 等比缩放 -> 输出 JPEG data URL
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      // 白底，避免 PNG 透明区域转 JPEG 后变黑
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片读取失败，请换一张试试'));
    };
    img.src = objectUrl;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  try {
    currentImageBase64 = await fileToDataUrl(file);
    showPreview(currentImageBase64);
  } catch (err) {
    alert(err.message);
  }
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
  const resp = await fetch(API_BASE + '/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageBase64 })
  });

  let payload = null;
  try { payload = await resp.json(); } catch { /* 非 JSON 响应 */ }

  if (!resp.ok || !payload || payload.error) {
    const detail = (payload && (payload.error || payload.upstream)) || ('HTTP ' + resp.status);
    throw new Error(detail);
  }
  return payload;
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
    const msg = err && err.message ? err.message : '未知错误';
    const isRateLimited = /1015|429|限流|rate limit/i.test(msg);
    const isNetwork = /Failed to fetch|NetworkError|Load failed/i.test(msg);
    let hint;
    if (isRateLimited) {
      hint = '这是上游 AI 服务的限流（Cloudflare 1015 / HTTP 429），不是你的操作问题。等约 1 分钟再试即可。';
    } else if (isNetwork) {
      hint = '请检查网络或后端服务是否正常。';
    } else {
      hint = '若反复出现，请检查后端 AI Key 配置与账户额度。';
    }
    alert('评测失败：' + msg + '\n\n' + hint);
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
  
  // 五个维度（story 是文案、story_score 是分数）
  const dims = [
    { dom: 'color', field: 'color' },
    { dom: 'composition', field: 'composition' },
    { dom: 'texture', field: 'texture' },
    { dom: 'appetite', field: 'appetite' },
    { dom: 'story', field: 'story_score' }
  ];
  dims.forEach(({ dom, field }) => {
    const scoreNum = Number(data[field]);
    const safeScore = Number.isFinite(scoreNum) ? scoreNum : 6;
    const bar = $('bar-' + dom);
    const scoreEl = $('score-' + dom);
    setTimeout(() => {
      bar.style.width = Math.min(safeScore * 10, 100) + '%';
    }, 200);
    scoreEl.textContent = safeScore.toFixed(1);
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
    var shareImg = document.getElementById("share-img");
    if (shareImg) shareImg.src = canvas.toDataURL("image/png");
  };
  img.crossOrigin = "anonymous";
  img.onerror = function() {
    drawPosterContent(ctx, W, H, data, score);
    var shareImg = document.getElementById("share-img");
    if (shareImg) shareImg.src = canvas.toDataURL("image/png");
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
    { name: '餐桌故事', key: 'story_score', emoji: '📖' }
  ];
  
  let yPos = 830;
  dims.forEach(dim => {
    const rawScore = Number(data[dim.key]);
    const safeScore = Number.isFinite(rawScore) ? rawScore : 6;
    const val = Math.round(safeScore / 10 * 100).toString();
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
  const score = currentResult?.overall_score || 65;
  const persona = currentResult?.persona_label || '佛系干饭派';
  const siteUrl = 'https://writtyflame.github.io/food-aesthetics/';
  const customText = (currentResult?.share_text || '').trim();
  const isDefaultText = !customText || customText === '快来测测你的餐桌人格！';
  const text = (isDefaultText
    ? '🍽 AI给我的晚餐打了' + score + '分，说我是一个「' + persona + '」食客～'
    : customText) + '\n\n' + siteUrl;

  const done = () => {
    $('copy-btn').textContent = '✅ 已复制';
    setTimeout(() => { $('copy-btn').textContent = '复制文字'; }, 2000);
  };

  navigator.clipboard.writeText(text).then(done).catch(() => {
    // 非 HTTPS / 无权限时的兜底
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    done();
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


