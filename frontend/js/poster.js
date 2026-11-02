/* ===== 分享海报绘制（750 × 1280）=====
 * 纯 canvas 逻辑，不依赖页面 DOM，便于单独预览与调试。
 * 入口：renderPoster(canvas, { data, imageSrc, emoji }) -> Promise<dataURL>
 */

const POSTER = {
  W: 750,
  H: 1280,
  pad: 48,
  ink: '#2C1810',
  sub: '#7A5C4F',
  faint: '#A08070',
  primary: '#C0621A',
  primaryDeep: '#8B4513',
  gold: '#E0A15A',
  line: '#EDE1D2',
  track: '#F3E9DD',
  white: '#FFFFFF'
};

const SERIF = '"Noto Serif SC", serif';
const SANS = '"Noto Sans SC", sans-serif';

function loadPosterImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function renderPoster(canvas, opts) {
  const ctx = canvas.getContext('2d');
  const data = (opts && opts.data) || {};
  const emoji = (opts && opts.emoji) || '🍽';
  const imageSrc = (opts && opts.imageSrc) || '';

  // 等字体就绪，否则首帧中文会回退成系统默认字体
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch { /* ignore */ }
  }

  canvas.width = POSTER.W;
  canvas.height = POSTER.H;

  drawPosterBackground(ctx);
  const img = await loadPosterImage(imageSrc);
  drawPosterPhoto(ctx, img);
  drawPosterHeader(ctx);
  drawPosterScore(ctx, data, emoji);
  drawPosterDimensions(ctx, data);
  drawPosterStory(ctx, data);
  drawPosterFooter(ctx);

  return canvas.toDataURL('image/png');
}

