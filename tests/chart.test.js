// Run with node tests/chart.test.js. A small DOM harness exercises chart interactions.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor(id) { this.id = id; this.value = id === 'calc-scenario' ? 'reference' : ''; this.textContent = ''; this.listeners = {}; this.attributes = {}; this.hidden = false; this.classList = {remove() {}, toggle() {}}; this._html = ''; }
  set innerHTML(html) {
    this._html = html;
    if (['trend-region', 'trend-fuel', 'rank-fuel'].includes(this.id) && !this.value) {
      const match = html.match(/<option value="([^"]+)"/);
      if (match) this.value = match[1];
    }
    if (this.id === 'chart' && html.includes('<svg')) {
      this.svg = new Element('svg');
      this.svg.getBoundingClientRect = () => ({left: 0, width: 1000});
      this.cursor = new Element('cursor');
      this.tooltip = new Element('tooltip');
      this.tooltip.hidden = true;
    }
  }
  get innerHTML() { return this._html; }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  querySelector(selector) { return selector === 'svg' ? this.svg : selector === '.chart-cursor' ? this.cursor : this.tooltip; }
}
const ids = ['trend-region','trend-fuel','rank-fuel','stats','rank-low','rank-high','insights','search','content','chart-label','chart-value','chart-meta','chart-legend','chart','chart-note','updated','freshness','load-error','adjustment-last','adjustment-next','adjustment-tip','locate-button','local-province','local-name','local-status','local-92','local-95','calc-search','calc-search-results','calc-search-hint','vehicle-coverage','calc-scenario','calc-brand','calc-year','calc-model','calc-electric-enabled','electric-inputs','calc-electric-distance','calc-electric-use','calc-electric-price','calc-preset-note','calc-consumption','calc-distance','calc-92','calc-95','calc-status'];
const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
const provinces = {北京:{t92: '8.61', t95:'9.00', t0:'7.00', t98:'10.67'}, 天津:{t92:'8.61'}, 河北:{t92:'8.61'}, 山西:{t92:'8.55'}, 内蒙古:{t92:'8.62'}};
const history = {days:[
  {date:'2026-01-21', source:'eastmoney', provinces:{北京:{t92:6.77,t98:null}, 天津:{t92:6.70}, 河北:{t92:6.69}}},
  {date:'2026-02-04', source:'eastmoney', provinces:{北京:{t92:6.94,t95:9.00,t0:7.50}, 天津:{t92:6.85}}},
  {date:'2026-10-28', source:'archive', provinces}
]};
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-28T00:00:00Z'])); } }
const adjustments = {days:[history.days[1], {date:'2026-10-27', source:'eastmoney', provinces}]};
const context = {document:{getElementById:id=>elements[id]}, fetch:async url=>({ok:true,json:async()=>url.includes('history-index') ? history : url.includes('imported-history') ? adjustments : url.includes('vehicles/manifest.json') ? {brands:{},count:0} : {updated_at:'2026-10-28T08:00:00+08:00',provinces}}), Date:FixedDate, Intl, console, navigator:{}, AbortController, URLSearchParams, setTimeout, clearTimeout};
vm.runInNewContext(fs.readFileSync('app.js','utf8'), context);
setTimeout(() => {
  const chart = elements.chart;
  assert(elements.stats.innerHTML.includes('stat-change-up">上涨 +1.72 元/升'));
  assert(elements.stats.innerHTML.includes('stat-change-flat">持平 0.00 元/升'));
  assert(elements.stats.innerHTML.includes('stat-change-down">下跌 −0.50 元/升'));
  assert(elements.stats.innerHTML.includes('暂无可核验的上次调价数据'));
  assert(elements.stats.innerHTML.includes('上次调价 2026-10-27 生效 · 2 个地区'));
  assert(elements['chart-label'].textContent.includes('北京'));
  assert(elements['chart-legend'].innerHTML.includes('北京'));
  assert(!elements['chart-legend'].innerHTML.includes('天津'));
  elements['trend-region'].value = '华北'; elements['trend-region'].listeners.change();
  assert(elements['chart-label'].textContent.includes('华北'));
  assert(elements['chart-legend'].innerHTML.includes('北京') && elements['chart-legend'].innerHTML.includes('天津'));
  assert(chart.innerHTML.includes('#237957') && chart.innerHTML.includes('#e19a39'));
  assert(chart.innerHTML.includes('stroke-dasharray="5 5"'));
  chart.svg.listeners.pointermove({pointerType:'mouse',clientX:99});
  assert(chart.tooltip.innerHTML.includes('2026-01-21'));
  assert(chart.tooltip.innerHTML.includes('6.77') && chart.tooltip.innerHTML.includes('6.70'));
  assert(chart.tooltip.innerHTML.includes('—'));
  chart.svg.listeners.pointerleave({pointerType:'mouse'});
  assert(chart.tooltip.hidden);
  chart.svg.listeners.pointerdown({pointerType:'touch',clientX:135});
  assert(chart.tooltip.innerHTML.includes('2026-02-04'));
  chart.svg.listeners.keydown({key:'ArrowLeft',preventDefault(){}});
  assert(chart.tooltip.innerHTML.includes('2026-01-21'));
  elements['trend-fuel'].value = 't98'; elements['trend-fuel'].listeners.change();
  assert(elements['chart-meta'].textContent.includes('1 个日期'));
  assert(elements['chart-legend'].innerHTML.includes('无数据'));
  elements['trend-region'].value = '华南'; elements['trend-region'].listeners.change();
  assert(chart.innerHTML.includes('暂无该地区和油品的历史记录'));
  console.log('Chart interaction checks passed');
}, 20);
