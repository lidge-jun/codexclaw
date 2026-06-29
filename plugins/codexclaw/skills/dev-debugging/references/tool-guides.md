# Debugging Tool Reference

Runtime-specific debugging commands and techniques. Consult when you need to
attach a debugger, profile performance, or hunt regressions.

---

## Node.js / JavaScript / TypeScript

### Node.js Inspector

```bash
node --inspect app.js              # attach anytime via chrome://inspect
node --inspect-brk app.js         # break before first line of user code
node --inspect-wait app.js        # wait for debugger (Node 22+)
# Default: ws://127.0.0.1:9229 → open chrome://inspect
```

### Debugging Test Runners and Frameworks

```bash
node --inspect-brk node_modules/.bin/vitest run --single-thread  # Vitest
node --inspect-brk node_modules/.bin/jest --runInBand             # Jest
NODE_OPTIONS='--inspect' next dev                                 # Next.js
node --inspect-brk --loader tsx src/server.ts                     # TypeScript
```

### Console Techniques

```javascript
console.trace('How did we get here?');                           // stack trace
console.dir(complexObject, { depth: 4, colors: true });          // deep inspect
console.time('db-query'); await db.query(sql); console.timeEnd('db-query');
if (suspiciousValue === null) debugger;                          // conditional break

console.group('Request Processing');                             // group logs
console.log('Input:', input);
console.log('Result:', result);
console.groupEnd();
```

### Memory Debugging

```bash
node --inspect --max-old-space-size=4096 app.js  # DevTools Memory tab → snapshots
node --trace-warnings app.js                     # MaxListeners, unhandled rejections
```

---

## Python

### pdb / breakpoint()

```python
def process_data(items):
    breakpoint()  # drops into interactive pdb (Python 3.7+)
    return transform(items)

python -m pdb script.py                  # run under debugger
python -m pdb -c continue script.py     # post-mortem: run until crash
```

### pdb Commands

| Command | Short | Description |
|---------|-------|-------------|
| `next` | `n` | Step over |
| `step` | `s` | Step into |
| `continue` | `c` | Continue to next breakpoint |
| `print expr` | `p` | Evaluate and print |
| `list` / `longlist` | `l` / `ll` | Show source / full function |
| `where` | `w` | Show call stack |
| `up` / `down` | `u` / `d` | Navigate call stack |
| `break file:line` | `b` | Set breakpoint |
| `!statement` | | Execute Python statement |

### pytest Integration

```bash
pytest --pdb                        # drop into debugger on first failure
pytest --lf                         # re-run only last-failed tests
pytest -vvs --tb=long --showlocals  # verbose with local vars on failure
```

### Structured Logging (Not print)

```python
import logging
logging.basicConfig(level=logging.DEBUG,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

logger.debug('Processing item=%s state=%s', item_id, state)
logger.error('Connection failed', exc_info=True)  # includes traceback
# NOT: print(f"item: {item_id}")  — unstructured, unfilterable
```

### debugpy (VS Code Remote)

```python
import debugpy
debugpy.listen(("0.0.0.0", 5678))
debugpy.wait_for_client()  # blocks until VS Code attaches
```

---

## Browser / Chrome DevTools

### Essential Tabs

| Tab | Use For |
|-----|---------|
| **Console** | Errors, `console.log`, live JS |
| **Sources** | Breakpoints, step debugging, watch expressions |
| **Network** | API calls, timing, headers, response bodies |
| **Performance** | CPU profiling, flame charts, long tasks |
| **Memory** | Heap snapshots, detached DOM nodes |

### Network Tab Debugging

```
1. Open Network tab → "Preserve log" → filter: XHR / Doc / WS
2. Click request → Headers (status, auth) → Response (body) → Timing (TTFB)
3. Right-click → "Copy as cURL" to reproduce in terminal
4. Throttle dropdown: simulate Slow 3G for loading state testing
```

### React DevTools

```
1. Components tab: inspect props, state, hooks of any component
2. Profiler tab: record → interact → stop → see render durations
3. "Highlight updates" toggle: find unnecessary re-renders
4. Click component → "rendered by" traces the parent render chain
```

---

## git bisect — Regression Hunting

When something "used to work," `git bisect` binary-searches commits to find the break.

```bash
git bisect start
git bisect bad                      # current commit is broken
git bisect good <known-good-sha>   # this commit worked
# Git checks out middle commit → test it → mark good/bad → repeat
git bisect reset                   # return to original branch when done

# Automated (recommended):
git bisect start HEAD <known-good-sha>
git bisect run npm test            # git tests each commit automatically
```

---

## Database Debugging

```sql
-- PostgreSQL: see actual execution plan with timings
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT u.*, COUNT(p.id) FROM users u
LEFT JOIN posts p ON p.user_id = u.id
WHERE u.active = true GROUP BY u.id;
-- Look for: Seq Scan on large tables, Nested Loop with high rows, Sort with high memory

-- Find slow queries (requires pg_stat_statements extension)
SELECT query, calls, mean_exec_time FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;

-- MySQL: enable slow query log
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL long_query_time = 1;
```

---

## Structured Diagnostic Template

When instrumenting a multi-layer system, use this format at each boundary:

```javascript
// Format: === DIAGNOSTIC: [layer] === INPUT | CONFIG | OUTPUT | STATUS
console.log('=== DIAGNOSTIC: UserService.create ===');
console.log('INPUT:', JSON.stringify({ email, name }));
try {
  const result = await userRepo.create({ email, name });
  console.log('OUTPUT:', JSON.stringify(result), '| STATUS: success');
} catch (err) {
  console.log('STATUS: failure -', err.message);
  throw err;
}
```
