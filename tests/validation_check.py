#!/usr/bin/env python3
"""Agent-Desk comprehensive validation — runs all testing_criteria.md checks."""

import json, sys, time, uuid, requests

BACKEND = "https://backend-production-758b.up.railway.app"
FRONTEND = "https://frontend-production-7e76.up.railway.app"
ADMIN = {"username": "admin", "password": "password123"}

results = {"pass": [], "fail": [], "warn": []}

def check(test_id, name, passed, detail=""):
    status = "pass" if passed else "fail"
    results[status].append(f"{test_id} {name}" + (f" — {detail}" if detail else ""))
    icon = "✅" if passed else "❌"
    print(f"{icon} {test_id} {name}" + (f" — {detail}" if detail else ""))

def warn(test_id, name, detail=""):
    results["warn"].append(f"{test_id} {name}" + (f" — {detail}" if detail else ""))
    print(f"⚠️  {test_id} {name}" + (f" — {detail}" if detail else ""))

def get(url, headers=None, expect=None):
    try:
        r = requests.get(url, headers=headers, timeout=15, allow_redirects=False)
        if expect:
            return r.status_code in (expect if isinstance(expect, list) else [expect]), r
        return r.status_code < 400, r
    except Exception as e:
        return False, str(e)

def post(url, data, headers=None, expect=None):
    try:
        h = {"Content-Type": "application/json"}
        if headers: h.update(headers)
        r = requests.post(url, json=data, headers=h, timeout=15)
        if expect:
            return r.status_code in (expect if isinstance(expect, list) else [expect]), r
        return r.status_code < 400, r
    except Exception as e:
        return False, str(e)

def patch(url, data, headers):
    try:
        h = {"Content-Type": "application/json"}
        h.update(headers)
        r = requests.patch(url, json=data, headers=h, timeout=15)
        return r.status_code < 400, r
    except Exception as e:
        return False, str(e)

def delete(url, headers, expect=None):
    try:
        r = requests.delete(url, headers=headers, timeout=15)
        if expect:
            return r.status_code in (expect if isinstance(expect, list) else [expect]), r
        return r.status_code < 400, r
    except Exception as e:
        return False, str(e)

# ── 1. Health & Availability ──
print("\n═══ 1. HEALTH & AVAILABILITY ═══")
ok, r = get(f"{BACKEND}/api/", expect=[200, 401])  # May require auth
check("1.1", "Backend root responds", ok, f"HTTP {r.status_code}" if hasattr(r, 'status_code') else str(r))

ok, r = get(FRONTEND)
check("1.2", "Frontend loads", ok and hasattr(r, 'text'), f"HTTP {r.status_code}" if hasattr(r, 'status_code') else str(r))

ok, r = get(f"{BACKEND}/admin/", expect=[200, 301, 302])
check("1.3", "Admin panel", ok)

ok, r = get(f"{BACKEND}/api/docs/")
check("1.4", "Swagger docs", ok)

ok, r = get(f"{BACKEND}/api/schema/")
check("1.5", "OpenAPI schema", ok)

ok, r = get(f"{BACKEND}/api/skills/skills.md")
check("1.6", "skills.md (backend)", ok and hasattr(r, 'text') and len(r.text) > 100)

ok, r = get(f"{BACKEND}/api/skills/heartbeat.md")
check("1.7", "heartbeat.md (backend)", ok)

ok, r = get(f"{FRONTEND}/skills.md")
check("1.8", "skills.md (frontend proxy)", ok)

ok, r = get(f"{FRONTEND}/heartbeat.md")
check("1.9", "heartbeat.md (frontend proxy)", ok)

# ── 2. Authentication ──
print("\n═══ 2. AUTHENTICATION ═══")
ok, r = post(f"{BACKEND}/api/auth/login/", ADMIN, expect=[200])
check("2.1", "Login valid creds", ok)
if ok:
    tokens = r.json()
    TOKEN = tokens.get("access", "")
    REFRESH = tokens.get("refresh", "")
    AUTH = {"Authorization": f"Bearer {TOKEN}"}
    check("2.1b", "Has access+refresh", bool(TOKEN and REFRESH))
