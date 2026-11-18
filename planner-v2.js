
/* HOME V2.1 — on-device planner, pets and scheduled deliveries.
 * Account sharing and push notifications are intentionally not enabled in this release.
 */
export function createPlanner(ctx){
 const {getState,save,esc,toast,uuid}=ctx;
 let dialog=null,section="admin",scope="mine",showAll=false,petSelected=null;
 const state=()=>getState();
 const records=()=>state().tasks||[];
 const cats=()=>state().pets||[];
 const deliveries=()=>state().subscriptions||[];
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const dateOf=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);};
 const stringDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(dateOf(s).getTime())&&stringDate(dateOf(s))===s;
 function advance(base,n,unit){
  if(!base||!validDate(base))return "";
  const d=dateOf(base);
  if(unit==="months"||unit==="years"){
   const target=new Date(d.getFullYear()+(unit==="years"?n:0),d.getMonth()+(unit==="months"?n:0),1,12);
   target.setDate(Math.min(d.getDate(),new Date(target.getFullYear(),target.getMonth()+1,0).getDate()));
   return stringDate(target);
  }
  d.setDate(d.getDate()+n*(unit==="weeks"?7:1));return stringDate(d);
 }
 function taskNext(t){
  if(t.deletedAt||t.done&&!t.repeat)return "";
  if(!t.repeat)return t.due||"";
  return t.due||t.lastDone&&advance(t.lastDone,t.every||1,t.unit||"months")||"";
 }
 function status(t){
  const d=taskNext(t);if(!d)return {label:"Anytime",cls:"scheduled"};
  const gap=Math.round((dateOf(d)-dateOf(today()))/86400000);
  return gap<0?{label:"Overdue",cls:"overdue"}:gap===0?{label:"Today",cls:"overdue"}:gap<=7?{label:"Due soon",cls:"soon"}:{label:"Scheduled",cls:"scheduled"};
 }
 function ownerLabel(owner){return {me:"Me",jason:"Jason",together:"Together"}[owner]||"Together";}
 function visible(t){return t.visibility!=="private"||t.owner==="me";}
 function myTask(t){return t.owner==="me"||t.owner==="together";}
 function upcoming(all=false,limit=5){
  const list=records().filter(t=>!t.deletedAt&&!t.done&&visible(t)&&(!(!all&&!myTask(t)))&&taskNext(t));
  list.sort((a,b)=>(taskNext(a)||"9999").localeCompare(taskNext(b)||"9999"));
  const boundary=advance(today(),7,"days");
  return list.filter(t=>taskNext(t)<=boundary).slice(0,limit);
 }
 const tasksLink=(t)=>{
  if(t.linkType==="item"){const item=state().items.find(i=>i.id===t.linkId);return item?"📦 "+item.name:"Item removed";}
  if(t.linkType==="location"){const loc=state().locations.find(i=>i.id===t.linkId);return loc?"📍 "+loc.name:"Location removed";}
  if(t.linkType==="pet"){const pet=cats().find(i=>i.id===t.linkId);return pet?"🐾 "+pet.name:"Cat removed";}
  return "";
 };
 function taskCard(t){
  const d=taskNext(t),s=status(t);
  return '<div class="v2-task"><button class="v2-task-done" data-v2="done-task" data-id="'+t.id+'" aria-label="完成 '+esc(t.name)+'">✓</button><div class="v2-task-body"><strong>'+esc(t.name)+'</strong><div class="task-meta">'+esc({admin:"Life Admin",care:"Home Care",wellness:"Wellness",pets:"Pets"}[t.category]||"Life Admin")+' · '+ownerLabel(t.owner)+(d?" · "+esc(d):"")+'</div>'+
   (tasksLink(t)?'<div class="task-meta">'+esc(tasksLink(t))+'</div>':"")+'</div><span class="care-badge '+s.cls+'">'+s.label+'</span><button class="mini" data-v2="edit-task" data-id="'+t.id+'">Edit</button></div>';
 }
 function upcomingWidget(){
  const items=upcoming(scope==="all",5);
  return '<section class="v2-upcoming"><div class="section-head"><h2>Upcoming <small>近期提醒</small></h2><button class="secondary" data-act="nav" data-view="planner">See All</button></div>'+
   '<div class="v2-tabs"><button data-v2="scope" data-value="mine" class="'+(scope==="mine"?"selected":"")+'">For Me · 与我有关</button><button data-v2="scope" data-value="all" class="'+(scope==="all"?"selected":"")+'">All · 全部</button></div>'+
   (items.length?items.map(taskCard).join(""):'<div class="v2-calm">All caught up ♡<small>未来七天没有需要处理的计划。</small></div>')+'</section>';
 }
 const option=(value,label,chosen)=>'<option value="'+esc(value)+'" '+(value===chosen?"selected":"")+'>'+esc(label)+'</option>';
 function linkSelect(selectedType="",selectedId=""){
  const items=state().items.map(i=>option("item:"+i.id,"📦 "+i.name,""+selectedType+":"+selectedId));
  const loc=state().locations.map(i=>option("location:"+i.id,"📍 "+i.name,""+selectedType+":"+selectedId));
  const pets=cats().map(i=>option("pet:"+i.id,"🐾 "+i.name,""+selectedType+":"+selectedId));
  return '<select name="link"><option value="">None · 不关联</option><optgroup label="Items · 物品">'+items.join("")+'</optgroup><optgroup label="Locations · 房间与位置">'+loc.join("")+'</optgroup><optgroup label="Cats · 猫咪">'+pets.join("")+'</optgroup></select>';
 }
 function taskModal(t){
  const owner=t?.owner||"together",visibility=t?.visibility||"shared";
  return '<h2>'+(t?"Edit Task":"New Task")+' · 生活计划</h2><form class="form" id="v2-task-form">'+
   '<label class="field">Task · 事项名称 *<input required name="name" maxlength="100" placeholder="Pay parking fine / Clean washing machine" value="'+esc(t?.name||"")+'"></label>'+
   '<label class="field">Due Date · 日期（选填）<input type="date" name="due" value="'+esc(t?.due||"")+'"></label>'+
   '<label class="field">Assigned to · 负责人<select name="owner">'+[["me","Me · 我"],["jason","Jason"],["together","Together · 我们"]].map(([v,l])=>option(v,l,owner)).join("")+'</select></label>'+
   '<details class="v2-more" '+(t?"open":"")+'><summary>More Options · 更多选项</summary>'+
   '<label class="field">Category · 类型<select name="category">'+[["admin","Life Admin · 生活事务"],["care","Home Care · 家务维护"],["wellness","Wellness · 个人护理"],["pets","Pets · 宠物护理"]].map(([v,l])=>option(v,l,t?.category||"admin")).join("")+'</select></label>'+
   '<label class="field">Priority · 优先级<select name="priority">'+[["normal","Normal · 普通"],["important","Important · 重要"],["urgent","Urgent · 紧急"]].map(([v,l])=>option(v,l,t?.priority||"normal")).join("")+'</select></label>'+
   '<label class="field">Visibility · 可见范围<select name="visibility">'+[["shared","Shared · 共享"],["private","Private · 私人（本机标签）"]].map(([v,l])=>option(v,l,visibility)).join("")+'</select></label>'+
   '<label class="v2-checkbox"><input type="checkbox" name="repeat" '+(t?.repeat?"checked":"")+'> Repeat · 定期重复</label>'+
   '<div class="row"><label class="field">Every · 每隔<input type="number" name="every" min="1" max="365" value="'+(t?.every||3)+'"></label><label class="field">Unit · 单位<select name="unit">'+[["days","Days · 天"],["weeks","Weeks · 周"],["months","Months · 月"],["years","Years · 年"]].map(([v,l])=>option(v,l,t?.unit||"months")).join("")+'</select></label></div>'+
   '<label class="field">Next date calculation · 下次日期规则<select name="repeatMode">'+[["after","After completion · 按实际完成日期"],["fixed","Fixed schedule · 按固定计划"]].map(([v,l])=>option(v,l,t?.repeatMode||"after")).join("")+'</select></label>'+
   '<label class="field">Link to · 关联物品/房间/猫咪（选填）'+linkSelect(t?.linkType,t?.linkId)+'</label>'+
   '<label class="field">Notes · 备注<textarea name="notes" maxlength="1000" rows="3">'+esc(t?.notes||"")+'</textarea></label>'+
   '<p class="hint">V2.1 尚未启用真实双人账号和私密数据隔离，Private 当前仅为本机分类标签。</p></details>'+
   '<div class="modal-actions">'+(t?'<button type="button" class="secondary danger" data-v2="delete-task" data-id="'+t.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-v2="close">Cancel</button><button class="primary" type="submit">Save · 保存</button></div></form>';
 }
 function plannerPage(){
  const tabs=[["admin","Life Admin","生活事务"],["care","Home Care","家务"],["wellness","Wellness","个护"],["pets","Pets","猫咪"]];
  return '<div class="section-head"><h2>Planner <small>我们的生活计划</small></h2><button class="primary" data-v2="new-task">＋ Add Task</button></div>'+
   '<div class="v2-tabs planner-tabs">'+tabs.map(([id,en,zh])=>'<button class="'+(section===id?"selected":"")+'" data-v2="section" data-value="'+id+'">'+en+'<small>'+zh+'</small></button>').join("")+'</div>'+
   (section==="pets"?petPage():section==="wellness"?'<div class="notice">个护既可在原有 Wellness 页面记录，也可以在此创建带日期与负责人的计划。</div>'+taskSection("wellness")+'<div class="actions"><button class="secondary" data-act="nav" data-view="wellness">Open Wellness Records · 旧版个护记录</button></div>':section==="care"?'<div class="notice">原有 Home Care 记录仍然保留，下方同时展示新建的家务计划。</div>'+taskSection("care")+'<div class="actions"><button class="secondary" data-act="nav" data-view="chores">Open Home Care Records · 旧版家务记录</button></div>':taskSection("admin"));
 }
 function taskSection(category){
  const all=records().filter(t=>!t.deletedAt&&visible(t)&&t.category===category);
  const open=all.filter(t=>!t.done).sort((a,b)=>(taskNext(a)||"9999").localeCompare(taskNext(b)||"9999"));
  const done=all.filter(t=>t.done);
  return '<div class="section-head"><h2>To Do <small>待完成 '+open.length+'</small></h2></div>'+
   (open.length?open.map(taskCard).join(""):'<div class="v2-calm">没有待完成的事项 ♡</div>')+
   '<details class="v2-more"><summary>Completed · 已完成 ('+done.length+')</summary>'+(done.length?done.map(t=>'<div class="v2-task"><div class="v2-task-body"><strong>'+esc(t.name)+'</strong><div class="task-meta">Completed '+esc(t.completedAt||"")+'</div></div><button class="mini" data-v2="edit-task" data-id="'+t.id+'">Edit</button></div>').join(""):'<p class="hint">暂无完成记录</p>')+'</details>';
 }
 function inventoryPage(){
  const low=state().items.filter(i=>i.consumable&&Number(i.quantity)<=Number(i.minQuantity||0)).length;
  return '<div class="section-head"><h2>Inventory <small>家庭物品与收纳</small></h2><button class="primary" data-act="add-item">＋ Add Item</button></div>'+
   '<div class="tiles v2-inventory-grid">'+[["items","inventory","Items","全部物品"],["locations","storage","Storage","房间、柜子与盒子"],["stock","supplies","Supplies","消耗品与库存"],["unplaced","sort","To Sort","待整理物品"]].map(([v,ic,en,cn])=>'<button class="tile" data-act="nav" data-view="'+v+'"><span class="tile-icon">'+ctx.icon(ic)+'</span><strong>'+en+'</strong><span class="tile-description">'+cn+'</span></button>').join("")+'</div>'+
   (low?'<div class="notice">有 '+low+' 种消耗品达到低库存阈值。</div>':"");
 }
 function petPage(){
  if(petSelected)return catDetail(petSelected);
  return '<div class="section-head"><h2>Our Cats ♡ <small>两只小成员</small></h2><button class="primary" data-v2="new-pet">＋ Add Cat</button></div>'+
   '<div class="v2-cat-grid">'+cats().map(i=>'<button class="v2-cat-card" data-v2="open-pet" data-id="'+i.id+'"><span class="v2-cat-icon">🐱</span><strong>'+esc(i.name)+'</strong><small>'+esc(i.birthday||"Profile · Health · Care")+'</small></button>').join("")+(cats().length===0?'<div class="v2-calm">先添加第一只猫咪的档案 ♡</div>':"")+'</div>'+
   '<div class="notice">记录洗澡、健康检查、体重和兽医建议的复查日期。猫粮、猫砂配送统一在 Shopping → Subscriptions 管理。</div>';
 }
 function catDetail(id){
  const cat=cats().find(i=>i.id===id);
  if(!cat){petSelected=null;return petPage();}
  const health=(state().petRecords||[]).filter(x=>x.petId===id&&!x.deletedAt).sort((a,b)=>b.date.localeCompare(a.date));
  return '<div class="section-head"><h2>🐱 '+esc(cat.name)+' <small>Cat Profile</small></h2><button class="secondary" data-v2="back-pets">← All Cats</button></div>'+
   '<div class="panel"><div class="task-meta">Birthday · '+esc(cat.birthday||"未填写")+' · '+esc(cat.sex||"未设置")+'</div>'+
   (cat.microchip?'<div class="task-meta">Microchip · '+esc(cat.microchip)+'</div>':"")+
   (cat.notes?'<p class="hint">'+esc(cat.notes)+'</p>':"")+
   '<div class="actions"><button class="secondary" data-v2="edit-pet" data-id="'+id+'">Edit Profile</button><button class="primary" data-v2="new-pet-record" data-id="'+id+'">＋ Add Record</button></div></div>'+
   '<div class="section-head"><h2>Health & Care <small>健康与护理记录</small></h2></div>'+
   (health.length?health.map(r=>'<div class="extra-care"><div class="care-heading"><strong>'+esc({bath:"Bath · 洗澡",check:"Health Check · 健康检查",weight:"Weight · 体重",vet:"Vet · 兽医就诊",care:"Grooming · 日常护理"}[r.type]||"Care")+'</strong><span class="task-meta">'+esc(r.date)+'</span></div>'+
    (r.weight?'<div class="task-meta">Weight: '+Number(r.weight)+' kg</div>':"")+(r.notes?'<div class="task-meta">'+esc(r.notes)+'</div>':"")+(r.nextDate?'<div class="task-meta">Next check · 下次：'+esc(r.nextDate)+'</div>':"")+
    '<div class="actions"><button class="mini" data-v2="edit-pet-record" data-id="'+r.id+'">Edit</button></div></div>').join(""):'<div class="v2-calm">还没有记录。可以先添加上次洗澡或体检日期。</div>');
 }
 function petModal(cat){
  return '<h2>'+(cat?"Edit Cat":"Add Cat")+' · 猫咪档案</h2><form class="form" id="v2-pet-form">'+
   '<label class="field">Name · 名字 *<input name="name" required maxlength="70" value="'+esc(cat?.name||"")+'"></label>'+
   '<label class="field">Birthday · 生日（选填）<input name="birthday" type="date" value="'+esc(cat?.birthday||"")+'"></label>'+
   '<label class="field">Sex · 性别<select name="sex">'+[["","未设置"],["female","Female"],["male","Male"]].map(([v,l])=>option(v,l,cat?.sex||"")).join("")+'</select></label>'+
   '<label class="v2-checkbox"><input type="checkbox" name="neutered" '+(cat?.neutered?"checked":"")+'> Neutered · 已绝育</label>'+
   '<label class="field">Microchip · 芯片号（选填）<input name="microchip" maxlength="60" value="'+esc(cat?.microchip||"")+'"></label>'+
   '<label class="field">Notes · 备注<textarea name="notes" maxlength="1000" rows="3">'+esc(cat?.notes||"")+'</textarea></label>'+
   '<div class="modal-actions">'+(cat?'<button type="button" class="secondary danger" data-v2="delete-pet" data-id="'+cat.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-v2="close">Cancel</button><button class="primary">Save</button></div></form>';
 }
 function petRecordModal(r,petId){
  return '<h2>'+(r?"Edit Record":"Add Record")+' · 健康护理</h2><form class="form" id="v2-pet-record-form">'+
   '<label class="field">Type · 类型<select name="type">'+[["bath","Bath · 洗澡"],["check","Health Check · 健康检查"],["weight","Weight · 体重"],["vet","Vet Visit · 看兽医"],["care","Grooming · 其他护理"]].map(([v,l])=>option(v,l,r?.type||"bath")).join("")+'</select></label>'+
   '<label class="field">Date · 日期 *<input type="date" required name="date" value="'+esc(r?.date||today())+'"></label>'+
   '<label class="field">Weight (kg) · 体重（选填）<input type="number" name="weight" min="0.1" max="100" step="0.01" value="'+(r?.weight||"")+'"></label>'+
   '<label class="field">Next Date · 下次预约/计划（选填）<input type="date" name="nextDate" value="'+esc(r?.nextDate||"")+'"></label>'+
   '<label class="field">Results / Vet Notes · 结果与备注<textarea name="notes" maxlength="2000" rows="4">'+esc(r?.notes||"")+'</textarea></label>'+
   '<p class="hint">下次检查日期请按照兽医建议自行设置，HOME 不推断医疗周期。</p>'+
   '<div class="modal-actions">'+(r?'<button class="secondary danger" type="button" data-v2="delete-pet-record" data-id="'+r.id+'">Delete</button>':"")+'<button class="secondary" type="button" data-v2="close">Cancel</button><button class="primary">Save</button></div></form>';
 }
 function subscriptionPage(){
  const list=deliveries().filter(x=>!x.deletedAt);
  return '<div class="section-head"><h2>Subscriptions <small>定期配送</small></h2><button class="primary" data-v2="new-sub">＋ Add Plan</button></div>'+
  '<div class="notice">猫粮和猫砂的定期配送在这里管理。只有实际收到货并确认入库后，才会增加物品库存。</div>'+
  (list.length?list.map(s=>{
   const item=state().items.find(x=>x.id===s.itemId);
   return '<div class="extra-care"><div class="care-heading"><strong>'+esc(s.name)+'</strong><span class="care-badge">'+esc(s.status||"active")+'</span></div>'+
    '<div class="task-meta">Every '+Number(s.every||1)+' '+esc(s.unit||"weeks")+' · Next: '+esc(s.nextDate||"未设置")+'</div>'+
    '<div class="task-meta">Delivery: '+Number(s.quantity||1)+' '+esc(s.unitName||"件")+' · Inventory: '+esc(item?.name||"未关联物品")+'</div>'+
    (s.vendor?'<div class="task-meta">Supplier: '+esc(s.vendor)+'</div>':"")+
    '<div class="actions" style="margin-top:12px">'+(s.status==="active"?'<button class="primary" data-v2="receive-sub" data-id="'+s.id+'">✓ Mark as Received</button>':"")+'<button class="secondary" data-v2="edit-sub" data-id="'+s.id+'">Edit Plan</button><button class="secondary" data-v2="sub-history" data-id="'+s.id+'">History</button></div></div>';
  }).join(""):'<div class="v2-calm">还没有定期配送。可以添加猫粮或猫砂订阅。</div>');
 }
 function subscriptionModal(s){
  return '<h2>'+(s?"Edit Subscription":"New Subscription")+' · 定期配送</h2><form class="form" id="v2-sub-form">'+
   '<label class="field">Name · 商品名称 *<input name="name" maxlength="100" required value="'+esc(s?.name||"")+'" placeholder="Cat Food / 猫砂"></label>'+
   '<label class="field">Supplier · 商家<input name="vendor" maxlength="100" value="'+esc(s?.vendor||"")+'"></label>'+
   '<label class="field">Inventory Link · 关联库存（选填）<select name="itemId"><option value="">None · 暂不关联</option>'+state().items.map(i=>option(i.id,i.name,s?.itemId||"")).join("")+'</select></label>'+
   '<div class="row"><label class="field">Delivery quantity · 每次数量<input type="number" min="1" max="99999" required name="quantity" value="'+(s?.quantity||1)+'"></label><label class="field">Unit · 单位<input name="unitName" maxlength="20" value="'+esc(s?.unitName||"包")+'"></label></div>'+
   '<div class="row"><label class="field">Every · 每隔<input type="number" min="1" max="365" required name="every" value="'+(s?.every||4)+'"></label><label class="field">Period · 周期<select name="unit">'+[["days","Days"],["weeks","Weeks"],["months","Months"]].map(([v,l])=>option(v,l,s?.unit||"weeks")).join("")+'</select></label></div>'+
   '<label class="field">Next Scheduled Delivery · 下次预计配送<input name="nextDate" type="date" value="'+esc(s?.nextDate||"")+'"></label>'+
   '<label class="field">Status · 订阅状态<select name="status">'+[["active","Active · 正常"],["paused","Paused · 暂停"],["cancelled","Cancelled · 已取消"]].map(([v,l])=>option(v,l,s?.status||"active")).join("")+'</select></label>'+
   '<div class="modal-actions">'+(s?'<button class="secondary danger" type="button" data-v2="delete-sub" data-id="'+s.id+'">Delete</button>':"")+'<button class="secondary" type="button" data-v2="close">Cancel</button><button class="primary">Save</button></div></form>';
 }
 function receiveModal(s){
  const item=state().items.find(i=>i.id===s.itemId);
  return '<h2>Confirm Delivery · 确认收货</h2><form class="form" id="v2-receive-form">'+
   '<p class="hint">'+esc(s.name)+' · '+esc(s.vendor||"")+'</p>'+
   '<label class="field">Received Date · 实际到货日<input name="receivedDate" required type="date" value="'+today()+'"></label>'+
   '<label class="field">Actual quantity · 实际收货数量<input name="quantity" min="0" max="99999" required type="number" value="'+Number(s.quantity||1)+'"></label>'+
   '<p class="hint">'+(item?'确认后会给 '+esc(item.name)+' 增加实际收到的数量。':'未关联库存物品，确认后只记录收货，不修改 Inventory。')+'</p>'+
   '<div class="modal-actions"><button class="secondary" type="button" data-v2="close">Cancel</button><button class="primary">Confirm Received · 收货入库</button></div></form>';
 }
 function historyModal(s){
  const entries=(s.history||[]).slice().reverse();
  return '<h2>'+esc(s.name)+' · 收货历史</h2>'+(entries.length?entries.map(x=>'<div class="extra-care"><strong>'+esc(x.receivedDate)+'</strong><div class="task-meta">Received: '+Number(x.quantity)+' · Inventory added: '+(x.stockUpdated?"Yes":"No")+'</div></div>').join(""):'<div class="v2-calm">尚无收货记录</div>')+'<div class="modal-actions"><button class="secondary" data-v2="close">Close</button></div>';
 }
 function modalMarkup(){
  if(!dialog)return "";
  const x=dialog.id;
  const content=dialog.type==="task"?taskModal(records().find(t=>t.id===x)):
  dialog.type==="pet"?petModal(cats().find(t=>t.id===x)):
  dialog.type==="pet-record"?petRecordModal((state().petRecords||[]).find(t=>t.id===x),dialog.petId):
  dialog.type==="sub"?subscriptionModal(deliveries().find(t=>t.id===x)):
  dialog.type==="receive"?receiveModal(deliveries().find(t=>t.id===x)):
  dialog.type==="sub-history"?historyModal(deliveries().find(t=>t.id===x)):"";
  return '<div class="overlay" id="v2-overlay"><div class="modal v2-modal" role="dialog" aria-modal="true">'+content+'</div></div>';
 }
 function show(){document.getElementById("v2-overlay")?.remove();if(dialog)document.getElementById("app").insertAdjacentHTML("beforeend",modalMarkup());}
 function open(type,id="",petId=""){dialog={type,id,petId};show();}
 function close(){dialog=null;document.getElementById("v2-overlay")?.remove();}
 function completeTask(t){
  const now=today();
  if(t.priority!=="normal"&&!confirm("确认「"+t.name+"」已经完成了吗？"))return;
  t.history=[...(t.history||[]),{id:uuid(),date:now,action:"completed",by:"me"}];
  t.lastDone=now;
  if(!t.repeat){t.done=true;t.completedAt=now;}
  else if(t.repeatMode==="fixed"){
   const base=t.due||now;
   const candidate=advance(base,Number(t.every)||1,t.unit||"months");
   t.due=candidate||advance(now,Number(t.every)||1,t.unit||"months");
  }else t.due=advance(now,Number(t.every)||1,t.unit||"months");
  save();toast("完成已记录 ♡");
 }
 function click(e){
  const b=e.target.closest("[data-v2]");
  if(!b){if(e.target.id==="v2-overlay"){close();return true;}return false;}
  const {v2,id,value}=b.dataset;
  if(v2==="scope"){scope=value;save();}
  if(v2==="section"){section=value;petSelected=null;save();}
  if(v2==="new-task")open("task");
  if(v2==="edit-task")open("task",id);
  if(v2==="done-task"){const t=records().find(i=>i.id===id);if(t)completeTask(t);}
  if(v2==="new-pet")open("pet");
  if(v2==="edit-pet")open("pet",id);
  if(v2==="open-pet"){petSelected=id;save();}
  if(v2==="back-pets"){petSelected=null;save();}
  if(v2==="new-pet-record")open("pet-record","",id);
  if(v2==="edit-pet-record"){const r=(state().petRecords||[]).find(i=>i.id===id);if(r)open("pet-record",id,r.petId);}
  if(v2==="new-sub")open("sub");
  if(v2==="edit-sub")open("sub",id);
  if(v2==="receive-sub")open("receive",id);
  if(v2==="sub-history")open("sub-history",id);
  if(v2==="close")close();
  if(v2==="delete-task"||v2==="delete-pet"||v2==="delete-pet-record"||v2==="delete-sub"){
   const key={"delete-task":"tasks","delete-pet":"pets","delete-pet-record":"petRecords","delete-sub":"subscriptions"}[v2];
   const item=(state()[key]||[]).find(x=>x.id===id);
   if(item&&confirm("移到最近删除？可以在设置里恢复。")){
    item.deletedAt=new Date().toISOString();state().activity=[...(state().activity||[]),{id:uuid(),type:"delete",collection:key,recordId:id,at:item.deletedAt}];
    if(v2==="delete-pet")petSelected=null;close();save();
   }
  }
  if(v2==="restore"){
   const [key,recordId]=id.split("|"),entry=(state()[key]||[]).find(x=>x.id===recordId);
   if(entry){delete entry.deletedAt;save();toast("已恢复");}
  }
  return true;
 }
 function submit(e){
  const target=e.target.id;
  if(!["v2-task-form","v2-pet-form","v2-pet-record-form","v2-sub-form","v2-receive-form"].includes(target))return false;
  e.preventDefault();
  const f=new FormData(e.target),name=String(f.get("name")||"").trim();
  const collection=target==="v2-task-form"?"tasks":target==="v2-pet-form"?"pets":target==="v2-pet-record-form"?"petRecords":"subscriptions";
  const old=(state()[collection]||[]).find(x=>x.id===dialog?.id);
  let row;
  if(target==="v2-task-form"){
   const due=String(f.get("due")||""),repeat=f.has("repeat"),every=Number(f.get("every")),owner=String(f.get("owner")),visibility=String(f.get("visibility")),link=String(f.get("link")||"");
   if(!name||(due&&!validDate(due))||!Number.isInteger(every)||every<1||every>365){toast("请检查任务名称、日期和周期");return true;}
   if(visibility==="private"&&owner!=="me"){toast("私人任务只能分配给自己");return true;}
   const [linkType,...pieces]=link.split(":");
   row={...old,id:old?.id||uuid(),name,due,owner,visibility,category:String(f.get("category")),priority:String(f.get("priority")),repeat,every,unit:String(f.get("unit")),repeatMode:String(f.get("repeatMode")),linkType:link?linkType:"",linkId:link?pieces.join(":"):"",notes:String(f.get("notes")||"").trim(),history:old?.history||[],done:old?.done||false};
  }else if(target==="v2-pet-form"){
   if(!name){toast("请填写猫咪名字");return true;}
   row={...old,id:old?.id||uuid(),name,birthday:String(f.get("birthday")||""),sex:String(f.get("sex")||""),neutered:f.has("neutered"),microchip:String(f.get("microchip")||"").trim(),notes:String(f.get("notes")||"").trim()};
  }else if(target==="v2-pet-record-form"){
   const date=String(f.get("date")||""),nextDate=String(f.get("nextDate")||""),weightStr=String(f.get("weight")||"").trim(),weight=weightStr?Number(weightStr):null;
   if(!validDate(date)||(nextDate&&!validDate(nextDate))||(weight!==null&&(!Number.isFinite(weight)||weight<=0||weight>100))){toast("请检查日期或体重");return true;}
   row={...old,id:old?.id||uuid(),petId:dialog.petId,type:String(f.get("type")),date,nextDate,weight,notes:String(f.get("notes")||"").trim()};
  }else if(target==="v2-sub-form"){
   const quantity=Number(f.get("quantity")),every=Number(f.get("every")),nextDate=String(f.get("nextDate")||"");
   if(!name||!Number.isInteger(quantity)||quantity<1||quantity>99999||!Number.isInteger(every)||every<1||every>365||(nextDate&&!validDate(nextDate))){toast("请检查配送数量、周期和日期");return true;}
   row={...old,id:old?.id||uuid(),name,vendor:String(f.get("vendor")||"").trim(),itemId:String(f.get("itemId")||""),quantity,unitName:String(f.get("unitName")||"件").trim(),every,unit:String(f.get("unit")),nextDate,status:String(f.get("status")),history:old?.history||[]};
  }else{
   const sub=deliveries().find(x=>x.id===dialog?.id),quantity=Number(f.get("quantity")),receivedDate=String(f.get("receivedDate")||"");
   if(!sub||!Number.isInteger(quantity)||quantity<0||quantity>99999||!validDate(receivedDate)){toast("请检查实际收货日期和数量");return true;}
   const receiptId=uuid(),item=state().items.find(x=>x.id===sub.itemId);
   sub.history=[...(sub.history||[]),{id:receiptId,receivedDate,quantity,stockUpdated:!!item}];
   if(item&&quantity>0){item.quantity=Math.max(0,Number(item.quantity)||0)+quantity;item.updatedAt=new Date().toISOString();state().history=[...(state().history||[]),{type:"subscription-received",itemId:item.id,delta:quantity,receiptId,date:receivedDate}];}
   if(sub.nextDate)sub.nextDate=advance(sub.nextDate,Number(sub.every)||1,sub.unit||"weeks");
   else sub.nextDate=advance(receivedDate,Number(sub.every)||1,sub.unit||"weeks");
   close();save();toast("收货已记录，库存已更新");return true;
  }
  state()[collection]=old?state()[collection].map(x=>x.id===row.id?row:x):[...(state()[collection]||[]),row];
  close();save();toast("保存成功 ♡");return true;
 }
 function trashPage(){
  const types={tasks:"Task",pets:"Cat",petRecords:"Pet Record",subscriptions:"Subscription",items:"Item"};
  const all=Object.keys(types).flatMap(key=>(state()[key]||[]).filter(x=>x.deletedAt).map(x=>({key,...x}))).sort((a,b)=>b.deletedAt.localeCompare(a.deletedAt));
  return '<div class="section-head"><h2>Recently Deleted <small>最近删除</small></h2></div>'+
  '<div class="notice">删除的项目会保留在本机，支持手动恢复。V2.1 不自动永久清除；云端回收站和定期清理将在后续阶段实现。</div>'+
  (all.length?all.map(x=>'<div class="extra-entry"><div class="extra-detail"><strong>'+esc(x.name||x.type||"记录")+'</strong><div class="task-meta">'+types[x.key]+' · '+esc(x.deletedAt.slice(0,10))+'</div></div><button class="secondary" data-v2="restore" data-id="'+x.key+'|'+x.id+'">Restore · 恢复</button></div>').join(""):'<div class="v2-calm">最近没有删除的记录</div>');
 }
 const summary=()=>({tasks:records().filter(x=>!x.deletedAt&&!x.done).length,pets:cats().filter(x=>!x.deletedAt).length,subs:deliveries().filter(x=>!x.deletedAt&&x.status==="active").length});
 return {upcomingWidget,inventoryPage,plannerPage,subscriptionPage,trashPage,summary,show,close,click,submit,open,section:set=>{section=set;petSelected=null;}};
}