function drawPosterBackground(ctx) {
  const { W, H } = POSTER;
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#FFFCF8');
  grad.addColorStop(0.45, '#FBF1E4');
  grad.addColorStop(1, '#F6E3CC');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 右上暖光
  const glow = ctx.createRadialGradient(W - 60, 40, 0, W - 60, 40, 620);
  glow.addColorStop(0, 'rgba(232,152,94,0.30)');
  glow.addColorStop(1, 'rgba(232,152,94,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 左下暖调平衡
  const glow2 = ctx.createRadialGradient(20, H - 40, 0, 20, H - 40, 480);
  glow2.addColorStop(0, 'rgba(214,168,120,0.18)');
  glow2.addColorStop(1, 'rgba(214,168,120,0)');
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, W, H);

  // 极淡网点，避免大面积渐变的塑料感
  ctx.save();
  ctx.fillStyle = 'rgba(150,105,65,0.05)';
  for (let gy = 14, row = 0; gy < H; gy += 22, row++) {
    for (let gx = 14 + (row % 2) * 11; gx < W; gx += 22) {
      ctx.beginPath();
      ctx.arc(gx, gy, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawPosterHeader(ctx) {
  const { W, pad } = POSTER;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  ctx.font = '26px ' + SANS;
  ctx.fillStyle = POSTER.primary;
  ctx.fillText('🍽', pad, 62);

  ctx.font = 'bold 25px ' + SERIF;
  ctx.fillStyle = POSTER.ink;
  ctx.fillText('餐评师', pad + 40, 62);

  ctx.textAlign = 'right';
  ctx.font = '17px ' + SANS;
  ctx.fillStyle = POSTER.faint;
  ctx.fillText('AI 食物美学评测', W - pad, 62);
  ctx.restore();
}

function drawPosterPhoto(ctx, img) {
  const { W, pad } = POSTER;
  const x = pad, y = 104, w = W - pad * 2, h = 430, r = 30;

  // 卡片投影底
  ctx.save();
  ctx.shadowColor = 'rgba(120,70,30,0.20)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#F4E8D9';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  if (img && img.complete && img.naturalWidth) {
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const scale = Math.max(w / img.width, h / img.height);
    const sw = img.width * scale, sh = img.height * scale;
    ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
    // 上下渐隐，让画面更聚焦
    const veil = ctx.createLinearGradient(0, y, 0, y + h);
    veil.addColorStop(0, 'rgba(50,26,10,0.16)');
    veil.addColorStop(0.3, 'rgba(50,26,10,0)');
    veil.addColorStop(1, 'rgba(50,26,10,0.26)');
    ctx.fillStyle = veil;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  } else {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = POSTER.faint;
    ctx.font = '22px ' + SANS;
    ctx.fillText('原图未能加载', W / 2, y + h / 2);
    ctx.restore();
  }

  // 内描边
  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 右上角日期胶囊
  const dateText = formatPosterDate();
  ctx.save();
  ctx.font = '500 16px ' + SANS;
  const chipW = ctx.measureText(dateText).width + 34;
  const chipH = 34;
  const chipX = x + w - chipW - 18;
  const chipY = y + 18;
  ctx.fillStyle = 'rgba(255,252,248,0.9)';
  roundRect(ctx, chipX, chipY, chipW, chipH, chipH / 2);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = POSTER.sub;
  ctx.fillText(dateText, chipX + chipW / 2, chipY + chipH / 2 + 0.5);
  ctx.restore();
}

function formatPosterDate() {
  const now = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${now.getFullYear()}.${p(now.getMonth() + 1)}.${p(now.getDate())}`;
}

function drawPosterScore(ctx, data, emoji) {
  const { W, pad } = POSTER;
  const x = pad + 20, y = 470, w = W - (pad + 20) * 2, h = 220, r = 30;
  const score = clampScore(data.overall_score);

  // 白色卡片
  ctx.save();
  ctx.shadowColor = 'rgba(120,70,30,0.16)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = POSTER.white;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  // 极淡描边，让白卡在浅底上有轮廓
  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = 'rgba(192,98,26,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // ---- 左：分数 ----
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER.faint;
  ctx.font = '600 17px ' + SANS;
  ctx.fillText('综 合 评 分', x + 40, y + 60);

  const numText = String(score);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = POSTER.primary;
  ctx.font = 'bold 92px ' + SERIF;
  ctx.fillText(numText, x + 36, y + 138);
  const numW = ctx.measureText(numText).width;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER.faint;
  ctx.font = '500 20px ' + SANS;
  ctx.fillText('/ 100', x + 40 + numW + 6, y + 158);
  ctx.restore();

  // 分隔线
  ctx.save();
  ctx.strokeStyle = POSTER.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 268, y + 56);
  ctx.lineTo(x + 268, y + 168);
  ctx.stroke();
  ctx.restore();

  // ---- 右：人格 ----
  const rx = x + 306;
  const rw = x + w - 38 - rx;

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = '30px ' + SANS;
  ctx.fillStyle = POSTER.primary;
  ctx.fillText(emoji, rx, y + 92);

  ctx.font = 'bold 29px ' + SERIF;
  ctx.fillStyle = POSTER.ink;
  ctx.fillText(fitText(ctx, data.persona_label || '餐评师认证', rw - 44), rx + 44, y + 92);
  ctx.restore();

  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER.sub;
  ctx.font = '18px ' + SANS;
  drawLines(ctx, wrapLines(ctx, data.persona_desc || '好好吃饭，认真生活', rw, 2), rx, y + 142, 30);
  ctx.restore();
}

function drawPosterDimensions(ctx, data) {
  const { W, pad } = POSTER;
  const x = pad, y = 730, w = W - pad * 2, h = 286, r = 28;

  ctx.save();
  ctx.shadowColor = 'rgba(120,70,30,0.10)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = POSTER.white;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
  ctx.strokeStyle = 'rgba(192,98,26,0.07)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  // 标题
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillStyle = POSTER.ink;
  ctx.font = 'bold 21px ' + SERIF;
  ctx.fillText('六维美学分析', x + 40, y + 58);

  ctx.textAlign = 'right';
  ctx.fillStyle = POSTER.faint;
  ctx.font = '16px ' + SANS;
  ctx.fillText('满分 10', x + w - 40, y + 56);
  ctx.restore();

  const dims = [
    { name: '色彩和谐度', key: 'color', emoji: '🎨' },
    { name: '构图美感', key: 'composition', emoji: '📐' },
    { name: '质感对比', key: 'texture', emoji: '✨' },
    { name: '食欲指数', key: 'appetite', emoji: '🔥' },
    { name: '餐桌故事', key: 'story_score', emoji: '📖' }
  ];

  const barX = x + 224;
  const barW = w - 224 - 106;
  let cy = y + 100;

  dims.forEach(dim => {
    const val = clampScore(data[dim.key], 10);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = POSTER.ink;
    ctx.font = '19px ' + SANS;
    ctx.fillText(dim.emoji + ' ' + dim.name, x + 40, cy);
    ctx.restore();

    // 轨道
    ctx.save();
    ctx.fillStyle = POSTER.track;
    roundRect(ctx, barX, cy - 5, barW, 10, 5);
    ctx.fill();

    // 填充
    const fillW = Math.max(10, barW * val / 10);
    const g = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    g.addColorStop(0, POSTER.primary);
    g.addColorStop(1, POSTER.gold);
    ctx.fillStyle = g;
    roundRect(ctx, barX, cy - 5, fillW, 10, 5);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = POSTER.primary;
    ctx.font = 'bold 19px ' + SANS;
    ctx.fillText(val.toFixed(1), x + w - 40, cy);
    ctx.restore();

    cy += 38;
  });
}

function drawPosterStory(ctx, data) {
  const { W } = POSTER;

  // 中间短金线
  ctx.save();
  ctx.fillStyle = 'rgba(224,161,90,0.75)';
  roundRect(ctx, W / 2 - 28, 1054, 56, 3, 1.5);
  ctx.fill();
  ctx.restore();

  const story = String(data.story || '这是一道有故事的美食').replace(/^["'“]|["'”]$/g, '');
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER.sub;
  ctx.font = 'italic 20px ' + SERIF;
  const lines = wrapLines(ctx, '“' + story + '”', W - 140, 2);
  drawLines(ctx, lines, W / 2, 1104, 32);
  ctx.restore();
}

function drawPosterFooter(ctx) {
  const { W, H } = POSTER;
  ctx.save();
  ctx.strokeStyle = 'rgba(200,170,140,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 90, H - 96);
  ctx.lineTo(W / 2 + 90, H - 96);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = POSTER.faint;
  ctx.font = '17px ' + SANS;
  ctx.fillText('餐评师 · AI 食物美学评测', W / 2, H - 60);
  ctx.restore();
}

/* ===== Canvas 绘图小工具 ===== */
function clampScore(v, max = 100) {
  const n = Number(v);
  if (!Number.isFinite(n)) return max === 10 ? 6 : 65;
  return Math.min(max, Math.max(0, Math.round(n * 10) / 10));
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxWidth) s = s.slice(0, -1);
  return s + '…';
}

function wrapLines(ctx, text, maxWidth, maxLines) {
  const chars = Array.from(String(text));
  const lines = [];
  let line = '';
  for (const ch of chars) {
    if (ch === '\n') { lines.push(line); line = ''; continue; }
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line += ch;
    }
  }
  if (line) lines.push(line);

  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fitText(ctx, kept[maxLines - 1] + '…', maxWidth);
    return kept;
  }
  return lines;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
