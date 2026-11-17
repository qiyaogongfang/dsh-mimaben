// 密码本 · Host 半边
//
// 1. 加密存储（store.js）：条目落在本机数据目录（见 resolveStoreDir），AES-256-GCM + Windows DPAPI 保管密钥。
// 2. 给浏览器页面用的同源接口：POST /mimaben/api/rpc，action = status|list|get|save|delete。
//    密码本页面（client.js）和模型工具走同一套方法，不存在两份逻辑。
// 3. 给模型的四个工具：mimaben_save / mimaben_list / mimaben_get / mimaben_delete。
//    默认不回密钥正文，只有用户明确要原值时才 reveal。
import { fileURLToPath } from 'node:url'
import { MimabenStore, KINDS, resolveStoreDir } from './store.js'

const PLUGIN_ROOT = fileURLToPath(new URL('.', import.meta.url))
const BASE = '/mimaben/api'
const MAX_BODY = 512 * 1024

export const name = 'mimaben'
export const inject = ['webServer', 'tools']

const PROMPT = `# 密码本 / Vault
用户有一个本机加密的密码本（mimaben），用 mimaben_* 工具读写。用户说「记一下」「存起来」并给出
账号、密码、Key 或文档时写入 mimaben_save，别写进别的文件；要某项时先用 mimaben_list 找到条目，
再用 mimaben_get 取；只有用户明确要密钥原值时才把 reveal 设为 true，回复里只给出他要的那一项。
The user keeps credentials in a local encrypted vault (mimaben). When the user asks to remember an
account, password, key or document, call mimaben_save instead of writing another file. To fetch one,
locate it with mimaben_list, then read it with mimaben_get. Set reveal only when the user explicitly
asks for the secret value itself, and return only that one item — never dump the other credentials.`

function statusError(status, message) {
  return Object.assign(new Error(message), { status })
}

// 只接受同源页面发来的 JSON：content-type、Origin、自定义请求头三道，挡住跨站写入。
function readJson(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    if (req.method !== 'POST') return reject(statusError(405, '只接受 POST'))
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
      return reject(statusError(415, 'content-type 必须是 application/json'))
    }
    const origin = req.headers.origin
    if (origin) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        return reject(statusError(403, 'Origin 无效'))
      }
      if (!req.headers.host || originHost !== req.headers.host) return reject(statusError(403, '拒绝跨站请求'))
    }
    if (req.headers['x-mimaben'] !== '1') return reject(statusError(403, '缺少 x-mimaben 请求头'))
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > max) req.destroy()
      else chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(statusError(400, '请求体不是合法 JSON'))
      }
    })
    req.on('error', reject)
  })
}

