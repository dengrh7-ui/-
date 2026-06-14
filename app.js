'use strict';

// ── Category config ─────────────────────────────────────────────────────────
const CAT = {
  '食':     { icon: '🍜', color: '#ff9f43', label: '餐饮' },
  '衣':     { icon: '👕', color: '#ff6b9d', label: '服饰' },
  '住':     { icon: '🏠', color: '#4facfe', label: '住房' },
  '行':     { icon: '🚗', color: '#43e97b', label: '出行' },
  '娱':     { icon: '🎮', color: '#a29bfe', label: '娱乐' },
  '医':     { icon: '💊', color: '#fd7272', label: '医疗' },
  '教育':   { icon: '📚', color: '#0abde3', label: '教育' },
  '其他':   { icon: '📦', color: '#636e72', label: '其他' },
  '工资':   { icon: '💼', color: '#55efc4', label: '工资' },
  '兼职':   { icon: '💻', color: '#00cec9', label: '兼职' },
  '投资':   { icon: '📈', color: '#6c5ce7', label: '投资' },
  '红包':   { icon: '🧧', color: '#e17055', label: '红包' },
  '转账':   { icon: '🔄', color: '#74b9ff', label: '转账' },
  '报销':   { icon: '🧾', color: '#81ecec', label: '报销' },
  '理财':   { icon: '💹', color: '#fdcb6e', label: '理财' },
  '其他收入': { icon: '💰', color: '#ffeaa7', label: '其他收入' },
};

function catInfo(key) {
  return CAT[key] || { icon: '📦', color: '#636e72', label: key };
}

// ── Storage ─────────────────────────────────────────────────────────────────
const STORE_KEY = 'ledger_v1';

let records = [];
try { records = JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { records = []; }

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
}

