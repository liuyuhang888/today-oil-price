// Run with node tests/location.test.js. Location and the network are mocked.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
class Element {
  constructor(id) { this.id=id; this.value=''; this.textContent=''; this.listeners={}; this.classList={remove(){},toggle(){}}; this._html=''; }
  set innerHTML(html) {
    this._html=html;
    if (['trend-region','trend-fuel','rank-fuel'].includes(this.id) && !this.value) {
      const match=html.match(/<option value="([^"]+)"/); if(match) this.value=match[1];
    }
  }
  get innerHTML(){return this._html;}
  addEventListener(name,fn){this.listeners[name]=fn;}
}
const ids=['trend-region','trend-fuel','rank-fuel','stats','rank-low','rank-high','insights','search','content','chart-label','chart-value','chart-meta','chart-legend','chart','chart-note','updated','load-error','locate-button','local-province','local-name','local-status','local-92','local-95','calc-consumption','calc-distance','calc-92','calc-95','calc-status'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const provinces={北京:{t92:'8.61',t95:'9.17'},广东:{t92:'8.63',t95:'9.35'},天津:{t92:'8.61',t95:'0.00'}};
let success, failure, result={results:[{country_code:'CN',province:'广东省',center:{lat:23.1,lng:113.3}}]}, calls=0;
const navigator={geolocation:{getCurrentPosition(ok,fail){success=ok;failure=fail;calls++;}},permissions:{query:async()=>({state:'prompt'})}};
const fetch=async url=>({ok:true,json:async()=>url.includes('uapis.cn/api/v1/misc/district')?result:url.includes('history-index')?{days:[]}:{updated_at:'2026-10-28T08:00:00+08:00',provinces}});
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{document:{getElementById:id=>elements[id]},fetch,navigator,Date,Intl,console,AbortController,URLSearchParams,setTimeout,clearTimeout});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
(async()=>{
  await tick();
  assert.strictEqual(calls,0); // Initial permission prompt must follow a user click.
  elements['local-province'].listeners.change({target:{value:'北京'}});
  assert.strictEqual(elements['local-name'].textContent,'北京');
  assert(elements['local-92'].innerHTML.includes('8.61'));
  assert(elements['local-95'].innerHTML.includes('9.17'));
  elements['calc-consumption'].value='8'; elements['calc-distance'].value='100';
  elements['calc-distance'].listeners.input();
  assert.strictEqual(elements['calc-92'].textContent,'¥ 68.88');
  assert.strictEqual(elements['calc-95'].textContent,'¥ 73.36');
  assert(elements['calc-status'].textContent.includes('预计用油 8.00 升'));
  elements['calc-distance'].value='-10'; elements['calc-distance'].listeners.input();
  assert.strictEqual(elements['calc-92'].textContent,'—');
  elements['calc-distance'].value='100'; elements['calc-distance'].listeners.input();
  elements['local-province'].listeners.change({target:{value:'天津'}});
  assert.strictEqual(elements['calc-92'].textContent,'¥ 68.88');
  assert.strictEqual(elements['calc-95'].textContent,'—');
  elements['locate-button'].listeners.click();
  await success({coords:{latitude:23.1,longitude:113.3}});
  assert.strictEqual(elements['local-name'].textContent,'广东');
  assert(elements['local-92'].innerHTML.includes('8.63'));
  assert(elements['local-95'].innerHTML.includes('9.35'));
  assert.strictEqual(elements['calc-92'].textContent,'¥ 69.04');
  assert.strictEqual(elements['calc-95'].textContent,'¥ 74.80');
  elements['locate-button'].listeners.click();
  failure({code:1});
  assert(elements['local-status'].textContent.includes('未授权'));
  elements['locate-button'].listeners.click();
  result={results:[{country_code:'CN',province:'北京市',center:{lat:39.9,lng:116.4}}]};
  await success({coords:{latitude:39.9,longitude:116.4}});
  assert.strictEqual(elements['local-name'].textContent,'北京');
  elements['locate-button'].listeners.click();
  result={results:[{country_code:'US',province:'Beijing',center:{lat:0,lng:0}}]};
  await success({coords:{latitude:0,longitude:0}});
  assert(elements['local-status'].textContent.includes('手动选择'));
  elements['locate-button'].listeners.click();
  result={results:[{country_code:'CN',province:'河北省',center:{lat:39.9,lng:116.4}},{country_code:'CN',province:'北京市',center:{lat:39.91,lng:116.4}}]};
  await success({coords:{latitude:39.9,longitude:116.4}});
  assert(elements['local-status'].textContent.includes('手动选择'));
  elements['locate-button'].listeners.click();
  elements['local-province'].listeners.change({target:{value:'广东'}});
  await success({coords:{latitude:39.9,longitude:116.4}});
  assert.strictEqual(elements['local-name'].textContent,'广东');
  console.log('Location checks passed: permission, reverse geocoding, manual choice and race handling');
})().catch(error=>{console.error(error);process.exitCode=1;});
