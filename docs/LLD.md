# FitForge — Low-Level Design (LLD)

**Companion to:** [HLD.md](./HLD.md)  
**Scope:** Concrete modules, APIs, sequences, data models, and frontend wiring  
**Last updated:** 2026-10-14

---

## 1. Repository map

| Path | Responsibility |
|------|----------------|
| auth-service (separate deploy) | Issue access/refresh JWTs (~3302) |
| `services/` | NestJS API (~3303) — JWT verify, Profile, FitForge, Career, … |
| `services/src/fitforge/` | Fitness domain modules |
| `services/db-schema/postgres/prisma/schema.prisma` | Relational models |
| `services/db-schema/postgres/constants/fitforge-values.ts` | Domain string enums |
| `services/db-schema/mongodb/schemas/user-image.schema.ts` | Image documents |
| `services/docs/*fitforge*.postman_collection.json` | Postman collections |
| `fitnessai/` | Expo mobile client |
| `thinktank_desktop/` | Next.js desktop client (fitness under `/fitness`) |

---

## 2. Backend LLD

### 2.1 Nest module graph (FitForge)

Entry: `services/src/fitforge/fitforge.module.ts` imported by `AppModule`.

| Submodule | Controllers (prefix) | Core services |
|-----------|----------------------|---------------|
| User onboarding | `onboarding` | step tracking |
| Fitness | `fitness` | goals + profile CRUD, plans summary |
| Fitness profile | `fitness-profile` | alternate/profile-focused API |
| Foods | `foods` | catalog CRUD, nutrition estimate |
| Food preferences | `food-preferences` | `favorite` \| `available` \| `restricted` |
| Nutrition preferences | `nutrition-preferences` | meals/day, cuisine, budget, … |
| Physique goals | `physique-goals` | goal catalog |
| Diet | `diet` | create/activate diet from AI targets |
| Meal plans | `meal-plans` | plan CRUD, replace items, tracking helpers |
| Grocery | `grocery` | lists from meal plans |
| Transformation | `transformation` | formula targets + milestones (not LLM) |
| Meals execution | `meals` | complete/partial/skip/undo/replace/log-eaten |
| Hydration | `hydration` | log water |
| Workouts | `workouts` | plans + days/exercises |
| Workout session / engine | `workouts` (execution routes) | start/end/log session |
| Checkins | `checkins` | daily check-in aggregates |
| Dashboard | `dashboard` | today/summary/compliance/streak |
| Progress | `progress` | metrics + photo sets |
| Meal logs | `meal-logs` | log queries |
| Images | `images` | multipart upload, list, delete |
| Uploads | `uploads` | presigned URLs (legacy/alt path) |
| AI chat | `ai` | coach chat |
| Cache | `cache` | admin/debug cache ops |
| Redis infra | — | `RedisService`, FitForge cache keys/TTLs |

Shared / external:

| Module | Prefix | Notes |
|--------|--------|-------|
| **auth-service** | `/auth/*` | login, signup, google, refresh (**issues** tokens) |
| `services` Auth | — | Global JWT guard + Passport strategy (**verifies** access JWT only) |
| Profile | `/profile` | GET + PATCH account — **flat** body (no FitForge envelope) |

### 2.2 Request pipeline

```text
HTTP → Nest middleware (Bearer strip) → JWT guard
  → verify JWT_ACCESS_SECRET → load User (reject deleted)
  → @CurrentUser() { userId, email, role }
  → Controller DTO validation (class-validator)
  → Service → Prisma / Mongo / Redis / R2 / LlmService
  → FitForge: successResponse / paginatedResponse
  → Profile: flat object
```

Public routes use `@Public()`. Swagger UI at `/api/docs` only.

### 2.3 Auth & session

| Concern | Where |
|---------|--------|
| Issue access/refresh | **auth-service**; clients call `authApiUrl` |
| Verify access on FitForge | `services` `JwtStrategy` + `JWT_ACCESS_SECRET` (must match auth-service) |
| Refresh token rows | Postgres `RefreshToken` (owned by auth flow) |
| Profile password change | `ProfileService` argon2 (same algorithm as auth-service) |

Mobile: `tokenRefresh.ts` hits `env.authApiUrl/auth/refresh`, proactive refresh ~60s before `exp`, SecureStore session. Desktop: `apiSlice` baseQuery + same refresh pattern via `/api` proxy or direct.

### 2.4 Profile API (account, not fitness biometrics)

