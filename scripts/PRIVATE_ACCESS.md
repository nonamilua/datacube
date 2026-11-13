# Private HTTPS with Tailscale

Tailscale Serve can put Datacube on your private tailnet. Datacube still asks for its own sign-in. Keep the host awake and connected while you want to use the app from another device.

1. Connect the Windows host and your other devices to the same tailnet. Enable HTTPS certificates in Tailscale if prompted.
2. Follow the backend and frontend dependency setup in the [README](../README.md). In the repository root, build and start the private app.

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1 -Build
   ```

3. Run Tailscale Serve and copy the HTTPS address it prints. Run from Administrator PowerShell if Tailscale asks for it.

   ```powershell
   tailscale serve --bg http://127.0.0.1:8765
   ```

4. In the repository root, save the exact hostname from that address, without the scheme or path, and restart the private app.

   ```powershell
   @{ hostname = 'your-device.your-tailnet.ts.net' } | ConvertTo-Json |
       Set-Content .\.venv\private-access\settings.json -Encoding utf8
   powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1 -Stop
   powershell -ExecutionPolicy Bypass -File .\scripts\private-access.ps1
   ```

5. Open the HTTPS address on another connected device and sign in with your existing Datacube account. The private server uses the same SQLite database as local development by default. Create accounts on localhost first when using the development Turnstile keys.

The private server binds to loopback on port 8765 and uses secure cookies. Its build, hostname and logs stay in `.venv/private-access`. It has its own rate counters. Unless you configure trusted proxies, devices behind Serve share the loopback IP bucket. See [server settings](../AGENTS.md#server-settings).

Run the script with `-Build` to refresh the snapshot, `-Status` to check the process or `-Stop` to stop it. Tailscale Serve’s background setting persists separately. Use `tailscale serve status` to check it and `tailscale serve reset` to remove the machine’s Serve configuration. [Tailscale Serve docs](https://tailscale.com/docs/reference/tailscale-cli/serve)
