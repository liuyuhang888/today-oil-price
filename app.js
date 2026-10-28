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
  // Compare the latest snapshot to the most recent earlier Beijing calendar day.
  // Only provinces with a valid price at both points participate in the comparison.
  function previousComparison(field) {
    if (!history) return null;
    const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type).value;
    const today = `${get('year')}-${get('month')}-${get('day')}`;
    const candidates = history.days.filter(day => typeof day.date === 'string' && day.date < today && day.provinces).sort((a, b) => b.date.localeCompare(a.date));
    for (const day of candidates) {
      const changes = Object.keys(data.provinces).map(name => {
        const current = price(data.provinces[name] && data.provinces[name][field]);
        const previous = price(day.provinces[name] && day.provinces[name][field]);
        return current === null || previous === null ? null : current - previous;
      }).filter(value => value !== null);
      if (changes.length) return {date: day.date, count: changes.length, change: changes.reduce((a, b) => a + b, 0) / changes.length};
    }
    return null;
  }
  function renderStats() {
    $('stats').innerHTML = fuels.slice(0, 4).map(([field, name]) => {
      const values = entries(data.provinces, field);
      const comparison = previousComparison(field);
      let detail = '<span class="stat-change stat-change-muted">暂无上次可比数据</span>';
      if (comparison) {
        const cents = Math.round(Math.abs(comparison.change) * 100 + 1e-8);
        const direction = cents === 0 ? 'flat' : comparison.change > 0 ? 'up' : 'down';
        const symbol = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
        const label = direction === 'up' ? '上涨' : direction === 'down' ? '下跌' : '持平';
        detail = `<span class="stat-change stat-change-${direction}">${label} ${symbol}${(cents / 100).toFixed(2)} 元/升</span><span class="stat-compare-date">较 ${escape(comparison.date)} · ${comparison.count} 个可比地区</span>`;
      }
      return `<article class="stat"><div class="stat-label">${name} · 全国均价</div><div class="stat-value">${format(average(values))} <small>元/升</small></div><div class="stat-comparison">${detail}</div><div class="stat-foot">${values.length} 个地区参与均价统计</div></article>`;
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
  // UAPI returns nearby administrative centroids, so treat results as estimates.
  const provinceNames = Object.values(regions).flat();
  let locationRequest = 0, localProvince = '';
  function displayLocal(name, message) {
    localProvince = name;
    $('local-name').textContent = name || '未选择地区';
    $('local-status').textContent = message;
    const values = data && name && data.provinces[name];
    ['92', '95'].forEach(grade => { $('local-' + grade).innerHTML = `${format(price(values && values['t' + grade]))} <small>元/升</small>`; });
    renderCalculator();
  }
  function renderCalculator() {
    const consumptionText = $('calc-consumption').value.trim(), distanceText = $('calc-distance').value.trim();
    const consumption = Number(consumptionText), distance = Number(distanceText);
    const valid = consumptionText && distanceText && Number.isFinite(consumption) && Number.isFinite(distance) && consumption > 0 && distance > 0;
    const liters = valid ? consumption * distance / 100 : null;
    const values = data && localProvince && data.provinces[localProvince];
    ['92', '95'].forEach(grade => {
      const unitPrice = price(values && values['t' + grade]);
      const cost = liters !== null && unitPrice !== null ? liters * unitPrice : null;
      $('calc-' + grade).textContent = cost !== null && Number.isFinite(cost) ? `¥ ${cost.toFixed(2)}` : '—';
    });
    if (!localProvince) $('calc-status').textContent = '请选择地区，并填写油耗和里程。';
    else if (!valid || !Number.isFinite(liters)) $('calc-status').textContent = '请填写大于 0 的油耗和里程。';
    else $('calc-status').textContent = `${localProvince} · 预计用油 ${liters.toFixed(2)} 升；价格缺失的油品无法计算。`;
  }
  $('calc-consumption').addEventListener('input', renderCalculator);
  $('calc-distance').addEventListener('input', renderCalculator);

  function resolveProvince(result, latitude, longitude) {
    if (!Array.isArray(result.results) || !result.results.length) return null;
    const distance = center => {
      if (!center || !Number.isFinite(Number(center.lat)) || !Number.isFinite(Number(center.lng))) return Infinity;
      const rad = degrees => degrees * Math.PI / 180;
      const dLat = rad(Number(center.lat) - latitude), dLng = rad(Number(center.lng) - longitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(latitude)) * Math.cos(rad(Number(center.lat))) * Math.sin(dLng / 2) ** 2;
      return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
    };
    const nearby = result.results.map(item => ({item, distance: distance(item.center)})).sort((a,b) => a.distance - b.distance);
    const first = nearby[0];
    if (first.distance > 50 || first.item.country_code !== 'CN') return null;
    const province = provinceNames.find(name => String(first.item.province || '').startsWith(name));
    if (!province) return null;
    // A nearby center in another province makes the estimate ambiguous.
    if (nearby.some(entry => entry.distance <= first.distance + 10 && (entry.item.country_code !== 'CN' || !String(entry.item.province || '').startsWith(province)))) return null;
    return province;
  }
  function populateLocal() {
    $('local-province').innerHTML = '<option value="">手动选择省份</option>' + Object.keys(data.provinces).sort((a,b) => a.localeCompare(b, 'zh-CN')).map(name => `<option value="${escape(name)}">${escape(name)}</option>`).join('');
  }
  function locate() {
    const request = ++locationRequest;
    $('local-province').value = '';
    if (!navigator.geolocation) { displayLocal('', '浏览器不支持定位，请手动选择省份。'); return; }
    $('locate-button').disabled = true;
    displayLocal('', '正在获取位置…');
    navigator.geolocation.getCurrentPosition(async position => {
      if (request !== locationRequest) return;
      $('local-status').textContent = '正在识别所在省份…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      try {
        const params = new URLSearchParams({lat: String(position.coords.latitude), lng: String(position.coords.longitude), level: 'district', limit: '5'});
        const response = await fetch('https://uapis.cn/api/v1/misc/district?' + params, {signal: controller.signal});
        if (!response.ok) throw new Error('reverse geocoding failed');
        const result = await response.json();
        if (request !== locationRequest) return;
        const province = resolveProvince(result, position.coords.latitude, position.coords.longitude);
        if (!province || !data || !data.provinces[province]) { displayLocal('', '位置无法可靠识别，请手动选择省份。'); return; }
        $('local-province').value = province;
        displayLocal(province, '按附近行政区推测，请核对省份 · 省级参考价');
      } catch (error) {
        if (request === locationRequest) displayLocal('', '位置识别失败，请重试或手动选择省份。');
      } finally {
        clearTimeout(timer);
        if (request === locationRequest) $('locate-button').disabled = false;
      }
    }, error => {
      if (request !== locationRequest) return;
      $('locate-button').disabled = false;
      displayLocal('', error.code === 1 ? '定位权限未授权，请手动选择省份。' : '无法获取位置，请重试或手动选择省份。');
    }, {enableHighAccuracy: false, timeout: 10000, maximumAge: 0});
  }
  function locateIfAlreadyAllowed() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    navigator.permissions.query({name: 'geolocation'}).then(permission => {
      if (permission.state === 'granted' && locationRequest === 0) locate();
    }).catch(() => {});
  }
  $('locate-button').addEventListener('click', locate);
  $('local-province').addEventListener('change', event => {
    locationRequest++;
    $('locate-button').disabled = false;
    const province = event.target.value;
    displayLocal(province, province ? '手动选择 · 省级参考价' : '点击定位或手动选择省份');
  });

  const chartColors = ['#237957', '#e19a39', '#557cc8', '#b76176', '#8f73b7', '#27a0a2', '#bb7954'];
  $('trend-region').innerHTML = '<option value="北京">北京</option>' + Object.keys(regions).map(region => `<option value="${escape(region)}">${escape(region)}</option>`).join('');

  function renderChart() {
    const field = $('trend-fuel').value, region = $('trend-region').value, year = beijingYear();
    const fuel = fuels.find(item => item[0] === field);
    const names = region === '北京' ? ['北京'] : (regions[region] || []);
    $('chart-label').textContent = `${region} · ${fuel ? fuel[1] : ''}`;
    $('chart-legend').innerHTML = '';
    $('chart-value').textContent = '—';
    if (!history) {
      $('chart').innerHTML = '<div class="chart-empty">历史数据暂时无法加载，请稍后重试。</div>';
      $('chart-meta').textContent = '';
      return;
    }
    const days = history.days.filter(day => typeof day.date === 'string' && day.date.startsWith(year + '-') && day.provinces)
      .map(day => ({date: day.date, source: day.source, values: names.map(name => price(day.provinces[name] && day.provinces[name][field]))}))
      .filter(day => day.values.some(value => value !== null)).sort((a, b) => a.date.localeCompare(b.date));
    const series = names.map((name, index) => ({name, index, color: chartColors[index], points: days.filter(day => day.values[index] !== null)}));
    const visible = series.filter(item => item.points.length);
    $('chart-value').innerHTML = `${visible.length} <small>个省份有记录</small>`;
    $('chart-legend').innerHTML = series.map(item => `<span class="legend-item${item.points.length ? '' : ' legend-empty'}"><i style="background:${item.color}"></i>${escape(item.name)}${item.points.length ? '' : '（无数据）'}</span>`).join('');
    $('chart-note').textContent = '历史调价记录来自东方财富，本地归档取每天最后一次快照；虚线连接相隔多天的记录，不代表中间日期的实际价格。东方财富不提供 98 号历史价格。';
    if (!days.length) {
      $('chart').innerHTML = `<div class="chart-empty">${year} 年暂无该地区和油品的历史记录。</div>`;
      $('chart-meta').textContent = '';
      return;
    }
    $('chart-meta').textContent = `${days[0].date} 至 ${days[days.length - 1].date} · ${days.length} 个日期有记录`;
    const width = 1000, height = 240, left = 48, right = 20, top = 20, bottom = 35;
    const values = days.flatMap(day => day.values.filter(value => value !== null));
    const min = Math.min(...values), max = Math.max(...values);
    const padding = Math.max((max - min) * .2, .1), low = min - padding, high = max + padding;
    const start = Date.parse(year + '-01-01T00:00:00Z'), end = Date.parse((Number(year) + 1) + '-01-01T00:00:00Z');
    const x = date => left + (Date.parse(date + 'T00:00:00Z') - start) / (end - start) * (width - left - right);
    const y = value => top + (high - value) / (high - low) * (height - top - bottom);
    const grid = Array.from({length: 4}, (_, i) => { const yy = top + i * (height - top - bottom) / 3; return `<line x1="${left}" x2="${width-right}" y1="${yy}" y2="${yy}" stroke="#edf1ed"/><text x="${left-10}" y="${yy+4}" text-anchor="end" fill="#a0ada3" font-size="12">${(high-i*(high-low)/3).toFixed(2)}</text>`; }).join('');
    const ticks = [1,4,7,10,12].map(month => `<text x="${x(`${year}-${String(month).padStart(2,'0')}-01`)}" y="${height-4}" text-anchor="middle" fill="#a0ada3" font-size="12">${month}月</text>`).join('');
    const paths = visible.map(item => {
      const lines = item.points.slice(1).map((day, i) => {
        const previous = item.points[i];
        const gap = Date.parse(day.date) - Date.parse(previous.date) > 86400000;
        return `<line x1="${x(previous.date)}" y1="${y(previous.values[item.index])}" x2="${x(day.date)}" y2="${y(day.values[item.index])}" stroke="${item.color}" stroke-width="2" ${gap ? 'stroke-dasharray="5 5"' : ''} vector-effect="non-scaling-stroke"/>`;
      }).join('');
      const dots = item.points.map(day => `<circle cx="${x(day.date)}" cy="${y(day.values[item.index])}" r="3" fill="${item.color}" vector-effect="non-scaling-stroke"/>`).join('');
      return lines + dots;
    }).join('');
    $('chart').innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="${escape(year + '年' + region + (fuel ? fuel[1] : '') + '各省价格走势')}" tabindex="0"><g>${grid}${ticks}${paths}<line class="chart-cursor" x1="0" x2="0" y1="${top}" y2="${height-bottom}" stroke="#879b8c" stroke-width="1" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" visibility="hidden"/></g></svg><div class="chart-tooltip" role="status" aria-live="polite" hidden></div>`;
    const chart = $('chart'), svg = chart.querySelector('svg'), cursor = chart.querySelector('.chart-cursor'), tooltip = chart.querySelector('.chart-tooltip');
    let selected = 0;
    function showDate(index) {
      selected = index;
      const day = days[index], position = x(day.date);
      cursor.setAttribute('x1', position); cursor.setAttribute('x2', position); cursor.setAttribute('visibility', 'visible');
      tooltip.innerHTML = `<strong>${escape(day.date)}</strong><span class="tooltip-source">${day.source === 'eastmoney' ? '东方财富调价记录' : '本地归档'} · 元/升</span>${series.map(item => `<div class="tooltip-row"><span><i style="background:${item.color}"></i>${escape(item.name)}</span><b>${format(day.values[item.index])}</b></div>`).join('')}`;
      tooltip.hidden = false;
      tooltip.classList.toggle('tooltip-left', position > width * .55);
    }
    function selectPointer(event) {
      const rect = svg.getBoundingClientRect();
      if (!rect.width) return;
      const position = (event.clientX - rect.left) / rect.width * width;
      let closest = 0;
      days.forEach((day, i) => { if (Math.abs(x(day.date) - position) < Math.abs(x(days[closest].date) - position)) closest = i; });
      showDate(closest);
    }
    svg.addEventListener('pointermove', event => { if (event.pointerType !== 'touch') selectPointer(event); });
    svg.addEventListener('pointerdown', selectPointer);
    svg.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') { tooltip.hidden = true; cursor.setAttribute('visibility', 'hidden'); } });
    svg.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      if (tooltip.hidden) showDate(event.key === 'ArrowLeft' ? days.length - 1 : 0);
      else showDate(Math.max(0, Math.min(days.length - 1, selected + (event.key === 'ArrowRight' ? 1 : -1))));
    });
    svg.addEventListener('blur', () => { tooltip.hidden = true; cursor.setAttribute('visibility', 'hidden'); });
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
      renderStats(); renderRanking(); renderTable(); populateLocal(); $('locate-button').disabled = false; locateIfAlreadyAllowed();
    } catch (error) { displayLocal('', '油价数据加载失败，请稍后重试。'); $('updated').textContent = '加载失败'; $('load-error').classList.remove('hidden'); $('stats').innerHTML = ''; $('content').innerHTML = '<div class="empty">暂无油价数据</div>'; }
    try { const response = await fetch('data/history-index.json', {cache:'no-cache'}); if (!response.ok) throw new Error('History unavailable'); const result = await response.json(); if (!Array.isArray(result.days)) throw new Error('Invalid history'); history = result; } catch (error) { history = null; }
    if (data) renderStats();
    renderChart();
  }
  $('search').addEventListener('input', () => { if (data) renderTable(); });
  $('rank-fuel').addEventListener('change', () => { if (data) renderRanking(); });
  $('trend-fuel').addEventListener('change', renderChart);
  $('trend-region').addEventListener('change', renderChart);
  init();
})();
