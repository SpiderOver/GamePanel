# Public source snapshot

GamePanel is still under active development on a private self-hosted deployment. This directory publishes the sanitized portions of the current implementation that are most relevant to the CurseForge integration.

## Included

- `web/mods_api.py` — Flask bridge that validates requests, keeps the API key server-side, and forwards an allowlisted set of mod-management operations to the game host.
- `web/mods.js` — frontend workflow for installed mods, CurseForge catalog search, compatible releases, dependency planning, installation, enable/disable, and removal.
- `web/mods.css` — scoped styles for the mod management interface.

Production-specific deployment files, SSH configuration, databases, logs, host addresses, and credentials are intentionally excluded.

The game-host CurseForge client follows the architecture described in [`ARCHITECTURE.md`](../ARCHITECTURE.md): it talks to `https://api.curseforge.com/v1/` with the user-provided Core API key, filters files by the active Minecraft version and loader, and only installs files made available for API download.
