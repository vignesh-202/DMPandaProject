# DM Panda Migration Task List

## Phase 1: Preparation & Setup
- [x] Configure `Frontend/package.json` for Next.js
- [x] Create `next.config.js` and `tsconfig.json`
- [x] Set up root `layout.tsx` and `page.tsx`
- [x] Adapt `AuthContext.tsx` for Next.js
- [x] Set up Appwrite server/client utilities
- [ ] Initialize Node.js worker in `/node-worker` folder
- [ ] Initialize Node.js functions in `/functions-node` folder

## Phase 2: Frontend Migration
- [x] Convert `login/page.tsx`
- [x] Set up `dashboard/layout.tsx` and `ProtectedRoute.tsx`
- [x] Convert `dashboard/page.tsx`
- [ ] Convert other dashboard sub-views (DMAutomation, etc.)
- [ ] Convert remaining standalone pages (affiliate, support, etc.)

## Phase 3: Backend API Migration
- [x] Create `/api/me` route
- [x] Create `/api/login` route
- [ ] Add `/api/register`
- [ ] Add `/api/logout`
- [ ] Complete all Instagram routes (`/api/instagram/*`)
- [ ] Complete all Account routes (`/api/account/*`)
- [ ] Complete all Payment routes (`/api/payments/*`)
- [ ] Webhook routes (`/api/webhooks/instagram`)

## Phase 4: Worker & Functions Migration
- [ ] Implement Node.js DM automation processor
- [ ] Add keyword matching + template rendering
- [ ] Rewrite Appwrite functions in Node.js

## Phase 5: Verification & Cleanup
- [ ] Verify all routes and features
- [ ] Test end-to-end automation
- [ ] Deploy to Hostinger
- [ ] Decommission Python backend/worker (after verification)
