// 密码本 · 本机加密存储（支持多端）
//
// 落盘两个文件：
//   store.enc.json          全部条目，AES-256-GCM 密文（可以同步到别的设备）
//   store-key.passphrase.json  用主口令包住的同一把数据密钥（要同步，换机器靠它解锁）
//   store-key.dpapi         同一把数据密钥，用 Windows DPAPI(CurrentUser) 包着（本机便捷解锁，
//                           绑账户，**不要同步**，同步过去也用不了）
//
// 多端同步 = 让同一份 store.enc.json + store-key.passphrase.json 落在各设备都能读写的位置
// （移动硬盘、Syncthing/网盘同步目录、局域网共享盘都行）。每台设备第一次打开时输入一次主口令，
// 之后可选在本机再封一层 DPAPI 免输入。
//
// 写入用「读 → 改 → 比对哈希 → 冲突就重试」的乐观并发：两台设备改不同条目时两边都保留，
// 改同一条时以最后写入为准（updated_at 新的胜出由后写者决定，不做人工合并）。
import { createCipheriv, createDecipheriv, createHash, pbkdf2, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

export const STORE_FORMAT = '71lab-mimaben-store-v1'
export const KEYRING_FORMAT = '71lab-mimaben-keyring-v1'
export const KINDS = ['account', 'api', 'key', 'doc', 'other']

const DPAPI_ENTROPY = '71Lab.MiMaBen.Store.v1'
const KEY_BYTES = 32
const MAX_BODY = 200_000
const KDF_ITERATIONS = 600_000
const MIN_PASSPHRASE = 12
const WRITE_ATTEMPTS = 5

const DPAPI_FILE = 'store-key.dpapi'
const PASSPHRASE_FILE = 'store-key.passphrase.json'
const LOCK_FILE = 'store.lock'
const LOCK_TIMEOUT_MS = 6000
const LOCK_STALE_MS = 15000

// DPAPI 只能通过 PowerShell 调用：Node 没有内置绑定。
// 用 stdin 传 base64，避免命令行转义问题；stdout 只回 base64。
const PS_PROTECT = [
  "$ErrorActionPreference='Stop'",
  'try { Add-Type -AssemblyName System.Security -ErrorAction Stop } catch {}',
  `$entropy=[Text.Encoding]::UTF8.GetBytes('${DPAPI_ENTROPY}')`,
  '$raw=[Convert]::FromBase64String(([Console]::In.ReadToEnd()).Trim())',
  '$out=[Security.Cryptography.ProtectedData]::Protect($raw,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Console]::Out.Write([Convert]::ToBase64String($out))',
].join('\n')

const PS_UNPROTECT = [
  "$ErrorActionPreference='Stop'",
  'try { Add-Type -AssemblyName System.Security -ErrorAction Stop } catch {}',
  `$entropy=[Text.Encoding]::UTF8.GetBytes('${DPAPI_ENTROPY}')`,
  '$raw=[Convert]::FromBase64String(([Console]::In.ReadToEnd()).Trim())',
  '$out=[Security.Cryptography.ProtectedData]::Unprotect($raw,$entropy,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Console]::Out.Write([Convert]::ToBase64String($out))',
].join('\n')

function runPowerShell(script, input) {
  return new Promise((resolve, reject) => {
    const exe = process.env.MIMABEN_POWERSHELL || 'powershell.exe'
    let child
    try {
      child = spawn(exe, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    } catch (error) {
      reject(error)
      return
    }
    let out = ''
    let err = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { out += chunk })
    child.stderr.on('data', (chunk) => { err += chunk })
    child.on('error', (error) => reject(new Error(`无法运行 ${exe}：${error.message}`)))
    child.on('close', (code) => {
      if (code === 0) resolve(out.trim())
      else reject(new Error(`DPAPI 调用失败（exit ${code}）：${(err || out).trim().slice(0, 400)}`))
    })
    child.stdin.end(input, 'utf8')
  })
}

async function dpapiProtect(bytes) {
  const encoded = await runPowerShell(PS_PROTECT, bytes.toString('base64'))
  return Buffer.from(encoded, 'base64')
}

async function dpapiUnprotect(bytes) {
  const encoded = await runPowerShell(PS_UNPROTECT, bytes.toString('base64'))
  return Buffer.from(encoded, 'base64')
}

function deriveKek(passphrase, salt, iterations) {
  return new Promise((resolve, reject) => {
    pbkdf2(passphrase, salt, iterations, 32, 'sha256', (error, key) => (error ? reject(error) : resolve(key)))
  })
}

function keyId(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 16)
}

