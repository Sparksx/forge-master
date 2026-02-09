# Deploying Forge Master Server on Railway

## Step-by-step Railway Deployment

### 1. Create a Railway account
Go to https://railway.app and sign up with your GitHub account.

### 2. Create a new project
- Click **"New Project"**
- Select **"Deploy from GitHub repo"**
- Choose the `forge-master` repository

### 3. Add PostgreSQL
- In your project, click **"+ New"** > **"Database"** > **"PostgreSQL"**
- Railway provisions a PostgreSQL instance automatically
- The `DATABASE_URL` environment variable is set automatically

### 4. Configure the server service
- Click on your service
- Go to **Settings** > **Root Directory** → set to `server`
- Railway will detect the Dockerfile automatically

### 5. Set environment variables
In the **Variables** tab, add:

```
JWT_SECRET=<generate-a-random-64-char-string>
CLIENT_URL=https://sparksx.github.io
```

Note: `DATABASE_URL` and `PORT` are set automatically by Railway.

### 6. Deploy
Railway deploys automatically on every push to main.
Your server URL will be something like: `https://forge-master-server-production.up.railway.app`

### 7. Update the client
Set the `VITE_SERVER_URL` environment variable when building the client:

```bash
VITE_SERVER_URL=https://your-railway-url.up.railway.app npm run build
```

Or create a `.env` file at the project root:
```
VITE_SERVER_URL=https://your-railway-url.up.railway.app
```

## Local Development

### Start PostgreSQL (Docker)
```bash
docker run --name forgemaster-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=forgemaster -p 5432:5432 -d postgres:16
```

### Setup server
```bash
cd server
cp .env.example .env
# Edit .env with your local database URL
npm install
npx prisma db push
npm run dev
```

### Start client
```bash
# In the root directory
echo 'VITE_SERVER_URL=http://localhost:3000' > .env.local
npm run dev
```

## API Endpoints

### Auth
- `POST /api/auth/register` - `{ username, password }` → `{ token, player }`
- `POST /api/auth/login` - `{ username, password }` → `{ token, player }`
- `GET /api/auth/me` - (auth required) → `{ player }`

### Game
- `GET /api/game/state` - (auth required) → full game state
- `POST /api/game/save` - (auth required) → save game state
- `GET /api/game/leaderboard` - (auth required) → top 50 players

### Socket.IO Namespaces
- `/chat` - Real-time chat (events: `message`, `history`, `join`, `leave`)
- `/pvp` - PvP matchmaking (events: `queue:join`, `queue:leave`, `match:result`)
