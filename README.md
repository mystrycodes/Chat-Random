# 🌸 Random Chat - Anime Kawaii Edition

A real-time random chat application with WebRTC video calls, featuring a cute anime-inspired UI design.

![Anime Random Chat](https://img.shields.io/badge/Anime-Kawaii%20Theme-ff69b4?style=for-the-badge)
![Socket.IO](https://img.shields.io/badge/Socket.IO-WebSocket-white?style=for-the-badge)
![WebRTC](https://img.shields.io/badge/WebRTC-Video%20Calls-ff69b4?style=for-the-badge)
![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge)

## ✨ Features

- **Random Matching**: Get paired with random strangers for text and video chat
- **Text Messaging**: Send messages with emojis and images
- **Video Calls**: One-on-one video chat with camera/microphone controls
- **Chat History**: Save and view your past conversations
- **Report System**: Report inappropriate users
- **Anime UI**: Cute kawaii-themed responsive design
- **Mobile Ready**: Works on desktop and mobile devices

## 🛠️ Tech Stack

### Frontend
- React 18
- Vite
- Socket.IO Client
- WebRTC (getUserMedia, RTCPeerConnection)

### Backend
- Node.js
- Express
- Socket.IO
- HTTP Server

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/random-chat.git
   cd random-chat
   ```

2. **Install dependencies**
   ```bash
   # Install server dependencies
   cd server
   npm install

   # Install client dependencies
   cd ../client
   npm install
   ```

3. **Generate SSL certificates (for HTTPS/mobile)**

   On Windows (with Git Bash or OpenSSL):
   ```bash
   mkdir certs
   cd certs
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes -subj "//CN=localhost"
   ```

   On macOS/Linux:
   ```bash
   mkdir -p client/certs
   openssl req -x509 -newkey rsa:2048 -keyout client/certs/key.pem -out client/certs/cert.pem -days 365 -nodes -subj "/CN=localhost"
   ```

## 🚀 Running the App

1. **Start the server** (Terminal 1)
   ```bash
   cd server
   node index.js
   ```

2. **Start the client** (Terminal 2)
   ```bash
   cd client
   npm run dev
   ```

3. **Open your browser**
   - Desktop: `http://localhost:3000`
   - HTTPS (mobile): `https://localhost:3000`
   - Accept the self-signed certificate warning

## 📱 Mobile Access

### Option 1: Local Network
1. Find your local IP address:
   - Windows: `ipconfig` → look for "IPv4 Address"
   - Mac/Linux: `ifconfig` or `ip addr show`
2. Access via: `https://YOUR_IP:3000`
3. Accept the certificate warning

### Option 2: Tailscale
1. Install Tailscale on both devices
2. Use your Tailscale IP to access the app
3. Certificate warning may still appear (accept it)

## 🎮 Usage

1. **Enter a nickname** to get started
2. **Click "Start"** to find a random person
3. **Chat** with text, emojis, or images
4. **Click "Video Call"** to start a video call
5. **Click "Next"** to find a new person

## 🔧 Configuration

### Change Server Port
Edit `server/index.js`:
```javascript
const PORT = 4000; // Change to your preferred port
```

### Change Client Port
Edit `client/vite.config.js`:
```javascript
port: 3000, // Change to your preferred port
```

## 🌐 Deployment

### Render (Recommended - Free Tier)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

1. Click **"Deploy to Render"** button above
2. Connect your GitHub account
3. Select your `random-chat` repository
4. Render will auto-detect settings from `render.yaml`
5. Click **"Deploy"**

**Manual Setup:**
1. Go to [render.com](https://render.com) and create a new **Web Service**
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `cd client && npm install && npm run build`
   - **Start Command**: `cd server && node index.js`
4. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `4000`
5. Deploy!

The free tier includes:
- 750 hours/month of free service
- Automatic SSL/HTTPS
- Auto-deploys from GitHub

## 📝 Environment Variables (Optional)

Create `.env` files in both `client/` and `server/`:

**Server (.env)**
```
PORT=4000
HOST=0.0.0.0
```

**Client (.env)**
```
VITE_API_URL=http://localhost:4000
```

## 🎨 Customization

The app uses CSS variables for easy theming. Check `client/src/App.css` to customize:

- Colors (pink, purple, blue, mint, yellow)
- Animations (bounce, shimmer, twinkle)
- Border radius and spacing

## 📄 License

MIT License - feel free to use this project for learning or your own applications!

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## ⚠️ Known Issues

- iOS requires HTTPS for camera/mic access
- Self-signed certificates will show a browser warning (expected for local development)
- Tailscale may show certificate warnings (accept to proceed)

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

Made with 💖 and anime vibes
