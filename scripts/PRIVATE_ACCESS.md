# Private access to datacube

This machine uses Tailscale Serve for private HTTPS access. Only devices allowed
by the personal Tailscale network can connect. Datacube still requires its own
username and password. No router port forwarding or public Funnel is used.

The separate server binds only to `127.0.0.1:8765`. It uses the existing backend
and database, secure session cookies, and a production frontend snapshot stored
in `.venv/private-access/site`. Development ports 5174 and 8000 are unchanged.
Only that built public folder is served, never the repository or database files.
The private process has its own rate counters. It groups IP limits by the
loopback connection by default. The README documents `DATACUBE_TRUSTED_PROXIES`
for setups where an explicitly trusted proxy supplies the client address.

From PowerShell in `C:\dev\cubeapp`:

```powershell
# Start the existing snapshot
powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1
# Refresh the frontend snapshot and restart after app changes
powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1 -Build
# Check or stop only the private app server
powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1 -Status
powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1 -Stop
```

The private hostname is stored locally in `.venv/private-access/settings.json`.
Tailscale's `serve --bg` configuration persists separately in its Windows service.
Keep the PC powered on, awake, and connected to the internet. The startup shortcut
starts the private app when this Windows account signs in; it does not wake a
sleeping PC or run the app before Windows sign-in. Sleep/power settings are not
changed automatically.

On the phone, install Tailscale from the official app store, sign in to the same
personal Tailscale account, enable the VPN connection, and open the private HTTPS
URL in the emailed instructions. Sign in with the existing datacube account.
Bookmark that URL. It works over other Wi-Fi networks and mobile data while the
PC is available. Disconnecting Tailscale on the phone should make the URL
unreachable. Preferably test this on mobile data before leaving home.

If access fails, check the PC is awake, Tailscale is connected on both devices,
and `-Status` reports the app running. Logs are in `.venv/private-access/`.
The app's login and language/preferences on the new HTTPS origin are separate
from browser storage on localhost, so select the event, cube and preferences on
the phone as needed. Saved solves remain in the same account/database.

To turn off remote access, run `tailscale serve reset` on this PC and stop the
private app. To disable automatic app startup, remove only the
`datacube private access.lnk` shortcut from this user's Windows Startup folder.

References: [Tailscale Serve](https://tailscale.com/docs/features/tailscale-serve)
and [install Tailscale on your devices](https://tailscale.com/download).
