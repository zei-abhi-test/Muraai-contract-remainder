# Mission Control Dashboard

## Document Control

| Version | Date | Author | Change |
|---|---|---|---|
| 1.0 | 2026-07-20 | Principal UX Architect | Complete Mission Control dashboard specification |

---

## 0. Design Philosophy

### The 30-Second Rule

A Contract Manager (S1) opens this dashboard and must understand their operational state within 30 seconds. This means:

- **Above the fold** must contain everything needed to answer "what requires my decision right now?"
- **Counts are not metrics.** "12 renewals" is a count. "3 need assignment, 2 are overdue" is operational intelligence.
- **Vanity metrics are banned.** No "total contract value" without context. No "number of vendors." Every visible number must drive a decision or trigger an action.
- **Red first.** The dashboard surfaces problems before status. A green SLA heat map is comforting but useless — red items demand attention and must appear first.

### Mental Model

The dashboard is not a report. It is a **decision interface**. Every widget answers exactly one operational question:

| Widget | Question It Answers |
|---|---|
| Alerts | What is about to break or has already broken? |
| Today's Tasks | What must I personally do today? |
| Upcoming Renewals | Which contracts need my attention in the next 90 days? |
| Risk Contracts | Which contracts are at risk of missing their renewal? |
| Pending Approvals | Which decisions am I waiting on from others? |
| Recent Activity | What changed since I last looked? |
| Finance Summary | How much committed spend is in my pipeline? |
| Notifications | What events have I not acknowledged? |
| Quick Actions | What common action am I about to take? |

### Layout

A 2x2 grid of widgets with the Alerts bar across the top (conditionally visible) and Notifications + Quick Actions spanning the full width at the bottom.

| Row | Left | Right |
|---|---|---|
| 1 | Today's Tasks (personal queue) | Upcoming Renewals (90-day pipeline) |
| 2 | Risk Contracts (endangered renewals) | Pending Approvals (waiting on others) |
| 3 | Recent Activity (what changed) | Finance Summary (pipeline value) |

Below the grid: Notifications feed (full width), then Quick Actions sticky bar.

---

## 1. Alerts Widget

### What It Shows

A conditionally visible banner at the very top of the dashboard. It only appears when one or more alerts are active. If no alerts exist, the widget is hidden entirely and the content below shifts up.

### Alert Levels

| Level | Icon | Color | Meaning | Example |
|---|---|---|---|---|
| CRITICAL | red-triangle | Red background | Requires immediate action | SLA breach, 7 days to end date with no renewal |
| WARNING | amber-triangle | Amber background | Requires action today | Budget review pending, contract expiring in 30 days |
| INFO | blue-circle | Blue background | Requires acknowledgement | Renewal auto-created, document uploaded |

### Why This Widget Exists

Without alerts, the Contract Manager must proactively scan every widget to find problems. **Alerts are the dashboard's immune system.** They surface problems before the user looks for them. This is the first thing the user sees because problems are the first thing the user needs to know about. The conditional visibility (hidden when no alerts exist) means zero noise when operations are running smoothly — the dashboard rewards good process by giving the user more space.

### Interactions

| Element | Behavior |
|---|---|
| **Alert text** | Click opens the affected Renewal Workspace, scrolled to the relevant section (SLA panel for breach, Timeline for stalled). |
| **[Escalate]** | One-click escalation. Confirmation: "Escalate RNW-4123? Current level: 1. Next: CTO." Confirms state transition + notification + removes alert. |
| **[Reassign]** | Opens assignee selector with workload indicators. |
| **[Dismiss]** | Removes alert from dashboard but does NOT resolve the underlying issue. Dismissed alerts appear in "View All Alerts" with a snooze icon. Dismiss requires a reason (configurable). |
| **[View All Alerts]** | Opens the Alerts workspace — filterable table of all active, dismissed, and resolved alerts with timestamps and resolution notes. |

### Drill-Down Behavior

Clicking any alert navigates to the **Renewal Workspace** with context preserved:
- SLA breach alert -> Renewal Workspace, SLA panel open, that SLA row highlighted with pulsing border
- Stalled alert -> Renewal Workspace, Timeline panel open, 14-day gap auto-scrolled into view
- Budget review alert -> Renewal Workspace, Tasks panel, the budget review task highlighted

The user never lands on a generic page. Every alert click delivers targeted context.

---

## 2. Today's Tasks Widget

### What It Shows

