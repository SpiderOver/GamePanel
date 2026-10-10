# GamePanel

**GamePanel** is a self-hosted administration panel for game servers, with the current implementation focused on Minecraft.

It brings server lifecycle controls, profiles, file management, configuration editing, player management, backups, monitoring, console access, and mod management into one web interface.

> **Project status:** personal, non-commercial, self-hosted project under active development.

## Website

Project website: **https://spiderover.github.io/GamePanel/**

## Public source snapshot

The repository includes a sanitized snapshot of the current CurseForge integration under [`src/`](src/). Production credentials, SSH keys, databases, logs, private deployment data, and host-specific configuration are intentionally excluded.

- [Public source snapshot](src/)
- [Architecture and CurseForge flow](ARCHITECTURE.md)
- [Security guidance](SECURITY.md)

## Features

- Start, stop, restart, and monitor the game server host
- Manage multiple server profiles
- Browse and edit server files and configuration files
- Manage players and server console commands
- Automatic and manual backups with restore support
- Host monitoring and maintenance controls
- Minecraft mod management
- CurseForge-powered mod discovery and compatible release selection

## CurseForge integration

GamePanel integrates with the **CurseForge Core / 3rd Party API** to:

- Search Minecraft mods
- Display project metadata, authors, descriptions, and icons
- Filter releases by Minecraft version and mod loader
- Install compatible releases on explicit administrator request
- Switch between compatible mod versions
- Enable and disable locally installed mods

GamePanel **does not operate a public mod mirror**. CurseForge-hosted files are only requested when an administrator explicitly chooses to install a mod or release, and only when the CurseForge API permits the requested file to be distributed/downloaded.

The panel preserves the relationship with the original CurseForge project by showing project identity and metadata and linking users back to CurseForge where appropriate.

## API usage

The CurseForge integration is designed for low-volume, private/self-hosted usage. GamePanel caches metadata where appropriate and filters requests by the active Minecraft version and mod loader to avoid unnecessary API calls.

API credentials are **not committed to this repository**. A user-provided CurseForge Core API key is stored only on the self-hosted GamePanel installation.

## Supported games

### Current

- Minecraft

### Architecture

GamePanel is being structured so that additional dedicated-server profiles can be supported independently of the Minecraft-specific features.

## Security and privacy

This public repository must not contain deployment secrets, SSH private keys, API keys, access tokens, private IP addressing, or production credentials.

If you deploy GamePanel yourself, keep all credentials in local configuration or environment-specific storage and never commit them to Git.

## License / distribution

GamePanel is currently a personal, non-commercial project under active development. A formal project license will be selected before a stable public release.

## Disclaimer

GamePanel is an independent project and is not affiliated with, endorsed by, or sponsored by CurseForge, Overwolf, Mojang, or Microsoft.
