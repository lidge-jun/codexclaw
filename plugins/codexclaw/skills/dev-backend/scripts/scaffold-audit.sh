#!/usr/bin/env bash
set -euo pipefail

# Usage: scaffold-audit.sh [project-path]
# Checks backend/scaffolding conventions owned by dev-scaffolding.

DIR="${1:-.}"
PASS=0
FAIL=0
WARN=0

check() {
  local label="$1" result="$2"
  if [ "$result" = "pass" ]; then
    echo "  ✅ $label"
    PASS=$((PASS + 1))
  elif [ "$result" = "warn" ]; then
    echo "  ⚠️  $label"
    WARN=$((WARN + 1))
  else
    echo "  ❌ $label"
    FAIL=$((FAIL + 1))
  fi
}

echo "🔍 Auditing '$DIR' against backend/scaffolding conventions (see dev-scaffolding)"
echo ""

# 1. Feature-based structure (no controllers/ models/ services/ at src root)
BAD_DIRS=""
for d in controllers models services views helpers middlewares; do
  [ -d "$DIR/src/$d" ] && BAD_DIRS="$BAD_DIRS $d"
done
if [ -n "$BAD_DIRS" ]; then
  check "Feature-based (found type-based dirs:$BAD_DIRS)" "fail"
else
  check "Feature-based structure" "pass"
fi

# Detect project type
IS_GO=false
[ -f "$DIR/go.mod" ] && IS_GO=true

# 2. Colocation — test files next to source files
if [ -d "$DIR/src" ]; then
  if $IS_GO; then
    # Go: check _test.go next to .go files (skip main.go entry points)
    GO_SRC=$(find "$DIR/src" -name "*.go" ! -name "*_test.go" ! -name "main.go" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$GO_SRC" -gt 0 ]; then
      MISSING=0
      while IFS= read -r gofile; do
        TEST_FILE="${gofile%.go}_test.go"
        [ ! -f "$TEST_FILE" ] && MISSING=$((MISSING + 1))
      done < <(find "$DIR/src" -name "*.go" ! -name "*_test.go" ! -name "main.go" 2>/dev/null)
      if [ "$MISSING" -eq 0 ]; then
        check "Colocation (all Go files have tests)" "pass"
      else
        check "Colocation ($MISSING Go file(s) missing test)" "fail"
      fi
    else
      check "Colocation (no Go source files yet)" "warn"
    fi
  else
    TOOL_COUNT=$(find "$DIR/src" -name "*.tool.*" -o -name "*_tool.*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOOL_COUNT" -gt 0 ]; then
    MISSING=0
    while IFS= read -r toolfile; do
      TOOL_DIR=$(dirname "$toolfile")
      # Handle both .tool.js and _tool.py naming
      BASE=$(basename "$toolfile" | sed -E 's/[._]tool\.[^.]+$//')
      TESTS=$(find "$TOOL_DIR" -maxdepth 1 \( -name "${BASE}.test.*" -o -name "test_${BASE}.*" -o -name "${BASE}_test.*" \) 2>/dev/null | wc -l | tr -d ' ')
      [ "$TESTS" -eq 0 ] && MISSING=$((MISSING + 1))
    done < <(find "$DIR/src" -name "*.tool.*" -o -name "*_tool.*" 2>/dev/null)
    if [ "$MISSING" -eq 0 ]; then
      check "Colocation (all tools have tests)" "pass"
    else
      check "Colocation ($MISSING tool(s) missing colocated test)" "fail"
    fi
  else
    check "Colocation (no tool files yet)" "warn"
  fi
  fi
else
  check "Colocation (no src/ directory)" "fail"
fi

# 3. Public boundary exports (skip for Go — packages are boundaries)
if $IS_GO; then
  check "Public boundary exports (Go packages = boundaries)" "pass"
elif [ -d "$DIR/src" ]; then
  FEATURE_DIRS=$(find "$DIR/src" -mindepth 1 -maxdepth 1 -type d ! -name "shared" ! -name "__pycache__" 2>/dev/null)
  if [ -n "$FEATURE_DIRS" ]; then
    MISSING_BARREL=0
    while IFS= read -r fdir; do
      [ ! -f "$fdir/index.js" ] && [ ! -f "$fdir/index.ts" ] && [ ! -f "$fdir/__init__.py" ] && MISSING_BARREL=$((MISSING_BARREL + 1))
    done <<< "$FEATURE_DIRS"
    if [ "$MISSING_BARREL" -eq 0 ]; then
      check "Public boundary exports" "pass"
    else
      check "Public boundary exports ($MISSING_BARREL feature(s) missing index.js/index.ts/__init__.py)" "fail"
    fi
  else
    check "Public boundary exports (no feature dirs yet)" "warn"
  fi
else
  check "Public boundary exports (no src/)" "fail"
fi

# 4. devlog structure
if [ -d "$DIR/docs" ] || [ -d "$DIR/architecture" ] || [ -d "$DIR/plans" ]; then
  check "devlog structure (_plan + _fin)" "pass"
else
  check "devlog structure (missing _plan/ or _fin/)" "fail"
fi

# 5. .env safety
ENV_IGNORED=false
if [ -f "$DIR/.gitignore" ] && grep -Eq '(^|/)\.env($|[[:space:]]|#)' "$DIR/.gitignore"; then
  ENV_IGNORED=true
fi

if [ -f "$DIR/.env" ]; then
  check ".env safety (.env file found!)" "fail"
elif ! $ENV_IGNORED; then
  check ".env safety (.env missing from .gitignore)" "fail"
elif [ -f "$DIR/.env.example" ]; then
  check ".env safety (.gitignore + .env.example)" "pass"
else
  check ".env safety (.env.example missing)" "warn"
fi

# 6. File length (<500 lines)
if [ -d "$DIR/src" ]; then
  LONG_FILES=""
  while IFS= read -r f; do
    LINES=$(wc -l < "$f" | tr -d ' ')
    [ "$LINES" -gt 500 ] && LONG_FILES="$LONG_FILES $(basename "$f"):${LINES}L"
  done < <(find "$DIR/src" -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" \) 2>/dev/null)
  if [ -n "$LONG_FILES" ]; then
    check "File length (<500L) — violations:$LONG_FILES" "fail"
  else
    check "File length (all <500 lines)" "pass"
  fi
fi

# 7. AGENTS.md exists
if [ -f "$DIR/AGENTS.md" ]; then
  check "AGENTS.md exists" "pass"
else
  check "AGENTS.md missing" "warn"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Pass: $PASS  ⚠️ Warn: $WARN  ❌ Fail: $FAIL"
TOTAL=$((PASS + WARN + FAIL))
[ "$TOTAL" -gt 0 ] && SCORE=$((PASS * 100 / TOTAL)) || SCORE=0
echo "  Score: ${SCORE}%"
echo "━━━━━━━━━━━━━━━━━━━━━━━"

[ "$FAIL" -gt 0 ] && exit 1 || exit 0