| Method | Path | Body / notes |
|--------|------|--------------|
| GET | `/profile` | Flat `{ name, email, phone, avatar, imageUrl, role }` |
| PATCH | `/profile` | Partial: `name`, `phone`, `avatar` **or** `imageUrl`, `currentPassword`+`newPassword` |

Service prefers `imageUrl` then falls back to `avatar`; empty string clears avatar.

### 2.5 Images & uploads (two paths)

#### A. Optimized images (avatars, food, most UI) — preferred

| Method | Path | Notes |
|--------|------|-------|
| POST | `/images` | multipart `type` + `file`; header `Idempotency-Key`; max ~15MB |
| GET | `/images` | List; `?type=` |
| GET | `/images/:id` | One image |
| DELETE | `/images/:id` | By id |
| DELETE | `/images/by-path` | Body `{ url }` — R2 variants + Mongo row |

**Upload algorithm (`ImagesService.upload`):**

1. Multer `memoryStorage`; MIME allowlist (jpeg/png/webp/avif/gif/heic).
2. Normalize `type` slug; Idempotency-Key + SHA-256 Redis dedupe (~10 min) + in-process map.
3. Sharp sizes: original, thumbnail(200), small(480), medium(800), large(1200) × webp/jpeg/avif + blurDataUrl.
4. R2 keys: `uploads/{userId}/{type}/{imageId}/{size}.{ext}` (`R2_*` env).
5. Mongo `user_images` metadata.
6. Return `{ id, type, images: { medium: { webp, jpeg, … }, … } }` (inside FitForge envelope).

Clients pick **preferred URL** (medium.webp → jpeg → …) for `avatar` / entity `imageUrl`.

#### B. Presigned uploads (legacy / progress photos)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/uploads/presigned-url` | Client PUTs to R2 |
| POST | `/uploads/confirm` | Redis pending → Postgres `Upload`; may create `ProgressPhoto` |

### 2.6 Fitness profile & plans

**Façade `/fitness`** (`FitnessApiService` — preferred for FE):

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/fitness/goals` | Goals |
| PATCH | `/fitness/goals/:id` | Update goal |
| GET/POST/PATCH | `/fitness/profile` | Biometrics + prefs; completing onboarding can kick async AI diet/workout |
| GET | `/fitness/plans` | Active diet/meal/workout summary |

**Internal/alternate `/fitness-profile`:** POST/GET/PUT + `GET metrics` (BMI/BMR/TDEE).  
**`/physique-goals`:** catalog CRUD (card `imageUrl`s).  
**`/onboarding`:** GET/PATCH step; POST complete.

Clients may fall back between `/fitness/profile` and `/fitness-profile`.

### 2.7 Meal execution API

Controller: `execution/meals` → `@Controller('meals')`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/meals/log-eaten` | Ad-hoc eaten meal (not from plan item) |
| POST | `/meals/:mealId/complete` | Full planned meal done |
| POST | `/meals/:mealId/partial` | Partial portion |
| POST | `/meals/:mealId/undo` | Revert log |
| POST | `/meals/:mealId/skip` | Skip meal |
| POST | `/meals/:mealId/replace` | Swap food |

Writes `MealLog` (status, consumedQuantity, actual macros, replacementFoodId, …).

