(function () {
  'use strict';
  const fuels = [['t92', '92号汽油'], ['t95', '95号汽油'], ['t98', '98号汽油'], ['t0', '0号柴油'], ['t89', '89号汽油']];
  const regions = {'华北':['北京','天津','河北','山西','内蒙古'],'东北':['辽宁','吉林','黑龙江'],'华东':['上海','江苏','浙江','安徽','福建','江西','山东'],'华中':['河南','湖北','湖南'],'华南':['广东','广西','海南'],'西南':['重庆','四川','贵州','云南','西藏'],'西北':['陕西','甘肃','青海','宁夏','新疆']};
  const sources = ['data/latest.json', 'https://cdn.jsdelivr.net/gh/liuyuhang888/today-oil-price@main/data/latest.json', 'https://fastly.jsdelivr.net/gh/liuyuhang888/today-oil-price@main/data/latest.json', 'https://cdn.jsdelivr.net/gh/ZhangHowie/oilpulse-cn@main/data/latest.json', 'https://raw.githubusercontent.com/ZhangHowie/oilpulse-cn/main/data/latest.json'];
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const price = value => { const n = Number(value); return Number.isFinite(n) && n > 0 ? n : null; };
  const format = value => value == null ? '—' : value.toFixed(2);
  const entries = (provinces, field) => Object.keys(provinces).map(name => ({name, value: price(provinces[name] && provinces[name][field])})).filter(item => item.value !== null);
  const average = values => values.length ? values.reduce((sum, item) => sum + item.value, 0) / values.length : null;
  const beijingYear = () => new Intl.DateTimeFormat('en', {timeZone:'Asia/Shanghai', year:'numeric'}).format(new Date());
  let data = null, history = null;

  function setFuelOptions(id) { $(id).innerHTML = fuels.map(([key, name]) => `<option value="${key}">${name}</option>`).join(''); }
  setFuelOptions('trend-fuel'); setFuelOptions('rank-fuel');
  function renderStats() {
    $('stats').innerHTML = fuels.slice(0, 4).map(([field, name]) => {
      const values = entries(data.provinces, field);
      return `<article class="stat"><div class="stat-label">${name} · 全国均价</div><div class="stat-value">${format(average(values))} <small>元/升</small></div><div class="stat-foot">${values.length} 个地区参与统计</div></article>`;
    }).join('');
  }
  function renderRanking() {
    const field = $('rank-fuel').value;
    const list = entries(data.provinces, field);
    const ordered = list.slice().sort((a,b) => a.value - b.value || a.name.localeCompare(b.name, 'zh-CN'));
    function rows(items, target, high) {
      $(target).className = high ? 'high-list' : '';
      const max = Math.max(...items.map(x => x.value), 1);
      $(target).innerHTML = items.length ? items.map((item, i) => `<div class="rank-row"><span class="rank-number">${String(i + 1).padStart(2, '0')}</span><span class="rank-name">${escape(item.name)}</span><span class="bar" aria-hidden="true"><span style="width:${item.value / max * 100}%"></span></span><span class="rank-price">${format(item.value)}</span></div>`).join('') : '<div class="empty">暂无该油品价格</div>';
    }
    rows(ordered.slice(0, 10), 'rank-low', false);
    rows(list.slice().sort((a,b) => b.value - a.value || a.name.localeCompare(b.name, 'zh-CN')).slice(0, 10), 'rank-high', true);
    if (!ordered.length) { $('insights').innerHTML = ''; return; }
    const low = ordered[0].value, high = ordered[ordered.length - 1].value;
    const middle = ordered.length % 2 ? ordered[(ordered.length - 1) / 2].value : (ordered[ordered.length / 2 - 1].value + ordered[ordered.length / 2].value) / 2;
    $('insights').innerHTML = `<div class="insight">最高与最低价差<strong>¥ ${format(high - low)} <small> / 升</small></strong></div><div class="insight">价格中位数<strong>¥ ${format(middle)} <small> / 升</small></strong></div><div class="insight">按全国均价加满 50 升约需<strong>¥ ${format(average(list) * 50)}</strong></div>`;
  }
  function renderTable() {
    const keyword = $('search').value.trim().toLowerCase();
    const regionOf = {};
    Object.keys(regions).forEach(region => regions[region].forEach(name => { regionOf[name] = region; }));
    const names = Object.keys(data.provinces).filter(name => name.toLowerCase().includes(keyword)).sort((a,b) => a.localeCompare(b, 'zh-CN'));
    if (!names.length) { $('content').innerHTML = '<div class="empty">没有找到匹配的省份，请尝试其他关键词。</div>'; return; }
    $('content').innerHTML = `<div class="table-wrap"><table><thead><tr><th scope="col">省份 / 地区</th>${fuels.map(([,name]) => `<th scope="col">${name}</th>`).join('')}</tr></thead><tbody>${names.map(name => `<tr><td>${escape(name)}<span class="region-tag">${escape(regionOf[name] || '其他')}</span></td>${fuels.map(([field]) => `<td>${format(price(data.provinces[name][field]))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderChart() {
    const field = $('trend-fuel').value, province = $('trend-province').value, year = beijingYear();
    const fuelName = fuels.find(fuel => fuel[0] === field)[1];
    $('chart-label').textContent = `${province || '全国均价'} · ${fuelName}`;
    if (!history) { $('chart').innerHTML = '<div class="chart-empty">历史数据暂时无法加载，请稍后重试。</div>'; $('chart-meta').textContent = ''; $('chart-value').innerHTML = '— <small>元/升</small>'; return; }
    const days = history.days.filter(day => typeof day.date === 'string' && day.date.startsWith(year + '-') && day.provinces).map(day => ({date: day.date, source: day.source, value: province ? price(day.provinces[province] && day.provinces[province][field]) : average(entries(day.provinces, field))})).filter(day => day.value !== null).sort((a,b) => a.date.localeCompare(b.date));
    $('chart-value').innerHTML = `${days.length ? format(days[days.length - 1].value) : '—'} <small>元/升</small>`;
    if (!days.length) { $('chart').innerHTML = `<div class="chart-empty">${year} 年暂无该地区和油品的历史记录。</div>`; $('chart-meta').textContent = ''; $('chart-note').textContent = '历史数据按北京时间每天最后一次归档统计；无效或缺失的价格不参与统计。'; return; }
    $('chart-meta').textContent = `${days[0].date} 至 ${days[days.length - 1].date} · ${days.length} 条记录`;
    $('chart-note').textContent = '历史调价记录来自东方财富，本地归档取每天最后一次快照；虚线连接相隔多天的记录，不代表中间日期的实际价格。全国均价为当日各省有效价格的算术平均值。东方财富不提供 98 号历史价格。';
    const width = 1000, height = 240, left = 48, right = 20, top = 20, bottom = 35;
    const values = days.map(day => day.value), min = Math.min(...values), max = Math.max(...values);
    const padding = Math.max((max-min)*.2, .1), low = min-padding, high = max+padding;
    const start = Date.parse(year + '-01-01T00:00:00Z'), end = Date.parse((Number(year)+1) + '-01-01T00:00:00Z');
    const x = date => left + (Date.parse(date + 'T00:00:00Z') - start) / (end - start) * (width-left-right);
    const y = value => top + (high-value)/(high-low)*(height-top-bottom);
    const grid = Array.from({length: 4}, (_, i) => { const yy = top + i*(height-top-bottom)/3; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#edf1ed"/><text x="${left-10}" y="${yy+4}" text-anchor="end" fill="#a0ada3" font-size="12">${(high-i*(high-low)/3).toFixed(2)}</text>`; }).join('');
    const ticks = [1,4,7,10,12].map(month => { const date = `${year}-${String(month).padStart(2,'0')}-01`; return `<text x="${x(date)}" y="${height-4}" text-anchor="middle" fill="#a0ada3" font-size="12">${month}月</text>`; }).join('');
    // A dashed connector signals that intervening days are not observations.
    const lines = days.slice(1).map((day, i) => {
      const previous = days[i];
      const gap = Date.parse(day.date) - Date.parse(previous.date) > 86400000;
      return `<line x1="${x(previous.date)}" y1="${y(previous.value)}" x2="${x(day.date)}" y2="${y(day.value)}" stroke="#328b63" stroke-width="3" ${gap ? 'stroke-dasharray="5 5"' : ''} vector-effect="non-scaling-stroke"/>`;
    }).join('');
    const dots = days.map(day => `<circle cx="${x(day.date)}" cy="${y(day.value)}" r="4" fill="#fff" stroke="#328b63" stroke-width="2"><title>${escape(day.date)}：${format(day.value)} 元/升（${day.source === 'eastmoney' ? '东方财富调价记录' : '本地归档'}）</title></circle>`).join('');
    $('chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(year + '年' + (province || '全国均价') + fuelName)}走势，${days.length}条记录"><g>${grid}${ticks}${lines}${dots}</g></svg>`;
  }
  async function loadLatest() {
    for (const source of sources) {
      try { const response = await fetch(source, {cache:'no-cache'}); if (!response.ok) continue; const result = await response.json(); if (result && result.provinces && typeof result.provinces === 'object' && Object.keys(result.provinces).length) return result; } catch (error) { /* Try the next source. */ }
    }
    throw new Error('No available price source');
  }
  async function init() {
    try {
      data = await loadLatest();
      const date = new Date(data.updated_at);
      $('updated').textContent = isNaN(date) ? (data.updated_at || '未知') : new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Shanghai', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date) + '（北京时间）';
      $('trend-province').innerHTML += Object.keys(data.provinces).sort((a,b) => a.localeCompare(b, 'zh-CN')).map(name => `<option value="${escape(name)}">${escape(name)}</option>`).join('');
      renderStats(); renderRanking(); renderTable();
    } catch (error) { $('updated').textContent = '加载失败'; $('load-error').classList.remove('hidden'); $('stats').innerHTML = ''; $('content').innerHTML = '<div class="empty">暂无油价数据</div>'; }
    try { const response = await fetch('data/history-index.json', {cache:'no-cache'}); if (!response.ok) throw new Error('History unavailable'); const result = await response.json(); if (!Array.isArray(result.days)) throw new Error('Invalid history'); history = result; } catch (error) { history = null; }
    renderChart();
  }
  $('search').addEventListener('input', () => { if (data) renderTable(); });
  $('rank-fuel').addEventListener('change', () => { if (data) renderRanking(); });
  $('trend-fuel').addEventListener('change', renderChart);
  $('trend-province').addEventListener('change', renderChart);
  init();
})();
