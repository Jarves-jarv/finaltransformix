# 🏗 TRANSFORMIX ARCHITECTURE BLUEPRINT

## 1. Stack
- **Frontend:** React 19 (ESM) + Tailwind CSS
- **Icons:** Lucide React
- **Charts:** Recharts (Responsive Area/Line charts)
- **Database:** Dexie.js (IndexedDB wrapper)
- **AI Engine:** @google/genai (Gemini 3 Flash/Pro)

## 2. Data Flow
1. **Onboarding:** Collects profile -> Persists to `db.profile`.
2. **Dashboard:** Aggregates stats from `db.meals`, `db.workouts`, and `db.progress`.
3. **Workout:** Fetches Gemini plan -> Logs sets to memory -> Persists session to `db.workouts`.
4. **Diet:** Gemini analyzes text -> Returns JSON -> Persists to `db.meals`.

## 3. State Management
- Local React `useState` for UI-specific states.
- `ApiService` acts as the Controller for DB operations.
- `App.tsx` manages the global `activeTab` and `profile`.