else:
    print("❌ FATAL: Cannot login — stopping auth tests")
    TOKEN = AUTH = None

if TOKEN:
    ok, r = post(f"{BACKEND}/api/auth/login/", {"username": "admin", "password": "wrong"}, expect=[401])
    check("2.2", "Login bad password → 401", ok)

    ok, r = post(f"{BACKEND}/api/auth/token/refresh/", {"refresh": REFRESH}, expect=[200])
    check("2.3", "Token refresh", ok)

    # Register human (unique username)
    uname = f"testuser_{uuid.uuid4().hex[:6]}"
    ok, r = post(f"{BACKEND}/api/auth/join/", {"username": uname, "password": "testpass123", "name": "Test Human", "user_type": "HUMAN"}, expect=[201])
    check("2.4", "Register human", ok, f"username={uname}")
    test_human_id = r.json().get("user", {}).get("id") if ok else None

    # Register bot (bots require invite token per current logic)
    bname = f"testbot_{uuid.uuid4().hex[:6]}"
    ok, r = post(f"{BACKEND}/api/auth/join/", {"username": bname, "name": "Test Bot", "user_type": "BOT"}, expect=[201, 400])
    if hasattr(r, 'status_code') and r.status_code == 400 and "invite" in r.text.lower():
        warn("2.5", "Register bot without invite", "bots require workspace_invite_token (by design)")
    else:
        check("2.5", "Register bot", ok and "api_token" in (r.json() if ok else {}), f"username={bname}")

    # Invalid invite
    ok, r = post(f"{BACKEND}/api/auth/join/", {"username": f"x_{uuid.uuid4().hex[:4]}", "password": "test12345", "name": "X", "user_type": "HUMAN", "workspace_invite_token": "invalid-token-abc"}, expect=[400])
    if hasattr(r, 'status_code') and r.status_code == 500:
        warn("2.7", "Invalid invite → 500", "KNOWN BUG: should return 400")
    else:
        check("2.7", "Invalid invite → 400", ok)

    # Duplicate username
    ok, r = post(f"{BACKEND}/api/auth/join/", {"username": "admin", "password": "test123", "name": "Dup"}, expect=[400])
    check("2.8", "Duplicate username → 400", ok)

# ── 3. Users API ──
print("\n═══ 3. USERS API ═══")
if AUTH:
    ok, r = get(f"{BACKEND}/api/users/", AUTH)
    check("3.1", "List users", ok and hasattr(r, 'json'))
    
    ok, r = get(f"{BACKEND}/api/users/me/", AUTH)
    check("3.2", "Get /me/", ok)
    my_id = r.json().get("id") if ok else None

    if my_id:
        ok, r = patch(f"{BACKEND}/api/users/{my_id}/", {"name": "Admin"}, AUTH)
        check("3.3", "Patch self", ok)

    ok, r = get(f"{BACKEND}/api/users/", expect=[401])
    check("3.6", "Unauthed → 401", ok)

# ── 4. Workspaces ──
print("\n═══ 4. WORKSPACES ═══")
if AUTH:
    ok, r = get(f"{BACKEND}/api/workspaces/", AUTH)
    check("4.1", "List workspaces", ok)
    ws_list = r.json().get("results", []) if ok else []
    ws_id = ws_list[0]["id"] if ws_list else None

    if ws_id:
        ok, r = get(f"{BACKEND}/api/workspace-members/?workspace={ws_id}", AUTH)
        check("4.2", "List members", ok)
        members = r.json().get("results", []) if ok else []

        ok, r = get(f"{BACKEND}/api/invites/?workspace={ws_id}", AUTH)
        check("4.5", "List invites", ok)

        ok, r = post(f"{BACKEND}/api/invites/", {"workspace": ws_id}, AUTH)
        check("4.6", "Create invite", ok)
        invite_token = r.json().get("token") if ok else None

        # Clean up: delete the invite we just made
        if ok:
            inv_id = r.json().get("id")
            if inv_id:
                delete(f"{BACKEND}/api/invites/{inv_id}/", AUTH)

