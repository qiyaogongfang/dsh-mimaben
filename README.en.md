# dsh-mimaben

[中文](README.md) | [English](README.en.md)

An encrypted, local-first credential vault for the [DeepSeek Harness](https://github.com/deepseek-ai)
sidebar. It stores accounts, passwords, API keys and documents, and lets the agent read or write them
from a conversation.

- **Local only**: AES-256-GCM at rest; no cloud, no account system, no network calls.
- **Secrets stay hidden by default**: placeholders in the panel, masked in the transcript; values are
  fetched only when explicitly requested.
- **Multi-device by folder sync**: sync a folder (removable drive / Syncthing / shared volume) and one
  passphrase opens the same encrypted vault on every device.
- **Safe edits**: field-level updates change only what you give; every change leaves an audit record.

## Requirements

| Item | Requirement |
|---|---|
| DSH | 0.2.2-rc.1 or later (0.2.x) |
| Node.js | ^22.19.0 or >=24.0.0 |
| OS | Windows unlocks without a passphrase (DPAPI); macOS / Linux use the passphrase |

## Install

### Option 1: npm (recommended)

```
plugin_manager → install_bundle → target: dsh-mimaben
```

Pin a version with `dsh-mimaben@1.0.0` when you need one.

### Option 2: straight from GitHub

```
plugin_manager → install_bundle → target: github:qiyaogongfang/dsh-mimaben
```

No npm account required; takes the repository's default branch.

### Option 3: local directory (when you want to change the code)

```powershell
git clone https://github.com/qiyaogongfang/dsh-mimaben.git
```

Install that directory from the DSH plugin manager, or ask the agent to run `plugin_manager` with
`install_bundle` and the absolute path of the clone as `target`.

### Verify

Refresh the page: a keyhole icon appears in the sidebar. Alternatively ask the agent to call
`mimaben_list`; a returned entry count means the vault is ready.

### First launch

- **Windows**: ready to use. The data key is protected by the Windows account (DPAPI), so opening the
  vault needs no passphrase.
- **macOS / Linux**: no DPAPI available. The first launch asks for a passphrase that protects the key;
  each later launch asks for it again.

## Usage

**Sidebar**: search, filter by kind, create, edit and delete entries. Secrets render as placeholders;
「Show」 requests the value from the Host once, and 「Copy」 writes it to the clipboard without revealing
it. The create form can generate a random password.

**Conversation**: the model calls these tools as needed.

| Tool | Purpose |
|---|---|
| `mimaben_save` | Create an entry; with `id`, only the given fields are overwritten |
| `mimaben_update` | Update an entry: send only changed fields, `clear` empties a field |
| `mimaben_list` | List entries by query and kind (no secret bodies) |
| `mimaben_get` | Read one entry; `reveal="true"` returns the secret value |
| `mimaben_delete` | Delete one entry |

Secrets never enter the transcript by default; a value is written only when the user explicitly asks
for it. When the vault is locked (for example on a newly synced device), the tools report that the
sidebar must unlock it first. The passphrase has no tool entry point: only the user enters it.

## Multi-device sync

Put the `data` directory where every device can read and write it (removable drive, Syncthing or cloud
folder, LAN share). Each device asks for the passphrase once. If the directory is not in a default
location, point `MIMABEN_STORE_DIR` at it.

1. On an unlocked device: sidebar「Vault → Passphrase」, set a passphrase of at least 12 characters and
   store it safely.
2. Sync these files:

| File | Content | Sync |
|---|---|---|
| `store.enc.json` | All entries, AES-256-GCM ciphertext | Yes |
| `store-key.passphrase.json` | The same data key, wrapped by the passphrase | Yes |
| `store-key.dpapi` | The same data key, wrapped by Windows DPAPI | No (bound to one account, useless elsewhere) |

3. A new device shows 「This device is locked」; enter the passphrase. The device then seals its own
   DPAPI copy, so later launches need no passphrase.

**Conflicts**: before writing, the plugin reads the file and compares its hash; if another device wrote
in the meantime it re-reads and retries, so concurrent edits of different entries are preserved. A
`store.lock` file serialises writes across processes (a lock left by a crash is taken over after 15
seconds). Concurrent edits of the same entry resolve to the last write.

## Security model

- The data key is 32 random bytes, cached only in the Host process memory; no plaintext on disk.
- Both unlock paths wrap the **same** data key: Windows DPAPI (convenient, bound to the account) and a
  passphrase (PBKDF2-SHA256 600,000 iterations → AES-256-GCM, portable).
- The passphrase is never written to disk, to logs, or to the transcript.
- The write endpoint accepts same-origin POST only and requires the `x-mimaben` header to block
  cross-site writes; the server listens on `127.0.0.1`.
- Two guards against accidental overwrites: the panel never pre-fills a secret, and the server treats a
  value made only of `•` characters as "no change".

## Data location

The first match wins:

| # | Location | Purpose |
|---|---|---|
| 1 | `MIMABEN_STORE_DIR` environment variable | Points at a synced folder, shared volume or removable drive |
| 2 | `<plugin dir>/../data` when a vault already exists | Portable and existing installs keep their data |
| 3 | `$DSH_HOME/mimaben/data` | Default when DSH_HOME is set |
| 4 | `%LOCALAPPDATA%\dsh-mimaben`, `~/Library/Application Support/dsh-mimaben`, `$XDG_DATA_HOME/dsh-mimaben` | Platform defaults |

## Editing model

Three paths share one semantic: the panel's「Edit」, `mimaben_update`, and `mimaben_save` with `id`.

**Field-level merge**: omitted fields stay unchanged; an explicit `null` clears a field. Changing only
the title therefore leaves the account and secret untouched.

**Audit record**: every change stores `{time, changed fields, source}`, keeping the last 10. The detail
pane and `mimaben_get` display it. Only field names are kept, never old values, so secret copies do not
accumulate inside the file.

## Limitations

- Passphrase-free unlocking is Windows-only; other systems ask for the passphrase on every launch.
- Entries are text fields (title, account, secret, link, body, tags); binary attachments are not
  supported.
- No cloud sync service: synchronisation relies on the file layer (removable drive / Syncthing / shared
  volume).
- Conflicts resolve at entry level, last write wins; the audit record keeps no old values, so there is no
  version rollback.

## Development

- Tested against DSH 0.2.2-rc.1 (`engines.dsh: >=0.2.2-rc.1 <0.3.0`).
- `index.js`: Host routes, tool registration, prompt section. `store.js`: encrypted store, key wrapping,
  concurrent writes. `client.js`: sidebar icon and panel.
- After changing the Host side, no DSH restart is needed: disable and re-enable the plugin to reload the
  module. Changes to `client.js` only need a page refresh.

## Releasing

npm publishing uses **trusted publishing (OIDC)**: no token is stored in the repository or the CI, and a
release needs no 2FA code.

1. Bump the `version` in `package.json`, commit and push.
2. Tag and push:

   ```powershell
   git tag v1.0.4
   git push origin main --tags
   ```

3. `.github/workflows/publish.yml` runs on the tag: it checks that the tag matches the version, publishes
   through OIDC and attaches provenance (npm shows "built from qiyaogongfang/dsh-mimaben's publish.yml").

Prerequisites: this repository and `publish.yml` are registered under the package's Trusted publishing
settings with **Publish** checked in Allowed actions, and CI runs **Node 24 + npm ≥ 11.5** — older npm
cannot do OIDC publishing and fails with `ENEEDAUTH`.

## License

MIT © qiyaogongfang
