export function mapBounds(value) {
 const bounds = String(value || "").trim().split(/[\s,]+/).map(Number);
 const [left, top, width, height] = bounds;
 return bounds.length === 4 && bounds.every(Number.isFinite) &&
  left >= 0 && top >= 0 && width > 0 && height > 0 &&
  left + width <= 100 && top + height <= 100 ? bounds : null;
}

export function storageMap({locations, background, selection, ancestors, itemCards, esc}) {
 const chain = ancestors(selection);
 const highlighted = new Set(chain.map(location => location.id));
 const buttons = locations.map(location => {
  const bounds = mapBounds(location.mapBounds?.join(" "));
  if (!bounds) return "";
  const [left, top, width, height] = bounds;
  const label = location.label ? location.label + " · " + location.name : location.name;
  return `<button type="button" class="map-region${highlighted.has(location.id) ? " map-highlight" : ""}"
   style="left:${left}%;top:${top}%;width:${width}%;height:${height}%"
   data-act="map-select" data-id="${esc(location.id)}" aria-label="${esc(label)}"
   aria-pressed="${location.id === selection}">${background ? "" : esc(location.label || location.name)}</button>`;
 }).join("");
 const validBackground = /^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(background || "");
 const selected = chain.at(-1);
 const image = validBackground ? `<img src="${esc(background)}" alt="Floor plan · 家庭布局">` : "";
 const choices = locations.map(location =>
  `<option value="${esc(location.id)}" ${location.id === selection ? "selected" : ""}>${esc(ancestors(location.id).map(part => [part.label, part.name].filter(Boolean).join(" ")).join(" → "))}</option>`
 ).join("");
 return `<div class="section-head"><h2>Storage Map · 收纳地图</h2><button class="secondary" data-act="nav" data-view="locations">管理位置</button></div>
  <div class="panel">
   <div class="toolbar"><label class="field">跳到收纳位置<select id="map-location"><option value="">选择位置</option>${choices}</select></label>
   <button type="button" class="secondary" data-act="map-import">导入户型图</button>
   <button type="button" class="secondary" data-act="map-import-layout">导入户型与柜体</button>
   <input id="map-layout-file" type="file" accept=".json,application/json" hidden>
   <input id="map-file" type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" hidden></div>
   ${image || buttons ? `<div class="storage-map">${image}${buttons}</div>` : '<p class="hint">导入户型图后，可在收纳位置里给房间和柜子设置可点击区域。</p>'}
   ${selected ? `<div class="section-head"><h2>${esc(chain.map(part => [part.label, part.name].filter(Boolean).join(" ")).join(" → "))}</h2>
    <button class="primary" data-act="add-item" data-location="${esc(selected.id)}">＋ 添加物品</button></div>
    <div class="toolbar"><button class="secondary" data-act="edit-location" data-id="${esc(selected.id)}">编辑位置</button>
    <button class="secondary" data-act="add-location" data-parent="${esc(selected.id)}">＋ 子位置</button>
    ${locations.filter(location => location.parentId === selected.id).map(location =>
     `<button class="secondary" data-act="map-select" data-id="${esc(location.id)}">${esc(location.label || location.name)}</button>`
    ).join("")}</div>${itemCards || '<p class="hint">此位置还没有物品。</p>'}` : ""}
  </div>`;
}

export function readLayout(raw) {
 if (raw?.format !== "home-v3-layout" || !Array.isArray(raw.locations) ||
  !/^data:image\/(?:svg\+xml|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(raw.floorPlan||"")) {
  throw new Error("户型文件格式不正确");
 }
 const ids = new Set();
 const locations = raw.locations.map(location=>{
  const {id,parentId,name,label,icon} = location;
  if (typeof id!=="string" || !/^[-a-zA-Z0-9_]{1,120}$/.test(id||"") || ids.has(id) || typeof name!=="string" || !name.trim() ||
   (parentId&&!ids.has(parentId))) throw new Error("收纳位置或父级无效");
  const bounds = Array.isArray(location.mapBounds) ? mapBounds(location.mapBounds.join(" ")) : null;
  if (location.mapBounds && !bounds) throw new Error("户型坐标无效");
  ids.add(id);
  return {id,parentId:parentId||null,name,label:String(label||""),icon:String(icon||"📦"),mapBounds:bounds};
 });
 return {floorPlan:raw.floorPlan,locations};
}