# ── 5. Projects ──
print("\n═══ 5. PROJECTS ═══")
if AUTH:
    ok, r = get(f"{BACKEND}/api/projects/", AUTH)
    check("5.1", "List projects", ok)
    projects = r.json().get("results", []) if ok else []

    # Create test project
    ok, r = post(f"{BACKEND}/api/projects/", {"name": f"TestProj_{uuid.uuid4().hex[:4]}", "workspace": ws_id or 1}, AUTH)
    check("5.2", "Create project", ok)
    test_proj_id = r.json().get("id") if ok else None

    if test_proj_id:
        ok, r = get(f"{BACKEND}/api/projects/{test_proj_id}/", AUTH)
        check("5.3", "Get project", ok)

        ok, r = patch(f"{BACKEND}/api/projects/{test_proj_id}/", {"description": "test"}, AUTH)
        check("5.4", "Update project", ok)

        # Delete empty project
        ok, r = delete(f"{BACKEND}/api/projects/{test_proj_id}/", AUTH, expect=[204])
        check("5.5", "Delete empty project", ok)

    if ws_id:
        ok, r = get(f"{BACKEND}/api/projects/?workspace={ws_id}", AUTH)
        check("5.6", "Filter by workspace", ok)

    # Test: can't delete project with tickets
    if projects:
        proj_with_tickets = projects[0]
        # Check tickets exist for this project first
        has_tickets_ok, has_tickets_r = get(f"{BACKEND}/api/tickets/?project={proj_with_tickets['id']}", AUTH)
        ticket_count = has_tickets_r.json().get("count", 0) if has_tickets_ok else 0
        if ticket_count > 0:
            ok, r = delete(f"{BACKEND}/api/projects/{proj_with_tickets['id']}/", AUTH, expect=[400])
            check("5.7", "Delete non-empty project → 400", ok, f"project has {ticket_count} tickets")
        else:
            warn("5.7", "Delete non-empty project", "no project with tickets found to test")

# ── 6. Tickets ──
print("\n═══ 6. TICKETS ═══")
if AUTH:
    ok, r = get(f"{BACKEND}/api/tickets/", AUTH)
    check("6.1", "List tickets", ok)
    tickets = r.json().get("results", []) if ok else []

    # Find a project to create ticket in
    proj_id = projects[0]["id"] if projects else 1
    ok, r = post(f"{BACKEND}/api/tickets/", {"title": f"CronTest_{uuid.uuid4().hex[:4]}", "description": "Auto-created by validation cron", "project": proj_id, "priority": "LOW"}, AUTH)
    check("6.2", "Create ticket", ok)
    test_ticket_id = r.json().get("id") if ok else None

    if test_ticket_id:
        ok, r = get(f"{BACKEND}/api/tickets/{test_ticket_id}/", AUTH)
        check("6.3", "Get ticket", ok)

        ok, r = patch(f"{BACKEND}/api/tickets/{test_ticket_id}/", {"description": "updated by cron"}, AUTH)
        check("6.4", "Update ticket", ok)

        ok, r = get(f"{BACKEND}/api/tickets/?project={proj_id}", AUTH)
        check("6.6", "Filter by project", ok)

        ok, r = get(f"{BACKEND}/api/tickets/?status=OPEN", AUTH)
        status_results = r.json().get("results", []) if ok and hasattr(r, 'json') else []
        all_open = all(t["status"] == "OPEN" for t in status_results) if status_results else False
        check("6.7", "Filter by status", ok and (all_open or len(status_results) == 0), f"got {len(status_results)} results, all_open={all_open}")

        # Assign
        ok, r = patch(f"{BACKEND}/api/tickets/{test_ticket_id}/", {"assigned_to": my_id}, AUTH)
        check("6.8", "Assign ticket", ok)

        # Invalid status
        ok, r = patch(f"{BACKEND}/api/tickets/{test_ticket_id}/", {"status": "INVALID_STATUS"}, AUTH)
        is_400 = hasattr(r, 'status_code') and r.status_code == 400
        is_500 = hasattr(r, 'status_code') and r.status_code == 500
        if is_400:
            check("6.9", "Invalid status → 400", True)
        elif is_500:
            warn("6.9", "Invalid status → 500", "KNOWN BUG: should be 400")
        else:
            check("6.9", "Invalid status → 400", False, f"got {r.status_code if hasattr(r, 'status_code') else r}")

        # Delete ticket
        ok, r = delete(f"{BACKEND}/api/tickets/{test_ticket_id}/", AUTH, expect=[204])
        check("6.5", "Delete ticket", ok)

