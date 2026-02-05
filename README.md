# 🌸 Random Chat

<div align="center">

A real-time random chat application with WebRTC video calls, featuring a modern anime-inspired UI.

[![Deploy](https://img.shields.io/badge/Deploy-Render-success?style=for-the-badge&logo=render)](https://render.com/deploy)
[![License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.x-white?style=for-the-badge&logo=socket.io)](https://socket.io/)

[Features](#-features) • [Demo](#-live-demo) • [Installation](#-installation) • [Deployment](#-deployment) • [Contributing](#-contributing)

</div>

---

## ✨ Features

- **🎲 Random Matching** – Get paired instantly with random users worldwide
- **💬 Real-Time Messaging** – Send text messages with emoji support
- **📸 Image Sharing** – Share images directly in the chat
- **📹 Video Calls** – One-on-one video chat with WebRTC
- **🎨 Beautiful UI** – Modern anime-kawaii themed responsive design
- **📱 Mobile Ready** – Fully responsive, works on all devices
- **🚫 Report System** – Report inappropriate users
- **📜 Chat History** – Save and view past conversations

## 🎯 Live Demo

Check out the live deployment: **[chat-random.onrender.com](https://chat-random.onrender.com)**

> **Note:** The live demo may take a moment to wake up if inactive.

## 📸 Preview

| Desktop View | Mobile View |
|:------------:|:-----------:|
| ![Desktop](https://via.placeholder.com/600x400/ff69b4/ffffff?text=Desktop+View) | ![Mobile](https://via.placeholder.com/300x500/c44cff/ffffff?text=Mobile+View) |

## 🛠️ Tech Stack

### Frontend
- **React 18** – UI library
- **Vite** – Build tool and dev server
- **Socket.IO Client** – Real-time communication
- **WebRTC** – Peer-to-peer video calls

### Backend
- **Node.js** – Runtime environment
- **Express** – Web framework
- **Socket.IO** – WebSocket server

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm
- Git

### Clone & Install

```bash
# Clone the repository
git clone https://github.com/mystrycodes/Chat-Random.git
cd Chat-Random

# Install dependencies
npm install
```

### Run Locally

```bash
# Start the application
npm start
```

Open [http://localhost:4000](http://localhost:4000) in your browser.

### Development Mode

For development with hot-reload:

```bash
# Terminal 1 - Backend
npm run start-server

# Terminal 2 - Frontend
cd client && npm run dev
```

## 🌐 Deployment

### One-Click Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Manual Deployment

The project includes a `render.yaml` configuration file for automatic deployment detection.

**Environment Variables:**

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `4000` |

**Build Command:**
```bash
npm install --include=dev && npm install --prefix client --include=dev && npm run build --prefix client
```

**Start Command:**
```bash
npm start
```

### Other Platforms

This app can be deployed to any platform supporting Node.js:
- **Railway** – `railway.app`
- **Fly.io** – `fly.io`
- **Heroku** – `heroku.com`
- **Vercel** – Frontend only, requires separate backend

## 🎮 Usage

1. **Enter a nickname** to identify yourself
2. **Click "Start"** to be matched with a random user
3. **Chat** using text, emojis, or images
4. **Click "Video Call"** to start a video chat
5. **Click "Next"** to find a new match

## ⚙️ Configuration

### Change Ports

**Server Port** – Edit the PORT environment variable or `server/index.js`

**Client Port** – Edit `client/vite.config.js`

### Customize Theme

Edit `client/src/App.css` to customize:
- Color palette
- Animation styles
- Border radius and spacing
- Font families

## 🤝 Contributing

Contributions are welcome! Here's how to help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Add comments for complex logic
- Test thoroughly before submitting
- Keep commits clear and focused

## 📋 Roadmap

- [ ] User authentication
- [ ] Interest-based matching
- [ ] Voice messages
- [ ] Group chat rooms
- [ ] Dark mode toggle
- [ ] Internationalization

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

## ⚠️ Known Limitations

- iOS Safari requires HTTPS for camera/microphone access
- WebRTC may not work in some corporate network environments
- Free tier hosting may have cold-start delays

## 📧 Support

- **Issues:** [GitHub Issues](https://github.com/mystrycodes/Chat-Random/issues)
- **Discussions:** [GitHub Discussions](https://github.com/mystrycodes/Chat-Random/discussions)

## 🙏 Acknowledgments

- Built with [Socket.IO](https://socket.io/)
- UI inspired by anime/kawaii aesthetics
- WebRTC powered by modern browser APIs

---

<div align="center">

**Made with 💖 by [mystrycodes](https://github.com/mystrycodes)**

[⭐ Star](https://github.com/mystrycodes/Chat-Random) • [🍴 Fork](https://github.com/mystrycodes/Chat-Random/fork) • [🐛 Report Issue](https://github.com/mystrycodes/Chat-Random/issues)

</div>
