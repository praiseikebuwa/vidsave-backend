# 🚀 VidSave Backend Server (Node.js + Express)

A lightweight, multi-engine REST API server for VidSave that extracts direct video, audio, and image download links across **TikTok, Instagram, YouTube, Facebook, and Twitter**.

---

## 📦 Features
- **TikTok**: Direct MP4 & HD video extraction via TikWM API.
- **Instagram**: Direct Reel & Post video stream parser via Instagram Embed API.
- **YouTube**: Direct 720p/1080p stream extraction via Piped & Invidious APIs.
- **Facebook & Twitter**: Multi-instance Cobalt fallback network.
- **CORS Enabled**: Cross-origin requests allowed for Web & Mobile Flutter clients.

---

## 💻 Local Setup & Running

1. Open terminal inside the `backend` directory:
   ```bash
   cd backend
   npm install
   npm start
   ```
2. The server will run at: `http://localhost:3000`
3. Test in browser: `http://localhost:3000/api/download?url=YOUR_TIKTOK_OR_INSTAGRAM_URL`

---

## 🌐 1-Click Free Deployment on Render.com

1. Push your repository to **GitHub**.
2. Go to [Render Dashboard](https://dashboard.render.com/) and click **New + -> Web Service**.
3. Connect your GitHub repository.
4. Set **Root Directory** to `backend`.
5. Render will automatically detect Node.js build (`npm install`) and start (`npm start`) settings.
6. Click **Create Web Service**.

Once deployed, Render gives you a free HTTPS server URL like:
`https://vidsave-backend.onrender.com`

---

## 📱 Connecting Backend to VidSave App

1. Open the VidSave Flutter App.
2. Go to **Settings** -> **Custom Downloader API Server**.
3. Enter your deployed server URL (e.g. `https://vidsave-backend.onrender.com`).
4. Click **Save Server**.