/** 浏览器页面和工具共用的同一套操作。 */
async function dispatch(store, action, payload) {
  switch (action) {
    case 'status':
      return store.status()
    case 'list':
      return store.list({ query: payload.query, kind: payload.kind })
    case 'get':
      if (!payload.id) throw new Error('缺少 id')
      return store.read(String(payload.id), { reveal: payload.reveal === true })
    case 'save':
      return store.save(payload.entry || payload, { source: payload.source || 'ui' })
    case 'update':
      return store.update(payload.id, payload.patch || {}, { source: payload.source || 'ui' })
    case 'delete':
      if (!payload.id) throw new Error('缺少 id')
      return store.remove(String(payload.id))
    // 主口令只能由人在页面上输入：不提供任何模型工具入口，避免口令进对话记录。
    case 'unlock':
      if (!payload.passphrase) throw new Error('缺少主口令')
      return store.unlock(String(payload.passphrase))
    case 'set-passphrase':
      if (!payload.passphrase) throw new Error('缺少主口令')
      return store.setPassphrase(String(payload.passphrase))
    // 首次创建：非 Windows 主机必须带一个主口令才能建库。
    case 'bootstrap':
      if (!payload.passphrase) throw new Error('缺少主口令')
      return store.bootstrap(String(payload.passphrase))
    default:
      throw Object.assign(new Error(`未知操作：${action}`), { status: 400 })
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

const text = (value) => [{ type: 'text', text: value }]
const str = (description, extra = {}) => ({ type: 'string', description, ...extra })

const KIND_LABEL = { account: '账号 / Account', api: 'API', key: '密钥 / Key', doc: '文档 / Doc', other: '其他 / Other' }

// 修改记录里存的是字段中文名（历史数据也是），渲染时补上英文。
const FIELD_LABEL = {
  标题: '标题 / title',
  类型: '类型 / kind',
  账号: '账号 / account',
  密钥: '密钥 / secret',
  链接: '链接 / link',
  正文: '正文 / body',
  标签: '标签 / tags',
}
const fieldLabel = (name) => FIELD_LABEL[name] || name
const SOURCE_LABEL = { tool: '对话 / chat', ui: '页面 / panel' }

function formatTime(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso)
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function entryText(entry, { revealed = false } = {}) {
  const lines = [`${entry.title}（${KIND_LABEL[entry.kind] || entry.kind}）`, `id：${entry.id}`]
  if (entry.account) lines.push(`账号 / Account：${entry.account}`)
  if (entry.has_secret) {
    lines.push(
      revealed
        ? `密钥 / Secret：${entry.secret}`
        : `密钥 / Secret：已隐藏（${entry.secret_length} 位；要原值就再取一次并传 reveal=true）/ hidden (${entry.secret_length} chars; pass reveal=true for the value)`,
    )
  }
  if (entry.url) lines.push(`链接 / Link：${entry.url}`)
  if (entry.tags && entry.tags.length) lines.push(`标签 / Tags：${entry.tags.join('、')}`)
  if (entry.body) lines.push('', entry.body)
  lines.push('', `更新 / Updated：${formatTime(entry.updated_at)}`)
  const history = (entry.history || []).slice(-3).reverse()
  if (history.length) {
    lines.push('修改记录 / History：')
    for (const item of history) {
      lines.push(`- ${formatTime(item.at)} · ${item.fields.map(fieldLabel).join('、')} · ${SOURCE_LABEL[item.source] || item.source}`)
    }
  }
  return lines.join('\n')
}

function checkArgs(args, schema) {
  const errors = []
  const input = args && typeof args === 'object' ? args : {}
  for (const key of schema.required || []) {
    if (input[key] === undefined || input[key] === '') errors.push(`缺少 ${key}`)
  }
  for (const [key, value] of Object.entries(input)) {
    const property = schema.properties[key]
    if (!property) {
      errors.push(`未知参数 ${key}`)
      continue
    }
    if (value === undefined || value === null) continue
    if (property.type === 'array') {
      if (!Array.isArray(value)) errors.push(`${key} 应该是字符串数组`)
    } else if (typeof value !== 'string') {
      errors.push(`${key} 应该是字符串`)
    } else if (property.enum && !property.enum.includes(value)) {
      errors.push(`${key} 只能是 ${property.enum.join(' / ')}`)
    }
  }
  if (errors.length) throw new Error(errors.join('；'))
  return input
}

function buildTools(store) {
  const SAVE_PARAMS = {
    type: 'object',
    additionalProperties: false,
    required: ['title'],
    properties: {
      title: str('条目名称，例如「腾讯云 CAM 子用户」「Cloudflare D1 备份步骤」'),
      kind: str('类型：account 账号密码，api 接口凭据，key 密钥，doc 文档，other 其它', {
        enum: KINDS,
        default: 'account',
      }),
      account: str('账号、用户名或邮箱'),
      secret: str('密码、API Key、Token 或私钥原文；密码本会加密保存'),
      url: str('登录地址、控制台地址或文档路径'),
      body: str('文档正文、备注或使用说明'),
      tags: { type: 'array', items: { type: 'string' }, description: '标签，例如 ["云服务", "腾讯"]' },
      id: str('要更新的条目 id；不填表示新建'),
    },
  }

  const LIST_PARAMS = {
    type: 'object',
    additionalProperties: false,
    properties: {
      query: str('按标题、账号、链接、标签或正文模糊搜索'),
      kind: str('只看某一类', { enum: [...KINDS, 'all'] }),
    },
  }

  const GET_PARAMS = {
    type: 'object',
    additionalProperties: false,
    properties: {
      id: str('条目 id（mimaben_list 返回）'),
      query: str('不确定 id 时用标题关键词查；命中多个会返回候选列表'),
      reveal: str('要密钥原值就填 "true"；默认只给隐藏后的占位'),
    },
  }

  const DELETE_PARAMS = {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: str('要删除的条目 id') },
  }

  const UPDATE_PARAMS = {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: {
      id: str('要修改的条目 id（mimaben_list 返回）'),
      title: str('新标题'),
      kind: str('新类型', { enum: KINDS }),
      account: str('新账号'),
      secret: str('新密码 / Key / 密钥原文'),
      url: str('新链接或路径'),
      body: str('新正文'),
      tags: { type: 'array', items: { type: 'string' }, description: '新的标签列表（整体替换）' },
      clear: {
        type: 'array',
        items: { type: 'string', enum: ['account', 'secret', 'url', 'body', 'tags'] },
        description: '要清空的字段名',
      },
    },
  }

  return [
    {
      name: 'mimaben_save',
      description:
        '把账号、密码、API Key、密钥或文档存进本机加密密码本。不传 id 是新建；带 id 只覆盖给出的字段。 / Save an account, password, API key or document into the local encrypted vault. Omit id to create; with id only the given fields are written.',
      parameters: SAVE_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'kind', 'created'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            kind: { type: 'string' },
            created: { type: 'boolean' },
          },
        },
        render: (_args, value) =>
          text(
            `已保存 / Saved：${value.title}（${KIND_LABEL[value.kind] || value.kind}，id ${value.id}）` +
              `${value.created ? '' : ' · 已更新原条目 / updated'} · 密钥已加密落盘，不会回显 / secret encrypted at rest, never echoed`,
          ),
      },
      async execute(rawArgs) {
        const args = checkArgs(rawArgs, SAVE_PARAMS)
        const created = !args.id
        const entry = await dispatch(store, 'save', {
          source: 'tool',
          entry: {
            id: args.id,
            title: args.title,
            kind: args.kind,
            account: args.account,
            secret: args.secret,
            url: args.url,
            body: args.body,
            tags: args.tags,
          },
        })
        return { id: entry.id, title: entry.title, kind: entry.kind, created }
      },
    },
    {
      name: 'mimaben_update',
      description:
        '改一条已有记录：只覆盖给出的字段，其余保持不变；清空某字段就传 null 或把字段名放进 clear。 / Update an existing entry: only the given fields change; pass null or list the field in clear to empty it.',
      parameters: UPDATE_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'title', 'changed'],
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            changed: { type: 'array', items: { type: 'string' } },
          },
        },
        render: (_args, value) =>
          text(
            `已修改 / Updated：${value.title} · ` +
              `${value.changed.length ? '改了 / changed：' + value.changed.join('、') : '内容与原来一致 / no change'}`,
          ),
      },
      async execute(rawArgs) {
        const args = checkArgs(rawArgs, UPDATE_PARAMS)
        const patch = {}
        for (const key of ['title', 'kind', 'account', 'secret', 'url', 'body', 'tags']) {
          if (args[key] !== undefined) patch[key] = args[key]
        }
        for (const key of args.clear || []) patch[key] = null
        if (!Object.keys(patch).length) throw new Error('没有要改的字段：给 title/account/secret/url/body/tags 之一，或用 clear 清空。')
        const entry = await dispatch(store, 'update', { id: args.id, patch, source: 'tool' })
        const last = (entry.history || []).slice(-1)[0]
        return { id: entry.id, title: entry.title, changed: last ? last.fields.map(fieldLabel) : [] }
      },
    },
    {
      name: 'mimaben_list',
      description: '列出条目（不含密钥正文），可按关键词和类型筛选，返回 id 供 mimaben_get 使用。 / List entries without secret bodies, filtered by query and kind; the ids feed mimaben_get.',
      parameters: LIST_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['total', 'shown'],
          properties: {
            total: { type: 'integer' },
            shown: { type: 'integer' },
            summary: { type: 'string' },
          },
        },
        render: (_args, value) => text(value.summary),
      },
      async execute(rawArgs) {
        const args = checkArgs(rawArgs, LIST_PARAMS)
        const { items, total } = await dispatch(store, 'list', { query: args.query, kind: args.kind })
        const shown = items.slice(0, 80)
        const header = args.query
          ? `匹配「${args.query}」${items.length} 条 / ${items.length} matched for "${args.query}"`
          : `共 ${items.length} 条 / ${items.length} entries`
        const rows = shown.map((item, index) => {
          const bits = [item.title, KIND_LABEL[item.kind] || item.kind]
          if (item.account) bits.push(`账号/Account ${item.account}`)
          bits.push(item.has_secret ? `密钥/secret ${item.secret_length}` : '无密钥 / no secret')
          bits.push(`${formatTime(item.updated_at)}`)
          bits.push(`id ${item.id}`)
          return `${index + 1}. ${bits.join(' · ')}`
        })
        const summary = [
          header,
          ...rows,
          items.length > shown.length
            ? `（只显示前 ${shown.length} 条，用 query 缩小范围）/ showing the first ${shown.length}; narrow it with query`
            : '',
          total === 0 ? '密码本还是空的 / The vault is empty' : '',
        ]
          .filter(Boolean)
          .join('\n')
        return { total, shown: shown.length, summary }
      },
    },
    {
      name: 'mimaben_get',
      description:
        '取一条详情。默认隐藏密钥正文；只有用户明确要原值时 reveal 才传 "true"（原值会进入对话记录）。 / Read one entry. Secrets stay hidden unless reveal is "true", which puts the value into the transcript.',
      parameters: GET_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['found', 'text'],
          properties: {
            found: { type: 'boolean' },
            text: { type: 'string' },
            reveal: { type: 'boolean' },
          },
        },
        render: (_args, value) => text(value.text),
      },
      async execute(rawArgs) {
        const args = checkArgs(rawArgs, GET_PARAMS)
        const reveal = args.reveal === 'true' || args.reveal === true
        if (args.id) {
          const entry = await dispatch(store, 'get', { id: args.id, reveal })
          return { found: true, text: entryText(entry, { revealed: reveal }), reveal }
        }
        if (!args.query) throw new Error('需要 id 或 query')
        const { items } = await dispatch(store, 'list', { query: args.query })
        if (!items.length) {
          return { found: false, text: `没有匹配「${args.query}」的条目 / no entry matches "${args.query}"`, reveal }
        }
        if (items.length === 1) {
          const entry = await dispatch(store, 'get', { id: items[0].id, reveal })
          return { found: true, text: entryText(entry, { revealed: reveal }), reveal }
        }
        const rows = items.slice(0, 10).map((item, index) => `${index + 1}. ${item.title} · ${item.id}`)
        return {
          found: false,
          text: `「${args.query}」命中 ${items.length} 条，选一个 id 再取 / ${items.length} matches, pick one id:\n${rows.join('\n')}`,
          reveal,
        }
      },
    },
    {
      name: 'mimaben_delete',
      description: '删除一条记录，删前先跟用户确认是哪一条。 / Delete one entry. Confirm which one with the user first.',
      parameters: DELETE_PARAMS,
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'total'],
          properties: { id: { type: 'string' }, total: { type: 'integer' } },
        },
        render: (_args, value) => text(`已删除 / Deleted：${value.id} · 还剩 ${value.total} 条 / ${value.total} left`),
      },
      async execute(rawArgs) {
        const args = checkArgs(rawArgs, DELETE_PARAMS)
        return dispatch(store, 'delete', { id: args.id })
      },
    },
  ]
}

export function apply(ctx) {
  const store = new MimabenStore(resolveStoreDir(PLUGIN_ROOT))

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: BASE,
      async handler(req, res) {
        if (req.method !== 'POST') {
          res.writeHead(405, { allow: 'POST' })
          res.end()
          return
        }
        try {
          const body = await readJson(req)
          const data = await dispatch(store, String(body.action || ''), body)
          sendJson(res, 200, { ok: true, data })
        } catch (error) {
          sendJson(res, error.status || (error.code === 'locked' ? 409 : 500), {
            ok: false,
            error: error.message,
            ...(error.code === 'locked' ? { code: 'locked', needs: error.needs } : {}),
          })
        }
      },
    }),
  )

  for (const tool of buildTools(store)) ctx.effect(() => ctx.tools.register(tool))

  const systemPrompt = ctx.get('systemPrompt')
  if (systemPrompt) {
    ctx.effect(() => systemPrompt.section({ name: 'mimaben-vault', order: 40, text: PROMPT }))
  }
}
