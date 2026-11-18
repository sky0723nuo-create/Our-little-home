export function createWellness(ctx){
 const {getState,save,esc,toast,uuid}=ctx;
 let edit=null,filter="all";
 const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");};
 const dateFrom=s=>{const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d,12);};
 const dateText=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
 const records=()=>getState().wellness||[];
 const owners={me:"Me · 我",jason:"Jason",both:"Together · 我们"};
 const categories={skincare:"Skincare · 护肤",hairremoval:"Hair Removal · 脱毛",physio:"Physio & Massage · 理疗按摩",fitness:"Fitness · 健身",other:"Other · 其他个护"};
 function nextDate(i){
  if(!i.lastDone||!i.frequency)return null;
  const d=dateFrom(i.lastDone),n=Number(i.frequency)||1;
  if(i.unit==="months"){
   const t=new Date(d.getFullYear(),d.getMonth()+n,1,12);
   t.setDate(Math.min(d.getDate(),new Date(t.getFullYear(),t.getMonth()+1,0).getDate()));
   return dateText(t);
  }
  d.setDate(d.getDate()+n*(i.unit==="weeks"?7:1));
  return dateText(d);
 }
 function status(i){
  const next=nextDate(i);
  if(!next)return {text:i.lastDone?"Last completed · 已记录":"No date · 待安排",style:"scheduled"};
  const days=Math.round((dateFrom(next)-dateFrom(today()))/86400000);
  if(days<0)return {text:"Overdue · 已逾期",style:"overdue"};
  if(days===0)return {text:"Due today · 今天到期",style:"overdue"};
  if(days<=7)return {text:"Due soon · 即将到期",style:"soon"};
  return {text:"Scheduled · 已安排",style:"scheduled"};
 }
 function page(){
  const all=records();
  const shown=all.filter(i=>filter==="all"||i.owner===filter).sort((a,b)=>(nextDate(a)||"9999").localeCompare(nextDate(b)||"9999"));
  const alerts=all.filter(i=>["overdue","soon"].includes(status(i).style)&&nextDate(i)).length;
  return '<div class="section-head"><h2>Wellness <small>个护与健身</small></h2><button class="primary" data-well="new">＋ Add</button></div>'+
   '<div class="notice">护肤、脱毛、按摩 / Physio、健身训练都可以记录。选择属于谁，并追踪上次完成与下次计划。</div>'+
   '<div class="stat-strip"><span>'+all.length+' routines · 记录</span><span>'+alerts+' upcoming · 近期提醒</span></div>'+
   '<div class="well-tabs">'+[["all","All · 全部"],["me","Me · 我"],["jason","Jason"],["both","Together · 我们"]].map(([key,label])=>'<button data-well="filter" data-key="'+key+'" class="well-tab '+(filter===key?"selected":"")+'">'+label+'</button>').join("")+'</div>'+
   '<div class="panel">'+(shown.length?'<div class="extra-list">'+shown.map(i=>{
     const st=status(i),next=nextDate(i),f=i.frequency>0;
     return '<div class="extra-care"><div class="care-heading"><div class="well-title"><span class="well-category">'+esc(categories[i.category]||categories.other)+'</span><strong>'+esc(i.name)+'</strong></div><span class="care-badge '+st.style+'">'+st.text+'</span></div>'+
      '<div class="task-meta">'+esc(owners[i.owner]||owners.me)+(f?' · Every '+Number(i.frequency)+' '+esc(i.unit):' · One-time / 不定期')+'</div>'+
      '<div class="task-meta">Last · 上次：'+(i.lastDone?esc(i.lastDone):"未记录")+'　Next · 下次：'+(next||"无固定日期")+'</div>'+
      (i.notes?'<div class="task-meta">'+esc(i.notes)+'</div>':"")+
      '<div class="actions" style="margin-top:12px"><button class="primary" data-well="done" data-id="'+i.id+'">✓ Done Today · 今天完成</button><button class="secondary" data-well="edit" data-id="'+i.id+'">Edit · 编辑</button><button class="secondary" data-well="history" data-id="'+i.id+'">History · 历史</button></div></div>';
   }).join("")+'</div>':'<div class="empty">这里还没有记录。试试添加「护肤」或「Jason 的 Physio」。</div>')+'</div>';
 }
 function modalMarkup(){
  if(!edit)return "";
  const item=records().find(i=>i.id===edit.id),historyOnly=edit.type==="history";
  if(historyOnly){
   const entries=[...(item?.history||[])].sort((a,b)=>b.localeCompare(a));
   return '<div class="overlay" id="well-overlay"><div class="modal" role="dialog" aria-modal="true"><h2>'+esc(item?.name||"Wellness")+' · 历史记录</h2>'+
    '<p class="hint">每次点击「今天完成」都会保留日期。修改上次完成日期不会自动生成历史记录。</p>'+
    (entries.length?'<div class="extra-list">'+entries.map((d,ix)=>'<div class="extra-entry"><span class="extra-detail">'+esc(d)+'</span><button class="mini" data-well="remove-history" data-id="'+item.id+'" data-index="'+ix+'">删除</button></div>').join("")+'</div>':'<div class="empty">还没有历史完成记录。</div>')+
    '<div class="modal-actions"><button class="secondary" data-well="close">Close · 关闭</button></div></div></div>';
  }
  const select=(name,value,choices)=>'<select name="'+name+'">'+choices.map(([k,label])=>'<option value="'+k+'" '+(k===value?"selected":"")+'>'+label+'</option>').join("")+'</select>';
  return '<div class="overlay" id="well-overlay"><div class="modal" role="dialog" aria-modal="true"><h2>'+(item?"Edit Wellness":"New Wellness")+' · 个护记录</h2>'+
   '<form class="form" id="wellness-form"><label class="field">Activity / 项目名称 *<input required maxlength="100" name="name" value="'+esc(item?.name||"")+'" placeholder="脱毛 / Skincare / Physio / Gym"></label>'+
   '<label class="field">Who / 属于谁'+select("owner",item?.owner||"me",Object.entries(owners))+'</label>'+
   '<label class="field">Category / 分类'+select("category",item?.category||"skincare",Object.entries(categories))+'</label>'+
   '<label class="field">Last done / 上次完成<input type="date" name="lastDone" value="'+esc(item?.lastDone||"")+'"></label>'+
   '<div class="row"><label class="field">Repeat every / 每隔（0 为不定期）<input type="number" required min="0" max="365" name="frequency" value="'+(item?.frequency??1)+'"></label><label class="field">Unit / 单位'+select("unit",item?.unit||"weeks",[["days","Days · 天"],["weeks","Weeks · 周"],["months","Months · 月"]])+'</label></div>'+
   '<label class="field">Notes / 备注<textarea name="notes" maxlength="500" rows="3" placeholder="使用产品、按摩预约地点、健身内容等">'+esc(item?.notes||"")+'</textarea></label>'+
   '<p class="hint">例如每 3 个月脱毛：填写 3 + Months。健身若不设固定频率可填 0，仍能记录完成历史。</p>'+
   '<div class="modal-actions">'+(item?'<button type="button" class="secondary danger" data-well="delete" data-id="'+item.id+'">Delete</button>':"")+'<button type="button" class="secondary" data-well="close">Cancel</button><button class="primary">Save · 保存</button></div></form></div></div>';
 }
 function show(){document.getElementById("well-overlay")?.remove();if(edit)document.getElementById("app").insertAdjacentHTML("beforeend",modalMarkup());}
 function close(){edit=null;document.getElementById("well-overlay")?.remove();}
 function click(e){
  const b=e.target.closest("[data-well]");
  if(!b){if(e.target.id==="well-overlay"){close();return true;}return false;}
  const {well,id,key,index}=b.dataset,entry=records().find(i=>i.id===id);
  if(well==="filter"){filter=key;save();}
  if(well==="new"||well==="edit"||well==="history"){edit={type:well,id};show();}
  if(well==="close")close();
  if(well==="done"&&entry&&confirm("确认今天完成「"+entry.name+"」？")){
   entry.lastDone=today();entry.history=[...(entry.history||[]),today()];save();toast("已记录完成日期 ♡");
  }
  if(well==="delete"&&entry&&confirm("删除「"+entry.name+"」和它的完成历史？")){
   getState().wellness=records().filter(i=>i.id!==id);close();save();
  }
  if(well==="remove-history"&&entry){
   const sorted=[...(entry.history||[])].sort((a,b)=>b.localeCompare(a));
   const value=sorted[Number(index)];
   if(value&&confirm("删除 "+value+" 的记录？")){
    const idx=entry.history.indexOf(value);if(idx>=0)entry.history.splice(idx,1);show();save();
   }
  }
  return true;
 }
 function submit(e){
  if(e.target.id!=="wellness-form")return false;
  e.preventDefault();
  const fd=new FormData(e.target),name=String(fd.get("name")||"").trim(),frequency=Number(fd.get("frequency")),lastDone=String(fd.get("lastDone")||"");
  if(!name||!Number.isSafeInteger(frequency)||frequency<0||frequency>365||(lastDone&&(!/^\d{4}-\d{2}-\d{2}$/.test(lastDone)||lastDone>today()))){toast("请检查名称、周期和完成日期");return true;}
  const old=records().find(i=>i.id===edit?.id);
  const entry={id:old?.id||uuid(),name,owner:Object.hasOwn(owners,fd.get("owner"))?fd.get("owner"):"me",category:Object.hasOwn(categories,fd.get("category"))?fd.get("category"):"other",frequency,unit:["days","weeks","months"].includes(fd.get("unit"))?fd.get("unit"):"weeks",lastDone,notes:String(fd.get("notes")||"").trim(),history:old?.history||[]};
  getState().wellness=old?records().map(i=>i.id===entry.id?entry:i):[...records(),entry];
  close();save();toast("个护记录已保存");return true;
 }
 const summary=()=>({total:records().length,upcoming:records().filter(i=>nextDate(i)&&["soon","overdue"].includes(status(i).style)).length});
 return {page,show,click,submit,close,summary};
}
