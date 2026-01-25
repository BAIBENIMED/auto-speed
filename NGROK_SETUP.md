# Ngrok Setup Guide for TIBOU AUTO

## Overview

This guide explains how to expose your TIBOU AUTO application to the internet using ngrok, allowing remote access for testing and demonstration purposes.

## Prerequisites

1. **Node.js Backend Server** - Must be running on port 5000
2. **Ngrok** - Download from [https://ngrok.com/download](https://ngrok.com/download)

## Quick Start

### Step 1: Install Ngrok (One-time setup)

1. Download ngrok from [https://ngrok.com/download](https://ngrok.com/download)
2. Extract `ngrok.exe` to a folder (e.g., `C:\ngrok`)
3. (Optional) Add the folder to your PATH environment variable for easier access

### Step 2: Start the Backend Server

Open a terminal and run:

```bash
cd server
npm start
```

You should see:
```
🚀 Serveur démarré sur le port 5000
📍 Accès local: http://localhost:5000
```

**Keep this terminal open!**

### Step 3: Start Ngrok Tunnel

#### Option A: Using the Batch Script (Easiest)

Double-click `start-ngrok.bat` in the project root folder.

#### Option B: Manual Command

Open a **new terminal** and run:

```bash
ngrok http 5000
```

### Step 4: Access Your Application

Once ngrok starts, you'll see output like:

```
Forwarding    https://abc123.ngrok.io -> http://localhost:5000
```

**Copy the `https://` URL** and open it in your browser. This is your public URL!

## How It Works

```
Internet → Ngrok Tunnel → localhost:5000 (Backend API + Frontend)
```

1. Ngrok creates a secure tunnel from the internet to your local port 5000
2. The backend server (port 5000) serves both:
   - API endpoints (e.g., `/api/vehicles`, `/api/users`)
   - Frontend static files (HTML, CSS, JS)
3. When you access the ngrok URL, the frontend automatically uses the same URL for API calls

## Troubleshooting

### 401 Unauthorized Errors

**Symptom:** API calls fail with 401 Unauthorized

**Solution:** Make sure you're logged in. The application uses JWT tokens for authentication.

1. Access the ngrok URL
2. Log in with your credentials
3. The JWT token is stored in localStorage and sent with all API requests

### Ngrok Session Expired

**Symptom:** Ngrok tunnel stops working after 2 hours (free plan)

**Solution:** Restart ngrok. The URL will change, so you'll need to use the new URL.

### Backend Server Not Running

**Symptom:** Ngrok shows "502 Bad Gateway"

**Solution:** Make sure the backend server is running on port 5000:

```bash
cd server
npm start
```

### Port Already in Use

**Symptom:** Backend fails to start with "EADDRINUSE" error

**Solution:** Another process is using port 5000. Either:
- Stop the other process
- Or change the port in `server/.env` and update the ngrok command

## Security Notes

⚠️ **Important Security Considerations:**

1. **Temporary Access Only** - Use ngrok for testing/demos, not production
2. **Free Plan Limitations** - Ngrok free plan has session time limits and URL changes
3. **Authentication Required** - All sensitive endpoints require login
4. **HTTPS Encryption** - Ngrok provides HTTPS by default
5. **Access Control** - Only share the ngrok URL with trusted users

## Advanced Configuration

### Custom Subdomain (Paid Plan)

If you have a paid ngrok plan, you can use a custom subdomain:

```bash
ngrok http 5000 --subdomain=tibou-auto
```

### Configuration File

Create `ngrok.yml` for persistent configuration:

```yaml
authtoken: YOUR_AUTH_TOKEN
tunnels:
  tibou-auto:
    proto: http
    addr: 5000
```

Then run:
```bash
ngrok start tibou-auto
```

## Stopping Ngrok

Press `Ctrl+C` in the ngrok terminal to stop the tunnel.

## Need Help?

If you encounter issues:
1. Check that the backend server is running
2. Verify ngrok is installed correctly
3. Review the browser console for errors
4. Check the server logs for API errors
