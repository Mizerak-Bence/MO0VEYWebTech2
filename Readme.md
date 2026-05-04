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

Hardcode-olt rendszer admin:
- felhasználónév: `admin`
- jelszó: `admin123`
- kijelzett név: `Rendszer Admin`

Jogosultsági modell:
- `user`: csak a saját tételeit látja és módosítja
- `admin`: minden tételt lát és módosíthat

### Import a saját .txt listákból (seed)

Ha a repo gyökerében ott vannak a 0,5L / 1L / 1,5L listák `.txt` fájlokként, akkor az import script be tudja olvasni őket és feltölteni a DB-t.

### Futtatás

Backend
1. Függőségek:
	- `cd backend`
	- `npm i`
2. Indítás:
	- `npm run dev`
Frontend
1. Függőségek:
	- `cd frontend`
	- `npm i`
2. Indítás:
	- `npm start`

http://localhost:3001
cd frontend
npm run build
cd ../backend
npm start