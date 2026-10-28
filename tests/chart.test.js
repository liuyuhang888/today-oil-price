// Run with node tests/chart.test.js. A small DOM harness exercises chart interactions.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor(id) { this.id = id; this.value = ''; this.textContent = ''; this.listeners = {}; this.attributes = {}; this.hidden = false; this.classList = {remove() {}, toggle() {}}; this._html = ''; }
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
const ids = ['trend-region','trend-fuel','rank-fuel','stats','rank-low','rank-high','insights','search','content','chart-label','chart-value','chart-meta','chart-legend','chart','chart-note','updated','load-error'];
const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
const provinces = {北京:{t92: '8.61', t98:'10.67'}, 天津:{t92:'8.61'}, 河北:{t92:'8.61'}, 山西:{t92:'8.55'}, 内蒙古:{t92:'8.62'}};
const history = {days:[
  {date:'2026-01-21', source:'eastmoney', provinces:{北京:{t92:6.77,t98:null}, 天津:{t92:6.70}, 河北:{t92:6.69}}},
  {date:'2026-02-04', source:'eastmoney', provinces:{北京:{t92:6.94}, 天津:{t92:6.85}}},
  {date:'2026-10-28', source:'archive', provinces}
]};
class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-28T00:00:00Z'])); } }
const context = {document:{getElementById:id=>elements[id]}, fetch:async url=>({ok:true,json:async()=>url.includes('history-index') ? history : {updated_at:'2026-10-28T08:00:00+08:00',provinces}}), Date:FixedDate, Intl, console};
vm.runInNewContext(fs.readFileSync('app.js','utf8'), context);
setTimeout(() => {
  const chart = elements.chart;
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
