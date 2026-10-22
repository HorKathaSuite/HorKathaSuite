# 🚀 Setup Guide — Hoṛ Katha Suite

**Complete installation and setup instructions** for developers, administrators, and end users.

---

## 📋 Table of Contents

1. [System Requirements](#system-requirements)
2. [Quick Start (Web)](#quick-start-web)
3. [Desktop App (Electron)](#desktop-app-electron)
4. [PWA Installation](#pwa-installation)
5. [Admin Setup (License Keys)](#admin-setup-license-keys)
6. [Configuration](#configuration)
7. [Deployment](#deployment)
8. [Troubleshooting](#troubleshooting)

---

## 💻 System Requirements

### Minimum Requirements

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 10+, macOS 11+, Linux (Ubuntu 20+) |
| **RAM** | 2 GB |
| **Storage** | 200 MB |
| **Browser** | Chrome 90+, Edge 90+, Firefox 88+, Safari 14+ |
| **Internet** | Required for initial setup |

### Recommended

| Component | Requirement |
|-----------|-------------|
| **OS** | Windows 11, macOS 13+, Linux (Ubuntu 22+) |
| **RAM** | 4 GB+ |
| **Storage** | 500 MB+ |
| **Browser** | Chrome 120+, Edge 120+ |
| **Network** | Broadband (for payments) |

---

## 🌐 Quick Start (Web)

### Option 1: Local Server (Easiest)

```bash
# Clone the repository
git clone https://github.com/bosctech/hor-katha-suite.git
cd hor-katha-suite

# Start local server (Python 3)
python -m http.server 8080

# Or using Node.js
npx serve .

# Or using PHP
php -S localhost:8080

# Or using VS Code: "Live Server" extension