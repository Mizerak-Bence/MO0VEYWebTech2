Web-technológia 2 2025/26/2

## Beadandó: Pálinka nyilvántartó

Stack: Angular (+Material) + Node.js (Express) + MongoDB

### Funkciók
- Bejelentkezés (név + jelszó, JWT)
- Regisztrációs felület
- Profil oldal
- Jelszó módosítás
- Alap szerepkörök (`admin`, `user`)
- Pálinka tételek kilistázása
- Új tétel felvétele (duplikáció tiltás: név alapján, felhasználónként)
- Validáció (frontend + backend)

### Futtatás (lokál)

Előfeltételek:
- Node.js + npm
- Futó MongoDB (pl. lokál `mongodb://127.0.0.1:27017`)

### Repo szerkezet
- `backend/` - Express + TypeScript + MongoDB API
- `frontend/` - Angular + Material kliens
- `docker-compose.yml` - opcionális MongoDB indítás Dockerrel
- `package.json` - root szintű segéd script-ek

### Gyors indítás git clone után

1. `npm run install:all`
2. MongoDB indítása:
	- ha van lokális MongoDB service: indítsd el
	- vagy Dockerrel: `docker compose up -d mongo`
3. Backend külön terminálban: `npm run dev:backend`
4. Frontend külön terminálban: `npm run dev:frontend`

Windows alatt egy parancsos indítás:
- `npm run dev:windows`

Frontend: `http://localhost:4200`
API: `http://localhost:3001/api`

### Hostolás / deploy

A projekt most már egyetlen konténerből is futtatható:
- a backend szolgálja ki az Angular buildet
- az API ugyanazon a domainen a `/api` útvonalon érhető el

Ehhez a gyökérben van egy [Dockerfile](Dockerfile).

Szükséges környezeti változók hoszton:
- `PORT` - pl. `3001` vagy amit a szolgáltató ad
- `MONGO_URI` - külső MongoDB connection string
- `JWT_SECRET` - saját titkos kulcs
- opcionális: `SYSTEM_ADMIN_USERNAME`, `SYSTEM_ADMIN_PASSWORD`, `SYSTEM_ADMIN_DISPLAY_NAME`

Példa Docker build és futtatás lokálisan:
- `docker build -t palinka-app .`
- `docker run -p 3001:3001 -e MONGO_URI="mongodb://host:27017/palinka" -e JWT_SECRET="eros-titok" palinka-app`

Ezután az app a `http://localhost:3001` címen érhető el.

Olyan hoszton érdemes deployolni, ami Docker imaget tud futtatni, például:
- Render
- Railway
- Fly.io
- Northflank

Itt a deploy folyamat általában:
1. repo feltöltése GitHubra
2. új web service létrehozása Dockerfile alapján
3. környezeti változók beállítása
4. külső MongoDB összekötése

### Felhasználói fiókok

- Regisztráció a frontendből: `http://localhost:4200/register`
- Bejelentkezés: `http://localhost:4200/login`
- Profil és jelszócsere: `http://localhost:4200/profile`
- Az első létrehozott felhasználó `admin` szerepkört kap, a továbbiak `user` szerepkört.

Hardcode-olt rendszer admin:
- felhasználónév: `admin`
- jelszó: `admin123`
- kijelzett név: `Rendszer Admin`

Jogosultsági modell:
- `user`: csak a saját tételeit látja és módosítja
- `admin`: minden tételt lát és módosíthat

### MongoDB ezen a gépen

Ezen a gépen a Windows service neve `MongoDB`, és fut.

Ha manuálisan akarod ellenőrizni / indítani PowerShellből:
- állapot: `Get-Service MongoDB`
- indítás: `Start-Service MongoDB`
- leállítás: `Stop-Service MongoDB`

Ha másik gépen nincs telepített MongoDB, akkor a legegyszerűbb a Docker:
- `docker compose up -d mongo`

#### 1) Backend
Mappa: `backend/`

1. Függőségek:
	- `cd backend`
	- `npm i`
2. Indítás:
	- `npm run dev`

Alapértelmezett, gitben verziózott backend beállítások:
- MongoDB: `mongodb://127.0.0.1:27017/palinka`
- JWT secret: `palinka-dev-secret`
- Frontend origin: `http://localhost:4200`

Ezeket csak akkor kell felülírni, ha más környezetben futtatod. Erre opcionálisan használhatsz `.env`-et a [backend/.env.example](backend/.env.example) alapján, de a projekt alap működéséhez nem kötelező.

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

### Import a saját .txt listákból (seed)

Ha a repo gyökerében ott vannak a 0,5L / 1L / 1,5L listák `.txt` fájlokként, akkor az import script be tudja olvasni őket és feltölteni a DB-t.

Parancs (backend mappából):
- `cd backend`
- `npx tsx src/scripts/import-from-txt.ts --username bence --password secret123`

Ugyanez repo gyökérből:
- `npm run seed:import -- --username bence --password secret123`
- vagy Windows PowerShellből: `./scripts/seed-import.ps1 -Username bence -Password secret123`

Csak teszt (nem ír DB-be):
- `npx tsx src/scripts/import-from-txt.ts --username bence --password secret123 --dry-run`

### Megjegyzés
- A repo `.gitignore` kizárja a tipikus nem feltöltendő fájlokat (pl. `node_modules`, build outputok, `.env`).
- A `backend/.env` nincs git-ben, de a projekt alap dev futásához nem is szükséges.

http://localhost:4200
cd frontend
npm run build
cd ../backend
npm start