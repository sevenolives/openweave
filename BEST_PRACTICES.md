# Common Context — Best Practices from Building Bloom

Hard-won lessons from building a Django + Next.js app deployed on Railway.

---

## Django

### Custom User Model
- **Use `AbstractUser`, not `AbstractBaseUser`** — `AbstractBaseUser` strips out username and all built-in fields. You'll fight Django's admin, auth backends, and every third-party package.
- Keep the `username` field. If you want email login, add a custom auth backend — don't remove username.
- Auto-generate username from email prefix if users sign up with email only (`uuid.uuid4().hex[:20]` as fallback).
- If you must add fields to User, just extend `AbstractUser` with your extra fields. Don't reinvent what Django gives you.

### Migrations
- **Never rename models that map to existing tables** — Django will try to DROP and CREATE. Use `db_table` in Meta if you must rename the Python class.
- When adding a non-nullable field to an existing table with data, do it in 3 steps: (1) add as nullable/with default, (2) RunPython to populate, (3) AlterField to add constraints.
- Adding `unique=True` to a new field with `default=''` will fail if multiple rows exist — they all get the same default. Always populate unique values first.
- Test migrations against a DB with real data, not just an empty DB.

### Admin Performance
- **Always add `list_select_related`** for any ForeignKey in `list_display` — without it, Django fires a separate query per row (N+1 problem). Hundreds of rows = hundreds of queries = slow admin.
- Set `list_per_page = 50` (or similar) to avoid loading thousands of rows.
- Add `search_fields` and `list_filter` for any model with more than a few dozen rows.

### Management Commands
- When creating users in management commands (`createsuperadmin`, etc.), always handle conflicts: check for existing users by email AND username before creating.
- Use `Q(email=email) | Q(username=username)` to find existing users, then update rather than create.
- Don't assume the DB is empty — commands run on every deploy.

### API Design
- **`http_method_names` on ViewSets restricts ALL actions** — if you set `['get', 'patch']`, custom `@action(methods=['post'])` endpoints will return 405. Always include methods needed by your custom actions.
- Use `@action(detail=False, methods=['post'])` for custom endpoints on ViewSets.
- Add proper error handling in API views — don't let exceptions bubble up as 500s.
- For paginated endpoints, always return `{ count, next, previous, results }` format.

### Authentication
- SimpleJWT's `TokenObtainPairView` uses `USERNAME_FIELD` from the User model. If you change the User model, the login field changes too.
- For email+username login: write a simple custom serializer with `email` and `password` fields, use `django.contrib.auth.authenticate()`, and return `RefreshToken.for_user(user)`. Don't fight `TokenObtainPairSerializer`.
- Custom auth backend: implement `authenticate(self, request, username=None, password=None)` and query `Q(username=username) | Q(email=username)`.

### Static Files
- **Always run `collectstatic` in the deploy command** — without it, Django admin gets 500 errors.
- Use `CompressedStaticFilesStorage`, not `ManifestStaticFilesStorage` (Manifest can break with missing files).

---

## Next.js Frontend

### Responsive Design
- **Don't put action buttons in a `flex` row with the page title** — they overflow on mobile. Use a `grid grid-cols-2 sm:grid-cols-4` below the title instead.
- For data tables: use card layout on mobile (`sm:hidden` for cards, `hidden sm:block` for table). Tables are unreadable on phones.
- Use `px-3 sm:px-4` and `py-4 sm:py-8` for tighter mobile spacing.
- Always test with a 390px viewport (iPhone 14).

### Data Fetching
- **Always handle failed API calls** — if `Promise.all` has one failing call, the whole page hangs on "Loading..." forever.
- Pattern: `.then(r => r.ok ? r.json() : fallbackValue)` and wrap in `.catch(() => {})`.
- Add `.finally(() => setLoading(false))` so the loading state always resolves.

### Auth Flow
- Store JWT tokens in `localStorage` (access + refresh).
- On 401, try refreshing the token once. If refresh fails, redirect to login.
- `isLoggedIn()` should check `localStorage` for access token presence.
- After registration, auto-login by storing the returned tokens.