### 2.8 Dashboard, compliance, checkins

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/dashboard` | Full payload |
| GET | `/dashboard/today` | Today-focused |
| GET | `/dashboard/compliance` | Breakdown |
| GET | `/dashboard/streak` | Streak |
| GET | `/dashboard/summary` | Compact / week-month |

**Score engine weights:** meals 30% + workout 30% + calories 15% + protein 15% + water 10%. Compliant day if score ≥ **60**.

`DailyCheckin` is rebuilt by checkin aggregators from meal/hydration/workout/progress events (`/checkins/*`).

### 2.9 Workouts

- Plan CRUD / fetch under `/workouts`.
- Session: start / end / log via execution controllers (same `/workouts` prefix, different route files).
- AI: `ai-workout-plan.service.ts` + generation pipeline.

### 2.10 Diet & meal planning

**`/diet`:** `generate`, `regenerate`, `generate-targets`, `from-targets`, create, `active`/`history`/`planner`, planner hydration patch, `:id/activate`, delete.

**`/meal-plans`:** `generate` / `generate-ai`, `active`, `today`, nutrition-summary, history, item CRUD, complete/undo/skip/replace (plan-level), activate.

**`/grocery`:** generate, current, history — aggregated from active meal plan.

AI: `AiDietTargetsService`, `AiMealPlanService`, diet prompt builders; plans store `prompt` + `responseJson`.

### 2.11 Preferences & foods

- `/foods` — categories, list/CRUD, `custom`, `POST estimate-nutrition` (LLM).
- `/food-preferences` — types `favorite` \| `available` \| `restricted`.
- `/nutrition-preferences` — GET/POST/PATCH/DELETE (budget, cuisine, mealsPerDay, cooking time, timing).

### 2.12 Hydration, progress, transformation

- `/hydration` — POST log, GET today.
- `/progress` — body metric CRUD, analytics, photo sets (images and/or `/uploads` confirm → `ProgressPhoto`).
- `/transformation` — `POST generate` (formula), GET active/history, `:id/milestones`.

### 2.13 AI chat (desktop coach; API available to all)

- `/ai` — chat, history, sessions/messages; `ConversationService` + context/prompt builders + reply validator.
- FitForge `GeminiService` is a thin façade over shared `LlmService` failover.

### 2.14 Postgres models (fitness-critical)

```text
User
 ├─ UserFitnessProfile
 ├─ UserFoodPreference ── FoodMaster
 ├─ UserNutritionPreference
 ├─ DietPlan ── MealPlan ── MealPlanItem ── MealLog
 ├─ WorkoutPlan ── WorkoutDay ── WorkoutExercise
 │                 └─ WorkoutSessionLog / logs
 ├─ Hydration / checkin / compliance / progress entities
 └─ RefreshToken, UserOnboarding, …
```

**Lifecycle tip:** DietPlan/MealPlan/WorkoutPlan use `version` + `status` (`draft` → active). AI stores `prompt` + `responseJson` for audit/remap.

### 2.15 Mongo user image document (shape)

```text
{
  id, userId, type, originalFileName, folderPath, blurDataUrl,
  images: {
    original|thumbnail|small|medium|large: {
      webp, jpeg, avif, width, height, bytes
    }
  }
}
```

---

## 3. Mobile LLD (`fitnessai`)

### 3.1 Boot & providers

```text
index → App
  → AppProviders (Redux, ThemeProvider, VersionGate, NavigationContainer, Toast)
    → RootNavigator
         Auth? → AuthNavigator (Login/Signup)
         App?  → AppNavigator (MainTabs + FitnessSetup)
```

Files: `src/app/providers.tsx`, `src/navigation/*`.

### 3.2 Navigation

**Tabs** (`AppNavigator` / `BottomTabBar`):

1. Analytics (initial)
2. Profile
3. Workout
4. Meals
5. Transformation (Journey)

**Stack overlay:** `FitnessSetup` (gesture enabled only in `mode: 'edit'`).

**Onboarding gate:** `FitnessOnboardingGate` checks fitness profile; redirects to setup.

### 3.3 API layer

| File | Backend |
|------|---------|
| `api/baseApi.ts` | Axios instance + auth header interceptor |
| `api/authApi.ts` | auth-service `/auth/*` (`env.authApiUrl`) |
| `api/profileApi.ts` | services `/profile` (flat) |
| `api/imagesApi.ts` | `/images` via Expo `File.upload` MULTIPART |
| `api/fitnessApi.ts` | `/fitness/*` |
| `api/dashboardApi.ts` | `/dashboard*` |
| `api/mealApi.ts` | meal plan + `/meals/*` execution |
| `api/dietApi.ts` | `/diet` |
| `api/foodApi.ts` / `foodPreferencesApi.ts` | foods + prefs |
| `api/nutritionPreferencesApi.ts` | nutrition prefs |
| `api/workoutApi.ts` | workouts + sessions |
| `api/hydrationApi.ts` | hydration |
| `api/transformationApi.ts` | transformation |
| `services/tokenRefresh.ts` | 401 refresh + proactive refresh timer |
| `services/authSession.ts` | persist session |

Normalizers: `src/lib/fitness/*Response.ts`, `src/lib/images/imageResponse.ts`.

### 3.4 Screen responsibilities

| Screen | Data in | UI building blocks |
|--------|---------|-------------------|
| `AnalyticsScreen` | dashboard | `HomeTopBar`, hero score, meal/workout/water cards, account drawer |
| `MealsScreen` | meals + diet + nutrition | Horizontal pager: Meals / `DietPanel` / `NutritionPanel` |
| `WorkoutScreen` | workout plan/session | Day list, session controls, `ImageUploadThumb` |
| `ProfileScreen` | fitness profile | `FitnessProfilePanel`, edit exit to Profile |
| `TransformationScreen` | transformation APIs | Quotes, daily focus, history drawer |
| `FitnessSetupScreen` | fitness POST/PATCH | Multi-step form → plans |

### 3.5 Profile / avatar sequence (mobile)

```text
UserAccountDrawer.openEdit
  → hide SideDrawer Modal (avoid nested iOS Modals)
  → delay → ProfileEditSheet visible

Pick photo
  → pickAndPrepareImage (expo-image-picker + manipulator JPEG ≤2000px)
  → uploadImage({ uri, type: 'profile' })
       ExpoFile.upload MULTIPART fieldName=file parameters={type}
  → getPreferredImageUrl → hold in state/ref (“New photo ready”)

Save
  → updateProfile({ name, phone, avatar: url })  // desktop-aligned: all profile fields when dirty
  → Redux userProfileUpdated + saveSession
  → onSaved → close sheet → reload profile
```

Theme toggle on drawer + edit sheet → `ThemeContext.setMode` → AsyncStorage key `theme-mode`.

### 3.6 Theme & palette

| System | Hook | Used by |
|--------|------|---------|
| App chrome / auth | `useTheme().colors` | AppShell, auth, ProfileEditSheet |
| Fitness screens | `useFitnessPalette()` | Dashboard cards, meals, workouts |

Icon chips must use `p.surfaceElevated` + `p.text` (never hardcoded dark rgba) so light mode stays readable.

### 3.7 Image upload implementation note (SDK 56)

Do **not** use RN `{ uri, name, type }` with expo/fetch (Unsupported FormDataPart).  
Do **not** `new Blob([arrayBuffer])` (unsupported on RN Blob).  
**Do** `expo-file-system` `File.upload({ uploadType: MULTIPART, … })`.

---

## 4. Desktop LLD (`thinktank_desktop`)

### 4.1 Routes & shell

Under `src/app/(protected)/fitness/`:

- `dashboard`, `setup`, `meals`, `diet`, `workout`, `progress`, `transformation`, `food-preferences`
- Layout: `FitnessCoachHost` (floating coach)
- Gate: `FitForgeShell` / module `fitforge` enabled in Settings
- Nav: `src/lib/fitness/navConfig.ts`; portal `/fitforge` → transformation

Account avatar: `/settings` → `ProfileSettingsSection` (not under `/fitness`).

### 4.2 Data layer

```text
Component / hook (useDashboard, useMealExecution, …)
  → RTK Query hook
  → *Api.ts injectEndpoints + unwrap
  → *.service.ts { url, method, body, headers }
  → apiSlice baseQuery (Bearer + 401 refresh; often baseUrl `/api` BFF/proxy)
```

APIs: `fitness`, `dashboard`, `meal`, `mealExecution`, `diet`, `workout`, `progress`, `hydration`, `food`, `nutritionPreferences`, `transformation`, `images`, `aiCoach`, `profile`.

Libs: `src/lib/fitness/**` (dashboard, meals, diet, workout, progress, food, transformation, execution, coach, schemas).

### 4.3 Avatar (desktop reference)

`ProfileSettingsSection` + `ProfileAvatarPicker` (`ImageLibraryPicker`):

1. Upload or pick existing image → preferred URL into form `avatar`.
2. Save → `PATCH /profile` with `{ name, phone, avatar }` when profile dirty (+ optional password).

`images.service.upload`: browser `FormData` `type` + `File` + Idempotency-Key — contract mobile mirrors with Expo `File.upload` MULTIPART.

---

## 5. Sequence diagrams (selected)

### 5.1 Login → Analytics

```text
Client                Auth API              Dashboard API
  │ POST /auth/login      │                      │
  │──────────────────────>│                      │
  │ tokens + user         │                      │
  │<──────────────────────│                      │
  │ persist session       │                      │
  │ GET /dashboard/today  │                      │
  │─────────────────────────────────────────────>│
  │ dashboard DTO         │                      │
  │<─────────────────────────────────────────────│
  │ render Analytics      │                      │
```

### 5.2 Complete meal → score update

```text
Meals UI          Meals API           DB              Dashboard
  │ POST /meals/:id/complete │          │                 │
  │─────────────────────────>│          │                 │
  │                          │ write MealLog              │
  │                          │─────────>│                 │
  │ 200 OK                   │          │                 │
  │<─────────────────────────│          │                 │
  │ refresh dashboard        │          │                 │
  │──────────────────────────────────────────────────────>│
  │                          │ read logs/compliance       │
  │                          │          │<────────────────│
  │ new score payload        │          │                 │
  │<──────────────────────────────────────────────────────│
```

### 5.3 Image → avatar

```text
Client            Images API         Optimize/R2/Mongo      Profile API
  │ POST /images multipart │               │                    │
  │───────────────────────>│               │                    │
  │                        │ optimize+put+save                  │
  │                        │──────────────>│                    │
  │ { images.medium.webp } │               │                    │
  │<───────────────────────│               │                    │
  │ PATCH /profile {avatar:url}            │                    │
  │───────────────────────────────────────────────────────────>│
  │                        │               │     update User    │
  │ updated profile        │               │                    │
  │<───────────────────────────────────────────────────────────│
```

---

## 6. API contract cheat sheet (clients)

| Feature | Host | Primary endpoints |
|---------|------|-------------------|
| Auth | auth-service | `POST /auth/login`, `/signup`, `/google`, `/refresh` |
| Account | services | `GET/PATCH /profile` (flat) |
| Media | services | `POST/GET /images`, `DELETE /images/:id\|by-path`; alt `/uploads/*` |
| Setup | services | `/fitness/*`, `/fitness-profile`, `/physique-goals`, `/onboarding` |
| Dashboard | services | `/dashboard`, `/today`, `/compliance`, `/streak`, `/summary` |
| Meals exec | services | `/meals/:id/complete\|partial\|skip\|undo\|replace`, `/meals/log-eaten` |
| Diet / plans / grocery | services | `/diet/*`, `/meal-plans/*`, `/grocery/*` |
| Foods / prefs | services | `/foods`, `/food-preferences`, `/nutrition-preferences` |
| Workouts | services | `/workouts/*` (plan + session + set engine) |
| Water / checkins | services | `/hydration/*`, `/checkins/*` |
| Progress | services | `/progress/*` (desktop-heavy) |
| Journey | services | `/transformation/*` |
| Coach | services | `/ai/*` (desktop host UI) |
| Cache | services | `/cache/*` |

Base URL for FitForge: services host **without** `/api` prefix. DTO folders under each Nest module remain source of truth for fields.

---

## 7. Error & empty-state handling

| Layer | Behavior |
|-------|----------|
| Nest | `BadRequest` / `Conflict` / `Unauthorized` / `NotFound` with message |
| Mobile | Toast and/or inline `formError` (modals hide root Toast — prefer inline inside Modal) |
| Desktop | `useToast` + RTK error unwrap via `getApiErrorMessage` |
| Missing fitness profile | Clients gate to setup; some queries soft-empty on 404 |

---

## 8. Security & privacy notes (implementation)

- Never log tokens or `.env` values.
- Image URLs are user-scoped; delete-by-path checks ownership.
- Password change requires current password when one exists.
- Idempotency keys on uploads reduce duplicate storage on retries.

---

## 9. File index (quick jump)

### Backend

- `services/src/fitforge/fitforge.module.ts`
- `services/src/profile/profile.service.ts`
- `services/src/fitforge/media/images/services/images.service.ts`
- `services/src/fitforge/tracking/dashboard/routes/dashboard.controller.ts`
- `services/src/fitforge/execution/meals/routes/meals.controller.ts`
- `services/db-schema/postgres/prisma/schema.prisma`

### Mobile

- `fitnessai/src/navigation/AppNavigator.tsx`
- `fitnessai/src/api/*.ts`
- `fitnessai/src/screens/app/*`
- `fitnessai/src/components/app/ProfileEditSheet.tsx`
- `fitnessai/src/contexts/ThemeContext.tsx`

### Desktop

- `thinktank_desktop/src/app/(protected)/fitness/**`
- `thinktank_desktop/src/lib/services/*Api.ts`
- `thinktank_desktop/src/components/settings/ProfileSettingsSection.tsx`
- `thinktank_desktop/src/lib/services/images.service.ts`

---

## 10. Extension guidelines

1. **New FitForge feature:** add Nest module under the right domain (`onboarding|planning|execution|tracking|training|media|ai`) → register in `FitforgeModule` → add client API + screen.
2. **New image consumer:** always `POST /images` then store returned URL on the domain entity / profile — never upload binaries to Postgres.
3. **Keep mobile/desktop contracts aligned** — prefer shared field names; normalize on the client if backend aliases (`avatar` / `imageUrl`).
4. **Theme-safe UI:** all chrome colors from palette/theme tokens; no dark-only hardcoded icon chip backgrounds.