/** 主口令 → 32 字节 KEK → AES-256-GCM 包住数据密钥。 */
async function wrapWithPassphrase(dataKey, passphrase) {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const kek = await deriveKek(passphrase, salt, KDF_ITERATIONS)
  const cipher = createCipheriv('aes-256-gcm', kek, iv)
  const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()])
  const tag = cipher.getAuthTag()
  kek.fill(0)
  return {
    format: KEYRING_FORMAT,
    kdf: 'pbkdf2-sha256',
    iterations: KDF_ITERATIONS,
    created_at: new Date().toISOString(),
    key_id: keyId(dataKey),
    salt_b64: salt.toString('base64'),
    iv_b64: iv.toString('base64'),
    tag_b64: tag.toString('base64'),
    ciphertext_b64: ciphertext.toString('base64'),
  }
}

async function unwrapWithPassphrase(envelope, passphrase) {
  if (envelope?.format !== KEYRING_FORMAT) throw new Error('主口令文件格式不对，可能不是这个密码本的。')
  const kek = await deriveKek(passphrase, Buffer.from(envelope.salt_b64, 'base64'), Number(envelope.iterations) || KDF_ITERATIONS)
  const decipher = createDecipheriv('aes-256-gcm', kek, Buffer.from(envelope.iv_b64, 'base64'))
  decipher.setAuthTag(Buffer.from(envelope.tag_b64, 'base64'))
  try {
    const key = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext_b64, 'base64')), decipher.final()])
    return key
  } catch {
    throw new Error('主口令不对，或者这个文件被改动过。')
  } finally {
    kek.fill(0)
  }
}

/** 需要用户输主口令才能继续。 */
export class LockedError extends Error {
  constructor(message, needs = 'passphrase') {
    super(message)
    this.name = 'LockedError'
    this.code = 'locked'
    this.needs = needs
  }
}

/**
 * 存储目录，按顺序取第一个命中的：
 * 1. `MIMABEN_STORE_DIR` —— 指向同步目录、共享盘、移动硬盘时用它。
 * 2. `<插件目录>/../data` 里已经有库 —— 老安装/便携安装继续用它，升级不会"丢数据"。
 * 3. `$DSH_HOME/mimaben/data`。
 * 4. 平台用户目录：`%LOCALAPPDATA%\dsh-mimaben`、`~/Library/Application Support/dsh-mimaben`、
 *    `$XDG_DATA_HOME/dsh-mimaben`。
 */
export function resolveStoreDir(pluginRoot) {
  const explicit = (process.env.MIMABEN_STORE_DIR || '').trim()
  if (explicit) return explicit
  const root = pluginRoot || process.cwd()
  const sibling = join(root, '..', 'data')
  if (existsSync(join(sibling, 'store.enc.json'))) return sibling
  const home = (process.env.DSH_HOME || '').trim()
  if (home) return join(home, 'mimaben', 'data')
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'dsh-mimaben')
  }
  if (process.platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'dsh-mimaben')
  }
  return join(process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'dsh-mimaben')
}

function nowIso() {
  return new Date().toISOString()
}

function newId() {
  return `mba_${randomBytes(5).toString('hex')}`
}

function cleanText(value, max) {
  if (value === undefined || value === null) return null
  const text = String(value).replace(/\r\n/g, '\n').trim()
  if (!text) return null
  return text.length > max ? text.slice(0, max) : text
}

function cleanTags(value) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,，、\s]+/) : []
  const tags = []
  for (const item of raw) {
    const tag = cleanText(item, 40)
    if (tag && !tags.includes(tag)) tags.push(tag)
    if (tags.length >= 12) break
  }
  return tags
}

/** 字段取值：没传（undefined）= 保持原值；显式传 null = 清空；传值 = 覆盖。 */
function field(input, previous, key, clean) {
  const value = input?.[key]
  if (value === undefined) return previous ? previous[key] ?? null : null
  return clean(value)
}