// ── State ────────────────────────────────────────────────────────────────────
const S = {
  page: 'pageRecords',
  year: new Date().getFullYear(),
  month: new Date().getMonth(),   // 0-indexed
  filterCat: 'all',
  addType: 'expense',
  addCat: null,
  amtStr: '0',
  delId: null,
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

function fmt(n) {
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function monthRecords() {
  return records.filter(r => {
    const d = new Date(r.date + 'T00:00:00');
    return d.getFullYear() === S.year && d.getMonth() === S.month;
  });
}

function weekdayStr(dateStr) {
  const days = ['日', '一', '二', '三', '四', '五', '六'];
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()} 周${days[d.getDay()]}`;
}

// ── Toast ────────────────────────────────────────────────────────────────────
let toastTmr = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTmr);
  toastTmr = setTimeout(() => el.classList.remove('on'), 2000);
}

// ── Header ───────────────────────────────────────────────────────────────────
function renderHeader() {
  $('monthLabel').textContent = `${S.year}年${S.month + 1}月`;
  const mr = monthRecords();
  const exp = mr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const inc = mr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const bal = inc - exp;
  $('headerExpense').textContent = `¥${fmt(exp)}`;
  $('headerIncome').textContent = `¥${fmt(inc)}`;
  const b = $('headerBalance');
  b.textContent = `¥${fmt(Math.abs(bal))}`;
  b.className = `summary-val ${bal >= 0 ? 'income' : 'expense'}`;
}

// ── Records page ─────────────────────────────────────────────────────────────
function renderRecords() {
  let mr = monthRecords();
  if (S.filterCat !== 'all') mr = mr.filter(r => r.category === S.filterCat);
  mr.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const list = $('recordsList');
  const empty = $('emptyState');

  if (!mr.length) {
    list.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  const groups = {};
  mr.forEach(r => { (groups[r.date] = groups[r.date] || []).push(r); });

  list.innerHTML = Object.keys(groups).sort((a, b) => b.localeCompare(a)).map(date => {
    const items = groups[date];
    const dayExp = items.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
    const dayInc = items.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
    const parts = [];
    if (dayExp > 0) parts.push(`支出¥${fmt(dayExp)}`);
    if (dayInc > 0) parts.push(`收入¥${fmt(dayInc)}`);

    const rows = items.map(r => {
      const c = catInfo(r.category);
      return `
        <div class="record-item" data-id="${r.id}">
          <div class="r-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</div>
          <div class="r-body">
            <div class="r-cat">${c.label}</div>
            ${r.note ? `<div class="r-note">${r.note}</div>` : ''}
          </div>
          <div class="r-amt ${r.type}">${r.type === 'expense' ? '-' : '+'}¥${fmt(r.amount)}</div>
          <button class="r-del" data-id="${r.id}" title="删除">×</button>
        </div>`;
    }).join('');

    return `
      <div class="day-group">
        <div class="day-header">
          <span class="day-date">${weekdayStr(date)}</span>
          <span class="day-total">${parts.join('  ')}</span>
        </div>
        ${rows}
      </div>`;
  }).join('');

  list.querySelectorAll('.r-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      S.delId = Number(btn.dataset.id);
      $('delOverlay').classList.add('show');
    });
  });
}

// ── Stats page ────────────────────────────────────────────────────────────────
function renderStats() {
  const mr = monthRecords();
  const exp = mr.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const inc = mr.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const bal = inc - exp;

  $('stExp').textContent = `¥${fmt(exp)}`;
  $('stInc').textContent = `¥${fmt(inc)}`;
  const bEl = $('stBal');
  bEl.textContent = `¥${fmt(Math.abs(bal))}`;
  bEl.className = `sc-val ${bal >= 0 ? 'income' : 'expense'}`;

  renderPie(mr);
  renderBreakdown(mr);
  renderTrend(mr);
}

function renderPie(mr) {
  const expRecs = mr.filter(r => r.type === 'expense');
  const total = expRecs.reduce((s, r) => s + r.amount, 0);
  const svg = $('pieSvg');
  const leg = $('pieLegend');

  if (!total) {
    svg.innerHTML = `<text x="100" y="108" text-anchor="middle" fill="#555" font-size="13">暂无支出</text>`;
    leg.innerHTML = '';
    return;
  }

  const catTotals = {};
  expRecs.forEach(r => { catTotals[r.category] = (catTotals[r.category] || 0) + r.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  let angle = -Math.PI / 2;
  const cx = 100, cy = 100, ro = 78, ri = 48;

  const paths = sorted.map(([cat, amt]) => {
    const c = catInfo(cat);
    const span = (amt / total) * 2 * Math.PI;
    const end = angle + span;
    const x1 = cx + ro * Math.cos(angle), y1 = cy + ro * Math.sin(angle);
    const x2 = cx + ro * Math.cos(end),   y2 = cy + ro * Math.sin(end);
    const ix1 = cx + ri * Math.cos(end),  iy1 = cy + ri * Math.sin(end);
    const ix2 = cx + ri * Math.cos(angle),iy2 = cy + ri * Math.sin(angle);
    const large = span > Math.PI ? 1 : 0;
    const d = `M${x1},${y1} A${ro},${ro},0,${large},1,${x2},${y2} L${ix1},${iy1} A${ri},${ri},0,${large},0,${ix2},${iy2} Z`;
    angle = end;
    return `<path d="${d}" fill="${c.color}" opacity="0.9"/>`;
  }).join('');

  const top = sorted[0];
  const topLabel = catInfo(top[0]).label;
  const topPct = Math.round(top[1] / total * 100);

  svg.innerHTML = paths + `
    <text x="100" y="95"  text-anchor="middle" fill="#c8c8e8" font-size="10">${topLabel}</text>
    <text x="100" y="112" text-anchor="middle" fill="#e4e4f0" font-size="15" font-weight="bold">${topPct}%</text>`;

  leg.innerHTML = sorted.map(([cat, amt]) => {
    const c = catInfo(cat);
    const pct = Math.round(amt / total * 100);
    return `
      <div class="leg-item">
        <span class="leg-dot" style="background:${c.color}"></span>
        <span class="leg-name">${c.icon} ${c.label}</span>
        <span class="leg-pct">${pct}%</span>
      </div>`;
  }).join('');
}

function renderBreakdown(mr) {
  const expRecs = mr.filter(r => r.type === 'expense');
  const total = expRecs.reduce((s, r) => s + r.amount, 0);
  const el = $('catBreakdown');

  if (!total) {
    el.innerHTML = '<p class="no-data">暂无支出数据</p>';
    return;
  }

  const catTotals = {};
  expRecs.forEach(r => { catTotals[r.category] = (catTotals[r.category] || 0) + r.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);

  el.innerHTML = sorted.map(([cat, amt]) => {
    const c = catInfo(cat);
    const pct = (amt / total * 100);
    return `
      <div class="bk-item">
        <div class="bk-top">
          <div class="bk-left">
            <span class="bk-icon">${c.icon}</span>
            <span>${c.label}</span>
          </div>
          <div class="bk-right">
            <span class="bk-amt">¥${fmt(amt)}</span>
            <span class="bk-pct">${pct.toFixed(1)}%</span>
          </div>
        </div>
        <div class="bk-bar">
          <div class="bk-fill" style="width:${pct}%;background:${c.color}"></div>
        </div>
      </div>`;
  }).join('');
}

function renderTrend(mr) {
  const expRecs = mr.filter(r => r.type === 'expense');
  const days = new Date(S.year, S.month + 1, 0).getDate();
  const daily = new Array(days).fill(0);
  expRecs.forEach(r => {
    const d = new Date(r.date + 'T00:00:00').getDate();
    daily[d - 1] += r.amount;
  });

  const max = Math.max(...daily, 1);
  const W = 300, H = 70;
  const bw = W / days - 1;

  const bars = daily.map((amt, i) => {
    const bh = Math.max((amt / max) * (H - 8), amt > 0 ? 2 : 0);
    const x = i * (W / days);
    const y = H - bh;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${amt > 0 ? '#6c63ff' : '#252538'}" rx="2"/>`;
  }).join('');

  $('trendSvg').innerHTML = bars;
}

