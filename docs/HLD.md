# FitForge — High-Level Design (HLD)

**Product:** FitForge fitness experience  
**Clients:** `fitnessai` (Expo mobile), `thinktank_desktop` (Next.js web)  
**Backend:** NestJS FitForge API in `services` (JWT validated here; tokens issued by **auth-service**)  
**Last updated:** 2026-10-14 (enriched from codebase exploration)

---

## 1. Purpose

FitForge helps a user set fitness goals, get AI-generated diet/meal/workout plans, execute daily meals & workouts, track hydration/progress/compliance, and manage account identity (profile + avatar).

This HLD describes **system boundaries**, **major components**, **data stores**, **cross-cutting concerns**, and **how frontends talk to the backend** — not class-level detail (see [LLD.md](./LLD.md)).

---

## 2. System context

```text
┌────────────────────┐     ┌─────────────────────────┐
│  fitnessai         │     │  thinktank_desktop      │
│  Expo SDK 56 RN    │     │  Next.js + RTK Query    │
│  Mobile app        │     │  Web FitForge console   │
└─────────┬──────────┘     └────────────┬────────────┘
          │  HTTPS JSON / multipart     │
          │                             │
          ├──────────┬──────────────────┤
          ▼          ▼                  │
┌─────────────────┐  ┌──────────────────▼────────────┐
│ auth-service    │  │ services (NestJS ~:3303)      │
│ (tokens ~:3302) │  │ JWT verify · Profile · FitForge│
│ login/refresh   │  │ (no global /api route prefix) │
└─────────────────┘  └───────┬──────────┬────────────┘
                             │          │
                    ┌────────▼──┐  ┌────▼─────┐  ┌──────────┐
                    │ PostgreSQL│  │ MongoDB  │  │ Redis    │
                    │ (Prisma)  │  │ user_    │  │ optional │
                    │ domain    │  │ images   │  │ cache/   │
                    └───────────┘  └────┬─────┘  │ locks    │
                                       │        └──────────┘
                                  ┌────▼─────┐  ┌────────────┐
                                  │ Cloudflare│  │ LLM        │
                                  │ R2        │  │ Gemini/Grok│
                                  └──────────┘  │ /Cursor FO │
                                                └────────────┘
```

| Layer | Repo / service | Role |
|-------|----------------|------|
| Mobile UI | `fitnessai` | Daily execution: Analytics, Meals (Diet/Nutrition tabs), Workout, Journey, Profile |
| Desktop UI | `thinktank_desktop` | Full FitForge: setup, diet, meals, workout, **progress**, food prefs, **AI coach** |
| Auth issuance | **auth-service** (~3302) | Login, signup, Google, refresh — clients use `AUTH_API_URL` / `EXPO_PUBLIC_AUTH_API_URL` |
| FitForge API | `services` (~3303) | Validates JWT; Profile + FitForge + sibling modules (career/roadmaps) |
| Relational DB | Postgres via Prisma | Users, fitness profile, diet/meals/workouts, logs, checkins |
| Document DB | MongoDB | `user_images` variant metadata (FitForge); other collections for coding platform |
| Cache | Redis (optional) | Plan caches, image idempotency/locks — degrades gracefully if unset |
| Media | Cloudflare R2 | Optimized binaries; also presigned `/uploads` path |
| AI | Shared `LlmModule` | Diet/meal/workout generation, food estimate, coach chat — **not** transformation (formula) |

---

## 3. Product surfaces (what users see)

### 3.1 Mobile (`fitnessai`) — primary tabs

| Tab | Screen | Job |
|-----|--------|-----|
| **Analytics** (landing) | `AnalyticsScreen` | Daily score, compliance, meal/workout/water progress |
| **Profile** | `ProfileScreen` | Fitness profile summary; avatar opens account drawer |
| **Workout** | `WorkoutScreen` | Active plan days, session start/log, exercise images |
| **Meals** | `MealsScreen` | Swipe tabs: Meals \| Diet \| Nutrition |
| **Journey** | `TransformationScreen` | Transformation quotes/focus/history |

Gate: `FitnessOnboardingGate` → if no fitness profile, push `FitnessSetupScreen`.

Account: avatar → `UserAccountDrawer` → Edit profile (`ProfileEditSheet`) + theme toggle + logout.

### 3.2 Desktop (`thinktank_desktop`) — `/fitness/*`

Routes under `(protected)/fitness/`: dashboard, setup, meals, diet, workout, progress, transformation, food-preferences. Shell: `FitForgeShell` / module gate; floating `FitnessCoachHost`. Sidebar `/fitforge` redirects to transformation. Account avatar lives under **Settings** (`ProfileSettingsSection`), not `/fitness`.

**Parity gaps:** Desktop has Progress + AI coach; mobile folds diet/nutrition into Meals and has no dedicated Progress route.

---

## 4. Backend architecture (FitForge domains)

`FitforgeModule` groups vertical slices:

