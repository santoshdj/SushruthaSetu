# ADR 0003: Authentication and Role-Based Authorisation

**Date:** 2026-05-16  
**Status:** Accepted  
**Deciders:** Product owner (via design interview, 2026-05-16)  
**Implements:** ADR 0002 Decision 1 consequence ("Role distinction must be enforced when auth is added")

---

## Context

The app was initially built without authentication (ADR 0001) and the patient registration feature (ADR 0002) deferred role enforcement to a future auth phase. This ADR implements that phase: a login flow using an external identity provider, two user roles (admin and clinician), and enforcement at both the UI and API layers. The solution must work identically on local development, Vercel, and any cloud platform.

All decisions in this ADR were made during a structured design interview on 2026-05-16.

---

## Decisions

### 1. Identity Provider: Clerk

**Decision:** Authentication is delegated to Clerk, an external identity-as-a-service provider. Clerk owns the user store, handles credential verification, issues JWTs, and manages session state. The app never stores passwords.

**Rationale:** Clerk provides a React SDK with pre-built components that integrate natively into the Vite + React stack. It issues standard JWTs verifiable with public JWKS, works identically on localhost and any cloud platform (configuration is entirely via environment variables), has a generous free tier, and requires minimal code to integrate. Self-hosted auth was rejected due to the security surface it introduces.

**Alternatives rejected:**
- *Self-hosted JWT auth* — requires implementing password hashing, token rotation, session storage, and brute-force protection. High security risk, high maintenance burden.
- *Auth0* — functionally equivalent to Clerk but with a more complex developer experience and higher cost at comparable tiers.
- *AWS Cognito* — good fit if the backend is AWS-native, but adds significant configuration complexity for a frontend-first integration.
- *Supabase Auth* — reasonable alternative, but Clerk has better React SDK ergonomics and role/claim support out of the box.

---

### 2. Role Assignment: Clerk Public Metadata

**Decision:** Each user is assigned a `role` field in their Clerk `publicMetadata`: either `"admin"` or `"clinician"`. This value is embedded in the JWT issued by Clerk and available in both the React SDK (`user.publicMetadata.role`) and the decoded JWT on the backend. For MVP, users are created manually in the Clerk dashboard — no self-registration.

**Rationale:** Clerk's `publicMetadata` is the simplest mechanism for custom claims that survive across sessions and are accessible on both client and server. It avoids the complexity of Clerk Organizations while meeting the two-role requirement precisely. Manual user creation prevents unauthorised self-registration against a system containing (even synthetic) patient data.

**Alternatives rejected:**
- *Clerk Organizations* — supports multi-tenant role assignment but introduces significant configuration overhead unnecessary for two roles and a small user set.
- *Backend-managed role store* — storing roles in a separate database adds a dependency and a synchronisation problem between the IdP and the role store.

---

### 3. Permission Matrix

**Decision:** The following permissions apply:

| Feature | `clinician` | `admin` |
|---|---|---|
| View today's schedule | ✅ | ✅ |
| View patient dashboard | ✅ | ✅ |
| View patient list | ✅ | ✅ |
| Search patients by name | ✅ | ✅ |
| Create new patient | ❌ | ✅ |
| Edit patient demographics | ❌ | ✅ |

Clinicians have full read access. Admins have full read and write access. There are no admin-only pages — only admin-only actions. Enforcement is dual-layer: UI (buttons hidden) and API (403 on unauthorised write attempts).

---

### 4. Login UI: Clerk Embedded `<SignIn />` Component

**Decision:** A `/login` route renders Clerk's pre-built `<SignIn />` React component. On successful authentication, the user is redirected to `/` (the schedule page). If a user who is already signed in navigates to `/login`, they are redirected to `/`.

**Rationale:** The embedded component renders inside the app's own layout, avoiding a redirect to a Clerk-hosted subdomain. It handles all error states, loading states, and credential validation internally. Implementation is a single component import — approximately 10 lines of code.

**Alternatives rejected:**
- *Clerk hosted sign-in page* — redirects the user away from the app domain, breaking the single-page experience and looking off-brand.
- *Custom login form* — maximum control, maximum effort. Not justified when Clerk's component produces a clean, functional result.

---

### 5. Frontend Route Protection: `<ProtectedRoute>` Wrapper

**Decision:** A `<ProtectedRoute>` component wraps all routes except `/login` in the router configuration. It uses Clerk's `useAuth()` hook to check `isSignedIn`. If false, it redirects to `/login`. If true, it renders its children. This is the single point of route-level auth enforcement in the frontend.

