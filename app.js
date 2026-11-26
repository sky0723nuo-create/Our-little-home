import { createCloud, recordsFor } from "./home-cloud.js";
import { createSync } from "./cloud-sync.js";
import { mapBounds, readLayout, storageMap } from "./storage-map.js";
import { createCollection } from "./collection.js?v=v3";
import { createPlanner } from "./planner-v2.js?v=v3";
import { createWellness } from "./wellness.js?v=v3";
import { createHomeExtras } from "./home-extras.js?v=v3";
const STORAGE_KEY = "our-little-home-v1";
const app = document.getElementById("app");
const themeStorageKey = "nest-notes-theme";
let theme = localStorage.getItem(themeStorageKey) === "lavender" ? "lavender" : "wood";
document.body.dataset.theme = theme;
const toastEl = document.getElementById("toast");
const uuid = () => crypto.randomUUID?.() || String(Date.now()) + Math.random().toString(36).slice(2);
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pretty = (v) => escapeHtml(v);
const initial = () => ({version:4,locations:[],items:[],history:[],shopping:[],chores:[],wellness:[],tasks:[],pets:[],petRecords:[],subscriptions:[],activity:[],finds:[]});
function load() {
 try {
  const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  if (parsed && Array.isArray(parsed.items) && Array.isArray(parsed.locations)) return {...initial(),...parsed,shopping:Array.isArray(parsed.shopping)?parsed.shopping:[],chores:Array.isArray(parsed.chores)?parsed.chores:[],wellness:Array.isArray(parsed.wellness)?parsed.wellness:[],tasks:Array.isArray(parsed.tasks)?parsed.tasks:[],pets:Array.isArray(parsed.pets)?parsed.pets:[],petRecords:Array.isArray(parsed.petRecords)?parsed.petRecords:[],subscriptions:Array.isArray(parsed.subscriptions)?parsed.subscriptions:[],activity:Array.isArray(parsed.activity)?parsed.activity:[],finds:Array.isArray(parsed.finds)?parsed.finds:[]};
 } catch {}
 return initial();
}
let state = load(), view = "home", searchTerm = "", locationFilter = "", activeLocation = null, modal = null, categoryFilter = "", sortBy = "name";
const cloud = createCloud();
let cloudMessage="";
const sync=createSync({api:cloud,initial,change:({status,state:next})=>{
 cloudMessage=status;
 if(next){state=next;if(!modal&&!document.activeElement?.matches("input, textarea, select"))render();}
 const statusNode=document.querySelector("#cloud-status");
 if(statusNode)statusNode.textContent=status;
}});
const save = () => {
 try {
  if(sync.connected)sync.save(state);
  else localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
 } catch {toast("本机存储空间不足，请导出备份后重试");}
 window.dispatchEvent(new Event("home:changed"));render();
};
const extras=createHomeExtras({getState:()=>state,save,esc:escapeHtml,toast:(m)=>toast(m),uuid});
const wellness=createWellness({getState:()=>state,save,esc:escapeHtml,toast:(m)=>toast(m),uuid});
const planner=createPlanner({getState:()=>state,save,esc:escapeHtml,toast:(m)=>toast(m),uuid,icon:uiIcon});
const collection=createCollection({getState:()=>state,save,esc:escapeHtml,toast:(m)=>toast(m),uuid});
let shoppingTab="list", mapSelection=null;
let timeout; function toast(message){toastEl.textContent=message;toastEl.classList.add("show");clearTimeout(timeout);timeout=setTimeout(()=>toastEl.classList.remove("show"),2300);}
function ancestors(id) {
 const seen = new Set(), chain=[];
 let x = state.locations.find(l => l.id===id);
 while(x && !seen.has(x.id)){seen.add(x.id);chain.unshift(x);x=state.locations.find(l=>l.id===x.parentId);}
 return chain;
}
function fullPath(id){return id ? ancestors(id).map(l=>[l.label,l.name].filter(Boolean).join(" ")).join(" → ") || "待整理（位置已删除）" : "📦 待整理";}
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
 return '<div class="item"><div class="row" style="justify-content:space-between"><h3>'+pretty(i.name)+'</h3>'+(low?'<span class="tag">需要补货</span>':'')+'</div><div class="path">'+pretty(fullPath(i.locationId))+'</div><div class="path" style="margin-top:6px">'+pretty(i.category||"未分类")+(i.notes?" · "+pretty(i.notes):"")+'</div><div class="foot"><span class="qty '+(low?'low':'')+'">'+pretty(quant(i))+'</span><div class="qty-buttons"><button class="mini" aria-label="减少数量" data-act="quantity" data-id="'+i.id+'" data-delta="-1">−</button><button class="mini" aria-label="增加数量" data-act="quantity" data-id="'+i.id+'" data-delta="1">+</button><button class="mini" data-act="edit-item" data-id="'+i.id+'">编辑</button>'+(i.locationId?'<button class="mini" data-act="map-select" data-id="'+escapeHtml(i.locationId)+'">定位</button>':'')+'</div></div></div>';
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
function uiIcon(name,size=30){const p={collection:'<path d="M12 20s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 5.7-8 11-8 11Z" fill="currentColor" fill-opacity=".13"/><path d="M12 20s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 5.7-8 11-8 11Z"/>',
 plus:'<path d="M12 4v16M4 12h16"/>',
 planner:'<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/>',
 wellness:'<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11Z" fill="currentColor" fill-opacity=".13"/><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11ZM8 13h2l1-2 2 4 1-2h2"/>',
 shopping:'<path d="M4 8h16l-1.5 12H5.5L4 8Z" fill="currentColor" fill-opacity=".13"/><path d="M4 8h16l-1.5 12H5.5L4 8ZM8 9V7a4 4 0 0 1 8 0v2M9 13h6"/>',
 chores:'<rect x="4" y="3" width="16" height="18" rx="3" fill="currentColor" fill-opacity=".13"/><rect x="4" y="3" width="16" height="18" rx="3"/><circle cx="12" cy="13" r="5"/><path d="m10 13 1.5 1.5L14 12"/>',
inventory:'<rect x="4" y="7" width="16" height="14" rx="2" fill="currentColor" fill-opacity=".13"/><path d="M4 9 12 4l8 5v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9ZM4 9l8 5 8-5M12 14v7"/>',
storage:'<rect x="4" y="3" width="16" height="18" rx="2" fill="currentColor" fill-opacity=".13"/><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 12h16M10 8h4m-4 8h4"/>',
supplies:'<rect x="9" y="3" width="6" height="3" rx="1"/><path d="M9 6v3c-3 1-4 2-4 5v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5c0-3-1-4-4-5V6"/><rect x="8" y="13" width="8" height="5" rx="1" fill="currentColor" fill-opacity=".16"/>',
sort:'<path d="M4 10h16l-1 9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-1-9Z" fill="currentColor" fill-opacity=".14"/><path d="M4 10h16l-1 9a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2l-1-9ZM8 10l4-7 4 7M10 15h4"/>',
house:'<path d="m3 11 9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8Z" fill="currentColor" fill-opacity=".13"/><path d="m3 11 9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8ZM10 21v-7h4v7"/>'
};return '<svg class="ui-icon" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(p[name]||p.house)+'</svg>';}
function header(){
 const total=state.items.length,unplaced=state.items.filter(i=>!i.locationId).length,low=state.items.filter(i=>i.consumable&&Number(i.quantity)<=Number(i.minQuantity||0)).length;
 return '<header class="top"><div class="brand"><div class="eyebrow">OUR SPACE · 我们的家</div><h1>HOME<span class="title-dot">.</span></h1></div><div class="header-shortcuts"><button class="header-icon-btn" data-act="nav" data-view="home" title="Home" aria-label="返回首页">'+uiIcon("house",22)+'</button><button class="pill" data-act="nav" data-view="settings">Settings · 设置</button></div></header>'+
 '<section class="hero"><div class="hero-line"><div><h2>Everything has a place.</h2><p>每样东西，都有它的位置。</p></div><div class="hero-brand">'+uiIcon("house",46)+'</div></div><div class="search"><input id="global-search" placeholder="Search items, categories, locations... 搜索物品" value="'+pretty(searchTerm)+'" aria-label="搜索物品"></div><div class="stats"><div class="stat"><b>'+total+'</b><span>Items · 物品</span></div><div class="stat"><b>'+unplaced+'</b><span>To Sort · 待整理</span></div><div class="stat"><b>'+low+'</b><span>Low Stock · 待补货</span></div></div></section>';
}
function home(){
 const low=state.items.filter(i=>i.consumable&&Number(i.quantity)<=Number(i.minQuantity||0)).length;
 const unplaced=state.items.filter(i=>!i.locationId).length;
 return '<div class="v2-welcome"><div class="eyebrow">A LITTLE LIFE, TOGETHER.</div><h2>Welcome HOME ♡</h2><p>我们的家，一起慢慢打理。</p></div>'+planner.upcomingWidget()+
 '<div class="section-head"><h2>Quick Overview <small>家庭概览</small></h2></div><div class="v2-overview-grid">'+[['shopping','待购买',extras.summary().shopping],['stock','低库存',low],['unplaced','待整理',unplaced],['planner','待办任务',planner.summary().tasks]].map(([v,label,n])=>'<button data-act="nav" data-view="'+v+'"><strong>'+n+'</strong><small>'+label+'</small></button>').join("")+'</div>'+
 '<div class="section-head"><h2>Explore <small>功能分类</small></h2><button class="secondary" data-act="quick-add">＋ Quick Add</button></div><div class="tiles v2-explore">'+[['collection','collection','Collection','我们的好物与餐厅'],['inventory','inventory','Inventory','物品与收纳'],['planner','planner','Planner','生活事务与护理'],['shopping','shopping','Shopping','采购与定期配送']].map(([v,ic,name,desc])=>'<button class="tile" data-act="nav" data-view="'+v+'"><span class="tile-icon">'+uiIcon(ic)+'</span><strong>'+name+'</strong><span class="tile-description">'+desc+'</span></button>').join("")+'</div>';
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
function shoppingPageV2(){return '<div class="v2-tabs shopping-tabs"><button data-act="shop-tab" data-value="list" class="'+(shoppingTab==="list"?"selected":"")+'">Shopping List · 清单</button><button data-act="shop-tab" data-value="subs" class="'+(shoppingTab==="subs"?"selected":"")+'">Subscriptions · 定期配送</button></div>'+(shoppingTab==="subs"?planner.subscriptionPage():extras.shoppingPage());}
function cloudPanel(){
 const auth=cloud.user();
 if(!auth)return '<form id="cloud-login" class="form"><label class="field">登录邮箱<input type="email" name="email" required autocomplete="email"></label><label class="field">密码（用邮箱链接登录时可留空）<input type="password" name="password" autocomplete="current-password"></label><div class="actions"><button class="primary" type="submit" name="method" value="link">发送登录链接</button><button class="secondary" type="submit" name="method" value="password">用密码登录</button></div><p id="cloud-status" role="status">'+pretty(cloudMessage)+'</p></form>';
 const legacy=load(),count=recordsFor(legacy).length;
 return '<p>'+pretty(auth.email)+'</p><p id="cloud-status" role="status">'+pretty(cloudMessage)+'</p><div class="actions"><button class="secondary" data-act="cloud-logout">退出登录</button><button class="secondary" data-act="cloud-sync">立即同步</button><button class="secondary" data-act="cloud-reload">重新加载云端</button></div>'+
 (sync.connected&&count?'<form id="cloud-migrate" class="form"><p>本机旧版记录 '+count+' 条，其中物品 '+legacy.items.length+' 条、位置 '+legacy.locations.length+' 条。导入保留旧版备份，并跳过云端已有的记录。</p><label class="field">导入私人资料的可见范围<select name="visibility"><option value="private">Private · 只给自己</option><option value="shared">Shared · 家庭成员可见</option></select></label><button class="primary" type="submit">确认导入旧版数据</button></form>':'');
}
async function connectCloud(){
 try {
  await cloud.finishLink();
  if(cloud.user()){
   cloudMessage="正在连接家庭…";
   await sync.start();
   if(location.hash==="")render();
  }
 } catch(error){cloudMessage="云端连接失败："+error.message;render();}
}
function settingsPage(){
 return '<div class="section-head"><h2>设置 ⚙️</h2></div><div class="panel"><div class="setting-block"><h3>你的数据</h3><p class="hint">可导出当前可见数据。登录后可在下方预览并迁移这台设备的旧版数据。</p><div class="actions"><button class="primary" data-act="export">↓ 导出 JSON 备份</button><button class="secondary" data-act="import" '+(sync.connected?'disabled':'')+'>↑ 导入备份</button><input id="import-file" type="file" accept=".json,application/json" hidden></div></div><div class="setting-block"><h3>界面配色</h3><p class="hint">选一款更适合家的颜色，切换不会影响物品数据。</p><div class="theme-picker"><button class="theme-option" data-act="theme" data-theme="wood" aria-pressed="'+(theme==="wood")+'"><span class="theme-swatch" style="background:#b59a78"></span>原木奶油白</button><button class="theme-option" data-act="theme" data-theme="lavender" aria-pressed="'+(theme==="lavender")+'"><span class="theme-swatch" style="background:#b8a6d7"></span>柔雾淡紫</button></div></div><div class="setting-block"><h3>情侣共享 ♡</h3>'+cloudPanel()+'</div><div class="setting-block"><h3>Recently Deleted · 最近删除</h3><button class="secondary" data-act="nav" data-view="trash">查看与恢复</button></div><div class="setting-block"><h3>关于 HOME</h3><p class="hint">HOME V3 开发版 · 收纳地图与双人同步。项目开源代码可在 GitHub 查看。</p></div><div class="setting-block"><button class="secondary danger" data-act="clear" '+(sync.connected?'disabled':'')+'>清空本机所有数据</button></div></div>';
}
function navBar(){return '<nav class="bottom v2-bottom" aria-label="主导航">'+[['collection','collection','Collection','收藏'],['inventory','inventory','Inventory','物品'],['add','plus','Add','添加'],['planner','planner','Planner','计划'],['shopping','shopping','Shopping','购物']].map(([v,ic,en,zh])=>'<button class="nav '+((view===v||v==="inventory"&&["items","locations","stock","unplaced","map"].includes(view))?"active":"")+(v==="add"?" v2-add-nav":"")+'" data-act="'+(v==="add"?"quick-add":"nav")+'" data-view="'+v+'"><span class="nav-icon">'+(v==="add"?'<span class="v2-plus">＋</span>':uiIcon(ic,22))+'</span><span>'+en+'</span><small>'+zh+'</small></button>').join("")+'</nav>';}
let composingSearch = null;
function render(focusSearch=false){
 if(composingSearch?.isConnected)return;
 app.innerHTML='<main class="shell">'+header()+(view==="home"?home():view==="collection"?collection.page():view==="inventory"?planner.inventoryPage():view==="planner"?planner.plannerPage():view==="trash"?planner.trashPage():view==="subscriptions"?planner.subscriptionPage():view==="map"?storageMap({locations:state.locations,background:state.floorPlan,selection:mapSelection,ancestors,itemCards:mapSelection?state.items.filter(i=>descendants(mapSelection).has(i.locationId)).map(itemCard).join(""):"",esc:escapeHtml}):view==="locations"?locationsPage():view==="settings"?settingsPage():view==="shopping"?shoppingPageV2():view==="chores"?extras.carePage():view==="wellness"?wellness.page():itemsPage())+'</main>'+navBar();
 if(modal)renderModal();
 extras.showModal();
 wellness.show();
 planner.show();
 collection.show();
 if(focusSearch){const input=document.getElementById("global-search");input?.focus();input?.setSelectionRange(searchTerm.length,searchTerm.length);}
}
function modalBox(body){return '<div class="overlay" id="modal-overlay"><div class="modal" role="dialog" aria-modal="true">'+body+'</div></div>';}
function renderModal(){
 document.getElementById("modal-overlay")?.remove();
 if(!modal)return;
 let html="";
 if(modal.type==="quick-add"){html='<h2>Quick Add · 快速添加</h2><div class="v2-quick-menu">'+[["find","♡","Collection","记录好物"],["item","📦","Inventory Item","添加物品"],["task","🗓️","Task","生活待办"],["shopping","🛒","Shopping Item","购物清单"],["care","🧺","Home Care","家务维护"],["wellness","♡","Wellness","个护记录"],["pet","🐱","Cat Profile","猫咪档案"],["sub","🚚","Subscription","定期配送"]].map(([type,ic,en,zh])=>'<button type="button" data-act="quick-add-choice" data-type="'+type+'"><span>'+ic+'</span><strong>'+en+'</strong><small>'+zh+'</small></button>').join("")+'</div><div class="modal-actions"><button class="secondary" data-act="close">Cancel</button></div>';}else if(modal.type==="item"){
  const i=state.items.find(x=>x.id===modal.id);
  const locationId=i?.locationId??modal.location??"";
  html='<h2>'+(i?"编辑物品":"添加新物品")+' ♡</h2><form class="form" id="item-form"><label class="field">物品名称 *<input name="name" maxlength="100" required placeholder="例如：USB-C 充电线" value="'+pretty(i?.name||"")+'"></label><label class="field">分类<select name="category">'+categoryOptions(i?.category||"其他")+'</select></label><label class="field">收纳位置<select name="locationId">'+locationOptions(locationId)+'</select></label><div class="row"><label class="field">数量<input name="quantity" type="number" min="0" step="1" required value="'+(i?.quantity??1)+'"></label><label class="field">单位<input name="unit" maxlength="20" placeholder="件 / 个 / 瓶" value="'+pretty(i?.unit||"件")+'"></label></div><label class="field" style="display:flex;flex-direction:row;align-items:center"><input name="consumable" type="checkbox" '+(i?.consumable?'checked':'')+' style="width:auto">这是消耗品（需要库存提醒）</label><label class="field">最低库存提醒阈值<input name="minQuantity" type="number" min="0" step="1" value="'+(i?.minQuantity??1)+'"></label><label class="field">可见范围<select name="visibility"><option value="shared">Shared · 共享</option><option value="private" '+(i?.visibility==="private"?"selected":"")+'>Private · 私人</option></select></label><label class="field">备注<textarea name="notes" rows="2" maxlength="500" placeholder="颜色、规格、用途等">'+pretty(i?.notes||"")+'</textarea></label><div class="modal-actions">'+(i?'<button type="button" class="secondary danger" data-act="delete-item" data-id="'+i.id+'">删除</button>':'')+'<button type="button" class="secondary" data-act="close">取消</button><button class="primary" type="submit">保存物品</button></div></form>';
 }else if(modal.type==="location"){
  const l=state.locations.find(x=>x.id===modal.id);
  html='<h2>'+(l?"修改收纳位置":"新建收纳位置")+' ♡</h2><form id="location-form" class="form"><label class="field">名称 *<input name="name" maxlength="70" required placeholder="例如：卧室 / 衣柜 A / 白色收纳盒" value="'+pretty(l?.name||"")+'"></label><label class="field">图标（一个 emoji）<input name="icon" maxlength="10" placeholder="🗄️" value="'+pretty(l?.icon||"📦")+'"></label><label class="field">柜体编号<input name="label" maxlength="40" value="'+pretty(l?.label||"")+'"></label><label class="field">地图区域<input name="mapBounds" placeholder="左 上 宽 高，例如 10 10 20 25" value="'+pretty(l?.mapBounds?.join(" ")||"")+'"><small>四个数值均为图中百分比。以左上角为原点。</small></label><label class="field">放在哪个位置里？<select name="parentId">'+locationOptions(l?.parentId??modal.parent??"",l?.id||"")+'</select></label><p class="hint">根位置请选择「待整理 / 未指定」，表示它直接在家里。修改盒子的父级位置，会自动更新盒内物品的完整路径。</p><div class="modal-actions">'+(l?'<button type="button" class="secondary danger" data-act="delete-location" data-id="'+l.id+'">删除</button>':'')+'<button type="button" class="secondary" data-act="close">取消</button><button type="submit" class="primary">保存位置</button></div></form>';
 }
 app.insertAdjacentHTML("beforeend",modalBox(html));
}
function track(type,item,delta=0){state.history.push({id:uuid(),type,itemId:item.id,name:item.name,delta,at:new Date().toISOString()});if(state.history.length>500)state.history.splice(0,state.history.length-500);}
function submitItem(form){
 const fd=new FormData(form),name=String(fd.get("name")||"").trim(),quantity=Number(fd.get("quantity")),minQuantity=Number(fd.get("minQuantity"));if(!name||!Number.isSafeInteger(quantity)||quantity<0||!Number.isSafeInteger(minQuantity)||minQuantity<0){toast("请检查名称和数量");return;}
 const old=state.items.find(x=>x.id===modal.id),item={...old,id:old?.id||uuid(),name,visibility:fd.get("visibility")==="private"?"private":"shared",category:String(fd.get("category")||"其他"),locationId:String(fd.get("locationId")||"")||null,quantity,unit:String(fd.get("unit")||"件").trim()||"件",consumable:fd.has("consumable"),minQuantity,notes:String(fd.get("notes")||"").trim(),createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
 if(old)state.items=state.items.map(x=>x.id===item.id?item:x);else state.items.push(item);
 track(old?"edit":"add",item);save();modal=null;render();toast("物品已保存 ♡");
}
function submitLocation(form){
 const fd=new FormData(form),name=String(fd.get("name")||"").trim(),parentId=String(fd.get("parentId")||"")||null;
 if(!name){toast("请输入位置名称");return;}
 const old=state.locations.find(x=>x.id===modal.id);
 if(old && parentId && descendants(old.id).has(parentId)){toast("不能把位置移动到它自己里面");return;}
 const boundsInput=String(fd.get("mapBounds")||"").trim();
 const bounds=mapBounds(boundsInput);
 if(boundsInput&&!bounds){toast("请输入有效的地图区域百分比");return;}
 const l={...old,id:old?.id||uuid(),name,label:String(fd.get("label")||"").trim(),mapBounds:bounds,icon:String(fd.get("icon")||"📦").trim()||"📦",parentId,updatedAt:new Date().toISOString()};
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
 const locations=raw.locations.map(l=>{if(typeof l.id!=="string"||!/^[-_a-zA-Z0-9]{1,120}$/.test(l.id)||ids.has(l.id))throw Error("位置数据无效");ids.add(l.id);return {id:l.id,name:String(l.name||"未命名"),icon:String(l.icon||"📦"),label:String(l.label||""),mapBounds:mapBounds(Array.isArray(l.mapBounds)?l.mapBounds.join(" "):""),parentId:l.parentId||null};});
 for(const l of locations){if(l.parentId&&!ids.has(l.parentId))l.parentId=null;const seen=new Set();let x=l;while(x){if(seen.has(x.id))throw Error("位置包含循环引用");seen.add(x.id);x=locations.find(y=>y.id===x.parentId);}}
 const itemIds=new Set();
 const items=raw.items.map(i=>{if(typeof i.id!=="string"||!/^[-_a-zA-Z0-9]{1,120}$/.test(i.id)||itemIds.has(i.id))throw Error("物品数据无效");itemIds.add(i.id);return {id:i.id,name:String(i.name||"未命名"),visibility:i.visibility==="private"?"private":"shared",category:String(i.category||"其他"),locationId:ids.has(i.locationId)?i.locationId:null,quantity:Math.max(0,Math.floor(Number(i.quantity)||0)),unit:String(i.unit||"件"),consumable:Boolean(i.consumable),minQuantity:Math.max(0,Math.floor(Number(i.minQuantity)||0)),notes:String(i.notes||""),createdAt:i.createdAt||new Date().toISOString(),updatedAt:i.updatedAt||new Date().toISOString()};});
 state={version:4,locations,items,floorPlan:typeof raw.floorPlan==="string"?raw.floorPlan:undefined,history:Array.isArray(raw.history)?raw.history:[],shopping:Array.isArray(raw.shopping)?raw.shopping.filter(i=>i&&typeof i.id==="string"&&typeof i.name==="string"):[],chores:Array.isArray(raw.chores)?raw.chores.filter(i=>i&&typeof i.id==="string"&&typeof i.name==="string"):[],wellness:Array.isArray(raw.wellness)?raw.wellness.filter(i=>i&&typeof i.id==="string"&&typeof i.name==="string"):[],tasks:Array.isArray(raw.tasks)?raw.tasks:[],pets:Array.isArray(raw.pets)?raw.pets:[],petRecords:Array.isArray(raw.petRecords)?raw.petRecords:[],subscriptions:Array.isArray(raw.subscriptions)?raw.subscriptions:[],activity:Array.isArray(raw.activity)?raw.activity:[],finds:Array.isArray(raw.finds)?raw.finds:[]};save();view="home";modal=null;render();toast("导入成功 ♡");
 }catch(e){toast("导入失败："+e.message);}
}
const searchSelector = "#global-search, [data-find-search]";
document.addEventListener("compositionstart",e=>{
 if(e.target.matches(searchSelector))composingSearch=e.target;
});
document.addEventListener("compositionend",e=>{
 if(composingSearch!==e.target)return;
 composingSearch=null;
 updateSearch(e);
});
document.addEventListener("input",e=>{
 if(e.isComposing||composingSearch===e.target)return;
 updateSearch(e);
});
function updateSearch(e){
 if(e.target.matches("[data-find-search]")){const caret=e.target.selectionStart;collection.input(e);render();const fresh=document.querySelector("[data-find-search]");fresh?.focus();fresh?.setSelectionRange(caret,caret);return;}
 if(e.target.id==="global-search"){searchTerm=e.target.value; if(searchTerm&&!(["items","stock","unplaced"].includes(view))){view="items";locationFilter="";categoryFilter="";};render(true);}
}
document.addEventListener("change",async e=>{
 if(e.target.id==="map-layout-file"){
  const file=e.target.files[0];
  if(!file)return;
  const account=cloud.user()?.id;
  try{
   if(file.size>1500000)throw new Error("户型文件过大");
   const layout=readLayout(JSON.parse(await file.text()));
   if(account!==cloud.user()?.id)return;
   const known=new Set(state.locations.map(location=>location.id));
   const additions=layout.locations.filter(location=>!known.has(location.id));
   const destination=sync.connected?"当前家庭的两位成员":"当前浏览器";
   if(!confirm("将户型图导入到"+destination+"，并新建 "+additions.length+" 个收纳位置。已有位置和物品会保留。继续吗？"))return;
   state.floorPlan=layout.floorPlan;
   state.locations.push(...additions);
   save();toast("户型和收纳位置已导入");
  }catch(error){toast("导入失败："+error.message);}
  finally{e.target.value="";}
  return;
 }
 if(e.target.id==="location-filter"){locationFilter=e.target.value;render();}
 if(e.target.id==="category-filter"){categoryFilter=e.target.value;render();}
 if(e.target.id==="sort"){sortBy=e.target.value;render();}
 if(e.target.id==="map-location"){mapSelection=e.target.value||null;render();}
 if(e.target.id==="map-file"){
  const file=e.target.files[0];
  if(!file)return;
  if(!["image/svg+xml","image/png","image/jpeg","image/webp"].includes(file.type)||file.size>1000000){toast("请选择小于 1 MB 的 SVG、PNG、JPEG 或 WebP");return;}
  const reader=new FileReader(),account=cloud.user()?.id;
  reader.onload=()=>{if(account!==cloud.user()?.id)return;state.floorPlan=reader.result;save();toast("户型图已导入");};
  reader.onerror=()=>toast("户型图读取失败");
  reader.readAsDataURL(file);
 }
 if(e.target.id==="import-file")doImport(e.target.files[0]);
});
document.addEventListener("submit",async e=>{
 if(e.target.id==="cloud-login"){
  e.preventDefault();
  const fields=new FormData(e.target);
  const email=fields.get("email"),password=fields.get("password");
  const usePassword=e.submitter?.value==="password";
  for(const button of e.target.querySelectorAll("button"))button.disabled=true;
  try {
   if(usePassword){
    await cloud.signIn(email,password);
    await connectCloud();
   }else{
    await cloud.sendLink(email);
    cloudMessage="请在此设备打开邮箱中的登录链接。";
   }
  }catch{
   cloudMessage=usePassword?"登录失败，请检查邮箱和密码。":"发送失败。请确认此邮箱已加入家庭，并稍后重试。";
  }
  render();
  return;
 }
 if(e.target.id==="cloud-migrate"){
  e.preventDefault();
  if(!sync.connected)return;
  const visibility=new FormData(e.target).get("visibility");
  try {state=sync.importLegacy(load(),visibility);render();}
  catch {toast("迁移暂缓，请检查本机存储空间。");}
  return;
 }
 if(collection.submit(e))return;
 if(planner.submit(e))return;
 if(wellness.submit(e))return;
 if(extras.submit(e))return;
 if(e.target.id==="item-form"){e.preventDefault();submitItem(e.target);}
 if(e.target.id==="location-form"){e.preventDefault();submitLocation(e.target);}
});
document.addEventListener("click",e=>{
 if(collection.click(e))return;
 if(planner.click(e))return;
 if(wellness.click(e))return;
 if(extras.click(e))return;
 if(e.target.id==="modal-overlay"){modal=null;render();return;}
 const b=e.target.closest("[data-act]");if(!b)return;
 const {act,id,view:target,delta,parent,location}=b.dataset;
 if(act==="theme"){theme=b.dataset.theme==="lavender"?"lavender":"wood";localStorage.setItem(themeStorageKey,theme);document.body.dataset.theme=theme;render();toast("配色已切换");}
 if(act==="nav"){extras.close();wellness.close();planner.close();collection.reset();modal=null;view=target;searchTerm="";locationFilter="";categoryFilter="";render();}
 if(act==="shop-tab"){shoppingTab=b.dataset.value==="subs"?"subs":"list";render();}
 if(act==="quick-add"){modal={type:"quick-add"};renderModal();}
 if(act==="quick-add-choice"){const t=b.dataset.type;modal=null;render();if(t==="find"){view="collection";render();collection.open("find");}else if(t==="item"){modal={type:"item"};renderModal();}else if(t==="task"){view="planner";render();planner.open("task");}else if(t==="shopping"){view="shopping";shoppingTab="list";render();document.querySelector('[data-extra="new-shopping"]')?.click();}else if(t==="care"){view="chores";render();document.querySelector('[data-extra="new-chore"]')?.click();}else if(t==="wellness"){view="wellness";render();document.querySelector('[data-well="new"]')?.click();}else if(t==="pet"){view="planner";planner.section("pets");render();planner.open("pet");}else if(t==="sub"){view="shopping";shoppingTab="subs";render();planner.open("sub");}}
 if(act==="add-item"){modal={type:"item",location:location||null};renderModal();}
 if(act==="edit-item"){modal={type:"item",id};renderModal();}
 if(act==="add-location"){modal={type:"location",parent:parent??activeLocation};renderModal();}
 if(act==="edit-location"){modal={type:"location",id};renderModal();}
 if(act==="map-import-layout")document.getElementById("map-layout-file")?.click();
 if(act==="map-import")document.getElementById("map-file")?.click();
 if(act==="map-select"){mapSelection=id||null;view="map";searchTerm="";modal=null;render();document.querySelector(".map-highlight:last-of-type")?.scrollIntoView({block:"nearest"});}
 if(act==="open-location"){activeLocation=id||null;render();}
 if(act==="close"){modal=null;render();}
 if(act==="quantity"){const i=state.items.find(x=>x.id===id);if(!i)return;i.quantity=Math.max(0,Number(i.quantity)+Number(delta));i.updatedAt=new Date().toISOString();track("quantity",i,Number(delta));save();render();}
 if(act==="delete-item"){const i=state.items.find(x=>x.id===id);if(i&&confirm('确定删除「'+i.name+'」吗？')){state.items=state.items.filter(x=>x.id!==id);save();modal=null;render();toast("物品已删除");}}
 if(act==="delete-location"){const l=state.locations.find(x=>x.id===id);if(!l)return;const descendantsSet=descendants(id);const n=state.items.filter(x=>descendantsSet.has(x.locationId)).length;if(confirm('删除「'+l.name+'」及其全部下级位置？其中 '+n+' 件物品将转到待整理，物品不会删除。')){state.locations=state.locations.filter(x=>!descendantsSet.has(x.id));state.items.forEach(x=>{if(descendantsSet.has(x.locationId))x.locationId=null;});if(activeLocation&&descendantsSet.has(activeLocation))activeLocation=null;save();modal=null;render();toast("位置已删除，物品已保留");}}
 if(act==="cloud-logout"){sync.stop();cloud.forget();state=load();cloudMessage="已退出登录";render();}
 if(act==="cloud-sync"){if(sync.connected)sync.sync();else connectCloud();}
 if(act==="cloud-reload"&&sync.connected&&confirm("重新加载会放弃尚未同步的本机编辑。继续吗？")){
  sync.reload().catch(()=>toast("暂时无法加载云端数据"));
 }
 if(act==="export")doExport();
 if(act==="import")document.getElementById("import-file")?.click();
 if(act==="clear"){if(confirm("此操作会永久清空当前设备的所有物品及收纳位置。请先导出备份。确认清空？")&&confirm("再次确认：删除所有本地数据？")){state=initial();save();view="home";render();toast("数据已清空");}}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(modal){modal=null;render();}else{collection.close();planner.close();extras.close();wellness.close();}}});
window.addEventListener("storage",e=>{if(e.key===STORAGE_KEY&&!sync.connected){state=load();render();toast("本机数据已刷新");}});
render();

window.addEventListener("online",()=>sync.sync());
setInterval(()=>{if(!document.hidden)sync.sync();},20000);
connectCloud();
