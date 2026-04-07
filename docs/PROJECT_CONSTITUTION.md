# 🧠 TRANSFORMIX PROJECT CONSTITUTION

## 1. Product Identity
- **Name:** Transformix AI
- **One-line Purpose:** AI-powered hyper-personalized gym assistant for workouts, meals, and gym access.
- **For:** Fitness enthusiasts who want data-driven hypertrophy and nutrition guidance.
- **Not For:** People looking for generic "follow-along" video workouts.
- **Primary Pain:** Generic plans that don't adapt to real-time performance or equipment availability.

## 2. Success Definition
- **Success IF:** Users can generate a plan in < 10 seconds, log sets with < 3 taps, and see clear progress trends.
- **UX Goal:** High-contrast "dark mode" aesthetics (Onyx/Indigo), production-grade responsiveness.

## 3. Engineering Values
- **Simple > Clever:** Prefer readable React code over complex abstractions.
- **Data Integrity:** Everything must be persisted to IndexedDB (Dexie).
- **AI Integration:** Use Gemini 3 Flash for speed and Pro for reasoning. 
- **Privacy:** User data stays local via IndexedDB.

## 4. Guardrails
- **No Drift:** Do not add social features beyond the specified "Partner" matching.
- **No Bloat:** Keep the bundle small by using ESM imports.
