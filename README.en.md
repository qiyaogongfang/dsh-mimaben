<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/qiyaogongfang/dsh-mimaben@main/assets/banner.svg" alt="dsh-mimaben vault" width="100%" />
</p>

<h1 align="center">dsh-mimaben · Vault</h1>

<p align="center"><strong>An on-disk, encrypted credential notebook.<br/>Your agent can read and write it from the chat.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-mimaben"><img src="https://img.shields.io/npm/v/dsh-mimaben?style=for-the-badge&color=2f7a5f&logo=npm" alt="npm version" /></a>
  <a href="https://www.npmjs.com/package/dsh-mimaben"><img src="https://img.shields.io/npm/dm/dsh-mimaben?style=for-the-badge&color=92a8b3" alt="monthly downloads" /></a>
  <a href="https://github.com/qiyaogongfang/dsh-mimaben"><img src="https://img.shields.io/github/stars/qiyaogongfang/dsh-mimaben?style=for-the-badge&color=e1af78" alt="GitHub stars" /></a>
  <img src="https://img.shields.io/github/license/qiyaogongfang/dsh-mimaben?style=for-the-badge&color=5fa8b2" alt="MIT license" />
  <img src="https://img.shields.io/badge/dependencies-0-92a8b3?style=for-the-badge" alt="zero runtime dependencies" />
  <img src="https://img.shields.io/badge/encryption-AES--256--GCM-2f7a5f?style=for-the-badge" alt="AES-256-GCM" />
</p>

<p align="center"><a href="README.md">中文</a> · <a href="https://github.com/qiyaogongfang/dsh-mimaben">⭐ Star it if it helps</a></p>

---

## What it solves

| Before | Now |
| :-- | :-- |
| Passwords scattered across txt files, notes and chat logs | One sidebar to look up and copy |
| Re-digging every credential on a new machine | Sync two files, share one vault across devices |
| Wanting the agent to look something up, without pasting the secret | It shows only "present / length" unless you ask for the value |

- **Always one click away.** A sidebar panel with search, kind filters and copy buttons.
- **The agent can save for you.** Say "remember: the Tencent Cloud secret key is …" and it is stored; ask "what Cloudflare entries do I have" and it lists them.
- **Secrets stay covered.** Placeholders in the panel, masked in the transcript, revealed only when you explicitly ask.

## Install

Search for **`dsh-mimaben`** in the DeepSeek Harness plugin manager, install, refresh the page, and a keyhole
icon appears in the sidebar.

Other sources:

| target | Purpose |
| :-- | :-- |
| `dsh-mimaben` | npm (recommended; China mirrors served from npmmirror) |
| `github:qiyaogongfang/dsh-mimaben` | No npm account needed |
| absolute path of a clone | When you want to change the code |

**First launch**: on Windows it just works (the key is protected by your Windows account, no passphrase).
On macOS / Linux it asks for a passphrase that protects the key, and asks again on every later launch.

## Usage

**Sidebar**: search, filter by kind, create, edit, delete. Secrets render as placeholders; 「Show」 asks the
local host for the value once, and 「Copy」 puts it on the clipboard without revealing it.

**Conversation**: the model calls these tools as needed.

| Tool | Purpose |
| :-- | :-- |
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
| :-- | :-- |
| `store.enc.json` | Yes |
| `store-key.passphrase.json` | Yes |
| `store-key.dpapi` | No (bound to one Windows account) |

If it lives elsewhere, point `MIMABEN_STORE_DIR` at it. Conflicts resolve to the last write per entry;
concurrent writes are guarded by a lock and hash checks.

## Security

- The data key is 32 random bytes, cached only in process memory; nothing plaintext on disk.
- Both unlock paths wrap the same key: Windows DPAPI and a passphrase (PBKDF2-SHA256 600,000 → AES-256-GCM).
- The passphrase is never written to disk, to logs, or to the transcript.
- The write endpoint accepts same-origin POST only and requires the `x-mimaben` header; the server binds
  to `127.0.0.1`.
- The panel never pre-fills a secret; the server treats a value made only of `•` as "no change".

## Where the data lives

First match wins: `MIMABEN_STORE_DIR` → `<plugin dir>/../data` (when a vault already exists) →
`$DSH_HOME/mimaben/data` → the platform user directory (`%LOCALAPPDATA%\dsh-mimaben` on Windows).

## Limitations

- Passphrase-free unlocking is Windows-only; other systems ask on every launch.
- Entries are text fields; binary attachments are not supported.
- No cloud sync: synchronisation relies on the file layer.
- Conflicts resolve per entry, last write wins; no version rollback.

## License

MIT © qiyaogongfang