---

## Railway Deployment

### Deploy Triggers
- **Railway auto-deploy does NOT reliably work** — always trigger manually via GraphQL API.
- Use `serviceInstanceDeploy` with `latestCommit: true`. Never use `serviceInstanceRedeploy` — it reuses the old image.
- Deploy builds take ~2-3 minutes.

### railway.json
- `startCommand` in `railway.json` **overrides Procfile** — always use `startCommand`.
- Chain commands with `&&`: `collectstatic && migrate && createsuperadmin && seed && gunicorn`.
- Don't leave one-time fix scripts in the start command — they run on every restart.

### Database
- Railway Postgres uses internal URLs (`postgres.railway.internal`) — you can't connect from outside Railway.
- To run one-time DB operations, add a management command to the deploy start command, deploy once, then remove it.
- `dj_database_url.config()` with a SQLite fallback works well for local dev.

### Debugging Deploys
- Check deploy status via GraphQL: `deployments(first: 1, input: { serviceId, environmentId }) { edges { node { id status } } }`.
- Get logs: `deploymentLogs(deploymentId: "...", limit: 80) { message }`.
- A deploy can show `SUCCESS` but the app still crashes at runtime (e.g., management command fails after gunicorn starts). Check logs.

---

## PDF Parsing (Bank Statements)

### Library
- **pdfplumber** is the best choice for text-based PDFs (most bank statements). No Java dependency (unlike tabula), more reliable than camelot for simple tables.

### Extraction Strategy
1. Try `page.extract_tables()` first — works when PDFs have visible table borders.
2. Fall back to text line parsing: find lines starting with a date, ending with an amount.
3. Auto-detect columns from headers OR infer from data patterns (date-like, amount-like, text-like).

### Credit Card vs Bank Statement
- **Critical**: Credit card PDFs list charges as positive numbers, payments as negative. Bank statements are the opposite.
- Detect by checking if >60% of amounts are positive → credit card format.
- Flip the sign logic accordingly: positive = expense for credit cards, positive = income for banks.

### Date/Amount Parsing
- Support multiple date formats: `MM/DD/YYYY`, `YYYY-MM-DD`, `MM/DD/YY`, `Mon DD, YYYY`, `MM/DD`.
- Amount parsing: strip `$`, commas, handle parentheses as negative `(123.45)` → `-123.45`.
- Deduplicate extracted transactions by (date, amount, description) tuple.

---

## Performance

### N+1 Queries
- The #1 performance killer. Always use `select_related()` for ForeignKey fields and `prefetch_related()` for reverse/M2M relations.
- In Django admin: `list_select_related`.
- In DRF ViewSets: override `get_queryset()` with `.select_related('category', 'user')`.

### Subscription Detection
- Don't query the DB per-merchant in a loop (N+1). Use a single aggregation query: `values('merchant').annotate(count=Count('id'), avg_amount=Avg('amount'), min_date=Min('date'), max_date=Max('date'))`.
- Filter `count__gte=2` in the query, not in Python.

---

## CORS
- Always set `CORS_ALLOWED_ORIGINS` to include the frontend URL.
- For debugging, `CORS_ALLOW_ALL_ORIGINS = True` can help identify if CORS is the issue.
- Mobile Safari can be stricter about CORS than desktop browsers.

---

## General Principles
- **Ship it, then fix it** — a working deploy with a known bug beats a perfect local build.
- **Don't mess with Django core** — extend, don't replace. Use AbstractUser, not AbstractBaseUser. Use built-in admin. Use built-in auth backends.
- **Leverage the framework** — Django and Next.js solve most problems already. Don't reinvent pagination, auth, static files, etc.
- **Test against the deployed environment** — local SQLite behaves differently from Railway Postgres (especially around migrations, constraints, and concurrent access).
- **Keep deploy commands idempotent** — every command in `startCommand` runs on every restart. Use "create if not exists" patterns.
- **No features without customers** — don't over-build. Phase 1 should be the smallest useful thing.
