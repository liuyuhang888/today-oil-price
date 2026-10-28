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
  let data = null, history = null, adjustments = null;
  const preferenceKey = 'oil-price-preferences-v1';
  function readPreferences() { try { return JSON.parse(localStorage.getItem(preferenceKey)) || {}; } catch (_) { return {}; } }
  function savePreferences(values) { try { localStorage.setItem(preferenceKey, JSON.stringify({...readPreferences(), ...values})); } catch (_) {} }

  function setFuelOptions(id) { $(id).innerHTML = fuels.map(([key, name]) => `<option value="${key}">${name}</option>`).join(''); }
  setFuelOptions('trend-fuel'); setFuelOptions('rank-fuel');
  // Compare the last verified adjustment to the preceding one, never daily snapshots.
  function previousComparison(field) {
    if (!adjustments || !Array.isArray(adjustments.days)) return null;
    const latestTime = new Date(data.updated_at);
    if (isNaN(latestTime)) return null;
    const parts = new Intl.DateTimeFormat('en', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(latestTime);
    const get = key => parts.find(part => part.type === key).value;
    const latestDate = `${get('year')}-${get('month')}-${get('day')}`;
    const days = adjustments.days.filter(day => day.source === 'eastmoney' && day.provinces && day.date <= latestDate).sort((a,b) => b.date.localeCompare(a.date));
    if (days.length < 2) return null;
    const current = days[0], prior = days[1];
    const comparable = Object.keys(data.provinces).map(name => {
      const latest = price(data.provinces[name] && data.provinces[name][field]);
      const effective = price(current.provinces[name] && current.provinces[name][field]);
      const old = price(prior.provinces[name] && prior.provinces[name][field]);
      return latest !== null && effective !== null && old !== null ? {latest, effective, old} : null;
    }).filter(Boolean);
    if (!comparable.length) return null;
    // Refuse to label an older change as the latest if current prices disagree.
    if (comparable.filter(item => Math.abs(item.latest - item.effective) < 0.015).length / comparable.length < 0.8) return null;
    return {date: current.date, count: comparable.length, change: comparable.reduce((sum, item) => sum + item.effective - item.old, 0) / comparable.length};
  }
  function renderStats() {
    $('stats').innerHTML = fuels.slice(0, 4).map(([field, name]) => {
      const values = entries(data.provinces, field);
      const comparison = previousComparison(field);
      let detail = '<span class="stat-change stat-change-muted">暂无可核验的上次调价数据</span>';
      if (comparison) {
        const cents = Math.round(Math.abs(comparison.change) * 100 + 1e-8);
        const direction = cents === 0 ? 'flat' : comparison.change > 0 ? 'up' : 'down';
        const symbol = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
        const label = direction === 'up' ? '上涨' : direction === 'down' ? '下跌' : '持平';
        detail = `<span class="stat-change stat-change-${direction}">${label} ${symbol}${(cents / 100).toFixed(2)} 元/升</span><span class="stat-compare-date">上次调价 ${escape(comparison.date)} 生效 · ${comparison.count} 个地区</span>`;
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
  // Values are tied to specific model years/configurations, not every trim.
  const vehiclePresets = [
    {id:'emgrand', brand:'吉利', year:'2025', name:'吉利帝豪第4代 CVT', value:'6.18', detail:'2025款 1.5L CVT旗舰型，WLTC综合油耗', source:'https://www.dongchedi.com/auto/params-carIds-110853'},
    {id:'song', brand:'比亚迪', year:'2025', name:'比亚迪宋Pro DM-i', value:'4.90', detail:'2025款 第二代 115KM超越型，WLTC亏电油耗', source:'https://www.dongchedi.com/auto/params-carIds-240804'},
    {id:'qin', brand:'比亚迪', year:'2025', name:'比亚迪秦PLUS DM-i', value:'3.90', detail:'2025款 智驾版 55KM领先型，WLTC亏电油耗', source:'https://www.dongchedi.com/auto/params-carIds-x-4802'},
    {id:'han', brand:'比亚迪', year:'2022', name:'比亚迪汉 DM-i', value:'5.10', detail:'2022款 121KM尊贵型，WLTC亏电油耗', source:'https://www.dongchedi.com/auto/params-carIds-72789-60262-72788-72691-72110'},
    {id:'c16', brand:'零跑', year:'2026', name:'零跑C16增程', value:'6.42', detail:'2026款 280激光雷达智尊版，WLTC亏电油耗', source:'https://pdf.dfcfw.com/pdf/H3_AP202604101821111556_1.pdf?1775826218000.pdf='}
  ];
  function updateVehicleYears(brand, selectedYear) {
    const years = [...new Set(vehiclePresets.filter(item => item.brand === brand).map(item => item.year))].sort().reverse();
    $('calc-year').innerHTML = '<option value="">选择年款</option>' + years.map(year => `<option value="${escape(year)}">${escape(year)}款</option>`).join('');
    $('calc-year').value = selectedYear || '';
    updateVehicleModels(brand, selectedYear || '');
  }
  function updateVehicleModels(brand, year) {
    $('calc-model').innerHTML = '<option value="">手动输入油耗</option>' + vehiclePresets.filter(item => item.brand === brand && item.year === year).map(item => `<option value="${item.id}">${escape(item.name)}${item.value === null ? ' · 请手动填写' : ' · ' + item.value + ' L/100km'}</option>`).join('');
    $('calc-model').value = '';
  }
  let vehicleInteracted = false;
  function populateVehicleBrands() {
    const selected = $('calc-brand').value;
    $('calc-brand').innerHTML = '<option value="">选择品牌</option>' + [...new Set(vehiclePresets.map(item => item.brand))].sort((a,b) => a.localeCompare(b, 'zh-CN')).map(brand => `<option value="${escape(brand)}">${escape(brand)}</option>`).join('');
    $('calc-brand').value = selected;
  }
  populateVehicleBrands();
  async function loadVehicleCatalog() {
    try {
      const response = await fetch('data/vehicle-catalog.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('Catalog unavailable');
      const catalog = await response.json();
      if (!Array.isArray(catalog.rows)) throw new Error('Invalid catalog');
      catalog.rows.forEach(row => {
        if (!Array.isArray(row) || row.length < 6 || !row[0] || !row[1] || !row[2] || !row[3]) return;
        const value = typeof row[4] === 'number' && row[4] > 0 && Number.isFinite(row[4]) ? row[4].toFixed(2) : null;
        vehiclePresets.push({id:'catalog-' + row[0], brand:String(row[1]), year:String(row[2]), name:String(row[3]), value, detail:row[5] === 3 ? '插混/增程车型，请手动填写实际油耗' : '公开目录参考值，工况及适用市场请核对来源', source:'https://eficien.com/vehicles.html'});
      });
      const selectedBrand = $('calc-brand').value, selectedYear = $('calc-year').value, selectedModel = $('calc-model').value;
      populateVehicleBrands();
      if (selectedBrand) { updateVehicleYears(selectedBrand, selectedYear); $('calc-model').value = selectedModel; }
      $('vehicle-coverage').textContent = `已收录 ${catalog.rows.length} 条燃油、混动及插混车型记录，含海外车型；部分车型需手动填写油耗。`;
    } catch (_) { $('vehicle-coverage').textContent = '完整车型目录暂不可用，可选择已核验车型或手动输入油耗。'; }
  }
  $('calc-brand').addEventListener('change', () => { vehicleInteracted = true; updateVehicleYears($('calc-brand').value, ''); $('calc-preset-note').textContent = '请选择年款和车型；当前油耗已保留，请确认。'; savePreferences({model:''}); });
  $('calc-year').addEventListener('change', () => { vehicleInteracted = true; updateVehicleModels($('calc-brand').value, $('calc-year').value); $('calc-preset-note').textContent = '请选择车型；当前油耗已保留，请确认。'; savePreferences({model:''}); });
  $('calc-model').addEventListener('change', event => {
    vehicleInteracted = true;
    const preset = vehiclePresets.find(item => item.id === event.target.value);
    if (!preset) {
      $('calc-preset-note').textContent = '手动输入实际油耗可获得更贴近行程的估算。';
      savePreferences({model:''});
      return;
    }
    $('calc-scenario').value = 'reference';
    $('calc-consumption').value = preset.value || '';
    if (preset.value === null) {
      $('calc-preset-note').innerHTML = `${escape(preset.detail)}。<a href="${escape(preset.source)}" target="_blank" rel="noopener">查看数据来源 ↗</a>`;
      savePreferences({model:'', consumption:''});
      renderCalculator();
      return;
    }
    savePreferences({model:preset.id, scenario:'reference', consumption:preset.value});
    $('calc-preset-note').innerHTML = `${escape(preset.detail)} ${preset.value} L/100km。<a href="${escape(preset.source)}" target="_blank" rel="noopener">查看数据来源 ↗</a>；具体油耗可自行修改。`;
    renderCalculator();
  });
  function renderCalculator() {
    const consumptionText = $('calc-consumption').value.trim(), distanceText = $('calc-distance').value.trim();
    const consumption = Number(consumptionText), distance = Number(distanceText);
    const valid = consumptionText && distanceText && Number.isFinite(consumption) && Number.isFinite(distance) && consumption > 0 && distance > 0;
    const electric = $('calc-electric-enabled').checked;
    $('electric-inputs').hidden = !electric;
    const electricTexts = ['calc-electric-distance','calc-electric-use','calc-electric-price'].map(id => $(id).value.trim());
    const [electricDistance, electricityUse, electricityPrice] = electricTexts.map(Number);
    const validElectric = !electric || (electricTexts.every(Boolean) && [electricDistance,electricityUse,electricityPrice].every(Number.isFinite) && electricDistance >= 0 && electricDistance <= distance && electricityUse > 0 && electricityPrice >= 0);
    const liters = valid && validElectric ? consumption * (distance - (electric ? electricDistance : 0)) / 100 : null;
    const powerCost = electric && validElectric ? electricDistance * electricityUse / 100 * electricityPrice : 0;
    const values = data && localProvince && data.provinces[localProvince];
    ['92', '95'].forEach(grade => {
      const unitPrice = price(values && values['t' + grade]);
      const cost = liters !== null && unitPrice !== null ? liters * unitPrice + powerCost : null;
      $('calc-' + grade).textContent = cost !== null && Number.isFinite(cost) ? `¥ ${cost.toFixed(2)}` : '—';
    });
    if (!localProvince) $('calc-status').textContent = '请选择地区，并填写油耗和里程。';
    else if (!valid) $('calc-status').textContent = '请填写大于 0 的油耗和里程。';
    else if (!validElectric) $('calc-status').textContent = '请填写有效电耗、电价和纯电里程（不能超过总里程）。';
    else if (!Number.isFinite(liters) || !Number.isFinite(powerCost)) $('calc-status').textContent = '输入数值过大，请检查。';
    else $('calc-status').textContent = `${localProvince} · 预计用油 ${liters.toFixed(2)} 升${electric ? `，电费 ¥ ${powerCost.toFixed(2)}（已计入总额）` : ''}；价格缺失的油品无法计算。`;
  }
  $('calc-scenario').addEventListener('change', () => {
    const scenario = $('calc-scenario').value;
    const saved = readPreferences();
    $('calc-consumption').value = scenario === 'city' ? (saved.cityConsumption || '') : scenario === 'highway' ? (saved.highwayConsumption || '') : '';
    $('calc-model').value = '';
    $('calc-preset-note').textContent = scenario === 'city' ? '请输入市区实际百公里油耗。' : scenario === 'highway' ? '请输入高速实际百公里油耗。' : '请选择车型或手动输入油耗。';
    savePreferences({scenario, model:'', consumption:$('calc-consumption').value});
    renderCalculator();
  });
  $('calc-consumption').addEventListener('input', () => {
    vehicleInteracted = true;
    if ($('calc-model').value) {
      $('calc-model').value = '';
      $('calc-preset-note').textContent = '已切换为手动输入油耗。';
    }
    const scenario = $('calc-scenario').value;
    const values = {model:'', scenario, consumption:$('calc-consumption').value};
    if (scenario === 'city') values.cityConsumption = $('calc-consumption').value;
    if (scenario === 'highway') values.highwayConsumption = $('calc-consumption').value;
    savePreferences(values);
    renderCalculator();
  });
  $('calc-distance').addEventListener('input', renderCalculator);
  $('calc-electric-enabled').addEventListener('change', renderCalculator);
  ['calc-electric-distance','calc-electric-use','calc-electric-price'].forEach(id => $(id).addEventListener('input', renderCalculator));

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
  // Test the browser coordinates against provincial polygons on the device.
  // The boundary file is fetched without sending the user's coordinates.
  function resolveBoundary(geojson, latitude, longitude) {
    if (!geojson || !Array.isArray(geojson.features)) throw new Error('Invalid boundary data');
    const insideRing = ring => {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > latitude) !== (yj > latitude) && longitude < (xj - xi) * (latitude - yi) / (yj - yi) + xi) inside = !inside;
      }
      return inside;
    };
    const nearRing = ring => {
      const sx = 111.2 * Math.cos(latitude * Math.PI / 180), sy = 111.2;
      for (let i = 1; i < ring.length; i++) {
        const ax = (ring[i-1][0] - longitude) * sx, ay = (ring[i-1][1] - latitude) * sy;
        const bx = (ring[i][0] - longitude) * sx, by = (ring[i][1] - latitude) * sy;
        const dx = bx-ax, dy = by-ay, denominator = dx*dx + dy*dy;
        const t = denominator ? Math.max(0, Math.min(1, -(ax*dx+ay*dy)/denominator)) : 0;
        if (Math.hypot(ax+t*dx, ay+t*dy) < 2) return true;
      }
      return false;
    };
    const matches = [];
    for (const feature of geojson.features) {
      const geometry = feature.geometry || {}, province = provinceNames.find(name => String(feature.properties && feature.properties.name || '').startsWith(name));
      if (!province) continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : [];
      for (const polygon of polygons || []) {
        if (!polygon.length || !insideRing(polygon[0]) || polygon.slice(1).some(insideRing)) continue;
        matches.push({province, ambiguous: polygon.some(nearRing)});
      }
    }
    return matches.length === 1 && !matches[0].ambiguous ? matches[0].province : null;
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
        let province, boundaryAvailable = false;
        const boundaryController = new AbortController();
        const boundaryTimer = setTimeout(() => boundaryController.abort(), 3500);
        try {
          const response = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json', {signal: boundaryController.signal});
          if (!response.ok) throw new Error('Boundary unavailable');
          const boundary = await response.json();
          province = resolveBoundary(boundary, position.coords.latitude, position.coords.longitude);
          boundaryAvailable = true;
        } catch (error) {
          if (controller.signal.aborted) throw error;
        } finally { clearTimeout(boundaryTimer); }
        if (!boundaryAvailable) {
          const params = new URLSearchParams({lat: String(position.coords.latitude), lng: String(position.coords.longitude), level: 'district', limit: '5'});
          const response = await fetch('https://uapis.cn/api/v1/misc/district?' + params, {signal: controller.signal});
          if (!response.ok) throw new Error('reverse geocoding failed');
          province = resolveProvince(await response.json(), position.coords.latitude, position.coords.longitude);
        }
        if (request !== locationRequest) return;
        if (!province || !data || !data.provinces[province]) { displayLocal('', '位置无法可靠识别，请手动选择省份。'); return; }
        $('local-province').value = province;
        savePreferences({province});
        displayLocal(province, boundaryAvailable ? '按省级边界识别，请核对省份 · 省级参考价' : '按附近行政区推测，请核对省份 · 省级参考价');
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
    savePreferences({province});
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
    $('chart-note').textContent = '历史调价记录来自东方财富，本地归档取每天最后一次快照；虚线连接相隔多天的记录，不代表中间日期的实际价格。98 号历史价格为交叉核对后的第三方数据，缺失数据不估算。';
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
  function renderFreshness() {
    const timestamp = new Date(data.updated_at).getTime();
    const elapsed = Date.now() - timestamp;
    const stale = !Number.isFinite(timestamp) || elapsed > 48 * 3600000 || elapsed < -3600000;
    $('freshness').textContent = stale ? '数据源更新时间较早或异常，请核对价格' : '数据源时间正常';
    $('freshness').className = stale ? 'freshness-stale' : 'freshness-ok';
  }
  async function loadCalendar() {
    try {
      const response = await fetch('data/adjustment-calendar.json', {cache:'no-cache'});
      if (!response.ok) throw new Error('Calendar unavailable');
      const calendar = await response.json();
      const now = Date.now();
      const next = (calendar.windows || []).find(date => Date.parse(date + 'T16:00:00Z') > now);
      $('adjustment-next').textContent = next ? next + ' 24时（北京时间）' : '暂无可核验的窗口日期';
      const last = calendar.last_notice;
      if (last && Date.parse(last.date + 'T16:00:00Z') <= now) {
        $('adjustment-last').innerHTML = `已收录公告：${escape(last.date)} · ${escape(last.text)} <a href="${escape(last.url || calendar.official)}" target="_blank" rel="noopener">官方公告 ↗</a>`;
      } else $('adjustment-last').textContent = '暂无可核验的最近公告';
      $('adjustment-tip').innerHTML = `公告可能不是最新结果；窗口日期仅供参考，调价结果以官方公告为准。<a href="${escape(calendar.source)}" target="_blank" rel="noopener">日历来源 ↗</a>`;
    } catch (_) { $('adjustment-last').textContent = '调价信息暂不可用'; $('adjustment-next').textContent = '—'; }
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
      renderFreshness(); renderStats(); renderRanking(); renderTable(); populateLocal(); $('locate-button').disabled = false;
      const saved = readPreferences();
      if (saved.province && data.provinces[saved.province]) { $('local-province').value = saved.province; displayLocal(saved.province, '已保存地区 · 省级参考价'); }
      else locateIfAlreadyAllowed();
      if (typeof saved.consumption === 'string') $('calc-consumption').value = saved.consumption;
      if (['reference','city','highway'].includes(saved.scenario)) $('calc-scenario').value = saved.scenario;
      renderCalculator();
      loadVehicleCatalog().then(() => {
        const preset = vehiclePresets.find(item => item.id === saved.model);
        if (!vehicleInteracted && preset && saved.consumption === preset.value) { $('calc-brand').value = preset.brand; updateVehicleYears(preset.brand, preset.year); $('calc-model').value = preset.id; $('calc-preset-note').innerHTML = `${escape(preset.detail)} ${preset.value} L/100km。<a href="${escape(preset.source)}" target="_blank" rel="noopener">查看数据来源 ↗</a>；具体油耗可自行修改。`; }
      });
    } catch (error) { displayLocal('', '油价数据加载失败，请稍后重试。'); $('updated').textContent = '加载失败'; $('load-error').classList.remove('hidden'); $('stats').innerHTML = ''; $('content').innerHTML = '<div class="empty">暂无油价数据</div>'; }
    try { const response = await fetch('data/imported-history.json', {cache:'no-cache'}); if (!response.ok) throw new Error('Adjustments unavailable'); const result = await response.json(); if (!Array.isArray(result.days)) throw new Error('Invalid adjustments'); adjustments = result; } catch (error) { adjustments = null; }
    try { const response = await fetch('data/history-index.json', {cache:'no-cache'}); if (!response.ok) throw new Error('History unavailable'); const result = await response.json(); if (!Array.isArray(result.days)) throw new Error('Invalid history'); history = result; } catch (error) { history = null; }
    if (data) renderStats();
    renderChart();
    loadCalendar();
  }
  $('search').addEventListener('input', () => { if (data) renderTable(); });
  $('rank-fuel').addEventListener('change', () => { if (data) renderRanking(); });
  $('trend-fuel').addEventListener('change', renderChart);
  $('trend-region').addEventListener('change', renderChart);
  init();
})();