The Contract Manager's personal task queue filtered to items where they are the assignee, due today or overdue.

### Task Priority Encoding

| Visual | Priority | Left Border |
|---|---|---|
| Red indicator | HIGH / CRITICAL | Red |
| Amber badge | OVERDUE (any priority) | Amber |
| Gray indicator | NORMAL | Gray |

### Why This Widget Exists

This widget answers: **"What do I need to do today?"** Without it, the manager scans the entire dashboard looking for items assigned to them. The tasks widget is their personal queue. Only items where they are the direct assignee appear here — not their team's tasks, not items assigned to others. This is a personal commitment list, not a team tracker.

### Interactions

| Element | Behavior |
|---|---|
| **[Complete]** | Optimistic UI check. Task animates to completed state. If error, reverts with inline message. |
| **[Quick Assign to Sarah]** | One-click assignment to the most common assignee for this task type. Uses ML to predict the right person. |
| **[Snooze to Tomorrow]** | Moves due date to tomorrow. Task removed from "Today" view, appears in tomorrow's dashboard. |
| **Task text** | Click opens the Task detail panel in slide-over. |

### Drill-Down Behavior

Clicking the task text opens the Task detail panel showing full description, creator, creation date, related entity (renewal ID with link), and activity log for the task. The user can complete, reassign, or edit the task from this panel without navigating away.

---

## 3. Upcoming Renewals Widget

### What It Shows

A 90-day renewal pipeline segmented into three 30-day windows.

| Window | What Each Row Shows |
|---|---|
| **Next 30 Days** | Renewals where end_date is within 30 days. These need immediate action. |
| **31-60 Days** | Renewals entering the active window. Should be assigned and quoting. |
| **61-90 Days** | Early pipeline. Should be identified and queued. |

Each renewal row shows: Vendor name, contract name, estimated value, days remaining, and a status indicator.

### Why This Widget Exists

This widget answers: **"Which contracts need my attention in what order?"** The pipeline is the manager's forward-looking view. Without it, renewals are discovered ad-hoc through email reminders or end-date panics. The 30/60/90 segmentation is deliberate — it maps to the standard renewal operations cadence: act now (30), prepare (60), monitor (90).

### Interactions

| Element | Behavior |
|---|---|
| **Row click** | Opens the Renewal Workspace for that renewal (or the Contract Workspace if no renewal exists yet). |
| **Window header click** | Collapses/expands that 30-day segment. Default: "Next 30 Days" is expanded, others collapsed. |
| **[View Full Pipeline]** | Opens the Pipeline workspace with all renewals, full filtering, sorting, bulk actions. |

### Drill-Down Behavior

Clicking a renewal row opens the Renewal Workspace. Clicking a contract that has no renewal yet (within 30 days, critical) opens the Contract Workspace with an action prompt: "This contract expires in 12 days with no renewal. [Create Renewal Now]"

---

## 4. Risk Contracts Widget

### What It Shows

Contracts with active risk factors that could result in a missed or failed renewal. Each contract card shows:

| Element | Content |
|---|---|
| **Risk level** | CRITICAL (red), HIGH (amber), MEDIUM (yellow) |
| **Contract + Vendor** | Name linked to Contract Workspace |
| **Days to end date** | If < 30, shown in red |
| **Risk reason** | One-line explanation: "No renewal created", "Renewal stalled 14d", "Legal SLA breached" |
| **[View]** | Opens the Contract or Renewal Workspace |

### Risk Classification Logic

| Risk Level | Criteria |
|---|---|
| **CRITICAL** | End date within 14 days with no PO created AND no active renewal on track to complete |
| **HIGH** | End date within 30 days with stalled renewal, or SLA breach > 24h, or budget review unresolved for > 7 days |
| **MEDIUM** | End date within 60 days with no renewal assigned, or legal review pending for > 5 days |

### Why This Widget Exists

This widget answers: **"Which contracts are going to cause me a problem?"** The Upcoming Renewals widget shows everything. Risk Contracts filters to only the ones that need intervention. This is the widget the manager checks when they have 15 seconds — it directly feeds the Alerts widget above.

### Interactions

| Element | Behavior |
|---|---|
| **[View]** | Opens the Contract Workspace (if no renewal) or Renewal Workspace (if renewal exists). Auto-focuses on the issue: Timeline for stalled, SLA for breach, Tasks for budget review. |
| **Risk level badge** | Hover shows the full risk score breakdown per the Renewal Workshop risk model. |