```text
fitforge/
├── onboarding/     # profile, foods, prefs, physique goals, fitness API
├── planning/       # diet, meal-plans, grocery, transformation
├── training/       # workout plans + session execution
├── execution/      # meal complete/skip/replace, hydration
├── tracking/       # dashboard, compliance, progress photos, checkins, meal-logs
├── media/          # images (optimize→R2), uploads (presign)
├── ai/             # coach chat + generation pipelines
└── infrastructure/ # Redis cache helpers
```

### 4.1 Domain map (business meaning)

| Domain | Responsibility |
|--------|----------------|
| **Identity** | User account (name/email/phone/avatar/password) — `ProfileModule` |
| **Fitness profile** | Age, biometrics, goals, experience — drives plan generation |
| **Food catalog** | `FoodMaster` + user likes/dislikes + nutrition prefs |
| **Diet plan** | Macro targets + AI response; versions/status |
| **Meal plan** | Day × meal-type items linked to foods |
| **Meal execution** | Complete / partial / skip / undo / replace / log-eaten |
| **Workout plan** | Days + exercises; AI-generated |
| **Workout session** | Start/end/log sets |
| **Hydration** | Daily water logging |
| **Dashboard / compliance** | Today’s score, streaks, meal/workout/water progress |
| **Progress** | Body metrics + photo sets |
| **Transformation** | Formula-based BMI/BMR/TDEE targets + milestones (not LLM) |
| **Daily checkin** | Aggregated day summary rebuilt from meal/hydration/workout/progress events |
| **Dashboard score** | Weighted: meals 30% + workout 30% + calories 15% + protein 15% + water 10%; day “compliant” if score ≥ 60 |
| **Images** | `POST /images` → Sharp variants → R2 → Mongo; preferred URL may be saved on `User.avatar` or entity `imageUrl` |
| **Uploads (alt)** | Presigned R2 + Postgres `Upload` (e.g. progress photo confirm) |

### 4.2 Shared non-FitForge modules clients still use

| Module | Paths | Used for |
|--------|-------|----------|
| **auth-service** (separate) | `/auth/*` | Login, signup, Google, refresh token issuance |
| `services` `AuthModule` | — | Global JWT **guard/strategy only** (verify access token) |
| `ProfileModule` | `GET/PATCH /profile` | Account name/phone/avatar/password (**flat** JSON, no `{success,data}` wrapper) |
| `HealthModule` | health checks | Ops |
| `LlmModule` | internal | Provider failover (`LLM_PROVIDER_ORDER`, e.g. gemini→grok→cursor) |

Swagger for `services`: `/api/docs` (docs path only — business routes have **no** `/api` prefix).

---

## 5. Frontend ↔ backend integration model

### 5.1 Transport

- **JSON REST** over HTTPS for almost everything.
- **Multipart** `POST /images` for media (`type` + `file` + `Idempotency-Key`).
- Auth: `Authorization: Bearer <accessToken>` (token from auth-service).
- **FitForge envelope:** `{ success, message, data }` (and paginated `{ items, meta }`).
- **Profile exception:** `GET/PATCH /profile` returns **flat** `{ name, email, phone, avatar, imageUrl, role }`.
- Errors: `{ statusCode, error, message, path, timestamp }` via global filter.
- Clients unwrap via helpers (`unwrapFitnessData`, `normalizeUserProfile`, etc.).

### 5.2 Client API styles

| Client | Pattern | Why |
|--------|---------|-----|
| Mobile | Thin `axios` modules under `src/api/*` + response normalizers in `src/lib/fitness/*` | Simple, screen-owned fetch |
| Desktop | RTK Query (`*Api.ts`) + `*.service.ts` request builders | Cache tags, shared hooks |

Both call the **same Nest routes** and share conceptual DTOs (often mirrored TypeScript types).

### 5.3 Auth session flow (both clients)

```text
Login / Google / Signup
    → access + refresh tokens
    → persist (SecureStore/MMKV mobile; web storage desktop)
    → attach Bearer on each request
401 (non-auth URL)
    → single-flight refresh
    → retry original request
Refresh fail
    → clear session → auth screens
```

Secrets (backend): `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` (must match auth-service if split).  
Clients never hold secrets — only tokens + public env (`EXPO_PUBLIC_API_URL`, etc.).

### 5.4 Theme (mobile)

- `ThemeProvider` persists `light` | `dark`.
- App chrome uses `ThemeColors`; fitness screens use `useFitnessPalette()` (`lightFitnessPalette` / `darkFitnessPalette`).
- Toggle lives on Account drawer + Edit profile (and auth/AppShell).

---

## 6. Critical end-to-end flows

### 6.1 Onboarding → plans

```text
Physique goals → fitness profile (biometrics + goal)
  → metrics (BMI/BMR/TDEE)
  → transformation (formula milestones)
  → onboardingCompleted / profile save
  → async AI diet + workout generation (FitnessApiService)
  → activate diet → meal plans → grocery (desktop)
  → Active plans feed Meals / Workout / Dashboard
```

FE often prefers façade `/fitness/*`, with fallback to `/fitness-profile` where implemented.

### 6.2 Daily analytics loop

