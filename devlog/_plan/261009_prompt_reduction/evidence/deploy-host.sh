#!/usr/bin/env bash
# deploy-host.sh — install a pinned codexclaw dev SHA on this host and verify it.
# Usage: CXC_SHA=<full sha> [CXC_CHECKOUT=<path>] bash -l -s < deploy-host.sh   (over ssh or locally)
# Refuses (exit 3) on a dirty or off-dev checkout and never resets. Prints KEY=VALUE lines.
set -uo pipefail
SHA="${CXC_SHA:-}"; CO="${CXC_CHECKOUT:-$HOME/Developer/codexclaw}"
[ -n "$SHA" ] || { echo "RESULT=ERROR no sha"; exit 2; }
cd "$CO" 2>/dev/null || { echo "RESULT=SKIP missing checkout $CO"; exit 3; }
echo "CHECKOUT=$CO"
branch=$(git rev-parse --abbrev-ref HEAD); dirty=$(git status --porcelain --untracked-files=no | wc -l | tr -d ' ')
echo "BRANCH=$branch DIRTY=$dirty HEAD_BEFORE=$(git rev-parse --short HEAD)"
[ "$branch" = "dev" ] || { echo "RESULT=SKIP off-dev"; exit 3; }
[ "$dirty" = "0" ] || { echo "RESULT=SKIP dirty"; exit 3; }
git fetch -q origin || { echo "RESULT=ERROR fetch"; exit 4; }
git merge-base --is-ancestor "$SHA" origin/dev || { echo "RESULT=ERROR sha not on origin/dev"; exit 4; }
git merge-base --is-ancestor HEAD "$SHA" || { echo "RESULT=SKIP local commits not in target"; exit 3; }
CACHE_ROOT="$HOME/.codex/plugins/cache/codexclaw/codexclaw"
OLD=$(ls "$CACHE_ROOT" 2>/dev/null | tail -1); echo "OLD_VERSION=$OLD"
RB="$HOME/.codexclaw-rollback/0.2.42-$(date -u +%Y%m%dT%H%M%SZ)"; mkdir -p "$RB"
[ -n "$OLD" ] && cp -R "$CACHE_ROOT/$OLD" "$RB/cache-$OLD"
cp "$HOME/.codex/config.toml" "$RB/config.toml" 2>/dev/null
echo "ROLLBACK=$RB"
git merge -q --ff-only "$SHA" || { echo "RESULT=ERROR ff"; exit 4; }
echo "HEAD_AFTER=$(git rev-parse HEAD)"
bash scripts/dev-install.sh --no-build > "$RB/install.log" 2>&1; echo "INSTALL_EXIT=$?"
NEW=$(ls "$CACHE_ROOT" | tail -1); echo "NEW_VERSION=$NEW"
CXC="node $CACHE_ROOT/$NEW/bin/cxc.mjs"
$CXC hooks retrust > "$RB/retrust.log" 2>&1; echo "RETRUST_EXIT=$?"
$CXC doctor > "$RB/doctor.log" 2>&1; echo "DOCTOR_EXIT=$?"
echo "TRUST_LINE=$(grep -iE 'trust' "$RB/doctor.log" | head -2 | tr -s ' ' | tr '\n' '|')"
TMP=$(mktemp -d); git archive "$SHA" plugins/codexclaw | tar -x -C "$TMP"
node -e '
const fs=require("fs"),path=require("path");
const [a,b]=process.argv.slice(1);
const skip=(r)=>/(^|\/)(\.DS_Store|\.codexclaw|__pycache__|node_modules)(\/|$)|\.pyc$|^gui\/dist\//.test(r);
const list=(d,base=d,o=new Map())=>{for(const n of fs.readdirSync(d)){const p=path.join(d,n);const r=path.relative(base,p).split(path.sep).join("/");if(skip(r))continue;const s=fs.lstatSync(p);if(s.isDirectory())list(p,base,o);else o.set(r,fs.readFileSync(p));}return o;};
const A=list(a),B=list(b);let missing=0,changed=0,extra=0;const ex=[];
for(const [k,v] of A){if(!B.has(k)){missing++;ex.push("missing "+k);}else if(!B.get(k).equals(v)){changed++;ex.push("changed "+k);}}
for(const k of B.keys())if(!A.has(k)){extra++;ex.push("extra "+k);}
console.log("PAYLOAD missing="+missing+" changed="+changed+" extra="+extra+(ex.length?" first="+ex.slice(0,3).join(";"):""));
' "$TMP/plugins/codexclaw" "$CACHE_ROOT/$NEW"
HOOK="$CACHE_ROOT/$NEW/components/pabcd-state/dist/cli.js"
PAYLOAD='{"hook_event_name":"PreToolUse","session_id":"smoke","cwd":"'"$TMP"'","tool_name":"Bash","tool_input":{"command":"echo $(git push origin HEAD)"}}'
OUT=$(printf '%s' "$PAYLOAD" | node "$HOOK" hook worktree-guard-pretool 2>/dev/null)
echo "$OUT" | grep -q '"deny"' && echo "SMOKE=deny" || echo "SMOKE=NOT-DENIED $(echo "$OUT" | head -c 160)"
echo "RESULT=DONE"

