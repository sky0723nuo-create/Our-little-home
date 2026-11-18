
/* HOME Collection V2.1.1 — local-first product and venue diary.
   Cloud sharing & per-user permissions arrive with V2.2. */
export function createCollection({getState,save,esc,toast,uuid}){
 let filter="all",query="",selected=null,editor=null;
 const items=()=>getState().finds||[];
 const active=()=>items().filter(x=>!x.deletedAt);
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const labels={product:"Products · 好物商品",restaurant:"Restaurants · 餐厅",cafe:"Cafés · 咖啡馆"};
 const en={product:"Product",restaurant:"Restaurant",cafe:"Café"};
 const rate=n=>n?("★".repeat(Math.max(0,Math.min(5,Number(n))))+"☆".repeat(5-Math.max(0,Math.min(5,Number(n))))):"Not Rated";
 const boolLabel=v=>({yes:"♡ Again · 会再买/再去",maybe:"Maybe · 待定",no:"Not Again · 不回购/不再访"})[v]||"Not decided";
 const ratingOptions=(value)=>'<option value="">Not Rated · 暂无评分</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'" '+(Number(value)===n?"selected":"")+'>'+n+' ★</option>').join("");
 const select=(v,options)=>options.map(([x,l])=>'<option value="'+x+'" '+(x===v?"selected":"")+'>'+l+'</option>').join("");
 const photo=(i)=>i?.photo?'<img class="find-cover" alt="'+esc(i.name)+'" src="'+esc(i.photo)+'">':'<div class="find-no-photo">'+(i.type==="restaurant"?"🍜":i.type==="cafe"?"☕":"♡")+'</div>';
 const summary=()=>({total:active().length,favorites:active().filter(i=>i.revisit==="yes").length});
 function page(){
  if(selected)return detail(selected);
  const list=active().filter(i=>(filter==="all"||i.type===filter)&&[i.name,i.brand,i.shop,i.location,i.notes,i.type,(i.events||[]).map(e=>[e.notes,e.orders].join(" "))].join(" ").toLowerCase().includes(query.toLowerCase())).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
  return '<div class="collection-head"><div><div class="eyebrow">OUR LITTLE FAVORITES</div><h2>Our Finds ♡</h2><p>Things we tried, loved and remembered.</p></div><button class="primary" data-find="add">＋ Add Find</button></div>'+
   '<div class="find-tabs">'+[["all","All · 全部"],["product","Products"],["restaurant","Restaurants"],["cafe","Cafés"]].map(([v,l])=>'<button data-find="filter" data-value="'+v+'" class="'+(filter===v?"selected":"")+'">'+l+'</button>').join("")+'</div>'+
   '<div class="find-search"><input data-find-search="1" aria-label="搜索收藏" placeholder="Search products, cafés, restaurants..." value="'+esc(query)+'"></div>'+
   '<div class="find-intro"><span>♡ '+summary().favorites+' favorites</span><span>'+list.length+' finds</span></div>'+
   (list.length?'<div class="find-grid">'+list.map(i=>'<button class="find-card" data-find="open" data-id="'+i.id+'">'+photo(i)+'<div class="find-card-info"><small>'+en[i.type]+'</small><strong>'+esc(i.name)+'</strong><span>'+esc(i.brand||i.location||i.shop||"")+'</span><div class="find-card-bottom"><span>'+rate(i.ratings?.together)+'</span><span>'+(i.revisit==="yes"?"♡":i.revisit==="no"?"✕":"")+'</span></div></div></button>').join("")+'</div>':
   '<div class="v2-calm">No finds yet ♡<small>记录买过的好东西，或者去过的咖啡馆和餐厅。</small></div>');
 }
 function detail(id){
  const item=active().find(i=>i.id===id);
  if(!item){selected=null;return page();}
  const experiences=(item.events||[]).slice().sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const shared=item.ratings||{};
  return '<button class="secondary find-back" data-find="back">← Collection · 返回收藏</button>'+
  '<div class="find-detail">'+photo(item)+'<div class="find-detail-body"><div class="eyebrow">'+esc(labels[item.type])+'</div><h2>'+esc(item.name)+'</h2><div class="task-meta">'+esc([item.brand,item.shop,item.location].filter(Boolean).join(" · "))+'</div>'+
  (item.notes?'<p>'+esc(item.notes)+'</p>':"")+
  '<div class="find-rating-box"><h3>Current Rating · 当前评价</h3><div class="find-scores">'+[["Our Rating · 共同",shared.together],["Me · 我",shared.me],["Jason",shared.jason]].map(([name,value])=>'<div><small>'+name+'</small><strong>'+rate(value)+'</strong></div>').join("")+'</div><div class="task-meta">'+boolLabel(item.revisit)+'</div></div>'+
  (item.type==="product"?'<div class="task-meta">'+(item.price!==null&&item.price!==undefined?"Price: A$"+Number(item.price).toFixed(2)+" · ":"")+'Optional Inventory link: '+esc(getState().items.find(x=>x.id===item.itemId)?.name||"None")+'</div>':item.link?'<p><a href="'+esc(item.link)+'" target="_blank" rel="noopener noreferrer">Open location / map · 打开位置</a></p>':"")+
  '<div class="actions"><button class="primary" data-find="experience" data-id="'+item.id+'">＋ Add Experience</button><button class="secondary" data-find="edit" data-id="'+item.id+'">Edit Find</button>'+(item.type==="product"?'<button class="secondary" data-find="rebuy" data-id="'+item.id+'">♡ Add to Shopping</button>':"")+'</div></div></div>'+
  '<div class="section-head"><h2>Experience History <small>购买 / 到访记录 · '+experiences.length+'</small></h2></div>'+
  (experiences.length?experiences.map(e=>'<div class="find-visit"><div class="find-visit-heading"><strong>'+esc(e.date||"Unknown Date")+'</strong><button class="mini" data-find="edit-experience" data-id="'+item.id+'" data-event="'+e.id+'">Edit</button></div>'+
    '<div class="task-meta">'+esc(e.place||"")+(e.price!==null&&e.price!==undefined&&e.price!==""?" · A$"+Number(e.price).toFixed(2):"")+'</div>'+
    (e.notes?'<p>'+esc(e.notes)+'</p>':"")+(e.orders?'<div class="find-orders"><strong>What we ordered · 点过什么</strong><p>'+esc(e.orders)+'</p></div>':"")+
    '<div class="find-visit-ratings">'+[["Our",e.ratings?.together],["Me",e.ratings?.me],["Jason",e.ratings?.jason]].map(([name,value])=>'<span>'+name+": "+rate(value)+'</span>').join("")+'</div></div>').join(""):'<div class="v2-calm">还没有购买 / 到访历史，点击 Add Experience 记录第一次体验。</div>');
 }
 function recordForm(item){
  const type=item?.type||"product",r=item?.ratings||{};
  return '<h2>'+(item?"Edit Find":"New Find")+' · 收藏记录</h2><form class="form" id="find-form">'+
  '<label class="field">Name · 名称 *<input name="name" required maxlength="120" value="'+esc(item?.name||"")+'" placeholder="草莓大福 / 你喜欢的餐厅"></label>'+
  '<label class="field">Type · 类型<select name="type">'+select(type,[["product","Product · 商品"],["restaurant","Restaurant · 餐厅"],["cafe","Café · 咖啡馆"]])+'</select></label>'+
  '<label class="field">Photo · 照片（选填，小图保存在本机）<input type="file" name="photo" accept="image/*"></label>'+
  (item?.photo?'<label class="find-checkbox"><input type="checkbox" name="removePhoto"> Remove existing photo · 删除旧照片</label>':"")+
  '<label class="field">Brand · 品牌（选填）<input name="brand" maxlength="100" value="'+esc(item?.brand||"")+'"></label>'+
  '<label class="field">Shop / Supplier · 购买商家（选填）<input name="shop" maxlength="120" value="'+esc(item?.shop||"")+'"></label>'+
  '<label class="field">Location · 店铺位置 / 区域（选填）<input name="location" maxlength="180" value="'+esc(item?.location||"")+'"></label>'+
  '<label class="field">Map / Website Link · 地图或网页链接（选填）<input name="link" type="url" maxlength="1000" placeholder="https://..." value="'+esc(item?.link||"")+'"></label>'+
  '<label class="field">Price (AUD) · 价格 / 参考人均消费（选填）<input name="price" type="number" step="0.01" min="0" value="'+(item?.price??"")+'"></label>'+
  '<h3>Current Rating · 当前评价（可留空）</h3><div class="find-form-ratings">'+[["together","Our Rating · 共同",r.together],["me","Me · 我",r.me],["jason","Jason",r.jason]].map(([k,l,v])=>'<label class="field">'+l+'<select name="rating_'+k+'">'+ratingOptions(v)+'</select></label>').join("")+'</div>'+
  '<label class="field">Buy / Visit Again · 是否回购 / 再去<select name="revisit">'+select(item?.revisit||"",[["","Not decided · 未决定"],["yes","♡ Yes · 会"],["maybe","Maybe · 可能"],["no","No · 不会"]])+'</select></label>'+
  '<label class="field">Inventory · 关联已有商品（选填）<select name="itemId"><option value="">None · 不关联</option>'+(getState().items||[]).map(x=>'<option value="'+esc(x.id)+'" '+(x.id===item?.itemId?"selected":"")+'>'+esc(x.name)+'</option>').join("")+'</select></label>'+
  '<label class="field">Notes · 总体印象（选填）<textarea name="notes" maxlength="1800" rows="3">'+esc(item?.notes||"")+'</textarea></label>'+
  '<p class="hint">V2.1.1 仍是浏览器本地保存，Me / Jason 暂无真实权限隔离。</p>'+
  '<div class="modal-actions">'+(item?'<button type="button" class="secondary danger" data-find="delete" data-id="'+item.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-find="close">Cancel</button><button class="primary">Save · 保存</button></div></form>';
 }
 function experienceForm(item,event){
  const e=event||{},r=e.ratings||{};
  return '<h2>'+(event?"Edit Experience":"Add Experience")+' · '+esc(item.name)+'</h2><form id="find-experience-form" class="form">'+
  '<label class="field">Date · 日期 *<input name="date" type="date" required value="'+esc(e.date||today())+'"></label>'+
  '<label class="field">'+(item.type==="product"?"Purchased at · 购买地点":"Visit · 当次到访说明")+'<input name="place" maxlength="150" value="'+esc(e.place||"")+'"></label>'+
  '<label class="field">Amount (AUD) · 本次花费（选填）<input name="price" type="number" step="0.01" min="0" value="'+(e.price??"")+'"></label>'+
  (item.type==="product"?"":'<label class="field">What We Ordered · 点过什么（每行一项，可写感受）<textarea name="orders" maxlength="2500" rows="3" placeholder="Matcha Latte — Me 喜欢，Jason 觉得太苦">'+esc(e.orders||"")+'</textarea></label>')+
  '<label class="field">Notes · 当次感受<textarea name="notes" maxlength="2500" rows="3">'+esc(e.notes||"")+'</textarea></label>'+
  '<div class="find-form-ratings">'+[["together","Our Rating · 共同",r.together],["me","Me · 我",r.me],["jason","Jason",r.jason]].map(([k,l,v])=>'<label class="field">'+l+'<select name="rating_'+k+'">'+ratingOptions(v)+'</select></label>').join("")+'</div>'+
  '<p class="hint">当次评价不会覆盖 Current Rating；历史记录会一直独立保留。</p>'+
  '<div class="modal-actions">'+(event?'<button type="button" class="secondary danger" data-find="delete-experience" data-id="'+item.id+'" data-event="'+event.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-find="close">Cancel</button><button class="primary">Save Experience</button></div></form>';
 }
 function modal(){
  if(!editor)return "";
  const item=active().find(x=>x.id===editor.id);
  let body="";
  if(editor.mode==="find")body=recordForm(item);
  if(editor.mode==="experience"&&item)body=experienceForm(item,(item.events||[]).find(x=>x.id===editor.eventId));
  return '<div class="overlay" id="find-overlay"><div class="modal find-modal" role="dialog" aria-modal="true">'+body+'</div></div>';
 }
 function show(){document.getElementById("find-overlay")?.remove();if(editor)document.getElementById("app").insertAdjacentHTML("beforeend",modal());}
 function open(mode,id="",eventId=""){editor={mode,id,eventId};show();}
 function close(){editor=null;document.getElementById("find-overlay")?.remove();}
 function restore(id){const i=items().find(x=>x.id===id);if(i){delete i.deletedAt;save();}}
 function click(e){
  const b=e.target.closest("[data-find]");
  if(!b){if(e.target.id==="find-overlay"){close();return true;}return false;}
  const {find,id,value,event}=b.dataset;
  if(find==="filter"){filter=value;selected=null;save();}
  if(find==="add")open("find");
  if(find==="open"){selected=id;save();}
  if(find==="back"){selected=null;save();}
  if(find==="edit")open("find",id);
  if(find==="experience")open("experience",id);
  if(find==="edit-experience")open("experience",id,event);
  if(find==="close")close();
  if(find==="delete"){const i=items().find(x=>x.id===id);if(i&&confirm("移到最近删除？收藏和体验历史都可以恢复。")){i.deletedAt=new Date().toISOString();selected=null;close();save();toast("已移动到最近删除");}}
  if(find==="delete-experience"){const i=items().find(x=>x.id===id);if(i&&confirm("删除这次体验记录？")){i.events=(i.events||[]).filter(x=>x.id!==event);close();save();toast("体验已删除");}}
  if(find==="rebuy"){
   const i=active().find(x=>x.id===id);
   if(i){const exists=(getState().shopping||[]).some(x=>x.findId===id&&!x.done);if(exists){toast("该商品已经在待买清单中了");return true;}
    getState().shopping=[...(getState().shopping||[]),{id:uuid(),name:i.name,group:"groceries",quantity:1,budget:i.price??null,notes:"From Collection ♡",done:false,findId:id}];
    save();toast("已加入 Shopping · 下次再买");}
  }
  return true;
 }
 function score(f,key){const n=f.get("rating_"+key);return n===""||n===null?null:Number(n);}
 function readPhoto(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.size)return resolve(null);
   if(!file.type.startsWith("image/")||file.size>12*1024*1024)return reject(new Error("请选择 12 MB 以内的图片"));
   const img=new Image(),reader=new FileReader();
   reader.onerror=()=>reject(new Error("无法读取照片"));
   reader.onload=()=>{img.onerror=()=>reject(new Error("图片格式不支持"));img.onload=()=>{
     const scale=Math.min(1,780/Math.max(img.width,img.height));const c=document.createElement("canvas");
     c.width=Math.max(1,Math.round(img.width*scale));c.height=Math.max(1,Math.round(img.height*scale));
     c.getContext("2d").drawImage(img,0,0,c.width,c.height);
     resolve(c.toDataURL("image/jpeg",0.68));
   };img.src=String(reader.result);};
   reader.readAsDataURL(file);
  });
 }
 function submit(e){
  if(!["find-form","find-experience-form"].includes(e.target.id))return false;
  e.preventDefault();processSubmission(e).catch(err=>toast("保存失败："+err.message));return true;
 }
 async function processSubmission(e){const f=new FormData(e.target),now=new Date().toISOString();
  if(e.target.id==="find-form"){
   const name=String(f.get("name")||"").trim(),type=String(f.get("type")||"product");
   if(!name||!labels[type]){toast("请填写名称和类型");return true;}
   const existing=active().find(x=>x.id===editor?.id),priceRaw=String(f.get("price")||"");
   const price=priceRaw===""?null:Number(priceRaw);
   if(price!==null&&(!Number.isFinite(price)||price<0)){toast("请检查价格");return true;}
   let picture=existing?.photo||"";
   if(f.has("removePhoto"))picture="";
   try{picture=(await readPhoto(f.get("photo")))||picture;}catch(err){toast(err.message);return true;}
   const link=String(f.get("link")||"").trim();
   if(link&&!/^https?:\/\//i.test(link)){toast("地图或网页链接需要以 https:// 开头");return true;}
   const record={...existing,id:existing?.id||uuid(),type,name,brand:String(f.get("brand")||"").trim(),shop:String(f.get("shop")||"").trim(),
    location:String(f.get("location")||"").trim(),link,photo:picture,price,notes:String(f.get("notes")||"").trim(),
    revisit:String(f.get("revisit")||""),itemId:String(f.get("itemId")||""),ratings:{together:score(f,"together"),me:score(f,"me"),jason:score(f,"jason")},
    events:existing?.events||[],createdAt:existing?.createdAt||now,updatedAt:now};
   getState().finds=existing?items().map(x=>x.id===record.id?record:x):[...items(),record];
   selected=record.id;close();save();toast("已加入 Collection ♡");
   return true;
  }
  const item=active().find(x=>x.id===editor?.id);if(!item)return true;
  const old=(item.events||[]).find(x=>x.id===editor.eventId),date=String(f.get("date")||"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)){toast("请填写正确的日期");return true;}
  const raw=String(f.get("price")||""),price=raw===""?null:Number(raw);
  if(price!==null&&(!Number.isFinite(price)||price<0)){toast("请检查价格");return true;}
  const row={...old,id:old?.id||uuid(),date,place:String(f.get("place")||"").trim(),price,orders:String(f.get("orders")||"").trim(),
   notes:String(f.get("notes")||"").trim(),ratings:{together:score(f,"together"),me:score(f,"me"),jason:score(f,"jason")},createdAt:old?.createdAt||now,updatedAt:now};
  item.events=old?(item.events||[]).map(x=>x.id===row.id?row:x):[...(item.events||[]),row];
  item.updatedAt=now;close();save();toast("体验已记录 ♡");return true;
 }
 function input(e){if(e.target.matches("[data-find-search]")){query=e.target.value;return true;}return false;}
 const reset=()=>{selected=null;close();};
 return {page,summary,show,open,close,reset,click,submit,input,restore};
}
