# Env Secret Leak Detector

Scans the **entire git commit history** of any repository — including commits where secrets were later deleted — and reports every accidental secret exposure with commit hash, author, date, and remediation steps.

## What it finds

| Secret type | Severity |
|---|---|
| AWS Access & Secret Keys | Critical |
| GitHub / GitLab Tokens | Critical |
| MongoDB / PostgreSQL Connection Strings | Critical |
| SSH Private Keys (PEM) | Critical |
| Stripe Live Keys | Critical |
| .env files committed to git | Critical |
| Google API Keys | High |
| Slack / Twilio Tokens | High |
| JWT Secrets | High |
| Hardcoded Passwords | Medium |
| Generic API Key assignments | Medium |
| Stripe Test Keys | Low |

---

## Tech stack

```
backend/    Node.js + Express + MongoDB + simple-git
frontend/   React + Recharts
```

---

## Local setup (step by step)

### Prerequisites

- Node.js 18+
- MongoDB running locally (`mongod`) OR a free MongoDB Atlas cluster
- Git

### 1. Clone or create the project

```bash
git clone <your-repo-url>
cd env-leak-detector
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create your `.env` file:

```bash
cp .env.example .env
```

Edit `.env`:

```
PORT=5000
MONGO_URI=mongodb://localhost:27017/env-leak-detector
```

If using MongoDB Atlas, replace MONGO_URI with your Atlas connection string.

Start the backend:

```bash
npm run dev
```

You should see:
```
MongoDB connected
Server running on port 5000
```

### 3. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm start
```

Opens at `http://localhost:3000`

---

## How to use

1. Open `http://localhost:3000`
2. Paste the **absolute path** to any local git repository
   - Mac/Linux: `/Users/tushar/projects/my-project`
   - Windows: `C:\Users\tushar\projects\my-project`
3. Click **Scan repo**
4. Wait while it walks your commit history (30 seconds for most repos)
5. Review findings — each card shows severity, commit hash, redacted preview, and how to fix it

---

## Project structure

```
env-leak-detector/
├── backend/
│   ├── src/
│   │   ├── scanner/
│   │   │   ├── gitWalker.js       # walks every commit with simple-git
│   │   │   └── patternMatcher.js  # 30+ regex rules for secrets
│   │   ├── models/
│   │   │   └── ScanResult.js      # Mongoose schema
│   │   ├── routes/
│   │   │   └── scan.js            # POST /api/scan, GET /api/results/:id
│   │   └── server.js
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── ScanForm.jsx        # repo path input
    │   │   ├── ScanProgress.jsx    # polling spinner
    │   │   ├── ReportView.jsx      # full results page
    │   │   ├── FindingCard.jsx     # expandable finding
    │   │   ├── SeverityBadge.jsx   # colored pill
    │   │   └── SeverityChart.jsx   # recharts donut
    │   ├── utils/api.js
    │   └── App.jsx
    └── package.json
```

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/scan` | Start a scan. Body: `{ repoPath }` |
| GET | `/api/results/:scanId` | Get scan result (poll until status=done) |
| GET | `/api/scans` | List all past scans |
| DELETE | `/api/scans/:scanId` | Delete a scan record |

---

## Deployment

### Backend — Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

railway login
railway init
railway add mongodb
railway up
```

Set environment variable in Railway dashboard:
```
MONGO_URI=<railway-provides-this-automatically>
```

### Frontend — Vercel

```bash
cd frontend
npm run build

# Install Vercel CLI
npm install -g vercel
vercel
```

Update `frontend/src/utils/api.js` to point to your Railway backend URL:
```js
const api = axios.create({ baseURL: 'https://your-app.railway.app/api' });
```

---

## Adding more patterns

Open `backend/src/scanner/patternMatcher.js` and add to the `SECRET_PATTERNS` array:

```js
{
  name: 'My Custom Token',
  severity: 'high',
  regex: /mytoken_[A-Za-z0-9]{32}/g,
  hint: 'Revoke this token in your dashboard',
},
```

---

## Built with

- [simple-git](https://github.com/steveukx/git-js) — git history walking
- [Express](https://expressjs.com/) — API server
- [Mongoose](https://mongoosejs.com/) — MongoDB ODM
- [React](https://react.dev/) — frontend
- [Recharts](https://recharts.org/) — severity donut chart
