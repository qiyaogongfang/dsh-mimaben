# dsh-mimaben

[中文](README.md) | [English](README.en.md)

An encrypted, local-first credential vault in the DSH sidebar. It stores accounts, passwords, API keys
and documents, and lets the agent read or write them from a conversation. Data never leaves the machine:
AES-256-GCM at rest, no cloud, no account, no network calls.

## Install

Install `dsh-mimaben` from the DSH plugin manager. Or ask the agent to run `install_bundle` with any of
these targets:

| target | Purpose |
|---|---|
| `dsh-mimaben` | From npm (recommended) |
| `github:qiyaogongfang/dsh-mimaben` | No npm account needed; takes the default branch |
| absolute path of a clone | When you want to change the code |

Refresh the page afterwards; a keyhole icon appears in the sidebar.

**First launch**: on Windows it just works (the key is protected by your Windows account, no passphrase).
On macOS / Linux it asks for a passphrase that protects the key, and asks again on every later launch.

## Usage

**Sidebar**: search, filter by kind, create, edit, delete. Secrets render as placeholders; 「Show」 asks the
local Host for the value once, and 「Copy」 puts it on the clipboard without revealing it.

**Conversation**: the model calls these tools as needed.

| Tool | Purpose |
|---|---|
| `mimaben_save` | Create; with `id` only the given fields are overwritten |
| `mimaben_update` | Update an entry: send only changed fields, `clear` empties a field |
| `mimaben_list` | List entries (no secret bodies) |
| `mimaben_get` | Read one entry; `reveal="true"` returns the secret |
| `mimaben_delete` | Delete an entry |

Secrets never enter the transcript by default; a value is written only when you explicitly ask for it.
When the vault is locked, the tools tell you to unlock it in the sidebar first.

## Multi-device sync

Put the `data` directory where every device can read and write it (removable drive, Syncthing, shared
volume), and enter the passphrase once per device.

| File | Sync? |
|---|---|
| `store.enc.json` | Yes |
| `store-key.passphrase.json` | Yes |
| `store-key.dpapi` | No (bound to one Windows account) |

If it lives elsewhere, point `MIMABEN_STORE_DIR` at it. Conflicts resolve to the last write per entry;
concurrent writes are guarded by a lock and hash checks.

## Security model

- The data key is 32 random bytes, cached only in process memory; nothing plaintext on disk.
- Both unlock paths wrap the same key: Windows DPAPI and a passphrase (PBKDF2-SHA256 600,000 → AES-256-GCM).
- The passphrase is never written to disk, to logs, or to the transcript.
- The write endpoint accepts same-origin POST only and requires the `x-mimaben` header; the server binds
  to `127.0.0.1`.
- The panel never pre-fills a secret; the server treats a value made only of `•` as "no change".

## Data location

First match wins: `MIMABEN_STORE_DIR` → `<plugin dir>/../data` (when a vault already exists) →
`$DSH_HOME/mimaben/data` → the platform user directory (`%LOCALAPPDATA%\dsh-mimaben` on Windows, etc.).

## Editing model

The panel's Edit, `mimaben_update`, and `mimaben_save` with `id` share one semantic: **omitted fields stay
unchanged, an explicit `null` clears a field**. Each change leaves an audit record (time, changed fields,
source), keeping the last 10. Only field names are kept, never old values.

## Limitations

- Passphrase-free unlocking is Windows-only; other systems ask on every launch.
- Entries are text fields; binary attachments are not supported.
- No cloud sync: synchronisation relies on the file layer.
- Conflicts resolve per entry, last write wins; no version rollback.

## License

MIT © qiyaogongfang