### Drill-Down Behavior

Clicking [View] navigates contextually:
- "No renewal created" -> Contract Workspace, Summary section, with inline prompt to create renewal
- "Renewal stalled 14d" -> Renewal Workspace, Timeline section, showing the 14-day gap
- "Legal SLA breached" -> Renewal Workspace, SLA panel, with the breached SLA highlighted

---

## 5. Pending Approvals Widget

### What It Shows

Approval requests that the Contract Manager is responsible for monitoring — not necessarily their own approvals, but approvals in their team's renewals that they need to track.

Each row shows:

| Element | Content |
|---|---|
| **Approval step** | Legal / Business Owner / Budget Override |
| **Approver** | Name + role of the person who needs to act |
| **Renewal** | Renewal ID + contract name |
| **SLA** | Time remaining (or overdue duration) |
| **[Remind]** | Sends in-app + email reminder to the approver |
| **[Escalate]** | Escalates to the approver's manager |

### Why This Widget Exists

This widget answers: **"Who is holding up my renewals?"** The manager's job is to unblock — that means knowing exactly whose desk each renewal is sitting on. Without this widget, the manager discovers stalled approvals by opening each renewal individually. With it, they see the entire blocker map in one place and can take action (remind, escalate) directly from the dashboard.

### Interactions

| Element | Behavior |
|---|---|
| **[Remind]** | Sends notification. Button shows cooldown: if reminded < 4 hours ago, shows "Reminded 30m ago" (disabled). |
| **[Escalate]** | Opens confirmation: "Escalate to Jane Smith's manager (VP Legal)? Current SLA: 2d remaining." |
| **Row click** | Opens the Renewal Workspace, Approvals section, with that approval row highlighted. |

### Drill-Down Behavior

Clicking a row opens the Renewal Workspace -> Approvals section. The specific ApprovalRecord is highlighted, showing its full detail: SLA deadline, escalation count, reminder history, and the renewal context.

---

## 6. Recent Activity Widget

### What It Shows

A chronological stream of the most recent state-changing events across the Contract Manager's scope. Grouped by "Today" and "Yesterday."

Each entry shows:

| Element | Content |
|---|---|
| **Icon** | Event type indicator (assignment, system event, approval, rejection, document) |
| **Action** | "Sarah assigned RNW-4125", "System created RNW-4126", "Jane approved legal on RNW-4123" |
| **Timestamp** | Relative time ("8:45 AM", "2h ago") |
| **Click target** | Entire entry is clickable |

### Why This Widget Exists

This widget answers: **"What happened since I last checked?"** The manager may step away for a meeting and return to find 4 things changed. The activity feed brings them up to speed in one scan. Without it, they must check each widget individually to see what's new.

### Interactions

| Element | Behavior |
|---|---|
| **Entry click** | Opens the affected entity's workspace (Renewal, Contract, PO) in slide-over. |
| **Double-click** | Opens the entity in full page view (for complex investigation). |
| **[View Full Activity Log]** | Opens the Activity Log workspace with pre-applied filter for the Contract Manager's scope. |

### Drill-Down Behavior

Clicking "Jane approved legal on RNW-4123" opens the Renewal Workspace -> Timeline section, with that transition highlighted. The user sees the approval details, any comments, and the current state.

---

## 7. Finance Summary Widget

### What It Shows

A compact financial overview of the renewal pipeline. Not a full finance dashboard — just the numbers the Contract Manager needs for daily decisions.

| Section | Content |
|---|---|
| **Pipeline Value** | Total renewal value in the pipeline, segmented by confidence: |
| | - Committed (PO sent/invoiced):  |
| | - At Risk (stalled or breached SLA):  |
| | - Pending Decision (in approval):  |
| **Forecast vs Budget** | Current quarter: forecast vs. allocated budget with variance |

### Why This Widget Exists

This widget answers: **"How much money is moving through my pipeline?"** The Contract Manager does not need a full financial dashboard — they need to know: (1) how much is committed, (2) how much is at risk, (3) whether the quarter is on track. This drives decisions about priority: a  renewal in "at risk" gets escalated before a  renewal that's on track.

### Vanity Metric Prevention

This widget explicitly excludes:
- Total contract value (all contracts, not just renewing ones) — vanity
- Number of vendors — vanity
- Year-over-year comparison without context — operational, but not daily
- Spend by category — useful for S6, not for S1

### Interactions

