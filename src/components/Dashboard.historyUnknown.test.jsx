// RAM element-tree contract; this does not prove browser/iPad or Radix interactions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test } from 'vitest';
import babel from '@babel/core';
import { fileURLToPath } from 'node:url';
const folder = path.dirname(fileURLToPath(import.meta.url));
const deny = () => { throw new Error('Network forbidden'); };
function element(tag,props,...children) {return {tag,props:props||{},children:children.flat()};}
function lowered(file) {
 return babel.transformSync(fs.readFileSync(path.join(folder,file),'utf8'),{babelrc:false,configFile:false,parserOpts:{plugins:['jsx']},plugins:[({types:t})=>({visitor:{
  ImportDeclaration(p){p.remove();},ExportNamedDeclaration(p){if(p.node.declaration)p.replaceWith(p.node.declaration);else p.remove();},ExportDefaultDeclaration(p){p.replaceWith(p.node.declaration);},
  JSXElement:{exit(p){const n=p.node;const name=x=>t.isJSXIdentifier(x)?(/^[a-z]/.test(x.name)?t.stringLiteral(x.name):t.identifier(x.name)):t.memberExpression(name(x.object),t.identifier(x.property.name));
   const props=n.openingElement.attributes.map(a=>t.isJSXSpreadAttribute(a)?t.spreadElement(a.argument):t.objectProperty(t.stringLiteral(a.name.name),!a.value?t.booleanLiteral(true):t.isJSXExpressionContainer(a.value)?a.value.expression:a.value));
   const children=n.children.flatMap(c=>t.isJSXText(c)?(c.value.trim()?[t.stringLiteral(c.value.replace(/\s+/g,' ').trim())]:[]):t.isJSXExpressionContainer(c)?(t.isJSXEmptyExpression(c.expression)?[]:[c.expression]):[c]);
   p.replaceWith(t.callExpression(t.identifier('__jsx'),[name(n.openingElement.name),t.objectExpression(props),...children]));}},
  JSXFragment:{exit(p){p.replaceWith(t.callExpression(t.identifier('__jsx'),[t.stringLiteral('fragment'),t.nullLiteral(),...p.node.children.filter(c=>!t.isJSXText(c)).map(c=>t.isJSXExpressionContainer(c)?c.expression:c)]));}},
 }})]}).code;
}
const appearance = {};
vm.runInNewContext(lowered('../utils/reportAppearance.js')+'\nthis.style=getDaysSinceStyle;',appearance);
const historyStyle = appearance.style;
function context() {
 return {__jsx:element,fetch:deny,useState:initial=>[initial,()=>{}],useRef:()=>({current:null}),useEffect:()=>{},
  useUpdateAcknowledgement:()=>({onClick(){}}),Popover:{Root:'root',Trigger:'button',Portal:'portal',Content:'dialog',Close:'close'},X:'icon',
  appendPriceToScheduleLine:line=>line,RiskScore:'risk',Copy:'copy',Check:'check',ChevronRight:'chevron',getDaysSinceStyle:historyStyle,useMemo:f=>f(),
 };
}
function load(file,expose) {const c=context();vm.runInNewContext(lowered(file)+'\n'+expose,c);return c;}
function nodes(tree) {return tree&&typeof tree==='object'?[tree,...(tree.children||[]).flatMap(nodes)]:[];}
test('unknown RiskScore label, ARIA and explanation are explicit; numeric zero remains known',()=>{
 const c=load('RiskScore.jsx','this.component=RiskScore;');
 for(const score of [null,undefined,NaN]) {const all=nodes(c.component({score,color:'gray',description:'misleading'}));
  assert.equal(all.find(n=>n.tag==='button').props['aria-label'],'Risk score unknown. Show explanation');
  assert.equal(all.find(n=>n.tag==='button').children[0],'Unknown');assert.match(all.find(n=>n.tag==='pre').children[0],/history unavailable/);
 }
 const known=nodes(c.component({score:0,description:'Known zero'}));assert.match(known.find(n=>n.tag==='button').props['aria-label'],/0 out of 100/);
 assert.equal(known.find(n=>n.tag==='button').children[0],0);
});
test('actual Dashboard tooltip and row keep unknown score and days distinct from confirmed-new',()=>{
 const c=load('Dashboard.jsx','this.tooltip=buildRiskTooltip;this.row=AppointmentRow;this.clipboard=formatAppointmentClipboardLine;this.detail=formatAppointmentHistoryDetail;');
 assert.match(c.tooltip(null,null,null),/Risk score unknown/);assert.match(c.tooltip(25,{baseline:25},'New customer (no history)'),/25%/);
 const appointment={id:'synthetic',appointmentTime:'2026-10-05T17:00:00Z',customerName:'Synthetic',serviceName:'Synthetic',daysSinceLastAppointment:null,futureIssueLikelihood:null};
 // Imported display components/hooks are inert RAM values; no providers or UI runtime.
 Object.assign(c,{getReportAppointmentPriceBadge:()=>null,titleCase:s=>s});
 const tree=c.row({appointment,hideNames:false,showPrices:false,likelihoodMap:{synthetic:{score:null}},reviewEntry:null,onUpdateSeen(){}});
 const all=nodes(tree);const risk=all.find(n=>n.tag==='risk');assert.ok(risk);assert.equal(risk.props.score,null);assert.match(risk.props.description,/unknown/);
 assert.equal(all.find(n=>n.props.className==='apt-days').children[0],'Unknown');
 const knownTree=c.row({appointment:{...appointment,daysSinceLastAppointment:7,futureIssueLikelihood:35},hideNames:false,showPrices:false,reviewEntry:null,onUpdateSeen(){}});
 assert.equal(nodes(knownTree).find(n=>n.tag==='risk').props.score,35);
 const newTree=c.row({appointment:{...appointment,daysSinceLookupStatus:'confirmed-new'},hideNames:false,showPrices:false,reviewEntry:null,onUpdateSeen(){}});
 assert.equal(nodes(newTree).find(n=>n.props.className==='apt-days').children[0],'New');
 const unknownNumeric={...appointment,daysSinceLastAppointment:7,daysSinceLookupStatus:'unknown'};
 const unknownRow=c.row({appointment:unknownNumeric,hideNames:false,showPrices:false,reviewEntry:null,onUpdateSeen(){}});
 assert.equal(nodes(unknownRow).find(n=>n.props.className==='apt-days').children[0],'Unknown');
 assert.match(c.clipboard(unknownNumeric,false,false),/Unknown/);
 assert.doesNotMatch(c.clipboard(unknownNumeric,false,false),/7d/);
 assert.equal(c.detail(unknownNumeric),'History unknown');
 assert.equal(c.detail(appointment),'History unknown');
 assert.equal(c.detail({...appointment,daysSinceLookupStatus:'confirmed-new'}),'New client');
 const knownZero={...appointment,daysSinceLastAppointment:0,daysSinceLookupStatus:'confirmed-history'};
 assert.equal(c.detail(knownZero),'0 days since last appointment');
 assert.match(c.clipboard(knownZero,false,false),/\(0d\)/);
 assert.equal(c.detail({...appointment,daysSinceLastAppointment:7,daysSinceLookupStatus:'confirmed-history'}),'7 days since last appointment');
 assert.match(c.clipboard(appointment,false,false),/Unknown/);
 assert.match(c.clipboard({...appointment,daysSinceLookupStatus:'confirmed-new'},false,false),/New/);
});

