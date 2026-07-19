# FitCheck MVP — Plan (000)

## Objective
Build and deploy a fullstack Korean fitness management platform on OpenAI Sites.

## Architecture
- **Stack**: React 19 + Next.js 16 (vinext) on Cloudflare Workers
- **DB**: D1 (6 tables: users, workoutLogs, weightLogs, dailyChecks, photos, splitRoutines)
- **Storage**: R2 for photo uploads
- **Auth**: SIWC (Sign In With ChatGPT)
- **CSS**: Tailwind 4, warm dark theme (#0c0a09 + #f97316 accent)

## File Change Map

### Backend (WP1 — DONE)
- `.openai/hosting.json` → D1=DB, R2=UPLOADS
- `db/schema.ts` → 6 Drizzle tables + unique index on dailyChecks(userId, checkDate)
- `worker/index.ts` → Added R2 Env binding
- `app/api/init/route.ts` → DB table initialization
- `app/api/user/route.ts` → User CRUD (getOrCreate + update)
- `app/api/workouts/route.ts` → Workout log CRUD
- `app/api/weight/route.ts` → Weight log CRUD
- `app/api/habits/route.ts` → Daily check upsert
- `app/api/photos/route.ts` → R2 photo upload + list
- `app/api/community/route.ts` → Cross-user feed + daily motivational quote

### Frontend (WP2)
- `app/components/Icons.tsx` → lucide-react re-exports
- `app/components/BottomNav.tsx` → Bottom nav + DashboardClient + ProfileClient
- `app/page.tsx` → Dashboard (auth gate + motivational quote + weekly progress + quick actions)
- `app/workout/page.tsx` → Exercise logging (category/sets/reps/weight)
- `app/weight/page.tsx` → Weight input + CSS bar chart + 7-day avg
- `app/habits/page.tsx` → Daily habit form (workout/wakeup/diet/exercise/notes) + 7-day calendar
- `app/photos/page.tsx` → R2 photo upload + 2-col gallery
- `app/community/page.tsx` → Social feed + motivational quote
- `app/profile/page.tsx` → Profile edit + stats + sign out

### Deploy (WP3)
- `npm run build` → verify exit 0
- Drizzle migration → `drizzle/0000_*.sql`
- Sites: create_site → push → save version → deploy

## Scope
- IN: Auth, workout logging, weight tracking, habit tracking, photos, community feed, profile
- OUT: Push notifications, wearable integration, real-time chat, advanced analytics charts

## Accept Criteria
1. All 7 API routes return correct JSON responses
2. All 7 pages render without errors
3. `npm run build` exits 0
4. Deployed to Sites with accessible URL
