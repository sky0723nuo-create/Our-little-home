const STORAGE_KEY = "our-little-home-v1";
const app = document.getElementById("app");
const themeStorageKey = "nest-notes-theme";
let theme = localStorage.getItem(themeStorageKey) === "lavender" ? "lavender" : "wood";
document.body.dataset.theme = theme;
const toastEl = document.getElementById("toast");
const uuid = () => crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty = (v) => escapeHtml(v);
const initial = () => ({version:1,locations:[],items:[],history:[]});
function load() {
 try {
  const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.locations)) return {...initial(),...parsed};
 } catch {}
 return initial();
}
let state = load(), view = "home", searchTerm = "", locationFilter = "", activeLocation = null, modal = null, categoryFilter = "", sortBy = "name";
const save = () => {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));window.dispatchEvent(new Event("home:changed"));};
let timeout; function toast(message){toastEl.textContent=message;toastEl.classList.add("show");clearTimeout(timeout);timeout=setTimeout(()=>toastEl.classList.remove("show"),2300);}
function ancestors(id) {
 const seen = new Set(), chain=[];
 let x = state.locations.find(l => l.id===id);
 while(x && !seen.has(x.id)){seen.add(x.id);chain.unshift(x);x=state.locations.find(l=>l.id===x.parentId);}
 return chain;
}
function fullPath(id){return id ? ancestors(id).map(l=>l.name).join(" → ") || "待整理（位置已删除）" : "📦 待整理";}
function descendants(id){const found=new Set([id]);let changed=true;while(changed){changed=false;for(const l of state.locations)if(l.parentId && found.has(l.parentId)&&!found.has(l.id)){found.add(l.id);changed=true;}}return found;}
function locationOptions(selected,excludeId="") {
 const exclude=excludeId?descendants(excludeId):new Set();
 return '<option value="">📦 待整理 / 未指定</option>'+state.locations.filter(l=>!exclude.has(l.id)).sort((a,b)=>fullPath(a.id).localeCompare(fullPath(b.id),'zh')).map(l=>'<option value="'+l.id+'" '+(l.id===selected?"selected":"")+'>'+pretty(fullPath(l.id))+'</option>').join("");
}
function categoryOptions(selected=""){
 const categories=["日用品","电子设备","厨房用品","清洁用品","护肤美妆","药品 / 急救","衣物配饰","工具","文件资料","食品","其他"];
 return [...new Set([...categories,...state.items.map(i=>i.category).filter(Boolean)])].map(x=>'<option '+(x===selected?'selected':'')+'>'+pretty(x)+'</option>').join("");
}
function quant(i){return (i.quantity??0)+" "+(i.unit||"件");}
function itemCard(i) {
 const low=i.consumable && Number(i.quantity)<=Number(i.minQuantity||0);
 return '<div class="item"><div class="row" style="justify-content:space-between"><h3>'+pretty(i.name)+'</h3>'+(low?'<span class="tag">需要补货</span>':'')+'</div><div class="path">'+pretty(fullPath(i.locationId))+'</div><div class="path" style="margin-top:6px">'+pretty(i.category||"未分类")+(i.notes?" · "+pretty(i.notes):"")+'</div><div class="foot"><span class="qty '+(low?'low':'')+'">'+pretty(quant(i))+'</span><div class="qty-buttons"><button class="mini" aria-label="减少数量" data-act="quantity" data-id="'+i.id+'" data-delta="-1">−</button><button class="mini" aria-label="增加数量" data-act="quantity" data-id="'+i.id+'" data-delta="1">+</button><button class="mini" data-act="edit-item" data-id="'+i.id+'">编辑</button></div></div></div>';
}
function currentItems() {
 let items=state.items.filter(i=>{
  if (view==="unplaced" && i.locationId) return false;
  if(view==="stock" && !i.consumable)return false;
  if(locationFilter && !descendants(locationFilter).has(i.locationId))return false;
  if(categoryFilter && i.category!==categoryFilter)return false;
  const hay=[i.name,i.category,i.notes,fullPath(i.locationId)].join(" ").toLowerCase();
  return hay.includes(searchTerm.trim().toLowerCase());
 });
 return items.sort((a,b)=>sortBy==="qty"?Number(a.quantity)-Number(b.quantity):a.name.localeCompare(b.name,"zh"));
}
function uiIcon(name,size=30){const p={
inventory:'<rect x="4" y="7" width="16" height="14" rx="2" fill="currentColor" fill-opacity=".13"/><path d="M4 9 12 4l8 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9ZM4 9l8 5 8-5M12 14v7"/>',
storage:'<rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" fill-opacity=".13"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M10 8h4m-4 8h4"/>',
supplies:'<rect x="9" y="3" width="6" height="3" rx="1"/><path d="M9 6v3c-3 1-4 2-4 5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5c0-3-1-4-4-5V6"/><rect x="8" y="13" width="8" height="5" rx="1" fill="currentColor" fill-opacity=".16"/>',
sort:'<path d="M4 10h16l-1 9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-1-9Z" fill="currentColor" fill-opacity=".14"/><path d="M4 10h16l-1 9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-1-9ZM8 10l4-7 4 7M10 15h4"/>',
house:'<path d="m3 11 9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z" fill="currentColor" fill-opacity=".13"/><path d="m3 11 9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8ZM10 21v-7h4v7"/>'
};return '<svg class="ui-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[name]||p.house)+'</svg>';}
function header(){
 const total=state.items.length,unplaced=state.items.filter(i=>!i.locationId).length,low=state.items.filter(i=>i.consumable&&Number(i.quantity)<=Number(i.minQuantity||0)).length;
 return '<header class="top"><div class="brand"><div class="eyebrow">OUR SPACE · 我们的家</div><h1>HOME<span class="title-dot">.</span></h1><div class="sub">Shared home inventory · 家庭收纳清单</div></div><button class="pill" data-act="nav" data-view="settings">Settings · 设置</button></header>'+
 '<section class="hero"><div class="hero-line"><div><h2>Everything has a place.</h2><p>每样东西，都有它的位置。</p></div><div class="hero-brand">'+uiIcon("house",46)+'</div></div><div class="search"><input id="global-search" placeholder="Search items, categories, locations... 搜索物品" value="'+pretty(searchTerm)+'" aria-label="搜索物品"></div><div class="stats"><div class="stat"><b>'+total+'</b><span>Items · 物品</span></div><div class="stat"><b>'+unplaced+'</b><span>To Sort · 待整理</span></div><div class="stat"><b>'+low+'</b><span>Low Stock · 待补货</span></div></div></section>';
}
function home(){
 const recent=state.items.slice().sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||"")).slice(0,4);
 return '<div class="tiles">'+[
 ["items","inventory","Inventory","家中物品清单"],
 ["locations","storage","Storage","房间、柜子与收纳盒"],
 ["stock","supplies","Supplies","消耗品与补货提醒"],
 ["unplaced","sort","To Sort","暂时还没整理的东西"]
 ].map(([v,icon,label,sub])=>'<button class="tile" data-act="nav" data-view="'+v+'"><span class="tile-icon">'+uiIcon(icon)+'</span><strong>'+label+'</strong><span class="tile-description">'+sub+'</span></button>').join("")+'</div>'+
 '<div class="section-head"><h2>Recently Added <small>最近添加</small></h2><button class="secondary" data-act="add-item">＋ Add Item · 添加物品</button></div>'+
 (recent.length?'<div class="cards">'+recent.map(itemCard).join("")+'</div>':empty("还没有添加物品","先从一根充电线、一个小盒子开始吧。"))+
 '<div class="notice" style="margin-top:18px">还没整理好的东西可以先放到「待整理」，之后再分配收纳位置。</div>';
}
function empty(title,sub){return '<div class="empty"><span class="emoji">🌷</span><b>'+title+'</b><p>'+sub+'</p></div>';}
function itemsPage(){
 let items=currentItems();
 return '<div class="section-head"><h2>'+({items:"所有物品",unplaced:"待整理",stock:"消耗品库存"}[view]||"搜索结果")+'</h2><button class="primary" data-act="add-item">＋ 添加物品</button></div>'+
 '<div class="panel"><div class="toolbar"><select id="location-filter" aria-label="按收纳位置筛选"><option value="">所有位置</option>'+state.locations.map(l=>'<option value="'+l.id+'" '+(locationFilter===l.id?'selected':'')+'>'+pretty(fullPath(l.id))+'</option>').join("")+'</select><select id="category-filter" aria-label="按分类筛选"><option value="">所有分类</option>'+categoryOptions(categoryFilter)+'</select><select id="sort" aria-label="排序"><option value="name" '+(sortBy==="name"?'selected':'')+'>按名称</option><option value="qty" '+(sortBy==="qty"?'selected':'')+'>按数量</option></select><span class="muted">'+items.length+' 项</span></div>'+
 (items.length?'<div class="cards">'+items.map(itemCard).join("")+'</div>':empty("这里还空空的","试试添加物品，或清除筛选条件。"))+'</div>';
}
function locationsPage(){
 const chain=activeLocation?ancestors(activeLocation):[];
 if(activeLocation&&!chain.length)activeLocation=null;
 const children=state.locations.filter(l=>(l.parentId||null)===(activeLocation||null));
 const items=state.items.filter(i=>i.locationId===activeLocation && activeLocation);
 return '<div class="section-head"><h2>收纳空间 🗄️</h2><button class="primary" data-act="add-location">＋ 新建位置</button></div>'+
 '<div class="panel"><div class="crumb"><button data-act="open-location" data-id="">🏠 我们的家</button>'+chain.map(l=>' › <button data-act="open-location" data-id="'+l.id+'">'+pretty(l.name)+'</button>').join("")+'</div><p class="hint">可以先建房间，再在房间里添加柜子、抽屉、盒子；层级不限。</p>'+
 (children.length?'<div class="loc-list">'+children.map(l=>'<div class="location"><button class="loc-button" data-act="open-location" data-id="'+l.id+'"><h3>'+pretty(l.icon||"📦")+' '+pretty(l.name)+'</h3><div class="path">'+state.items.filter(i=>descendants(l.id).has(i.locationId)).length+' 件物品 · '+state.locations.filter(x=>x.parentId===l.id).length+' 个子位置</div></button><div class="row" style="margin-top:8px"><button class="mini" data-act="edit-location" data-id="'+l.id+'">修改</button><button class="mini" data-act="add-location" data-parent="'+l.id+'">＋ 子位置</button></div></div>').join("")+'</div>':empty(activeLocation?"这里还没有下级位置":"还没有建立收纳空间","可以从「卧室」「厨房」「客厅」开始。"))+
 (activeLocation?'<div class="section-head"><h2>直接放在这里的物品</h2><button class="secondary" data-act="add-item" data-location="'+activeLocation+'">＋ 添加</button></div>'+(items.length?'<div class="cards">'+items.map(itemCard).join("")+'</div>':empty("暂无物品","你也可以将物品放到这个位置里。")):'')+'</div>';
}
function settingsPage(){
 return '<div class="section-head"><h2>设置 ⚙️</h2></div><div class="panel"><div class="setting-block"><h3>你的数据</h3><p class="hint">当前基础版的数据仅保存在这台设备的浏览器中，换手机不会自动同步。可使用导出/导入备份，导入将替换当前设备的数据。</p><div class="actions"><button class="primary" data-act="export">↓ 导出 JSON 备份</button><button class="secondary" data-act="import">↑ 导入备份</button><input id="import-file" type="file" accept=".json,application/json" hidden></div></div><div class="setting-block"><h3>界面配色</h3><p class="hint">选一款更适合家的颜色，切换不会影响物品数据。</p><div class="theme-picker"><button class="theme-option" data-act="theme" data-theme="wood" aria-pressed="'+(theme==="wood")+'"><span class="theme-swatch" style="background:#b59a78"></span>原木奶油白</button><button class="theme-option" data-act="theme" data-theme="lavender" aria-pressed="'+(theme==="lavender")+'"><span class="theme-swatch" style="background:#b8a6d7"></span>柔雾淡紫</button></div></div><div class="setting-block"><h3>情侣共享 ♡</h3><div class="notice">实时共享需要配置 Supabase 数据库与两个人的登录账号。云同步尚未启用，目前不要将本地数据误认为已同步。</div></div><div class="setting-block"><h3>关于 HOME</h3><p class="hint">版本 1.0 · 先收纳，再慢慢完善。项目开源代码可在 GitHub 查看。</p></div><div class="setting-block"><button class="secondary danger" data-act="clear">清空本机所有数据</button></div></div>';
}
function navBar(){return '<nav class="bottom" aria-label="主导航">'+[['home','house','Home','首页'],['items','inventory','Items','物品'],['locations','storage','Storage','收纳'],['stock','supplies','Stock','库存']].map(([v,icon,label,cn])=>'<button class="nav '+(view===v?'active':'')+'" data-act="nav" data-view="'+v+'"><span class="nav-icon">'+uiIcon(icon,22)+'</span><span>'+label+'</span><small>'+cn+'</small></button>').join("")+'</nav>';}
function render(focusSearch=false){
 app.innerHTML='<main class="shell">'+header()+(view==="home"?home():view==="locations"?locationsPage():view==="settings"?settingsPage():itemsPage())+'</main>'+navBar();
 if(modal)renderModal();
 if(focusSearch){const input=document.getElementById("global-search");input?.focus();input?.setSelectionRange(searchTerm.length,searchTerm.length);}
}
function modalBox(body){return '<div class="overlay" id="modal-overlay"><div class="modal" role="dialog" aria-modal="true">'+body+'</div></div>';}
function renderModal(){
 document.getElementById("modal-overlay")?.remove();
 if(!modal)return;
 let html="";
 if(modal.type==="item"){
  const i=state.items.find(x=>x.id===modal.id);
  const locationId=i?.locationId??modal.location??"";
  html='<h2>'+(i?"编辑物品":"添加新物品")+' ♡</h2><form class="form" id="item-form"><label class="field">物品名称 *<input name="name" maxlength="100" required placeholder="例如：USB-C 充电线" value="'+pretty(i?.name||"")+'"></label><label class="field">分类<select name="category">'+categoryOptions(i?.category||"其他")+'</select></label><label class="field">收纳位置<select name="locationId">'+locationOptions(locationId)+'</select></label><div class="row"><label class="field">数量<input name="quantity" type="number" min="0" step="1" required value="'+(i?.quantity??1)+'"></label><label class="field">单位<input name="unit" maxlength="20" placeholder="件 / 个 / 瓶" value="'+pretty(i?.unit||"件")+'"></label></div><label class="field" style="display:flex;flex-direction:row;align-items:center"><input name="consumable" type="checkbox" '+(i?.consumable?'checked':'')+' style="width:auto">这是消耗品（需要库存提醒）</label><label class="field">最低库存提醒阈值<input name="minQuantity" type="number" min="0" step="1" value="'+(i?.minQuantity??1)+'"></label><label class="field">备注<textarea name="notes" rows="2" maxlength="500" placeholder="颜色、规格、用途等">'+pretty(i?.notes||"")+'</textarea></label><div class="modal-actions">'+(i?'<button type="button" class="secondary danger" data-act="delete-item" data-id="'+i.id+'">删除</button>':'')+'<button type="button" class="secondary" data-act="close">取消</button><button class="primary" type="submit">保存物品</button></div></form>';
 }else if(modal.type==="location"){
  const l=state.locations.find(x=>x.id===modal.id);
  html='<h2>'+(l?"修改收纳位置":"新建收纳位置")+' ♡</h2><form id="location-form" class="form"><label class="field">名称 *<input name="name" maxlength="70" required placeholder="例如：卧室 / 衣柜 A / 白色收纳盒" value="'+pretty(l?.name||"")+'"></label><label class="field">图标（一个 emoji）<input name="icon" maxlength="10" placeholder="🗄️" value="'+pretty(l?.icon||"📦")+'"></label><label class="field">放在哪个位置里？<select name="parentId">'+locationOptions(l?.parentId??modal.parent??"",l?.id||"")+'</select></label><p class="hint">根位置请选择「待整理 / 未指定」，表示它直接在家里。修改盒子的父级位置，会自动更新盒内物品的完整路径。</p><div class="modal-actions">'+(l?'<button type="button" class="secondary danger" data-act="delete-location" data-id="'+l.id+'">删除</button>':'')+'<button type="button" class="secondary" data-act="close">取消</button><button type="submit" class="primary">保存位置</button></div></form>';
 }
 app.insertAdjacentHTML("beforeend",modalBox(html));
}
function track(type,item,delta=0){state.history.push({id:uuid(),type,itemId:item.id,name:item.name,delta,at:new Date().toISOString()});if(state.history.length>500)state.history.splice(0,state.history.length-500);}
function submitItem(form){
 const fd=new FormData(form),name=String(fd.get("name")||"").trim(),quantity=Number(fd.get("quantity")),minQuantity=Number(fd.get("minQuantity"));if(!name||!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(minQuantity)||minQuantity<0){toast("请检查名称和数量");return;}
 const old=state.items.find(x=>x.id===modal.id),item={id:old?.id||uuid(),name,category:String(fd.get("category")||"其他"),locationId:String(fd.get("locationId")||"")||null,quantity,unit:String(fd.get("unit")||"件").trim()||"件",consumable:fd.has("consumable"),minQuantity,notes:String(fd.get("notes")||"").trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(old)state.items=state.items.map(x=>x.id===item.id?item:x);else state.items.push(item);
 track(old?"edit":"add",item);save();modal=null;render();toast("物品已保存 ♡");
}
function submitLocation(form){
 const fd=new FormData(form),name=String(fd.get("name")||"").trim(),parentId=String(fd.get("parentId")||"")||null;
 if(!name){toast("请输入位置名称");return;}
 const old=state.locations.find(x=>x.id===modal.id);
 if(old && parentId && descendants(old.id).has(parentId)){toast("不能把位置移动到它自己里面");return;}
 const l={id:old?.id||uuid(),name,icon:String(fd.get("icon")||"📦").trim()||"📦",parentId,updatedAt:new Date().toISOString()};
 if(old)state.locations=state.locations.map(x=>x.id===l.id?l:x);else state.locations.push(l);
 save();modal=null;render();toast("收纳位置已保存 ♡");
}
function doExport(){
 const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="our-little-home-"+new Date().toISOString().slice(0,10)+".json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function doImport(file){
 if(!file)return;
 try{if(file.size>5_000_000)throw new Error("文件过大");
 const raw=JSON.parse(await file.text());if(!raw||!Array.isArray(raw.items)||!Array.isArray(raw.locations))throw new Error("备份格式不正确");
 if(!confirm("导入将覆盖当前浏览器的全部物品和位置。确定继续吗？"))return;
 const ids=new Set();
 const locations=raw.locations.map(l=>{if(typeof l.id!=="string"||!l.id||ids.has(l.id))throw Error("位置数据无效");ids.add(l.id);return {id:l.id,name:String(l.name||"未命名"),icon:String(l.icon||"📦"),parentId:l.parentId||null};});
 for(const l of locations){if(l.parentId&&!ids.has(l.parentId))l.parentId=null;const seen=new Set();let x=l;while(x){if(seen.has(x.id))throw Error("位置包含循环引用");seen.add(x.id);x=locations.find(y=>y.id===x.parentId);}}
 const itemIds=new Set();
 const items=raw.items.map(i=>{if(typeof i.id!=="string"||!i.id||itemIds.has(i.id))throw Error("物品数据无效");itemIds.add(i.id);return {id:i.id,name:String(i.name||"未命名"),category:String(i.category||"其他"),locationId:ids.has(i.locationId)?i.locationId:null,quantity:Math.max(0,Math.floor(Number(i.quantity)||0)),unit:String(i.unit||"件"),consumable:Boolean(i.consumable),minQuantity:Math.max(0,Math.floor(Number(i.minQuantity)||0)),notes:String(i.notes||""),createdAt:i.createdAt||new Date().toISOString(),updatedAt:i.updatedAt||new Date().toISOString()};});
 state={version:1,locations,items,history:[]};save();view="home";modal=null;render();toast("导入成功 ♡");
 }catch(e){toast("导入失败："+e.message);}
}
document.addEventListener("input",e=>{
 if(e.target.id==="global-search"){searchTerm=e.target.value; if(searchTerm&&view==="home")view="items";render(true);}
});
document.addEventListener("change",e=>{
 if(e.target.id==="location-filter"){locationFilter=e.target.value;render();}
 if(e.target.id==="category-filter"){categoryFilter=e.target.value;render();}
 if(e.target.id==="sort"){sortBy=e.target.value;render();}
 if(e.target.id==="import-file")doImport(e.target.files[0]);
});
document.addEventListener("submit",e=>{
 if(e.target.id==="item-form"){e.preventDefault();submitItem(e.target);}
 if(e.target.id==="location-form"){e.preventDefault();submitLocation(e.target);}
});
document.addEventListener("click",e=>{
 if(e.target.id==="modal-overlay"){modal=null;render();return;}
 const b=e.target.closest("[data-act]");if(!b)return;
 const {act,id,view:target,delta,parent,location}=b.dataset;
 if(act==="theme"){theme=b.dataset.theme==="lavender"?"lavender":"wood";localStorage.setItem(themeStorageKey,theme);document.body.dataset.theme=theme;render();toast("配色已切换");}
 if(act==="nav"){view=target;searchTerm="";locationFilter="";categoryFilter="";render();}
 if(act==="add-item"){modal={type:"item",location:location||null};renderModal();}
 if(act==="edit-item"){modal={type:"item",id};renderModal();}
 if(act==="add-location"){modal={type:"location",parent:parent??activeLocation};renderModal();}
 if(act==="edit-location"){modal={type:"location",id};renderModal();}
 if(act==="open-location"){activeLocation=id||null;render();}
 if(act==="close"){modal=null;render();}
 if(act==="quantity"){const i=state.items.find(x=>x.id===id);if(!i)return;i.quantity=Math.max(0,Number(i.quantity)+Number(delta));i.updatedAt=new Date().toISOString();track("quantity",i,Number(delta));save();render();}
 if(act==="delete-item"){const i=state.items.find(x=>x.id===id);if(i&&confirm('确定删除「'+i.name+'」吗？')){state.items=state.items.filter(x=>x.id!==id);save();modal=null;render();toast("物品已删除");}}
 if(act==="delete-location"){const l=state.locations.find(x=>x.id===id);if(!l)return;const descendantsSet=descendants(id);const n=state.items.filter(x=>descendantsSet.has(x.locationId)).length;if(confirm('删除「'+l.name+'」及其全部下级位置？其中 '+n+' 件物品将转到待整理，物品不会删除。')){state.locations=state.locations.filter(x=>!descendantsSet.has(x.id));state.items.forEach(x=>{if(descendantsSet.has(x.locationId))x.locationId=null;});if(activeLocation&&descendantsSet.has(activeLocation))activeLocation=null;save();modal=null;render();toast("位置已删除，物品已保留");}}
 if(act==="export")doExport();
 if(act==="import")document.getElementById("import-file")?.click();
 if(act==="clear"){if(confirm("此操作会永久清空当前设备的所有物品及收纳位置。请先导出备份。确认清空？")&&confirm("再次确认：删除所有本地数据？")){state=initial();save();view="home";render();toast("数据已清空");}}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&modal){modal=null;render();}});
window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY){state=load();render();toast("本机数据已刷新");}});
render();
