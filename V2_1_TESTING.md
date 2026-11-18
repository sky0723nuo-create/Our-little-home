# HOME V2.1 — Preview / 开发验收说明

**Branch:** `feature/home-v2-1`. Keep production `main` unchanged until the preview passes browser/device testing.

## Implemented in this branch

- Five bottom entries: Home, Inventory, Add, Planner, Shopping.
- Header Home shortcut next to Settings.
- Home dashboard with For Me / All, upcoming tasks (including legacy routines, pet record dates and scheduled deliveries), quick stats and Explore.
- Existing nested locations, inventory, stock, shopping list, home care, and wellness screens are still accessible.
- Life Admin / Home Care / Wellness / Pets tabs inside Planner.
- New tasks: due date, owner, category, priority, optional repeat, fixed/after-completion cycle, optional linked item/location/pet, notes, completed history.
- Cat profiles, individual health/bath/vet/weight records, optional next-appointment dates.
- Shopping subscriptions: supplier, periodic date, item link, receipt confirmation and stock increment, receipts history, paused/cancelled.
- Local JSON backup and import includes the newly added collections.
- Recently Deleted/Restore for newly added tasks, pets, pet records and subscriptions.

## Important limitations (planned for V2.2/V2.3)

- **No real shared accounts or privacy enforcement yet.** `Me`/`Jason`/Private are local labels only, and all data is currently stored in the same browser localStorage.
- **No live cloud sync, offline multi-device conflict handling or mobile push** in this version.
- Existing legacy shopping, Home Care, and Wellness screens remain separate rather than having their records migrated to the unified task model; this preserves historical data. The upcoming preview aggregates due dates.
- Current receipt double-confirmation guard prevents a second confirmation on the same calendar day, but cross-device idempotency will require server-side keys in V2.2.
- Recently Deleted for the *new modules* only; the earlier inventory deletion behavior is not yet converted to a reversible archive.
- The preview is not yet subjected to real browser/device end-to-end testing. Do not merge solely based on syntax checks.

## Manual acceptance checks before merging

1. Open preview version and confirm bottom nav has exactly five entries on a narrow phone.
2. Confirm every screen's top Home shortcut returns home; Settings remains accessible.
3. Add item, nested storage, shopping item, old Home Care and old Wellness entries; refresh, verify persistence.
4. Add one-time important task, complete it, verify history and visibility in Completed.
5. Add repeat task both Fixed Schedule and After Completion; verify next date across a month boundary.
6. Add both cat profiles, bath record, health check with a next date; confirm the correct cat owns each record.
7. Create subscription linked to inventory; mark receipt and verify inventory changes once.
8. Export JSON, import on another browser profile, check new and old records.
9. Delete and restore new module records from Settings.
10. Test empty states, mobile layout and legacy search/filter interactions.

No live backend connection is required to test V2.1.