```text
Analytics opens
  → GET /dashboard (or /dashboard/today)
  → Aggregates meal logs, workout sessions, hydration, compliance engine
  → UI: score ring, meal/workout/water cards, streak
```

### 6.3 Meal execution

```text
GET today’s meal plan items (meal-plans / meals views)
User marks complete | partial | skip | replace | undo
  → POST /meals/:mealId/{complete|partial|skip|replace|undo}
  or POST /meals/log-eaten (ad-hoc)
  → MealLog rows update
  → Dashboard/compliance recalculate
```

### 6.4 Avatar / image upload (desktop parity on mobile)

```text
Pick & compress image (client)
  → POST /images multipart (type e.g. profile|food)
  → Optimize to size/format variants
  → Upload binaries to R2
  → Persist metadata in Mongo user_images
  → Return preferred URL (medium.webp …)
User Save on profile
  → PATCH /profile { avatar: url, name, phone, … }
  → Postgres User.avatar updated
  → Clients refresh session/avatar UI
```

Mobile upload uses Expo `File.upload` multipart (SDK 56); desktop appends browser `File` to `FormData`.

### 6.5 AI generation

```text
Diet / meal / workout generation services
  → Build prompt from fitness profile + prefs + foods
  → LlmModule (ordered providers)
  → Validate JSON
  → Persist DietPlan / MealPlan / WorkoutPlan (+ prompt/responseJson audit)
```

Coach chat: `POST` under `/ai` with structured reply validation.

---

## 7. Data architecture (high level)

### 7.1 PostgreSQL (source of truth for fitness domain)

Examples: `User`, `UserFitnessProfile`, `FoodMaster`, `UserFoodPreference`, `UserNutritionPreference`, `DietPlan`, `MealPlan`, `MealPlanItem`, `MealLog`, `WorkoutPlan`, `WorkoutDay`, `WorkoutExercise`, session/log tables, hydration, compliance, progress, transformation entities.

### 7.2 MongoDB

- **User images**: id, userId, type, folderPath, blurDataUrl, nested `images` variants (original/thumbnail/small/medium/large × webp/jpeg/avif).

### 7.3 Redis

- FitForge response caching (TTL helpers).
- Image upload idempotency / distributed locks to avoid duplicate R2 work.

### 7.4 R2

- Object keys under user/type/uuid folders; public/CDN URLs returned to clients.

---

## 8. Cross-cutting concerns

| Concern | Approach |
|---------|----------|
| **AuthN** | JWT access + refresh; Google OAuth client-side then backend exchange |
| **AuthZ** | `@CurrentUser()` on controllers; user-scoped queries |
| **Idempotency** | `Idempotency-Key` on image upload |
| **Validation** | class-validator DTOs on Nest; Zod/forms on clients |
| **Errors** | HTTP exceptions → client `getApiErrorMessage` |
| **Versioning** | Mobile `VersionGate` / app-version API |
| **Observability** | Nest logs; activity-logs module (broader platform) |
| **Config** | Env vars only (never commit secrets); see services env rules |

---

## 9. Technology choices (what we used for what)

| Need | Choice | Why |
|------|--------|-----|
| Mobile UI | Expo 56 + React Native | Fast iteration, native modules (image picker, file upload) |
| Mobile nav | React Navigation tabs + stack | Custom FAB tab bar |
| Mobile state | Redux (auth) + local screen state | Auth is global; screens fetch own data |
| Desktop UI | Next.js App Router | Shared ThinkTank shell |
| Desktop data | RTK Query | Cache invalidation across fitness pages |
| API | NestJS modules | Clear domain boundaries inside one deployable |
| ORM | Prisma → Postgres | Typed relational fitness model |
| Images meta | Mongo | Flexible nested variant documents |
| Image binary | Sharp optimize + R2 | Multi-size CDN delivery |
| AI | Shared LlmModule | Provider failover (Gemini/Grok/…) |
| Cache/locks | Redis | Hot dashboard paths + upload dedupe |
| Theme | Context + dual palettes | Light/dark across fitness chrome |

---

## 10. Deployment / runtime topology (logical)

```text
[ Mobile / Web clients ]
        │
        ▼
[ NestJS API process ] ── Prisma ── Postgres
        │            ── Mongoose ── MongoDB
        │            ── ioredis ── Redis
        │            ── AWS S3 SDK-compatible ── R2
        └──────────── LlmModule ── external LLM APIs
```

Exact hosting is environment-specific; clients point at `API_URL` / `EXPO_PUBLIC_API_URL`.

---

## 11. Non-goals / boundaries

- FitForge does **not** own career/roadmap question banks (sibling modules in same Nest app).
- Clients do **not** talk to R2 or LLMs directly for core flows (except loading public image URLs).
- Mobile does not duplicate every desktop planner screen; it prioritizes daily execution + key prefs (Diet/Nutrition tabs).

---

## 12. Related docs

- [LLD.md](./LLD.md) — modules, APIs, sequences, file map, component contracts  
- Backend code: `services/src/fitforge/`  
- Desktop fitness: `thinktank_desktop/src/app/(protected)/fitness/`  
- Mobile app: `fitnessai/src/`