test('pricing unavailability is explained only when prices are requested',()=>{
 const c=load('Dashboard.jsx','this.notice=getReportPricingNotice;');
 assert.match(c.notice({pricingAvailability:{available:false}},true),/Prices are unavailable/);
 assert.equal(c.notice({pricingAvailability:{available:false}},false),null);
 assert.equal(c.notice({pricingAvailability:{available:true}},true),null);
 assert.equal(c.notice({},true),null);
});

test('shared history style requires explicit new evidence and preserves known intervals',()=>{
 for(const [days,status] of [[null,undefined],[undefined,undefined],[null,'unknown'],[undefined,'error'],[null,'confirmed-history'],[7,'unknown'],['',undefined],[false,undefined],[NaN,undefined],[Infinity,undefined]]) assert.equal(historyStyle(days,status).label,'Unknown');
 assert.equal(historyStyle(null,'confirmed-new').label,'New');
 for(const [days,category] of [[0,'recent'],[6,'recent'],[7,'fortnight'],[14,'fortnight'],[15,'month'],[28,'month'],[29,'two-months'],[60,'two-months'],[61,'older'],['14','fortnight']]) {
  for(const status of [undefined,'confirmed-history']) {
   const style=historyStyle(days,status);assert.equal(style.label,days+'d');
   assert.equal(style.bg,'var(--days-'+category+'-bg)');assert.equal(style.text,'var(--days-'+category+'-text)');
  }
 }
});
test('actual shared card passes history status to the rendered badge',()=>{
 const c=load('ReportCard/ReportCard.jsx','this.card=ReportCard;this.badge=DaysBadge;');
 for(const [days,status,label] of [[null,undefined,'Unknown'],[null,'confirmed-new','New'],[0,'confirmed-history','0d'],[7,'unknown','Unknown']]) {
  const badge=nodes(c.card({variant:'note',customer:'Synthetic',days,daysLookupStatus:status})).find(n=>n.tag===c.badge);assert.ok(badge);
  assert.equal(badge.props.lookupStatus,status);assert.equal(c.badge(badge.props).children[0],label);
 }
 assert.equal(nodes(c.card({variant:'duplicates',customer:'Synthetic',showDays:false})).some(n=>n.tag===c.badge),false);
});