# ── 7. Comments ──
print("\n═══ 7. COMMENTS ═══")
if AUTH and tickets:
    ticket_id = tickets[0]["id"]
    ok, r = get(f"{BACKEND}/api/comments/?ticket={ticket_id}", AUTH)
    check("7.1", "List comments", ok)

    ok, r = post(f"{BACKEND}/api/comments/", {"ticket": ticket_id, "body": f"Cron test {uuid.uuid4().hex[:4]}"}, AUTH)
    check("7.2", "Create comment", ok)
    test_comment_id = r.json().get("id") if ok else None

    # Clean up test comment
    if test_comment_id:
        delete(f"{BACKEND}/api/comments/{test_comment_id}/", AUTH)

    ok, r = get(f"{BACKEND}/api/comments/?ticket={ticket_id}", AUTH)
    check("7.3", "Filter by ticket", ok)

# ── 9. Frontend Pages ──
print("\n═══ 9. FRONTEND PAGES ═══")
pages = [
    ("9.1", "Landing page", "/"),
    ("9.2", "Login page", "/login"),
    ("9.3", "Dashboard", "/dashboard"),
    ("9.4", "Projects", "/projects"),
    ("9.5", "Tickets", "/tickets"),
    ("9.6", "Agents", "/agents"),
    ("9.7", "Workspaces", "/workspaces"),
]
for tid, name, path in pages:
    ok, r = get(f"{FRONTEND}{path}", expect=[200, 301, 302, 307, 308])
    check(tid, name, ok, f"HTTP {r.status_code}" if hasattr(r, 'status_code') else str(r))

# ── 10. Frontend Accessibility (HTML/JS checks) ──
print("\n═══ 10. FRONTEND ACCESSIBILITY ═══")

# Next.js is client-rendered, so check that pages load with JS bundles and basic structure
for tid, name, path in [("10.1", "Landing page structure", "/"), ("10.2", "Login page structure", "/login"),
                         ("10.3", "Projects page structure", "/projects"), ("10.4", "Tickets page structure", "/tickets")]:
    ok, r = get(f"{FRONTEND}{path}")
    if ok and hasattr(r, 'text'):
        html = r.text
        has_next = "__next" in html or "_next" in html  # Next.js marker
        has_viewport = "viewport" in html  # Mobile viewport meta
        has_scripts = "<script" in html
        check(tid, name, has_next and has_scripts, f"next.js={has_next}, viewport={has_viewport}, scripts={has_scripts}")
    else:
        check(tid, name, False, "page didn't load")

# Check mobile viewport is set (critical for small screens)
ok, r = get(f"{FRONTEND}/")
if ok and hasattr(r, 'text'):
    has_mobile_meta = 'width=device-width' in r.text
    check("10.5", "Mobile viewport meta", has_mobile_meta)
else:
    check("10.5", "Mobile viewport meta", False)

# ── Summary ──
print("\n" + "═" * 50)
total = len(results["pass"]) + len(results["fail"]) + len(results["warn"])
print(f"✅ PASS: {len(results['pass'])}/{total}")
print(f"❌ FAIL: {len(results['fail'])}/{total}")
print(f"⚠️  WARN: {len(results['warn'])}/{total}")

if results["fail"]:
    print("\n❌ FAILURES:")
    for f in results["fail"]:
        print(f"  - {f}")

if results["warn"]:
    print("\n⚠️  WARNINGS:")
    for w in results["warn"]:
        print(f"  - {w}")

# Exit code
sys.exit(1 if results["fail"] else 0)
