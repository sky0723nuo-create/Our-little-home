
export function createHomeExtras(ctx){
 const {getState,save,esc,toast,uuid}=ctx;
 let screen="shopping",editing=null;
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const asDate=d=>{const [y,m,day]=d.split("-").map(Number);return new Date(y,m-1,day,12);};
 const fmt=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 function due(task){
  if(!task.lastDone)return null;
  const d=asDate(task.lastDone),n=Number(task.frequency)||1;
  if(task.unit==="months"){const y=d.getFullYear(),m=d.getMonth(),day=d.getDate();const target=new Date(y,m+n,1,12);target.setDate(Math.min(day,new Date(target.getFullYear(),target.getMonth()+1,0).getDate()));return fmt(target);}
  d.setDate(d.getDate()+n*(task.unit==="weeks"?7:1));return fmt(d);
 }
 function dueState(task){
  const d=due(task);
  if(!d)return {label:"Not scheduled · 待安排",cls:"soon"};
  const days=Math.round((asDate(d)-asDate(today()))/86400000);
  return days<0?{label:"Overdue · 已逾期",cls:"overdue"}:days===0?{label:"Due today · 今天到期",cls:"overdue"}:days<=7?{label:"Due soon · 即将到期",cls:"soon"}:{label:"Scheduled · 已安排",cls:"scheduled"};
 }
 const shopping=()=>getState().shopping||[];
 const chores=()=>getState().chores||[];
 function shoppingPage(){
  const entries=shopping();
  return '<div class="section-head"><h2>Shopping List <small>购物清单</small></h2><button class="primary" data-extra="new-shopping">＋ Add</button></div>'+
  '<div class="notice">超市下次要买的东西、家具电器等大件心愿，都可以先记在这里。</div>'+
  [["groceries","Groceries","超市日用品"],["wishlist","Wishlist","大件心愿"]].map(([group,en,zh])=>{
   const list=entries.filter(i=>i.group===group).sort((a,b)=>Number(a.done)-Number(b.done));
   return '<section class="panel"><div class="section-head"><h2>'+en+' <small>'+zh+'</small></h2><span class="muted">'+list.filter(i=>!i.done).length+' to buy</span></div>'+
    (list.length?'<div class="extra-list">'+list.map(i=>'<div class="extra-entry '+(i.done?"is-done":"")+'"><button class="extra-check" aria-label="切换购买状态" data-extra="toggle-shopping" data-id="'+i.id+'">'+(i.done?"✓":"")+'</button><div class="extra-detail"><strong>'+esc(i.name)+'</strong><div class="task-meta">× '+Number(i.quantity||1)+(i.budget!==null&&i.budget!==undefined?" · Budget $"+Number(i.budget).toFixed(2):"")+'</div>'+(i.notes?'<div class="task-meta">'+esc(i.notes)+'</div>':"")+'</div><button class="mini" data-extra="edit-shopping" data-id="'+i.id+'">Edit</button></div>').join("")+'</div>':'<div class="empty">还没有东西，点击 Add 开始记录。</div>')+'</section>';
  }).join("");
 }
 function carePage(){
  const list=chores().slice().sort((a,b)=>(due(a)||"0000").localeCompare(due(b)||"0000"));
  return '<div class="section-head"><h2>Home Care <small>家务维护</small></h2><button class="primary" data-extra="new-chore">＋ Add Task</button></div>'+
   '<div class="notice">记录上次完成日期，自动计算下次日期；打开 HOME 时就可以看到到期和逾期项目。</div>'+
   '<section class="panel">'+(list.length?'<div class="extra-list">'+list.map(i=>{const st=dueState(i);return '<div class="extra-care"><div class="care-heading"><strong>'+esc(i.name)+'</strong><span class="care-badge '+st.cls+'">'+st.label+'</span></div><div class="task-meta">Every '+Number(i.frequency)+' '+esc(i.unit)+' · 每隔'+Number(i.frequency)+(i.unit==="months"?"个月":i.unit==="weeks"?"周":"天")+'</div><div class="task-meta">Last · 上次：'+(i.lastDone?esc(i.lastDone):"未记录")+'　Next · 下次：'+(due(i)||"待安排")+'</div>'+(i.notes?'<div class="task-meta">'+esc(i.notes)+'</div>':"")+'<div class="actions" style="margin-top:12px"><button class="primary" data-extra="complete-chore" data-id="'+i.id+'">✓ Done Today · 今天完成</button><button class="secondary" data-extra="edit-chore" data-id="'+i.id+'">Edit</button></div></div>';}).join("")+'</div>':'<div class="empty">还没有家务，例如「清洗洗衣机」，每 3 个月一次。</div>')+'</section>';
 }
 function modalHtml(){
  if(!editing)return "";
  const data=editing.type==="shopping"?shopping():chores(),item=data.find(i=>i.id===editing.id);
  let form;
  if(editing.type==="shopping"){
   form='<form id="extra-shopping-form" class="form"><label class="field">Item / 想买什么 *<input required maxlength="100" name="name" value="'+esc(item?.name||"")+'" placeholder="洗衣液 / 沙发"></label><label class="field">List / 清单<select name="group"><option value="groceries" '+(item?.group!=="wishlist"?"selected":"")+'>Groceries · 超市日用品</option><option value="wishlist" '+(item?.group==="wishlist"?"selected":"")+'>Wishlist · 大件心愿</option></select></label><div class="row"><label class="field">Quantity / 数量<input type="number" required name="quantity" min="1" max="99999" value="'+Number(item?.quantity||1)+'"></label><label class="field">Budget AUD / 预算<input type="number" name="budget" min="0" step="0.01" value="'+(item?.budget??"")+'"></label></div><label class="field">Notes / 备注<textarea name="notes" maxlength="500" rows="3">'+esc(item?.notes||"")+'</textarea></label><div class="modal-actions">'+(item?'<button type="button" class="secondary danger" data-extra="delete-shopping" data-id="'+item.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-extra="close">Cancel</button><button class="primary">Save · 保存</button></div></form>';
  }else{
   form='<form id="extra-chore-form" class="form"><label class="field">Task / 家务名称 *<input required maxlength="100" name="name" placeholder="清洗洗衣机内筒" value="'+esc(item?.name||"")+'"></label><div class="row"><label class="field">Every / 每隔<input type="number" min="1" max="365" required name="frequency" value="'+Number(item?.frequency||3)+'"></label><label class="field">Period / 周期<select name="unit"><option value="days" '+(item?.unit==="days"?"selected":"")+'>Days · 天</option><option value="weeks" '+(item?.unit==="weeks"?"selected":"")+'>Weeks · 周</option><option value="months" '+(!item||item.unit==="months"?"selected":"")+'>Months · 月</option></select></label></div><label class="field">Last done / 上次完成<input type="date" name="lastDone" value="'+esc(item?.lastDone||"")+'"></label><p class="hint">不填上次日期会标为待安排；点击「今天完成」会自动记录并计算下次日期。</p><label class="field">Notes / 备注<textarea rows="2" name="notes" maxlength="500">'+esc(item?.notes||"")+'</textarea></label><div class="modal-actions">'+(item?'<button type="button" class="secondary danger" data-extra="delete-chore" data-id="'+item.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-extra="close">Cancel</button><button class="primary">Save · 保存</button></div></form>';
  }
  return '<div class="overlay" id="extra-overlay"><div class="modal" role="dialog" aria-modal="true"><h2>'+(editing.type==="shopping"?"Shopping Item · 购物清单":"Home Care · 家务维护")+'</h2>'+form+'</div></div>';
 }
 function showModal(){document.getElementById("extra-overlay")?.remove();if(editing)document.getElementById("app").insertAdjacentHTML("beforeend",modalHtml());}
 function open(type,id){editing={type,id};showModal();}
 function close(){editing=null;document.getElementById("extra-overlay")?.remove();}
 function click(e){
  const b=e.target.closest("[data-extra]");if(!b){if(e.target.id==="extra-overlay"){close();return true;}return false;}
  const {extra,id}=b.dataset,s=getState();
  if(extra==="new-shopping")open("shopping");
  if(extra==="new-chore")open("chore");
  if(extra==="edit-shopping")open("shopping",id);
  if(extra==="edit-chore")open("chore",id);
  if(extra==="close")close();
  if(extra==="toggle-shopping"){const i=shopping().find(x=>x.id===id);if(i){i.done=!i.done;save();}}
  if(extra==="complete-chore"){const i=chores().find(x=>x.id===id);if(i&&confirm("确认今天完成了「"+i.name+"」？")){i.lastDone=today();i.history=[...(i.history||[]),today()];save();toast("已记录完成日期");}}
  if(extra==="delete-shopping"){const i=shopping().find(x=>x.id===id);if(i&&confirm("删除「"+i.name+"」？")){s.shopping=s.shopping.filter(x=>x.id!==id);save();close();}}
  if(extra==="delete-chore"){const i=chores().find(x=>x.id===id);if(i&&confirm("删除家务「"+i.name+"」及其历史？")){s.chores=s.chores.filter(x=>x.id!==id);save();close();}}
  return true;
 }
 function submit(e){
  const type=e.target.id==="extra-shopping-form"?"shopping":e.target.id==="extra-chore-form"?"chore":null;
  if(!type)return false;e.preventDefault();
  const fd=new FormData(e.target),name=String(fd.get("name")||"").trim(),old=(type==="shopping"?shopping():chores()).find(i=>i.id===editing?.id);
  if(!name){toast("请填写名称");return true;}
  let item;
  if(type==="shopping"){
   const qty=Number(fd.get("quantity")),budgetText=String(fd.get("budget")||"").trim(),budget=budgetText?Number(budgetText):null;
   if(!Number.isSafeInteger(qty)||qty<1||qty>99999||(budget!==null&&(!Number.isFinite(budget)||budget<0))){toast("数量或预算不正确");return true;}
   item={id:old?.id||uuid(),name,group:fd.get("group")==="wishlist"?"wishlist":"groceries",quantity:qty,budget,notes:String(fd.get("notes")||"").trim(),done:old?.done||false};
  }else{
   const freq=Number(fd.get("frequency")),unit=String(fd.get("unit")),lastDone=String(fd.get("lastDone")||"");
   if(!Number.isSafeInteger(freq)||freq<1||freq>365||!["days","weeks","months"].includes(unit)||(lastDone&&(lastDone>today()||!/^\d{4}-\d{2}-\d{2}$/.test(lastDone)))){toast("周期或日期不正确");return true;}
   item={id:old?.id||uuid(),name,frequency:freq,unit,lastDone,notes:String(fd.get("notes")||"").trim(),history:old?.history||[]};
  }
  const key=type==="shopping"?"shopping":"chores";
  getState()[key]=old?getState()[key].map(i=>i.id===item.id?item:i):[...getState()[key],item];
  close();save();toast("保存成功 ♡");return true;
 }
 function summary(){return {shopping:shopping().filter(i=>!i.done).length,care:chores().filter(i=>["overdue","soon"].includes(dueState(i).cls)).length};}
 return {shoppingPage,carePage,showModal,click,submit,summary,close};
}
