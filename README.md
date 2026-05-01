# 🏠 Home Dashboard

A custom browser new tab dashboard for **mike-trout**, served via `https://home.squidball.xyz` through Cloudflare Tunnel.

## Prerequisites

- **Node.js** 20+ (for local development)
- **Docker** and **Docker Compose** (for deployment)
- An external Docker network called `proxy-nw` (shared with other services)

## Getting API Keys & Credentials

### Miniflux API Key
1. Open Miniflux → **Settings** → **API Keys**
2. Click **Create a new API key**
3. Copy the generated token into `config.yaml` under `services.miniflux.api_key`

### Immich API Key
1. Open Immich → click your avatar → **Account Settings** → **API Keys**
2. Click **New API Key**, name it "dashboard"
3. Copy the key into `config.yaml` under `services.immich.api_key`
4. **Important:** The key must be from an **admin account** — the statistics endpoint requires admin privileges

### Nextcloud App Password
1. Open Nextcloud → **Settings** → **Security** → **Devices & sessions**
2. Enter a name like "dashboard" and click **Create new app password**
3. Copy the generated password into `config.yaml` under `services.nextcloud.app_password`
4. **Do not** use your main Nextcloud account password

### Super Productivity WebDAV Credentials
These are the username and password you configured for the WebDAV server that Super Productivity syncs to (the `sp-webdav` container). Check your SP WebDAV Docker Compose configuration for these values.

## Configuration

Edit `config.yaml` with your actual values:

1. Set your **latitude/longitude** for weather (find yours at [latlong.net](https://www.latlong.net/))
2. Fill in all **API keys and passwords** as described above
3. Customize **bookmarks** to your liking
4. Set **clock_format** to `12` or `24`
5. Set **units** to `fahrenheit` or `celsius`

## Running

### With Docker (recommended)

```bash
# Make sure the proxy-nw network exists
docker network create proxy-nw 2>/dev/null || true

# Build and start
docker compose up -d

# View logs
docker compose logs -f dashboard
```

The dashboard will be available at `http://localhost:3001`.

### Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Note: services won't be reachable outside Docker, so widgets will show error states.

## Cloudflare Tunnel Setup

1. In Cloudflare Zero Trust → **Networks** → **Tunnels**
2. Select your tunnel → **Public Hostname** → **Add a public hostname**
3. Set:
   - **Subdomain:** `home`
   - **Domain:** `squidball.xyz`
   - **Service:** `http://dashboard:3001`
4. Save

### Cloudflare Access Policy (Optional)

1. In Cloudflare Zero Trust → **Access** → **Applications** → **Add an application**
2. Choose **Self-hosted**
3. Set the application domain to `home.squidball.xyz`
4. Create a policy (e.g., allow your email address)

## Setting as New Tab Page

1. Install the **[New Tab Redirect](https://chrome.google.com/webstore/detail/new-tab-redirect/)** Chrome extension
2. Set the URL to `https://home.squidball.xyz`
3. Every new tab now opens your dashboard

## Customizing the Layout

The grid layout is defined in `src/app/globals.css`. Look for the `.dashboard-grid` section — every `grid-template-area`, column, and row is commented. To rearrange widgets:

1. Edit the `grid-template-areas` string
2. Make sure each widget's `grid-area` CSS class matches a name in the template
3. Rebuild with `docker compose up -d --build`
