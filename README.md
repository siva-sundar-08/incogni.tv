# Incogni.tv

Incogni.tv is a random video chat app built with React, Socket.IO, and WebRTC. It supports camera/mic verification, anonymous queueing, random partner matching, peer-to-peer video, text chat, skip, report, and live server stats.

## Run Locally

```bash
npm install
npm run dev
```

The client runs on `http://localhost:5173` and the Socket.IO backend runs on `http://localhost:8000`.

To open two local users, use two browser windows. Camera access may fail if the same camera is already locked by another browser profile or app.

## Production

```bash
npm run build
npm start
```

Set `NODE_ENV=production` when serving the built app from the backend.

## Environment

Client:

```bash
VITE_SOCKET_URL=https://your-api-domain.com
VITE_TURN_URL=turn:your-turn-host:3478
VITE_TURN_USERNAME=username
VITE_TURN_CREDENTIAL=password
```

Server:

```bash
PORT=8000
CORS_ORIGIN=https://your-site.com,https://www.your-site.com
```

## Important Deployment Note

STUN is enough for many local and simple network tests, but a real OmeTV/Omegle-style product needs a TURN server. Without TURN, some users behind strict NATs or mobile networks will match but video/audio will fail to connect.

## Current Safety Features

- 18+ self-confirmation before entering.
- Camera and microphone permission gate.
- Skip to leave a chat immediately.
- Report stores an in-memory report and rematches the reporter.
- Messages are capped at 500 characters on the server.

For a public launch, add persistent moderation storage, abuse rate limits, ban/session tracking, automated nudity/spam detection, and clear legal/community terms.

## Deploy Frontend on Vercel

Deploy this repo as a Vite project. Use these settings:

```text
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

Set these Vercel environment variables:

```bash
VITE_SOCKET_URL=https://your-render-backend.onrender.com
VITE_TURN_URL=turn:free.expressturn.com:3478
VITE_TURN_USERNAME=000000002091900009
VITE_TURN_CREDENTIAL=your-turn-credential
```

Vercel should only host the frontend. Do not deploy the Socket.IO backend as a Vercel Function because Vercel does not support long-running WebSocket servers.

## Deploy Backend on Render

Create a Render Web Service from the same GitHub repo. Render can use `render.yaml`, or you can enter the settings manually:

```text
Build Command: npm install && npm run build
Start Command: npm start
Health Check Path: /health
```

Set this Render environment variable after Vercel gives you a domain:

```bash
NODE_ENV=production
CORS_ORIGIN=https://your-vercel-app.vercel.app
```

After the backend is live, copy the Render URL into Vercel as `VITE_SOCKET_URL`, then redeploy the Vercel frontend.