export const HISTORY_LIMIT = 10

const TRACKED_FIELDS = [
  ['title', '标题'],
  ['kind', '类型'],
  ['account', '账号'],
  ['secret', '密钥'],
  ['url', '链接'],
  ['body', '正文'],
  ['tags', '标签'],
]

/** 比较前后两条记录，返回被改动的字段中文名（不含值）。 */
export function diffFields(before, after) {
  const changed = []
  for (const [key, label] of TRACKED_FIELDS) {
    const left = before?.[key]
    const right = after?.[key]
    const same = Array.isArray(left) || Array.isArray(right)
      ? JSON.stringify(left || []) === JSON.stringify(right || [])
      : (left ?? null) === (right ?? null)
    if (!same) changed.push(label)
  }
  return changed
}

/**
 * 把外部输入整理成一条记录。字段级合并：没给的字段沿用 previous，显式 null 才清空。
 * 这样"只改标题"不会顺手抹掉账号和密钥。
 */
export function normalizeEntry(input, previous) {
  const title = field(input, previous, 'title', (value) => cleanText(value, 200))
  if (!title) throw new Error('标题不能为空')
  const kind = field(input, previous, 'kind', (value) => (KINDS.includes(value) ? value : 'account')) || 'account'
  const rawSecret = field(input, previous, 'secret', (value) => cleanText(value, 8000))
  // 前端拿到的密钥是占位圆点；万一某个旧页面把它当新值提交，这里按"不修改"处理，
  // 否则真密钥会被一串 • 覆盖掉。
  const secret = rawSecret && /^•+$/.test(rawSecret) ? previous?.secret ?? null : rawSecret
  return {
    id: previous?.id || newId(),
    title,
    kind,
    account: field(input, previous, 'account', (value) => cleanText(value, 400)),
    secret,
    url: field(input, previous, 'url', (value) => cleanText(value, 2000)),
    body: field(input, previous, 'body', (value) => cleanText(value, MAX_BODY)),
    tags: field(input, previous, 'tags', (value) => cleanTags(value)) || [],
    created_at: previous?.created_at || nowIso(),
    updated_at: nowIso(),
    history: previous?.history || [],
  }
}

function maskSecret(secret) {
  if (!secret) return null
  return '•'.repeat(Math.min(secret.length, 12))
}

/** 对外返回的条目：默认抹掉密钥正文，只说明有没有、多长。 */
export function publicEntry(entry, reveal = false, withHistory = false) {
  return {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    account: entry.account,
    url: entry.url,
    body: entry.body,
    tags: entry.tags,
    has_secret: Boolean(entry.secret),
    secret_length: entry.secret ? entry.secret.length : 0,
    secret: reveal ? entry.secret : maskSecret(entry.secret),
    created_at: entry.created_at,
    updated_at: entry.updated_at,
    ...(withHistory ? { history: entry.history || [] } : {}),
  }
}

export class MimabenStore {
  #dir
  #file
  #dpapiFile
  #passphraseFile
  #lockFile
  #keyCache = null
  #keyPromise = null
  #queue = Promise.resolve()
  #forcePassphrase = /^(1|true|yes)$/i.test(process.env.MIMABEN_FORCE_PASSPHRASE || '')

  constructor(dir) {
    this.#dir = dir
    this.#file = join(dir, 'store.enc.json')
    this.#dpapiFile = join(dir, DPAPI_FILE)
    this.#passphraseFile = join(dir, PASSPHRASE_FILE)
    this.#lockFile = join(dir, LOCK_FILE)
  }

  get dir() {
    return this.#dir
  }