**Rationale:** A single wrapper in the router config means auth logic lives in one place. Adding new routes is automatically protected — no per-page auth check needed. Clerk's `useAuth()` hook reads from the in-memory session state, so no network call is made on each render.

---

### 6. Role-Based UI: `useRole()` Custom Hook

**Decision:** A `useRole()` custom hook wraps Clerk's `useUser()` hook and returns a typed value of `"admin" | "clinician"`. It reads `user.publicMetadata.role` from the Clerk session. If the role is absent or unrecognised, it returns `"clinician"` as a safe default (fail closed — read-only). Components that conditionally render admin-only actions (New Patient button, Edit row action) consume this hook.

**Rationale:** A custom hook provides a stable, typed interface that decouples components from Clerk's SDK internals. The fail-closed default ensures that a misconfigured user cannot accidentally gain write access. The hook can be extended later (e.g., to fetch roles from a backend) without changing any consuming component.

---

### 7. Backend JWT Verification: PyJWT + Clerk JWKS (Cached)

**Decision:** The FastAPI backend verifies incoming JWTs using `PyJWT`. On startup, the backend fetches Clerk's JWKS from `CLERK_JWKS_URL` and caches the public keys in memory with a TTL. Every authenticated request passes its `Authorization: Bearer {token}` header through a `get_current_user` FastAPI dependency, which verifies the JWT signature, expiry (`exp`), and issuer (`iss`) claims locally using the cached keys. The decoded claims (including `publicMetadata.role`) are returned as the current user object.

**Rationale:** Local verification via JWKS avoids a network call to Clerk on every request, keeping authentication out of the hot path. JWKS is the standard mechanism for verifying JWTs from external IdPs. Caching the keys is safe because Clerk rotates keys infrequently and the JWKS endpoint returns the full key set including any new keys before old ones are retired. For serverless deployments, the TTL-based re-fetch on cold start is a single lightweight HTTP call.

**Alternatives rejected:**
- *Clerk server-side SDK verification* — calls Clerk's API on every authenticated request, adding network latency and an external dependency in the hot path.
- *Symmetric shared secret (HS256)* — requires sharing a secret between Clerk and the backend. Clerk uses RS256 (asymmetric) by default, which is more secure and requires no shared secret.

---

### 8. Backend Authorisation: `require_admin` Dependency

**Decision:** A `require_admin` FastAPI dependency calls `get_current_user` and raises `HTTPException(status_code=403)` if the user's role claim is not `"admin"`. This dependency is applied to `POST /patients` and `PUT /patients/{id}`. All other existing endpoints use `get_current_user` only (authentication required, any role accepted).

**Rationale:** FastAPI's dependency injection system makes it trivial to apply authorisation at the endpoint level. A dedicated `require_admin` dependency is explicit, testable in isolation, and easy to apply to future write endpoints. It enforces the permission matrix at the API layer regardless of what the frontend renders.

---

### 9. Environment Variables

**Decision:** The following environment variables are added:

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk publishable key (safe to expose in browser) |
| `CLERK_JWKS_URL` | Backend | Clerk JWKS endpoint URL |
| `CLERK_ISSUER` | Backend | Clerk issuer URL for JWT `iss` claim validation |

All variables are managed via `.env.local` for local development (gitignored) and platform-native env var management for cloud deployments (Vercel dashboard, AWS Parameter Store, Railway env vars, etc.). A `.env.example` file with placeholder values is committed to the repo. Clerk provides separate key sets for development and production environments in its dashboard — no code changes are needed when switching environments.

---

## Consequences

- All existing API endpoints must now require a valid JWT. The `get_current_user` dependency is added to all route handlers. This is a breaking change for any existing API tests — tests must be updated to supply a mock JWT fixture.
- The frontend must wrap the entire app in `<ClerkProvider>` at the root. This is a one-time change to the app entry point.
- `POST /patients` and `PUT /patients/{id}` are additionally restricted to `admin` role via the `require_admin` dependency.
- The `useRole()` hook's fail-closed default (`"clinician"`) means that if a user's `publicMetadata.role` is not set in Clerk, they will have read-only access. All manually created users must have the role field set explicitly in the Clerk dashboard.
- When a real production deployment is made, Clerk's production key set must be configured in the platform env vars before go-live. Development keys will not work in production.
- SMART on FHIR OAuth2 (the FHIR-native auth standard) is not implemented. This app uses Clerk for application-level auth. A future production EHR integration may require SMART on FHIR on top of or instead of Clerk.