| Element | Behavior |
|---|---|
| **Pipeline segment** | Click "At Risk ()" -> opens Pipeline workspace filtered to stalled/breached renewals |
| **Committed** | Click -> opens PO workspace showing all POs for this manager's scope |
| **[View Full Forecast]** | Opens the Forecast workspace |

### Drill-Down Behavior

Clicking a pipeline segment applies the relevant filter in the Pipeline workspace. "At Risk ()" opens the pipeline table pre-filtered to Renewal status IN (STALLED, ON_HOLD, ESCALATED) OR SLA status = BREACHED. The manager can then take bulk actions on these renewals.

---

## 8. Notifications Widget

### What It Shows

The most recent unread notifications for the Contract Manager. This is the same feed as the Notification Center in the global header, presented inline on the dashboard.

| Visual | Notification Type | Priority |
|---|---|---|
| Red dot | SLA Breach, Invoice Exception, PO Rejected | Critical |
| Amber dot | Approval Required, Budget Review Needed | High |
| Blue dot | Assignment, Renewal Created, Invoice Received | Normal |
| Gray dot | System notification, Sync Complete | Low |

Each notification shows: icon + message + relative timestamp.

### Why This Widget Exists

This widget answers: **"What events have I not acknowledged?"** The notification center in the header is available everywhere. The inline feed on the dashboard serves a different purpose: **catch-up.** When the manager arrives in the morning, the inline feed shows everything they missed. The header bell shows a count. The inline feed shows the content.

### Interactions

| Element | Behavior |
|---|---|
| **Click notification** | Opens the relevant entity workspace. Marks notification as read. |
| **[Mark All Read]** | Marks all visible notifications as read. Confirmation if > 10. |
| **Hover** | Shows the full notification message if truncated. |
| **[View All]** | Opens the full Notification Center with history, filtering, and read/unread toggles. |

### Drill-Down Behavior

Clicking a notification navigates to the Renewal Workspace, Contract Workspace, or PO Workspace as appropriate. The notification is marked as read automatically.

---

## 9. Quick Actions Widget

### What It Shows

A sticky bar at the bottom of the dashboard with the most common creation and management actions.

| Action | Icon | Behavior |
|---|---|---|
| **+ New Renewal** | Plus | Opens Create Renewal form. Pre-fills contract selector as first field. |
| **+ New Contract** | Plus | Opens Create Contract form in slide-over. |
| **+ New Vendor** | Plus | Opens Create Vendor form in slide-over. |
| **Assign Bulk** | People | Opens multi-select mode. Manager selects renewals from a list, then assigns selected to an S2. |
| **Export** | Download | Exports the current dashboard view as a snapshot report (PDF). |

### Why This Widget Exists

This widget answers: **"What common action am I about to take?"** The Contract Manager's daily workflow includes creating entities and assigning work. These actions should be one click away, not buried in a sidebar menu. The sticky bar ensures these actions are available from anywhere on the dashboard — no scrolling to find them.

### Interactions

| Element | Behavior |
|---|---|
| **+ New X** | Opens a slide-over form, not a new page. The dashboard remains visible behind the panel. |
| **Assign Bulk** | Opens a modal: "Select renewals to assign." Shows a filterable table of unassigned PENDING_REVIEW renewals. After selection, shows an assignee picker with workload balance. |
| **Export** | Generates a snapshot PDF of the current dashboard state. Includes all visible widget data. Useful for standup meetings or email summaries. |

---

## 10. Empty State

When no renewals exist, the dashboard shows:

`
Mission Control

Everything is quiet. No renewals are pending, no approvals are waiting,
and no contracts are at risk.

This usually means one of:
- No contracts have been added yet. [Add your first contract]
- All renewals are completed or up to date. [View Completed Renewals]
- Your filter scope might be too narrow. [Check scope settings]

[Add Contract] [Import Contracts]
`

This is not celebration — it is validation. The manager should leave the dashboard knowing the system is working as expected.

---

## 11. Loading State

Skeleton layout matching the dashboard structure:
- Alerts bar: 3 skeleton lines (40%, 60%, 50% width)
- Today's Tasks: 3 skeleton cards with varying heights
- Upcoming Renewals: 2 skeleton table rows per 30-day segment
- Risk Contracts: 3 skeleton cards
- All other widgets: minimal skeleton placeholder

Loading time target: < 500ms for skeleton, < 2s for full data.

---

## 12. Error State

If the dashboard fails to load:

`
Unable to load Mission Control

This could be a connectivity issue or a server error.

[Retry] [Go to Pipeline] [Contact Support]

Error reference: ERR-DB-2026-07-20-14A2
`

The error reference code allows S10 to trace the exact failure. The fallback links let the manager continue working even if the dashboard is down — Pipeline and Renewal List are simpler queries that may succeed when the aggregation-heavy dashboard fails.

---

## 13. Dashboard Configuration

### Scope Selector

A dropdown in the dashboard header: "My Scope" (default), "My Team's Scope", "Department: Engineering", "All."

Changing scope refreshes all widgets. Scope is persisted in user preferences.

### Refreshing

| Trigger | Behavior |
|---|---|
| **Page load** | Full data fetch |
| **Manual refresh** | Button in header: "Last refreshed: 1m ago [Refresh]" |
| **Auto-refresh** | Every 5 minutes while the tab is active. Resets if user is actively interacting with a widget. |

### Persistence

| Element | Persisted |
|---|---|
| Widget visibility | User can hide/show widgets via a customize menu. Hidden widgets remembered across sessions. |
| Expanded/collapsed state | 30-day segments in Upcoming Renewals, task completion state. |
| Scope | Last selected scope. |

---

## 14. Widget Layout Customization

Users can customize their dashboard via a layout editor:

1. Click [Customize] in the dashboard header
2. Dashboard enters edit mode: all widgets show a drag handle + visibility toggle
3. User can:
   - Reorder widgets by drag-and-drop
   - Hide widgets (they move to a "Hidden Widgets" tray)
   - Resize widgets (some support compact vs. expanded modes)
4. Layout is saved per user, not per role

---

## 15. Widget Interaction Summary

| Widget | Click Element | Drill-Down Target | Action Buttons |
|---|---|---|---|
| Alerts | Alert text | Renewal Workspace (relevant panel highlighted) | Escalate, Reassign, Dismiss |
| Today's Tasks | Task text | Task detail panel (slide-over) | Complete, Reassign, Snooze |
| Upcoming Renewals | Row | Renewal Workspace or Contract Workspace | Create Renewal (if none exists) |
| Risk Contracts | [View] | Renewal or Contract Workspace (issue highlighted) | Create Renewal |
| Pending Approvals | Row | Renewal Workspace (Approvals section) | Remind, Escalate |
| Recent Activity | Entry | Entity Workspace (slide-over) | (none) |
| Finance Summary | Pipeline segment | Pipeline workspace (pre-filtered) | View Full Forecast |
| Notifications | Notification | Entity Workspace | Mark All Read |
| Quick Actions | Button | Slide-over form or modal | (action-specific) |

---

## 16. Performance Requirements

| Metric | Target |
|---|---|
| Time to first skeleton | < 500ms |
| Time to full data | < 2s |
| Alert count query | < 100ms (separate fast path) |
| Task count query | < 200ms |
| Pipeline aggregation | < 1s (pre-aggregated or counter cache) |
| Dashboard refresh | < 2s |
| Widget lazy loading | Non-critical widgets (Activity, Finance) load after critical widgets (Alerts, Tasks) |

### Data Freshness

- Alerts: Real-time (pushed via WebSocket if supported, polled every 30s otherwise)
- Tasks: Near-real-time (polled every 60s)
- Pipeline counts: Polled every 5 min
- Finance summary: Polled every 15 min (aggregation-heavy)
- Activity feed: Polled every 60s

---

## 17. Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| Cmd+K | Command palette |
| R | Focus Alerts (first alert) |
| T | Focus Today's Tasks |
| U | Focus Upcoming Renewals |
| X | Focus Risk Contracts |
| A | Focus Pending Approvals |
| N | Focus Notifications |
| Cmd+N | Quick action: New Renewal |
| Cmd+Shift+N | Quick action: New Contract |
| Cmd+R | Refresh dashboard |
| Escape | Close any open detail panel / return to dashboard |

---

## 18. Responsive Behavior

| Breakpoint | Layout Change |
|---|---|
| > 1280px | Full 2x2 grid as designed. All widgets visible. |
| 1024-1280px | Finance Summary collapses to a single row below the grid. |
| 768-1024px | Grid becomes single column. Alerts remain at top. Quick Actions collapse to an overflow (+). |
| < 768px | Only critical widgets shown: Alerts, Today's Tasks, Risk Contracts. Others accessible via [Show More]. Quick Actions become a floating button. |