  /** 串行化同进程内的读改写。 */
  #serial(task) {
    const run = this.#queue.then(task, task)
    this.#queue = run.then(() => undefined, () => undefined)
    return run
  }

  async #key() {
    if (this.#keyCache) return this.#keyCache
    if (!this.#keyPromise) {
      this.#keyPromise = this.#loadKey().then(
        (key) => {
          this.#keyCache = key
          return key
        },
        (error) => {
          this.#keyPromise = null
          throw error
        },
      )
    }
    return this.#keyPromise
  }

  async #loadKey() {
    const hasPassphrase = existsSync(this.#passphraseFile)
    if (!this.#forcePassphrase && existsSync(this.#dpapiFile)) {
      try {
        const key = await dpapiUnprotect(await fs.readFile(this.#dpapiFile))
        if (key.length !== KEY_BYTES) throw new Error('内容长度不对')
        return key
      } catch (error) {
        if (!hasPassphrase) {
          throw new Error(
            `这台设备解不开本机的密钥（${error.message}）。可能换了 Windows 账户或换了电脑：` +
              '需要在原设备的「密码本 → 主口令」里设一个主口令，然后把 store-key.passphrase.json 一起同步过来。',
          )
        }
        // 有主口令槽：交给用户输口令
      }
    }
    if (hasPassphrase) {
      throw new LockedError('密码本已锁定：输入主口令解锁。')
    }
    if (process.platform !== 'win32') {
      throw new Error('当前系统没有 Windows DPAPI，也没有主口令。请在 Windows 设备上设置主口令后同步过来。')
    }
    if (existsSync(this.#file)) {
      throw new Error(`密钥文件缺失，已有记录无法解密：${this.#dpapiFile}。请从备份恢复，或到原设备设置主口令。`)
    }
    const key = randomBytes(KEY_BYTES)
    await fs.mkdir(this.#dir, { recursive: true })
    await fs.writeFile(this.#dpapiFile, await dpapiProtect(key), { mode: 0o600 })
    return key
  }

  /** 用主口令解锁（多端第一次打开时用）；本机没有 DPAPI 槽时顺手封一份，下次免输入。 */
  async unlock(passphrase) {
    if (String(passphrase || '').length < MIN_PASSPHRASE) throw new Error(`主口令至少 ${MIN_PASSPHRASE} 位。`)
    const envelope = JSON.parse(await fs.readFile(this.#passphraseFile, 'utf8'))
    const key = await unwrapWithPassphrase(envelope, passphrase)
    if (key.length !== KEY_BYTES) throw new Error('主口令文件内容不对。')
    this.#keyCache = key
    this.#keyPromise = Promise.resolve(key)
    if (process.platform === 'win32' && !this.#forcePassphrase && !existsSync(this.#dpapiFile)) {
      try {
        await fs.writeFile(this.#dpapiFile, await dpapiProtect(key), { mode: 0o600 })
      } catch {
        // 封不起来不影响本次使用
      }
    }
    return { key_id: keyId(key) }
  }

  /** 给别的设备准备主口令：用同一把数据密钥再包一层。主口令本身不落盘。 */
  async setPassphrase(passphrase) {
    const text = String(passphrase || '')
    if (text.length < MIN_PASSPHRASE) throw new Error(`主口令至少 ${MIN_PASSPHRASE} 位。`)
    const key = await this.#key()
    const envelope = await wrapWithPassphrase(key, text)
    await fs.mkdir(this.#dir, { recursive: true })
    await fs.writeFile(this.#passphraseFile, JSON.stringify(envelope, null, 2), { mode: 0o600 })
    return { key_id: envelope.key_id }
  }

  /**
   * 首次创建密码本。Windows 上可以自动建（DPAPI 保管密钥）；
   * 其它系统没有 DPAPI，必须当场定一个主口令来保管这把密钥。
   */
  async bootstrap(passphrase) {
    if (existsSync(this.#file) || existsSync(this.#passphraseFile) || existsSync(this.#dpapiFile)) {
      throw new Error('这个目录里已经有密码本了，不用重新创建。')
    }
    const text = String(passphrase || '')
    if (text.length < MIN_PASSPHRASE) throw new Error(`主口令至少 ${MIN_PASSPHRASE} 位。`)
    const key = randomBytes(KEY_BYTES)
    await fs.mkdir(this.#dir, { recursive: true })
    const envelope = await wrapWithPassphrase(key, text)
    await fs.writeFile(this.#passphraseFile, JSON.stringify(envelope, null, 2), { mode: 0o600 })
    let sealed = false
    if (process.platform === 'win32') {
      try {
        await fs.writeFile(this.#dpapiFile, await dpapiProtect(key), { mode: 0o600 })
        sealed = true
      } catch {
        sealed = false
      }
    }
    this.#keyCache = key
    this.#keyPromise = Promise.resolve(key)
    return { key_id: keyId(key), sealed_to_windows_account: sealed }
  }

  async passphraseInfo() {
    if (!existsSync(this.#passphraseFile)) return { configured: false }
    try {
      const envelope = JSON.parse(await fs.readFile(this.#passphraseFile, 'utf8'))
      return { configured: true, key_id: envelope.key_id, created_at: envelope.created_at, iterations: envelope.iterations }
    } catch {
      return { configured: true, broken: true }
    }
  }

  /** 读出原始字节 + 哈希，供乐观并发比对。 */
  async #readRaw() {
    const raw = await fs.readFile(this.#file).catch((error) => {
      if (error.code === 'ENOENT') return null
      throw error
    })
    return { raw, hash: raw ? createHash('sha256').update(raw).digest('hex') : null }
  }

  async #decrypt(raw, key) {
    const payload = JSON.parse(raw)
    if (payload.format !== STORE_FORMAT) throw new Error(`未知的存储格式：${payload.format}`)
    if (payload.key_id && payload.key_id !== keyId(key)) {
      throw new Error('这份加密数据是用另一把密钥写的，和当前解锁的密钥不是一套。')
    }
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
    try {
      const plain = Buffer.concat([decipher.update(Buffer.from(payload.data, 'base64')), decipher.final()])
      const doc = JSON.parse(plain.toString('utf8'))
      if (!Array.isArray(doc.entries)) doc.entries = []
      return doc
    } catch {
      throw new Error('解密失败：store.enc.json 与当前密钥不匹配，或文件被改动过。')
    }
  }

  async #load() {
    const key = await this.#key()
    const { raw } = await this.#readRaw()
    if (!raw) return { format: STORE_FORMAT, entries: [], updated_at: null }
    return this.#decrypt(raw, key)
  }

  async #persist(doc) {
    const key = await this.#key()
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const plain = Buffer.from(JSON.stringify(doc), 'utf8')
    const data = Buffer.concat([cipher.update(plain), cipher.final()])
    plain.fill(0)
    const payload = {
      format: STORE_FORMAT,
      alg: 'AES-256-GCM',
      key_protection: existsSync(this.#passphraseFile) ? 'dpapi+passphrase' : 'windows-dpapi-currentuser',
      key_id: keyId(key),
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: data.toString('base64'),
      updated_at: doc.updated_at,
    }
    await fs.mkdir(this.#dir, { recursive: true })
    const tmp = `${this.#file}.${randomBytes(4).toString('hex')}.tmp`
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 })
    try {
      await this.#replaceFile(tmp, this.#file)
    } catch (error) {
      await fs.unlink(tmp).catch(() => {})
      throw error
    }
  }

  /**
   * Windows 上目标文件正被别的进程读着时 rename 会 EPERM/EBUSY，重试几次即可。
   */
  async #replaceFile(tmp, target) {
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(tmp, target)
        return
      } catch (error) {
        const retryable = ['EPERM', 'EACCES', 'EBUSY', 'EEXIST'].includes(error.code)
        if (!retryable || attempt >= 8) throw error
        await delay(20 + attempt * 25)
      }
    }
  }

  /**
   * 跨进程互斥：同一份文件可能被多台设备/多个进程同时改。
   * 拿不到锁就等一下；锁是崩溃遗留的旧文件（超过 15 秒）就直接接管。
   */
  async #withLock(task) {
    const deadline = Date.now() + LOCK_TIMEOUT_MS
    let handle = null
    while (!handle) {
      try {
        handle = await fs.open(this.#lockFile, 'wx')
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
        const stat = await fs.stat(this.#lockFile).catch(() => null)
        if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.unlink(this.#lockFile).catch(() => {})
          continue
        }
        if (Date.now() > deadline) throw Object.assign(new Error('密码本正被另一台设备写入，请稍后再试。'), { status: 409 })
        await delay(40)
      }
    }
    try {
      await handle.writeFile(`${process.pid} ${new Date().toISOString()}`)
      return await task()
    } finally {
      await handle.close().catch(() => {})
      await fs.unlink(this.#lockFile).catch(() => {})
    }
  }

  /**
   * 乐观并发写入：改之前记下文件哈希，落地前再比一次。
   * 两台设备同时写同一份文件时，后写的那次会发现哈希变了 → 重新读、重新改，两边都不丢。
   */
  async #mutate(apply) {
    return this.#serial(() =>
      this.#withLock(async () => {
        for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
          const key = await this.#key()
          const before = await this.#readRaw()
          const doc = before.raw ? await this.#decrypt(before.raw, key) : { format: STORE_FORMAT, entries: [], updated_at: null }
          const result = apply(doc)
          const after = await this.#readRaw()
          if (after.hash !== before.hash) continue
          doc.format = STORE_FORMAT
          doc.updated_at = nowIso()
          await this.#persist(doc)
          return result
        }
        throw Object.assign(new Error('密码本正被另一台设备写入，请再试一次。'), { status: 409 })
      }),
    )
  }

  async status() {
    const hasDpapi = existsSync(this.#dpapiFile)
    const passphrase = await this.passphraseInfo()
    const fresh = !existsSync(this.#file) && !hasDpapi && !passphrase.configured
    const base = {
      path: this.#file,
      dir: this.#dir,
      has_dpapi: hasDpapi,
      has_passphrase: passphrase.configured,
      passphrase,
      fresh,
    }
    try {
      const doc = await this.#load()
      return {
        ok: true,
        locked: false,
        ...base,
        count: doc.entries.length,
        updated_at: doc.updated_at,
        key_protection: passphrase.configured ? 'dpapi+passphrase' : 'windows-dpapi-currentuser',
        key_id: this.#keyCache ? keyId(this.#keyCache) : null,
      }
    } catch (error) {
      if (error instanceof LockedError) {
        return { ok: true, locked: true, needs: error.needs, ...base, count: null, updated_at: null }
      }
      return {
        ok: false,
        locked: false,
        ...(fresh ? { needs: 'bootstrap' } : {}),
        ...base,
        error: error.message,
        count: 0,
      }
    }
  }

  async list({ query, kind } = {}) {
    const doc = await this.#load()
    const needle = (query || '').trim().toLowerCase()
    const items = doc.entries
      .filter((entry) => !kind || kind === 'all' || entry.kind === kind)
      .filter((entry) => {
        if (!needle) return true
        return [entry.title, entry.account, entry.url, entry.body, ...(entry.tags || [])]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      })
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map((entry) => publicEntry(entry, false, true))
    return { items, total: doc.entries.length, updated_at: doc.updated_at }
  }

  async read(id, { reveal = false } = {}) {
    const doc = await this.#load()
    const entry = doc.entries.find((item) => item.id === id)
    if (!entry) throw new Error(`没有这个条目：${id}`)
    return publicEntry(entry, reveal, true)
  }

  /**
   * 新建或修改。带 id = 修改：只覆盖给出的字段，没给的保持原样，显式 null 才清空。
   * 修改会记一条 history（只记字段名和时间，不存旧值，避免密钥副本堆积）。
   */
  async save(input, { source = 'ui' } = {}) {
    return this.#mutate((doc) => {
      const previous = input?.id ? doc.entries.find((item) => item.id === input.id) : undefined
      if (input?.id && !previous) throw new Error(`没有这个条目：${input.id}`)
      const entry = normalizeEntry(input, previous)
      if (previous) {
        const changed = diffFields(previous, entry)
        if (changed.length) {
          entry.history = [...(previous.history || []), { at: entry.updated_at, source, fields: changed }].slice(-HISTORY_LIMIT)
        }
        if (String(entry.updated_at) < String(previous.updated_at)) entry.updated_at = previous.updated_at
        doc.entries = doc.entries.map((item) => (item.id === entry.id ? entry : item))
      } else {
        doc.entries.push(entry)
      }
      return publicEntry(entry, true, true)
    })
  }

  /** 只改给出的字段：patch 里没有的键一律不动。 */
  async update(id, patch = {}, options = {}) {
    if (!id) throw new Error('缺少 id')
    return this.save({ ...patch, id }, options)
  }

  async remove(id) {
    return this.#mutate((doc) => {
      const before = doc.entries.length
      doc.entries = doc.entries.filter((entry) => entry.id !== id)
      if (doc.entries.length === before) throw new Error(`没有这个条目：${id}`)
      return { id, total: doc.entries.length }
    })
  }
}