// ── Add form ─────────────────────────────────────────────────────────────────
function updateAmt() {
  $('amountDisplay').textContent = S.amtStr || '0';
}

function handleKey(v) {
  if (v === 'ok') { doSubmit(); return; }

  if (v === 'del') {
    S.amtStr = S.amtStr.length > 1 ? S.amtStr.slice(0, -1) : '0';
  } else if (v === '.') {
    if (!S.amtStr.includes('.')) S.amtStr += '.';
  } else if (v === '00') {
    if (S.amtStr === '0') return;
    if (S.amtStr.includes('.')) {
      const dec = S.amtStr.split('.')[1];
      if (dec.length < 2) S.amtStr += dec.length === 0 ? '00' : '0';
    } else {
      if (S.amtStr.replace('.', '').length < 8) S.amtStr += '00';
    }
  } else {
    if (S.amtStr.includes('.') && S.amtStr.split('.')[1].length >= 2) return;
    if (!S.amtStr.includes('.') && S.amtStr.replace('.', '').length >= 8) return;
    S.amtStr = S.amtStr === '0' ? v : S.amtStr + v;
  }
  updateAmt();
}

function doSubmit() {
  const amt = parseFloat(S.amtStr);
  if (!amt || amt <= 0) { toast('请输入金额'); return; }
  if (!S.addCat) { toast('请选择分类'); return; }

  records.push({
    id: Date.now(),
    type: S.addType,
    category: S.addCat,
    amount: amt,
    note: $('noteInput').value.trim(),
    date: $('dateInput').value || todayStr(),
  });
  save();

  S.amtStr = '0';
  S.addCat = null;
  $('noteInput').value = '';
  updateAmt();
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));

  toast('已记录');
  switchPage('pageRecords');
}

// ── Page switch ───────────────────────────────────────────────────────────────
function switchPage(id) {
  S.page = id;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  $(id).classList.add('active');
  document.querySelectorAll('.bnav').forEach(b => b.classList.toggle('active', b.dataset.page === id));

  if (id === 'pageRecords') { renderHeader(); renderRecords(); }
  if (id === 'pageStats')   { renderStats(); }
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  $('dateInput').value = todayStr();

  renderHeader();
  renderRecords();

  // Month nav
  $('prevMonth').addEventListener('click', () => {
    if (--S.month < 0) { S.month = 11; S.year--; }
    renderHeader();
    if (S.page === 'pageRecords') renderRecords();
    if (S.page === 'pageStats') renderStats();
  });
  $('nextMonth').addEventListener('click', () => {
    const now = new Date();
    if (S.year === now.getFullYear() && S.month === now.getMonth()) return;
    if (++S.month > 11) { S.month = 0; S.year++; }
    renderHeader();
    if (S.page === 'pageRecords') renderRecords();
    if (S.page === 'pageStats') renderStats();
  });

  // Bottom nav
  document.querySelectorAll('.bnav').forEach(b => {
    b.addEventListener('click', () => switchPage(b.dataset.page));
  });

  // Filter bar
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.filterCat = b.dataset.cat;
      document.querySelectorAll('.filter-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      renderRecords();
    });
  });

  // Type toggle
  document.querySelectorAll('.type-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.addType = b.dataset.type;
      S.addCat = null;
      document.querySelectorAll('.type-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.remove('active'));
      $('catExpense').style.display = S.addType === 'expense' ? 'grid' : 'none';
      $('catIncome').style.display  = S.addType === 'income'  ? 'grid' : 'none';
    });
  });

  // Category selection
  document.querySelectorAll('.cat-btn').forEach(b => {
    b.addEventListener('click', () => {
      S.addCat = b.dataset.cat;
      document.querySelectorAll('.cat-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  });

  // Numpad
  document.querySelectorAll('.np').forEach(b => {
    b.addEventListener('click', () => handleKey(b.dataset.v));
  });

  // Delete modal
  $('delCancel').addEventListener('click', () => {
    $('delOverlay').classList.remove('show');
    S.delId = null;
  });
  $('delConfirm').addEventListener('click', () => {
    if (S.delId) {
      records = records.filter(r => r.id !== S.delId);
      save();
      S.delId = null;
      $('delOverlay').classList.remove('show');
      renderHeader();
      renderRecords();
      toast('已删除');
    }
  });

  // Export
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
    a.href = url;
    a.download = `记账本_${dateStr}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast('导出成功');
  });

  // Import
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data)) { toast('格式错误'); return; }
        records = data;
        save();
        renderHeader();
        if (S.page === 'pageRecords') renderRecords();
        if (S.page === 'pageStats') renderStats();
        toast(`已导入 ${data.length} 条`);
      } catch { toast('解析失败'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

init();
