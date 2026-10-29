import { BRANDS } from './lib/brands.js';
import { dateKey, parseDate, validRecord, calendarDays, filterRecords, monthSummary, parseBackup, mergeRecords, toCSV, makeDemo } from './lib/journal.js';
import { createJournalStorage, STORAGE_KEY } from './lib/storage.js';

const ICONS = {
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  cup:'<path d="M6 7h12l-1.5 14h-9L6 7Z"/><path d="M5 7h14M7 4h10M12 4l2-3"/><path d="M10 12c-2-2-4 2 2 5 6-3 4-7 2-5l-1 1-1-1Z"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18M7 14h2m3 0h2m3 0h1M7 17h2m3 0h2"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M4 15v5h16v-5"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/>',
  wallet:'<path d="M20 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1 0-4"/><path d="M21 11h-6v6h6v-6Z"/><path d="M17 14h.01"/>',
  heart:'<path d="M20.8 4.6a5.6 5.6 0 0 0-7.9 0l-.9.9-.9-.9a5.6 5.6 0 0 0-7.9 7.9L12 21l8.8-8.5a5.6 5.6 0 0 0 0-7.9Z"/>',
  'chevron-left':'<path d="m15 6-6 6 6 6"/>',
  'chevron-right':'<path d="m9 6 6 6-6 6"/>',
  'arrow-right':'<path d="M4 12h15m-5-5 5 5-5 5"/>',
  sparkles:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
  x:'<path d="m6 6 12 12M6 18 18 6"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/>',
  edit:'<path d="m16 3 5 5-12 12H4v-5L16 3Zm-3 3 5 5M12 21h9"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>'
};
const icon = name => `<i data-icon="${name}" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.cup}</svg></i>`;
document.querySelectorAll('i[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon).match(/<svg[\s\S]*<\/svg>/)[0]);

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let TODAY = dateKey(new Date());
let today = parseDate(TODAY);
const journalStorage = createJournalStorage({
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value)
});
const loaded = journalStorage.load();
let saved = loaded.records, demoMode = !loaded.hasStarted, loadError = Boolean(loaded.error);
const uid = () => globalThis.crypto?.randomUUID?.() || `cup-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const money = n => Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
let year = today.getFullYear(), month = today.getMonth(), selectedDate = TODAY, filter = 'all', view = 'calendar', query = '';
let editingId = null, draftBrand = 'luckin', draftSugar = '五分糖', deleteId = null;
const returnFocus = new WeakMap();
let toastTimer;
const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
let demoRecords = makeDemo(today);
const records = () => demoMode ? demoRecords : saved;
const monthRecords = () => filterRecords(records(), { year, month });
const matching = record => filterRecords([record], { type: filter, query }).length > 0;

function toast(message, action = null) {
  clearTimeout(toastTimer);
  const container = $('#toast');
  container.replaceChildren(document.createTextNode(message));
  if (action) {
    const button = document.createElement('button');
    button.id = 'toast-action';
    button.textContent = '撤销';
    button.addEventListener('click', action, { once: true });
    container.append(button);
  }
  container.classList.add('show');
  toastTimer = setTimeout(() => container.classList.remove('show'), action ? 10000 : 3500);
}
function persist() {
  try {
    saved = journalStorage.save(saved);
    loadError = false;
    $('.local-status').innerHTML = '<span></span>记录保存在当前浏览器';
    return true;
  } catch (error) {
    toast(loadError ? error.message : '浏览器未能保存，请尽快导出备份以免记录丢失。');
    $('.local-status').innerHTML = '<span></span>当前为临时记录，请导出备份';
    return false;
  }
}

function miniReceipt(record,index=0) {
  const b=BRANDS[record.brand];
  return `<div class="mini-receipt style-${record.brand}" style="--brand:${b.color};--tilt:${[-3,3,-2,2][index%4]}deg" aria-hidden="true"><div class="mini-brand">${escape(b.name)}</div><div class="mini-brand-en">${b.en}</div><div class="mini-name">${escape(record.name)}</div><div class="mini-meta"><span>${escape(record.size)} / ${escape(record.temperature)}</span><span>¥${money(record.price)}</span></div><div class="barcode"></div></div>`;
}
function receipt(record) {
  const b=BRANDS[record.brand], date=record.date.replaceAll('-','.');
  return `<div class="receipt style-${record.brand}" style="--brand:${b.color}"><div class="receipt-brand"><span class="brand-monogram">${b.mark}</span>${escape(b.name)}</div><div class="receipt-en">${b.en}</div><div class="receipt-divider"></div><div class="receipt-topline"><span>${date}</span><span>1 / 1</span></div><div class="receipt-name">${escape(record.name||'今天的第一杯')}</div><div class="receipt-specs">${escape(record.size)} / ${escape(record.temperature)}<br>${escape(record.sugar)}</div><div class="receipt-divider"></div><div class="receipt-bottomline"><span>一杯小确幸</span><span class="receipt-price">¥${money(record.price||0)}</span></div><div class="receipt-thanks">${b.thanks}</div><div class="barcode"></div><div class="receipt-code">${record.date.replaceAll('-','')} · CUPNOTE</div></div>`;
}
function emptyState(title,description,extra='') {return `<div class="empty-state ${extra?'wall-empty':''}"><span class="empty-cup">${icon('cup')}</span><h3>${title}</h3><p>${description}</p>${extra}</div>`;}

function render() {
  const monthData=monthRecords(), summary=monthSummary(monthData);
  const found=monthData.filter(matching).length;
  $('#search-count').textContent = query.trim() || filter !== 'all' ? `本月找到 ${found} 杯` : `本月共 ${found} 杯`;
  $('#clear-search').hidden = !query;
  $('#search-empty').hidden = found > 0 || (!query.trim() && filter === 'all');
  $('#raw-data-action').hidden = !loadError;
  $('#month-title').innerHTML=`${year}年 ${month+1}月<span>${monthNames[month]}</span>`;
  $('#prev-month').disabled=year===1900&&month===0;
  $('#next-month').disabled=year===2200&&month===11;
  $('#stat-cups').textContent=summary.cups;
  $('#stat-cost').textContent=money(summary.cost);
  const best=summary.favoriteBrand;
  $('#stat-brand').textContent=best?BRANDS[best].name:'还在发现';
  $('#stat-brand-note').textContent=best?`${summary.favoriteCount} 次心动`:'期待第一杯';
  $('#wall-count').textContent=records().length;
  $('#filter-count').textContent=monthData.length;
  $('#demo-banner').hidden=!demoMode;
  $('#calendar-view').hidden=view!=='calendar';
  $('#wall-view').hidden=view!=='wall';
  $('#page-label').textContent=view==='calendar'?'饮品日历':'小票收藏夹';
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);button.setAttribute('aria-pressed',String(button.dataset.view===view));});
  document.querySelectorAll('[data-filter]').forEach(button=>{button.classList.toggle('active',button.dataset.filter===filter);button.setAttribute('aria-pressed',String(button.dataset.filter===filter));});
  renderCalendar();renderWall();renderDay();
}
function renderCalendar() {
  const days=calendarDays(year,month);
  const grouped={};records().filter(matching).forEach(r=>(grouped[r.date]??=[]).push(r));
  let html='';
  for(const [i,cell] of days.entries()) {
    const key=cell.key,date=parseDate(key),cups=grouped[key]||[],current=cell.current;
    const selected=key===selectedDate;
    html+=`<button class="calendar-day${current?'':' other-month'}${selected?' selected':''}" data-date="${key}" ${date.getFullYear()<1900||date.getFullYear()>2200?'disabled':''} aria-label="${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日，${cups.length?`${cups.length}杯，${cups.map(r=>BRANDS[r.brand].name+' '+r.name).map(escape).join('，')}`:'暂无记录'}" aria-pressed="${selected}"><span class="day-number${key===TODAY?' today':''}">${date.getDate()}</span>${cups.length>1?`<span class="cup-count" title="共${cups.length}杯">+${cups.length-1}</span>`:key===TODAY?'<span class="today-word">今天</span>':''}${cups.length?miniReceipt(cups[0],i):'<span class="day-placeholder" aria-hidden="true">+</span>'}</button>`;
  }
  $('#calendar-grid').innerHTML=html;
}
function renderWall() {
  const data=monthRecords().filter(matching).sort((a,b)=>b.date.localeCompare(a.date));
  $('#wall-view').innerHTML=data.length?data.map(r=>`<button class="wall-card" data-open-record="${escape(r.id)}" aria-label="编辑${escape(BRANDS[r.brand].name)} ${escape(r.name)}，${r.date}">${receipt(r)}<span class="wall-date">${r.date.replaceAll('-',' / ')}</span></button>`).join(''):emptyState(query.trim()?'没找到这一杯':'这一页，等一杯新故事',query.trim()?'试试其他饮品名称、品牌或随手记。':'选个喜欢的品牌，把今天的小快乐贴进来。',`<button class="primary-button" id="wall-add">${icon('plus')}记录一杯</button>`);
}
function renderDay() {
  const date=parseDate(selectedDate),data=records().filter(r=>r.date===selectedDate);
  $('#day-title').textContent=selectedDate===TODAY?'今天的小快乐':`${date.getMonth()+1}月${date.getDate()}日的小快乐`;
  $('#selected-date').textContent=`${date.getFullYear()}年${date.getMonth()+1}月${date.getDate()}日 ${weekdays[date.getDay()]} · ${data.length} 杯`;
  $('#day-records').innerHTML=data.length?data.map(r=>`<article class="day-entry">${receipt(r)}${r.note?`<p class="entry-note">${escape(r.note)}</p>`:''}<div class="entry-actions"><button data-repeat-record="${escape(r.id)}" aria-label="再来一杯${escape(r.name)}">${icon('plus')}再来一杯</button><button data-open-record="${escape(r.id)}" aria-label="编辑${escape(r.name)}">${icon('edit')}编辑</button><button data-delete-record="${escape(r.id)}" aria-label="删除${escape(r.name)}">${icon('trash')}删除</button></div></article>`).join(''):emptyState('还没有贴上小票','咖啡或奶茶，都值得留下一点痕迹。<br>从今天喜欢的那杯开始吧。');
}

function openDialog(dialog) {returnFocus.set(dialog,document.activeElement);dialog.showModal();}
function closeDialog(dialog) {dialog.close();}
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('close',()=>{
  const element=returnFocus.get(dialog);
  if(element?.isConnected)element.focus();else $('#add-record').focus();
}));
function renderBrands() {
  $('#brand-options').innerHTML=Object.entries(BRANDS).map(([key,b])=>`<button type="button" class="brand-option${key===draftBrand?' active':''}" data-brand="${key}" style="--brand:${b.color}" aria-pressed="${key===draftBrand}"><span class="brand-mark">${b.mark}</span>${b.name}</button>`).join('');
  $('#drink-suggestions').innerHTML=BRANDS[draftBrand].drinks.map(name=>`<option value="${escape(name)}"></option>`).join('');
  $('#drink-name').placeholder=`比如：${BRANDS[draftBrand].drinks[0]}`;
}
function draft() {const f=$('#record-form');return {brand:draftBrand,name:f.elements.name.value.trim(),date:f.elements.date.value||selectedDate,price:Number(f.elements.price.value)||0,size:f.elements.size.value,temperature:f.elements.temperature.value,sugar:draftSugar};}
function updatePreview() {const r=draft();if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date))r.date=selectedDate;$('#receipt-preview').innerHTML=receipt(r);}
function setSugar(value) {draftSugar=value;document.querySelectorAll('[data-sugar]').forEach(button=>{button.classList.toggle('active',button.dataset.sugar===value);button.setAttribute('aria-pressed',String(button.dataset.sugar===value));});}
function openForm({brand='luckin',record=null,date=selectedDate,repeat=false}={}) {
  $('#record-form').reset();editingId=repeat?null:record?.id||null;draftBrand=record?.brand||brand;setSugar(record?.sugar||'五分糖');
  const f=$('#record-form');f.elements.date.value=repeat?TODAY:record?.date||date;f.elements.name.value=record?.name||'';f.elements.price.value=record?record.price:'';f.elements.size.value=record?.size||'大杯';f.elements.temperature.value=record?.temperature||'少冰';f.elements.note.value=repeat?'':record?.note||'';
  $('#form-title').textContent=repeat?'喜欢的味道，再来一杯':record?'编辑这杯小快乐':'记录新的一杯';$('#save-label').textContent=editingId?'保存这一杯':'贴进我的日历';
  renderBrands();updatePreview();openDialog($('#record-dialog'));
  requestAnimationFrame(()=>$('#drink-name').focus());
}
function changeMonth(delta) {const next=new Date(year,month+delta,1,12);if(next.getFullYear()<1900||next.getFullYear()>2200)return;year=next.getFullYear();month=next.getMonth();selectedDate=dateKey(next);render();}

$('#today-label').textContent=`${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 ${weekdays[today.getDay()]}`;
$('#add-record').addEventListener('click',()=>openForm({date:TODAY}));
$('#add-to-day').addEventListener('click',()=>openForm());
$('#start-own').addEventListener('click',()=>openForm({date:TODAY}));
$('#all-brands').addEventListener('click',()=>openForm({date:TODAY}));
$('#prev-month').addEventListener('click',()=>changeMonth(-1));
$('#next-month').addEventListener('click',()=>changeMonth(1));
$('#go-today').addEventListener('click',()=>{year=today.getFullYear();month=today.getMonth();selectedDate=TODAY;render();});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{view=button.dataset.view;render();}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render();}));
document.querySelectorAll('[data-brand-quick]').forEach(button=>button.addEventListener('click',()=>openForm({brand:button.dataset.brandQuick,date:TODAY})));
$('#calendar-grid').addEventListener('click',event=>{const button=event.target.closest('[data-date]');if(!button)return;selectedDate=button.dataset.date;const d=parseDate(selectedDate);year=d.getFullYear();month=d.getMonth();$('.journal-layout').classList.add('show-day-mobile');render();if(matchMedia('(max-width:1050px)').matches)requestAnimationFrame(()=>$('.day-panel').scrollIntoView({behavior:'smooth',block:'nearest'}));});
document.addEventListener('click',event=>{
  const repeat=event.target.closest('[data-repeat-record]');if(repeat){const r=records().find(r=>r.id===repeat.dataset.repeatRecord);if(r)openForm({record:r,repeat:true});}
  const edit=event.target.closest('[data-open-record]');if(edit){const r=records().find(r=>r.id===edit.dataset.openRecord);if(r)openForm({record:r});}
  const del=event.target.closest('[data-delete-record]');if(del){deleteId=del.dataset.deleteRecord;openDialog($('#delete-dialog'));}
  if(event.target.closest('#wall-add'))openForm();
  const close=event.target.closest('.close-dialog');if(close)closeDialog(close.closest('dialog'));
});
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)closeDialog(dialog);}});
});
$('#brand-options').addEventListener('click',event=>{const button=event.target.closest('[data-brand]');if(!button)return;draftBrand=button.dataset.brand;renderBrands();updatePreview();});
$('#sugar-options').addEventListener('click',event=>{const button=event.target.closest('[data-sugar]');if(button){setSugar(button.dataset.sugar);updatePreview();}});
$('#record-form').addEventListener('input',updatePreview);
$('#record-form').addEventListener('change',updatePreview);
$('#record-form').addEventListener('submit',event=>{
  event.preventDefault();const r={...draft(),id:editingId&&!demoMode?editingId:uid(),note:$('#drink-note').value.trim()};
  if(!validRecord(r)){toast('请填写饮品名称、有效日期和金额。');return;}
  if(demoMode)demoMode=false;
  const index=saved.findIndex(item=>item.id===r.id);if(index>=0)saved[index]=r;else saved.push(r);
  const ok=persist();selectedDate=r.date;const d=parseDate(r.date);year=d.getFullYear();month=d.getMonth();filter='all';query='';$('#search-input').value='';$('.journal-layout').classList.add('show-day-mobile');
  closeDialog($('#record-dialog'));render();if(ok)toast(index>=0?'这一杯的小快乐，已更新。':'已贴进日历，又收集到一杯小快乐！');
});
$('#confirm-delete').addEventListener('click',()=>{
  const wasDemo=demoMode, deleted=records().find(r=>r.id===deleteId);
  if(!deleted)return;
  if(wasDemo)demoRecords=demoRecords.filter(r=>r.id!==deleteId);
  else saved=saved.filter(r=>r.id!==deleteId);
  const ok=wasDemo||persist();
  closeDialog($('#delete-dialog'));render();
  if(ok)toast(wasDemo?'已从示例手帐中移除。':'记录已删除，10 秒内可以撤销。',()=>{
    if(wasDemo!==demoMode){toast('手帐已切换，请回到原手帐后再操作。');return;}
    if(wasDemo)demoRecords=mergeRecords(demoRecords,[deleted]).records;
    else saved=mergeRecords(saved,[deleted]).records;
    const restored=wasDemo||persist();render();if(restored)toast('这一杯已恢复。');
  });
});

$('#backup-open').addEventListener('click',()=>{$('#backup-count').textContent=`已保存 ${saved.length} 条记录`;$('#toggle-demo').textContent=demoMode?'回到我的饮品手帐':'浏览示例手帐';openDialog($('#backup-dialog'));});
$('#toggle-demo').addEventListener('click',()=>{demoMode=!demoMode;if(!demoMode)persist();year=today.getFullYear();month=today.getMonth();selectedDate=TODAY;filter='all';query='';$('#search-input').value='';closeDialog($('#backup-dialog'));render();toast(demoMode?'示例手帐已打开，你的记录已保留。':'欢迎回到你的饮品手帐。');});
function downloadFile(content, filename, type) {
  const url=URL.createObjectURL(new Blob([content],{type}));
  const a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}
$('#export-data').addEventListener('click',()=>{
  downloadFile(JSON.stringify({version:1,exportedAt:new Date().toISOString(),records:saved},null,2),`cupnote-${TODAY}.json`,'application/json');
  toast(`已导出 ${saved.length} 条饮品记录。`);
});
$('#export-csv').addEventListener('click',()=>{
  downloadFile(toCSV(saved),`cupnote-${TODAY}.csv`,'text/csv;charset=utf-8');
  toast(`已导出 ${saved.length} 条记录，可用表格软件打开。`);
});
$('#raw-data-action').addEventListener('click',()=>{
  try {downloadFile(journalStorage.raw()||'',`cupnote-recovery-${TODAY}.txt`,'text/plain');toast('原始数据已导出。请保留此文件用于恢复。');}
  catch {toast('浏览器不允许读取本地数据，请检查隐私设置。');}
});

$('#import-data').addEventListener('click',()=>$('#import-file').click());
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try {
    if(file.size>10*1024*1024)throw new Error('备份文件太大，请选择 10MB 以内的文件。');
    const incoming=parseBackup(await file.text());
    const merged=journalStorage.import(incoming);
    saved=merged.records;demoMode=false;loadError=false;
    closeDialog($('#backup-dialog'));filter='all';query='';$('#search-input').value='';
    if(merged.added){const d=parseDate(saved.at(-1).date);year=d.getFullYear();month=d.getMonth();selectedDate=dateKey(d);}
    render();toast(`已导入 ${merged.added} 条记录，跳过 ${merged.skipped} 条重复记录。`);
  } catch(error){toast(error.message);}finally{event.target.value='';}
});
window.addEventListener('storage',event=>{
  if(event.key!==STORAGE_KEY)return;
  const data=journalStorage.load();
  if(data.error){loadError=true;$('#raw-data-action').hidden=false;toast('另一页面的数据无法读取，暂时保留当前记录。');return;}
  saved=data.records;loadError=false;
  if(data.hasStarted)demoMode=false;
  render();toast('已同步此浏览器另一页面的记录。');
});
$('#search-input').addEventListener('input',event=>{query=event.target.value;render();});
$('#clear-search').addEventListener('click',()=>{query='';$('#search-input').value='';render();$('#search-input').focus();});
$('#reset-filters').addEventListener('click',()=>{query='';filter='all';$('#search-input').value='';render();});
$('#calendar-grid').addEventListener('keydown',event=>{
  const directions={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7};
  if(!Object.hasOwn(directions,event.key)||!event.target.matches('[data-date]'))return;
  event.preventDefault();const date=parseDate(event.target.dataset.date);date.setDate(date.getDate()+directions[event.key]);
  if(date.getFullYear()<1900||date.getFullYear()>2200)return;
  selectedDate=dateKey(date);year=date.getFullYear();month=date.getMonth();render();
  document.querySelector(`[data-date="${selectedDate}"]`).focus();
});
function refreshToday() {
  const key=dateKey(new Date());
  if(key!==TODAY){TODAY=key;today=parseDate(key);demoRecords=makeDemo(today);$('#today-label').textContent=`${today.getFullYear()}年${today.getMonth()+1}月${today.getDate()}日 ${weekdays[today.getDay()]}`;render();}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshToday();});
setInterval(refreshToday,60000);
render();
if(loadError)toast('原有本地数据未能读取。请到数据与备份中导出原始数据后恢复。');
