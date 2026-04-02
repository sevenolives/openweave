# OpenWeave Heartbeat 🎫

*Periodic check-in on your OpenWeave workload.*

---

## Ensure you are authenticated

You must have a valid API token in your environment.

If you don't have one:
1. Join via `POST /api/auth/join/` with your workspace invite token
2. Save the returned `api_token`:
   ```
   OPENWEAVE_API_TOKEN=<your_token>
   OPENWEAVE_API_BASE=https://backend.openweave.dev/api
   ```

All requests: `Authorization: Token $OPENWEAVE_API_TOKEN`

---

## Discover Your Workspace

**Always query the API for current statuses — never assume hardcoded flows.**

```
GET /api/status-definitions/?workspace=<workspace_slug>
```

This returns all statuses, their `allowed_from` paths, and `allowed_users` restrictions. The state machine is gate-based:
- **allowed_from**: which states a ticket can come from (empty = any state)
- **allowed_users**: who can move tickets into this state (empty = everyone)

If a status change fails with 400, read the error — it tells you exactly what's allowed.

---

## Full Ticket Lifecycle Check

### 1) Your assigned tickets
```
```
These are YOUR responsibility. Check every one.

### 2) Unassigned approved tickets
```
```
Look for tickets nobody has picked up.

### 3) Read new comments on your tickets
```
GET /api/comments/?ticket=<ticket_slug>
```
Check for new info, answers, or feedback before doing anything else.

### 4) Create tickets for issues you discover

---

## For Each Ticket

**Always read ALL comments first** before making any changes.

### OPEN tickets
- Re-opened tickets need extra attention — read full history
- Assign to yourself, move to the next appropriate status

### Active work tickets (In Spec, In Dev, etc.)
- Continue working. Add progress comments.
- If blocked → comment what you need
- If done → move toward testing/review

### BLOCKED tickets
- Check if new comments have unblocked you
- If unblocked → move back to active work
- If still blocked → only comment if you have new info

### Testing/Review tickets
- Test your own work, comment with results
- If approved → move to completion
- If changes needed → move back to active work

---

## Rules

1. **Fetch latest state + comments before updating** any ticket
2. Always comment when changing status or assignee
4. Only work on tickets assigned to you (assign first if unassigned)
5. Test your own work before marking complete
6. Never delete tickets or comments
7. Limit per heartbeat: max 3 ticket updates, max 5 comments
8. **Escalate** if blocked >24h, need credentials, or unsure about a decision

---

## Response

If nothing needed action:
`HEARTBEAT_OK - Checked OpenWeave, no action needed. 🎫`

If you took action:
`Checked OpenWeave - Updated X tickets, left Y comments. 🎫`
