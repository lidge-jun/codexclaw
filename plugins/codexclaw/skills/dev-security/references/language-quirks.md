# Language-Specific Security Quirks

These are the quiet pitfalls that often survive ordinary code review.
Use this file when the code looks normal but still feels risky.

## JavaScript and TypeScript

### 1. Prototype pollution through object merge
```ts
const payload = { ...req.body };
Object.assign(userSettings, payload);
```
Validate strictly and copy only approved keys.

### 2. `eval` and `Function` execute attacker-controlled code
```ts
const result = eval(req.query.expression as string);
```
Model expressions as data, not executable code.

### 3. `child_process.exec` injects shell syntax
```ts
exec(`convert ${req.query.file} output.png`);
```
Use `execFile` or `spawn` with validated argument arrays.

### 4. `dangerouslySetInnerHTML` bypasses JSX escaping
```tsx
<div dangerouslySetInnerHTML={{ __html: userBio }} />
```
Sanitize HTML and use CSP when rich text is intentional.

### 5. String-built SQL bypasses ORM safety
```ts
await db.$queryRawUnsafe(`SELECT * FROM users WHERE email = '${email}'`);
```
Use tagged templates or parameter placeholders.

### 6. Open redirects via unchecked URLs
```ts
res.redirect(String(req.query.next || '/'));
```
Allow only same-origin or allowlisted relative paths.

### 7. Implicit JSON serialization leaks fields
```ts
res.json(user);
```
Serialize through an explicit DTO that excludes secrets and internal flags.

### 8. Browser token storage is reachable by XSS
```ts
localStorage.setItem('access_token', token);
```
Prefer secure cookies for browser sessions.

### 9. Regex denial of service from user patterns
```ts
new RegExp(req.query.pattern as string).test(target);
```
Avoid dynamic regex or constrain length and syntax aggressively.

### 10. URL construction can smuggle SSRF targets
```ts
const url = `https://${req.body.host}/status`;
```
Resolve against an allowlist or internal service registry.

## Python

### 1. `pickle.loads` executes serialized code
```python
data = pickle.loads(request.data)
```
Use JSON, MessagePack with schema validation, or typed parsers.

### 2. `yaml.load` with unsafe loader is code execution
```python
config = yaml.load(raw_text, Loader=yaml.Loader)
```
Use `yaml.safe_load` for untrusted YAML.

### 3. `subprocess.run(..., shell=True)` injects shell commands
```python
subprocess.run(f"convert {filename} out.png", shell=True)
```
Pass a list with `shell=False`.

### 4. `assert` is not an auth or validation check
```python
assert request.user.is_admin
```
Raise explicit exceptions or return explicit HTTP errors.

### 5. Django `mark_safe` bypasses output escaping
```python
return mark_safe(user_bio)
```
Escape by default and sanitize only approved rich text.

### 6. `eval`, `exec`, and `ast.literal_eval` on untrusted data
```python
query = eval(request.args["filter"])
```
Parse into a constrained schema instead.

### 7. Mass assignment through model constructors
```python
user = User(**request.json)
```
Bind only the fields the server explicitly accepts.

### 8. Pandas `query` and `eval` accept attacker syntax
```python
df.query(request.args["where"])
```
Build filters from allowed columns and operators.

## SQL

### 1. String interpolation is still injection
```sql
SELECT * FROM users WHERE email = '${email}';
```
Use parameter placeholders from the driver.

### 2. Dynamic `ORDER BY` can be injected
```sql
SELECT * FROM orders ORDER BY ${sort};
```
Map user choices to an allowlisted column set.

### 3. Wildcard search can become data exfiltration
```sql
WHERE email LIKE '%' || :term || '%'
```
Constrain searchable fields and rate limit broad queries.

### 4. Tenant scoping must live in the query
```sql
SELECT * FROM invoices WHERE id = $1;
```
Add tenant or owner filters in every access path.

### 5. Collation and case-folding can bypass uniqueness assumptions
```sql
SELECT * FROM users WHERE email = $1;
```
Normalize canonical values before storage and lookup.

### 6. Bulk updates without precise filters become integrity failures
```sql
UPDATE sessions SET revoked = true;
```
Require actor, tenant, or token family filters for every destructive statement.

## Go

### 1. `fmt.Sprintf` query building is SQL injection
```go
query := fmt.Sprintf("SELECT * FROM users WHERE email = '%s'", email)
```
Use `db.QueryContext(ctx, ..., email)` with parameters.

### 2. `html/template` and `text/template` are not interchangeable
```go
tmpl := template.Must(texttemplate.New("page").Parse(userHTML))
```
Use `html/template` for HTML output and avoid untrusted templates.

### 3. Missing `defer cancel()` leaks work and weakens timeouts
```go
ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
_ = cancel
```
Always `defer cancel()` immediately.

### 4. File path joins can still escape a base directory
```go
path := filepath.Join(uploadDir, r.FormValue("name"))
```
Clean, validate, and confirm the final path stays within the intended root.

### 5. Unbounded JSON decoding accepts oversized input
```go
decoder := json.NewDecoder(r.Body)
```
Wrap the body with `http.MaxBytesReader` before decoding.

Use this file together with `references/owasp-top10.md` A05 when the issue involves input, output, or execution sinks.
