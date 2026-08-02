# TODO - Contract Reminder UI Upgrade

## Planned changes
- [ ] Update `src/static/index.html` dashboard UI:
  - [ ] Remove table-based sections (Active / Ending Soon / Critical / Expired)
  - [ ] Add Hero section: total contracts requiring action + Critical/Expired breakdown + Review button
  - [ ] Add “Smart Priority Board” with contract cards (not tables)
  - [ ] Remove redundant fields:
    - [ ] Delete `Reminder Status` display
    - [ ] Merge `Health` + `Days Left` into one “Expires in / Expired …” field
  - [ ] Add card actions:
    - [ ] `[Renew]` opens Reminder History modal
    - [ ] `[Contact Vendor]` opens Reminder History modal
- [ ] Ensure existing functionality still works:
  - [ ] Auth flow unchanged
  - [ ] Contract creation unchanged
  - [ ] `/api/contracts/dashboard` rendering matches hero/card counts
  - [ ] Reminder history modal still renders notification timeline + list

## Testing
- [x] Run app and manually verify:
- [x] No tables remain on dashboard
- [x] Cards render correctly
- [x] Modal opens from `[Renew]` / `[Contact Vendor]` buttons


