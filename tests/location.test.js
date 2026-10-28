// Run with node tests/location.test.js. Location and the network are mocked.
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
class Element {
  constructor(id) { this.id=id; this.value=id === 'calc-scenario' ? 'reference' : ''; this.textContent=''; this.listeners={}; this.classList={remove(){},toggle(){}}; this._html=''; }
  set innerHTML(html) {
    this._html=html;
    if (['trend-region','trend-fuel','rank-fuel'].includes(this.id) && !this.value) {
      const match=html.match(/<option value="([^"]+)"/); if(match) this.value=match[1];
    }
  }
  get innerHTML(){return this._html;}
  addEventListener(name,fn){this.listeners[name]=fn;}
}
const ids=['trend-region','trend-fuel','rank-fuel','stats','rank-low','rank-high','insights','search','content','chart-label','chart-value','chart-meta','chart-legend','chart','chart-note','updated','freshness','load-error','adjustment-last','adjustment-next','adjustment-tip','locate-button','local-province','local-name','local-status','local-92','local-95','calc-search','calc-search-results','calc-search-hint','vehicle-coverage','calc-scenario','calc-brand','calc-year','calc-model','calc-electric-enabled','electric-inputs','calc-electric-distance','calc-electric-use','calc-electric-price','calc-preset-note','calc-consumption','calc-distance','calc-92','calc-95','calc-status'];
const elements=Object.fromEntries(ids.map(id=>[id,new Element(id)]));
const provinces={北京:{t92:'8.61',t95:'9.17'},广东:{t92:'8.63',t95:'9.35'},天津:{t92:'8.61',t95:'0.00'}};
let boundaryData=null, success, failure, result={results:[{country_code:'CN',province:'广东省',center:{lat:23.1,lng:113.3}}]}, calls=0;
const storage={};
const localStorage={getItem:key=>storage[key] || null,setItem:(key,value)=>{storage[key]=value;}};
const navigator={geolocation:{getCurrentPosition(ok,fail){success=ok;failure=fail;calls++;}},permissions:{query:async()=>({state:'prompt'})}};
const fetch=async url=>({ok:!url.includes('geo.datav.aliyun.com') || !!boundaryData,json:async()=>url.includes('geo.datav.aliyun.com')?boundaryData:url.includes('uapis.cn/api/v1/misc/district')?result:url.includes('history-index')||url.includes('imported-history')?{days:[]}:url.includes('vehicles/search.json')?{rows:[['one','测试品牌','2025','测试燃油车'],['two','测试品牌','2025','测试插混车']]}:url.includes('vehicles/manifest.json')?{brands:{'测试品牌':'00'},count:2}:url.includes('vehicles/00.json')?{rows:[['one','测试品牌','2025','测试燃油车',6.5,0],['two','测试品牌','2025','测试插混车',null,3]]}:{updated_at:'2026-10-28T08:00:00+08:00',provinces}});
vm.runInNewContext(fs.readFileSync('app.js','utf8'),{document:{getElementById:id=>elements[id]},fetch,navigator,localStorage,Date,Intl,console,AbortController,URLSearchParams,setTimeout,clearTimeout});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
(async()=>{
  await tick();
  assert.strictEqual(calls,0); // Initial permission prompt must follow a user click.
  assert(elements['calc-brand'].innerHTML.includes('测试品牌'));
  elements['calc-brand'].value='测试品牌'; await elements['calc-brand'].listeners.change();
  assert(elements['calc-year'].innerHTML.includes('2025'));
  elements['calc-year'].value='2025'; elements['calc-year'].listeners.change();
  assert(elements['calc-model'].innerHTML.includes('测试燃油车'));
  elements['calc-model'].value='catalog-one'; elements['calc-model'].listeners.change({target:{value:'catalog-one'}});
  assert.strictEqual(elements['calc-consumption'].value,'6.50');
  elements['calc-search'].value='测试 2025 燃油'; await elements['calc-search'].listeners.input();
  assert(elements['calc-search-results'].innerHTML.includes('测试燃油车'));
  assert(!elements['calc-search-results'].innerHTML.includes('测试插混车'));
  await elements['calc-search-results'].listeners.change({target:{value:'catalog-one'}});
  assert.strictEqual(elements['calc-consumption'].value,'6.50');
  assert.strictEqual(elements['calc-year'].value,'2025');
  elements['calc-search'].value='不存在'; await elements['calc-search'].listeners.input();
  assert(elements['calc-search-hint'].textContent.includes('没有找到'));
  elements['calc-model'].value='catalog-two'; elements['calc-model'].listeners.change({target:{value:'catalog-two'}});
  assert.strictEqual(elements['calc-consumption'].value,'');
  assert(elements['calc-preset-note'].innerHTML.includes('手动填写'));
  elements['calc-scenario'].value='city'; elements['calc-scenario'].listeners.change();
  elements['calc-consumption'].value='7.8'; elements['calc-consumption'].listeners.input();
  assert.strictEqual(JSON.parse(storage['oil-price-preferences-v1']).cityConsumption,'7.8');
  elements['calc-scenario'].value='reference'; elements['calc-scenario'].listeners.change();
  elements['local-province'].listeners.change({target:{value:'北京'}});
  assert.strictEqual(elements['local-name'].textContent,'北京');
  assert(elements['local-92'].innerHTML.includes('8.61'));
  assert(elements['local-95'].innerHTML.includes('9.17'));
  elements['calc-consumption'].value='8'; elements['calc-distance'].value='100';
  elements['calc-distance'].listeners.input();
  assert.strictEqual(elements['calc-92'].textContent,'¥ 68.88');
  assert.strictEqual(elements['calc-95'].textContent,'¥ 73.36');
  const models={emgrand:'6.18',song:'4.90',qin:'3.90',han:'5.10',c16:'6.42'};
  for (const [id,value] of Object.entries(models)) {
    elements['calc-model'].value=id;
    elements['calc-model'].listeners.change({target:{value:id}});
    assert.strictEqual(elements['calc-consumption'].value,value);
    assert(elements['calc-preset-note'].innerHTML.includes('查看数据来源'));
    assert.strictEqual(elements['calc-92'].textContent,`¥ ${(Number(value)*8.61).toFixed(2)}`);
  }
  assert(!elements['calc-model'].innerHTML.includes('零跑A10'));
  elements['calc-consumption'].value='8'; elements['calc-consumption'].listeners.input();
  assert.strictEqual(elements['calc-model'].value,'');
  assert.strictEqual(elements['calc-92'].textContent,'¥ 68.88');

  assert(elements['calc-status'].textContent.includes('预计用油 8.00 升'));
  elements['calc-electric-enabled'].checked=true;
  elements['calc-electric-distance'].value='50'; elements['calc-electric-use'].value='16'; elements['calc-electric-price'].value='0.8';
  elements['calc-electric-enabled'].listeners.change();
  assert.strictEqual(elements['calc-92'].textContent,'¥ 40.84');
  assert(elements['calc-status'].textContent.includes('电费 ¥ 6.40'));
  elements['calc-electric-distance'].value='150'; elements['calc-electric-distance'].listeners.input();
  assert.strictEqual(elements['calc-92'].textContent,'—');
  elements['calc-electric-enabled'].checked=false; elements['calc-electric-enabled'].listeners.change();
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
  boundaryData={features:[{properties:{name:'北京市'},geometry:{type:'Polygon',coordinates:[[[115,39],[117,39],[117,41],[115,41],[115,39]]]}}]};
  elements['locate-button'].listeners.click();
  await success({coords:{latitude:39.9,longitude:116.4}});
  assert.strictEqual(elements['local-name'].textContent,'北京');
  assert(elements['local-status'].textContent.includes('省级边界'));
  elements['locate-button'].listeners.click();
  await success({coords:{latitude:39.0001,longitude:116.4}});
  assert(elements['local-status'].textContent.includes('手动选择'));
  boundaryData=null;
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
