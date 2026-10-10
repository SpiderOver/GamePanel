# GamePanel architecture

GamePanel is split into two administrative boundaries:

1. **Web/UI host** — serves the self-hosted web interface, stores local UI state, and forwards restricted management operations to the game host.
2. **Game host** — owns the game server files and executes privileged server-management operations behind a restricted command boundary.

## CurseForge flow

The browser never receives the CurseForge API key.

1. The administrator enters a CurseForge Core / 3rd Party API key in the GamePanel integration dialog.
2. The web backend validates it through the restricted game-host command.
3. On success, the key is stored locally with restrictive permissions or may be supplied through `CURSEFORGE_API_KEY`.
4. Searches and metadata operations are forwarded to the game host.
5. Results are filtered by the active Minecraft version and mod loader.
6. Installation is allowed only when the selected CurseForge file exposes an API download URL and the server is in a safe mutable state.

## Mod management

The current Minecraft workflow supports:

- installed-mod inventory;
- CurseForge fingerprint identification;
- compatible catalog search;
- release channel selection;
- required dependency planning;
- explicit installation;
- version replacement with preservation of the previous file;
- local enable/disable;
- local removal with backup.

## Security model

- API credentials are never embedded in frontend JavaScript.
- API credentials are redacted from transport errors.
- UI operations use an allowlist of supported actions.
- profile identifiers and filenames are validated before use.
- mod changes are blocked while the game service is running.
- downloads are restricted to compatible `.jar` files exposed by CurseForge.
- this public repository excludes deployment secrets, databases, SSH keys, and production-specific configuration.
