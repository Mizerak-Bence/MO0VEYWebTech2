Web-technológia 2 2025/26/2

## Beadandó: Pálinka nyilvántartó

Stack: Angular (+Material) + Node.js (Express) + MongoDB

### Funkciók
- Bejelentkezés (név + jelszó, JWT)
- Pálinka tételek kilistázása
- Új tétel felvétele (duplikáció tiltás: név alapján, felhasználónként)
- Validáció (frontend + backend)

### Futtatás (lokál)

Előfeltételek:
- Node.js + npm
- Futó MongoDB (pl. lokál `mongodb://127.0.0.1:27017`)

#### 1) Backend
Mappa: `backend/`

1. Készíts egy `.env` fájlt a [backend/.env.example](backend/.env.example) alapján.
	- A `.env` nincs feltöltve git-be (kizárva `.gitignore`-ral).
2. Függőségek:
	- `cd backend`
	- `npm i`
3. Indítás:
	- `npm run dev`

API: `http://localhost:3001/api`

Első felhasználó (példa):
- Regisztráció:
  - `curl -X POST http://localhost:3001/api/auth/register -H "Content-Type: application/json" -d "{\"username\":\"bence\",\"password\":\"secret123\"}"`
- Login (token):
  - `curl -X POST http://localhost:3001/api/auth/login -H "Content-Type: application/json" -d "{\"username\":\"bence\",\"password\":\"secret123\"}"`

#### 2) Frontend
Mappa: `frontend/`

1. Függőségek:
	- `cd frontend`
	- `npm i`
2. Indítás:
	- `npm start`

Frontend: `http://localhost:4200`

### Megjegyzés
- A repo `.gitignore` kizárja a tipikus nem feltöltendő fájlokat (pl. `node_modules`, build outputok, `.env`).