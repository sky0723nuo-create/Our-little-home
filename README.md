# Our Little Home ♡

A warm, mobile-friendly home inventory app for two people.  
两个人的温柔收纳日记：慢慢整理，也能随时找到每一件小东西。

## 1.0 features

- **Nested storage** — 房间 → 柜子 → 抽屉 → 收纳盒（支持任意层级）
- **Inventory** — 添加、编辑、删除物品，数量、单位、分类与备注
- **Search & filters** — 搜索名称、分类、备注和完整位置路径；按位置、分类筛选
- **Unplaced** — 还没整理好的物品放进待整理清单
- **Consumables** — 消耗品数量增减及低库存提醒
- **Move a box** — 修改收纳盒父位置时，内部物品自动显示新的完整路径
- **Backups** — 导出/导入 JSON 备份
- **PWA** — 手机端布局、主屏幕安装配置

## Important: data and sharing

**当前版本使用浏览器 localStorage，数据只保存在当前设备。**
目前没有配置云端数据库，也没有实时同步或账号登录。请不要把当前版本视为两个人实时共享版；清除浏览器数据可能使记录丢失。定期在设置中导出 JSON 备份。

下一阶段将接入 Supabase Auth + Postgres + Row Level Security，为两人提供安全的共享家庭空间。不要将 Supabase service-role key 或其他秘密放进公开仓库或前端代码。

## GitHub Pages deployment

1. Open **Settings → Pages** in this GitHub repository.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Choose **main** and **/(root)**, then **Save**.
4. After GitHub Pages finishes publishing, the site should appear at:
   https://sky0723nuo-create.github.io/Our-little-home/

The site uses relative asset paths, so it works under a GitHub Pages project subpath.

## Local preview

No build step or package installation required. For local development, serve the folder via a simple static server (the browser may restrict storage or some PWA behavior when opened as a file).

```bash
python -m http.server 8000
```

Open http://localhost:8000 in your browser.

## Files

- `index.html` — app entry
- `styles.css` — responsive UI
- `app.js` — storage tree, inventory, filters and local persistence
- `manifest.webmanifest` — installable app metadata
- `icon.svg` — app icon

## Privacy note

This repository is public. Do not commit personal inventories, address details, API secrets or backups.

## HOME V3 development

The development branch is excluded from the automatic Pages publish workflow.
Serve the branch over HTTPS or localhost for review. Use a separate browser
profile when testing with sample data.

The existing Supabase project and its household memberships are reused.
`supabase/home-v3.sql` adds the V3 sync tables and functions in one transaction.
It leaves existing tables and their contents in place. Run the SQL in the
project's SQL Editor before testing cloud sign-in. Existing Auth users must be
linked to `household_members.user_id`. For email links, allowlist the review URL
under Authentication → URL Configuration. Supabase's built-in mailer only sends
to organization members. The existing accounts can also use password sign-in.

In HOME Settings, sign in, review the legacy data counts and choose the default
visibility before confirming the import. Existing Private entries stay private.
Personal care and change history stay private. Storage spaces and the floor plan
are shared with the household. The legacy browser copy is retained.

Import the household's private layout through Inventory → Map → Import layout
and storage spaces. Keep the layout file and its exports out of this repository.
The SVG is displayed as an image. Clickable regions are stored as percentages,
and subcompartments without an exact position are reached through the cabinet
list. New spaces and map coordinates can be edited under Inventory → Storage.

Verification:

- `node --test tests/*.test.mjs`
- Serve the app on port 8765 and run `node tests/browser-smoke.mjs` with
  Playwright installed. Set `HOME_TEST_CHROMIUM` to use a local Chromium binary.
- Run `node tests/home-v3-permissions.mjs` with `@electric-sql/pglite` installed
  to exercise the SQL migration against a disposable database.
- Before publishing, sign in using both household accounts from separate
  browser profiles. Verify Shared edits arrive on both devices, and that each
  Private record and its history only appear for its owner. Try an offline
  edit and reconnect. Review imported browser data and the real layout on a
  phone before merging.
