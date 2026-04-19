# SwingScope v0.1.0

<img width="1920" height="1032" alt="image" src="https://github.com/user-attachments/assets/f2dbef20-bf46-42f8-bbbe-78930dbb3244" />


A desktop application for analyzing and visualizing Rapsodo MLM2 Pro golf simulator session data.

Import CSV exports from the Rapsodo app to build a local historical database of shot data, then explore performance trends and shot dispersion across sessions.

## Stack

- **Tauri** — desktop app framework
- **Rust** — backend, CSV parsing, database
- **React + TypeScript + Vite** — frontend
- **SQLite (rusqlite)** — local data storage

## Development

```bash
cargo tauri dev
```

## Building

```bash
cargo tauri build
```
