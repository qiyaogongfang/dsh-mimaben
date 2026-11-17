// 密码本 · 浏览器半边
//
// 侧栏加一个「密码本」图标（钥匙孔），主区域是密码本页面：
//   左栏 搜索 + 类型筛选 + 条目列表；右栏 条目详情 / 新建与编辑表单。
// 数据来自 Host 的 POST /mimaben/api/rpc（同源、自定义头），密钥默认只显示占位点，
// 点「显示」才向 Host 要一次原值。样式只用 --dsw-alias-* 主题 token，不写死颜色。
window.__ModuleLoader__.load({
  id: 'dsh-mimaben',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const PANEL = 'mimaben'
    const API = '/mimaben/api/rpc'

    const KINDS = ['account', 'api', 'key', 'doc', 'other']

    const DICT = {
      zh: {
        panel: '密码本',
        title: '密码本',
        count: (n) => `${n} 条记录`,
        search: '搜索标题、账号、标签',
        newEntry: '新建',
        all: '全部',
        emptyTitle: '还没有记录',
        emptyHint: '右边点「新建」，或者直接在对话里说「记一下 ……」。',
        loading: '正在解锁密码本',
        noMatch: '没有匹配的条目',
        edit: '编辑',
        del: '删除',
        delConfirm: '确认删除',
        save: '保存',
        cancel: '取消',
        copy: '复制',
        copied: '已复制',
        copyFail: '复制失败，请手动选中文本',
        retry: '重试',
        reveal: '显示',
        hide: '隐藏',
        account: '账号',
        secret: '密钥',
        url: '链接',
        tags: '标签',
        doc: '正文',
        updated: '更新',
        locked: '无法解锁密码本',
        secretHidden: '未存密钥',
        hasSecret: '有密钥',
        formTitle: '标题',
        formKind: '类型',
        formAccount: '账号',
        formSecret: '密码 / Key',
        formUrl: '链接或路径',
        formTags: '标签',
        formBody: '正文 / 备注',
        formHint: '标签用逗号分隔；密钥加密保存，页面上默认隐藏。',
        formHintEdit: '只改你动过的字段；密钥留空表示保留原值。',
        secretKeep: (n) => `已存 ${n} 位，留空表示不修改`,
        secretCleared: '保存后会清空密钥',
        clearSecret: '清除密钥',
        history: '修改记录',
        byTool: '对话',
        byUi: '页面',
        genPassword: '生成密码',
        needTitle: '标题不能为空',
        saved: '已保存',
        deleted: '已删除',
        passphrase: '主口令',
        passTitle: '主口令',
        passIntro: '设置后，把 data 目录同步到别的设备，第一次打开输入这个口令就能解锁。',
        passSet: '已设置',
        passNotSet: '未设置',
        passLabel: '主口令（至少 12 位）',
        passSave: '设置',
        passReplace: '更换',
        passWarn: '忘了就打不开别的设备上的副本，建议存进密码管理器。',
        passDone: '主口令已保存',
        lockedTitle: '这台设备还没有解锁',
        lockedHint: '输入主口令继续。口令只在本机内存里用一次，不落盘。',
        unlock: '解锁',
        initTitle: '创建密码本',
        initHint: '先给这台设备上的密码本定一个主口令。以后把 data 目录同步到别的设备，也用它解锁。',
        initCreate: '创建',
        kind: { account: '账号', api: 'API', key: '密钥', doc: '文档', other: '其他' },
      },
      en: {
        panel: 'Vault',
        title: 'Vault',
        count: (n) => `${n} entries`,
        search: 'Search title, account, tag',
        newEntry: 'New',
        all: 'All',
        emptyTitle: 'No entries yet',
        emptyHint: 'Press “New”, or just say “remember …” in the chat.',
        loading: 'Unlocking the vault',
        noMatch: 'No matching entry',
        edit: 'Edit',
        del: 'Delete',
        delConfirm: 'Confirm delete',
        save: 'Save',
        cancel: 'Cancel',
        copy: 'Copy',
        copied: 'Copied',
        copyFail: 'Copy failed, select the text manually',
        retry: 'Retry',
        reveal: 'Show',
        hide: 'Hide',
        account: 'Account',
        secret: 'Secret',
        url: 'Link',
        tags: 'Tags',
        doc: 'Body',
        updated: 'Updated',
        locked: 'Vault locked',
        secretHidden: 'No secret',
        hasSecret: 'Has secret',
        formTitle: 'Title',
        formKind: 'Kind',
        formAccount: 'Account',
        formSecret: 'Password / key',
        formUrl: 'Link or path',
        formTags: 'Tags',
        formBody: 'Body / notes',
        formHint: 'Separate tags with commas. Secrets are encrypted and hidden by default.',
        formHintEdit: 'Only changed fields are written. Leave the secret blank to keep it.',
        secretKeep: (n) => `Stored, ${n} chars — leave blank to keep`,
        secretCleared: 'Secret will be cleared on save',
        clearSecret: 'Clear secret',
        history: 'History',
        byTool: 'chat',
        byUi: 'page',
        genPassword: 'Generate',
        needTitle: 'Title is required',
        saved: 'Saved',
        deleted: 'Deleted',
        passphrase: 'Passphrase',
        passTitle: 'Passphrase',
        passIntro: 'Once set, sync the data folder to another device and enter this passphrase there.',
        passSet: 'Set',
        passNotSet: 'Not set',
        passLabel: 'Passphrase (12 characters or more)',
        passSave: 'Set',
        passReplace: 'Replace',
        passWarn: 'Without it, a synced copy cannot be opened. Keep it in a password manager.',
        passDone: 'Passphrase saved',
        lockedTitle: 'This device is locked',
        lockedHint: 'Enter the passphrase. It is used once in memory and never stored.',
        unlock: 'Unlock',
        initTitle: 'Create the vault',
        initHint: 'Choose a passphrase for this vault. Synced copies on other devices open with it.',
        initCreate: 'Create',
        kind: { account: 'Account', api: 'API', key: 'Key', doc: 'Doc', other: 'Other' },
      },
    }

    let lang = /^zh/i.test(navigator.language || '') ? 'zh' : 'en'
    const langListeners = new Set()
    function setLang(next) {
      if (!next || next === lang) return
      lang = next
      for (const listener of langListeners) listener()
    }
    function useLang() {
      const [, bump] = React.useState(0)
      React.useEffect(() => {
        const listener = () => bump((n) => n + 1)
        langListeners.add(listener)
        return () => langListeners.delete(listener)
      }, [])
      return lang
    }

    async function rpc(action, payload) {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-mimaben': '1' },
        body: JSON.stringify({ action, ...(payload || {}) }),
      })
      let body = null
      try {
        body = await response.json()
      } catch {
        throw new Error(`HTTP ${response.status}`)
      }
      if (!response.ok || !body || body.ok !== true) {
        const error = new Error((body && body.error) || `HTTP ${response.status}`)
        if (body && body.code) error.code = body.code
        if (body && body.needs) error.needs = body.needs
        throw error
      }
      return body.data
    }

    function formatTime(iso) {
      if (!iso) return ''
      const date = new Date(iso)
      if (Number.isNaN(date.getTime())) return ''
      const pad = (value) => String(value).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    function generatePassword(length = 20) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_'
      const bytes = new Uint8Array(length)
      crypto.getRandomValues(bytes)
      let out = ''
      for (const byte of bytes) out += alphabet[byte % alphabet.length]
      return out
    }

    async function writeClipboard(value) {
      try {
        await navigator.clipboard.writeText(value)
        return true
      } catch {
        return false
      }
    }

    const ICON_PROPS = {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': 'true',
    }

    // 签名元素：钥匙孔。侧栏图标、空状态、载入态都用它。
    function Keyhole(props) {
      const size = props.size || 18
      return h('svg', { ...ICON_PROPS, width: size, height: size },
        h('path', { d: 'M12 3a5 5 0 0 0-5 5c0 1.9 1 3.5 2.5 4.4L8.4 21h7.2l-1.1-8.6A5 5 0 0 0 17 8a5 5 0 0 0-5-5z' }),
        h('circle', { cx: 12, cy: 8.2, r: 1.4 }))
    }

    const CSS = `
.mb-root { position: relative; display: flex; flex-direction: column; height: 100%; min-height: 0; background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font-family: "Geist", "PingFang SC", "HarmonyOS Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif; font-size: 14px; line-height: 1.6; }
.mb-root *, .mb-root *::before, .mb-root *::after { box-sizing: border-box; }
.mb-head { display: flex; align-items: center; gap: 10px; padding: 13px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1); flex: none; }
.mb-head-mark { display: flex; color: var(--dsw-alias-brand-primary); }
.mb-head-title { font-size: 16px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.2; }
.mb-head-count { font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.mb-head-spacer { flex: 1; }
.mb-body { flex: 1; min-height: 0; display: flex; }
.mb-pane { width: 300px; flex: none; border-right: 1px solid var(--dsw-alias-border-l1); display: flex; flex-direction: column; min-height: 0; }
.mb-search { padding: 12px 12px 8px; }
.mb-filters { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 10px; }
.mb-items { flex: 1; min-height: 0; overflow-y: auto; padding: 0 6px 16px; }
.mb-item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit;
  font: inherit; cursor: pointer; }
.mb-item:hover { background: var(--dsw-alias-bg-layer-1); }
.mb-item[data-active="true"] { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l1); }
.mb-item-row { display: flex; align-items: center; gap: 6px; }
.mb-item-title { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb-item-sub { font-size: 12px; color: var(--dsw-alias-label-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mb-kind { flex: none; font-size: 11px; line-height: 16px; padding: 0 5px; border: 1px solid var(--dsw-alias-border-l1); border-radius: 4px; color: var(--dsw-alias-label-secondary); }
.mb-dot { flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-success-primary); }
.mb-dot-off { background: var(--dsw-alias-state-idle-primary); }
.mb-detail { flex: 1; min-width: 0; overflow-y: auto; padding: 22px 26px 44px; position: relative; }
.mb-detail-title { font-size: 20px; font-weight: 600; line-height: 1.25; letter-spacing: -0.01em; text-wrap: balance; word-break: break-word; }
.mb-detail-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.mb-fields { margin: 18px 0 0; }
.mb-field { display: grid; grid-template-columns: 56px minmax(0, 1fr) auto; gap: 10px 12px; align-items: start; padding: 10px 0; border-top: 1px solid var(--dsw-alias-border-l1); }
.mb-field-label { font-size: 12px; color: var(--dsw-alias-label-secondary); padding-top: 2px; }
.mb-field-value { font-size: 13.5px; word-break: break-all; white-space: pre-wrap; }
.mb-mono { font-family: "Geist Mono", "SFMono-Regular", Menlo, "Noto Sans CJK SC", monospace; font-size: 13px; letter-spacing: 0.01em; }
.mb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.mb-btn { height: 30px; padding: 0 11px; font: inherit; font-size: 13px; line-height: 1.2; border-radius: 7px; border: 1px solid var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-primary); cursor: pointer; }
.mb-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.mb-btn:focus-visible, .mb-input:focus-visible, .mb-textarea:focus-visible, .mb-chip:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.mb-btn-primary { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); background: transparent; font-weight: 500; }
.mb-btn-primary:hover { background: var(--dsw-alias-bg-layer-1); }
.mb-btn-danger { border-color: var(--dsw-alias-state-error-primary); color: var(--dsw-alias-state-error-primary); background: transparent; }
.mb-btn-ghost { border-color: transparent; background: transparent; color: var(--dsw-alias-label-secondary); padding: 0 6px; }
.mb-btn-ghost:hover { color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-1); }
.mb-btn[disabled] { opacity: 0.5; cursor: default; }
.mb-input, .mb-textarea { width: 100%; font: inherit; color: inherit; background: var(--dsw-alias-bg-layer-1); border: 1px solid var(--dsw-alias-border-l1); border-radius: 7px; }
.mb-input { height: 32px; padding: 0 10px; font-size: 13px; }
.mb-textarea { min-height: 88px; padding: 8px 10px; font-size: 13px; line-height: 1.7; resize: vertical; }
.mb-chip { height: 26px; padding: 0 9px; font: inherit; font-size: 12px; line-height: 1.2; border-radius: 999px; border: 1px solid var(--dsw-alias-border-l1);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.mb-chip[data-active="true"] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-2); }
.mb-form { display: flex; flex-direction: column; gap: 14px; max-width: 560px; margin-top: 18px; }
.mb-label { display: block; font-size: 12px; color: var(--dsw-alias-label-secondary); margin-bottom: 5px; }
.mb-hint { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.mb-row { display: flex; gap: 10px; align-items: flex-end; }
.mb-lockbox { display: flex; flex-direction: column; align-items: center; gap: 10px; max-width: 380px; margin: 8vh auto 0; text-align: center; }
.mb-lockbox .mb-form { width: 100%; text-align: left; margin-top: 8px; }
.mb-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; height: 100%; min-height: 320px; text-align: center; color: var(--dsw-alias-label-secondary); }
.mb-empty-mark { color: var(--dsw-alias-label-secondary); opacity: 0.8; }
.mb-empty-title { font-size: 14px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.mb-empty-hint { font-size: 12.5px; max-width: 26em; text-wrap: pretty; }
.mb-banner { margin: 0 0 16px; padding: 10px 12px; border: 1px solid var(--dsw-alias-state-error-primary); border-radius: 8px;
  color: var(--dsw-alias-state-error-primary); font-size: 12.5px; line-height: 1.6; word-break: break-all; }
.mb-toast { position: absolute; left: 22px; bottom: 16px; z-index: 2; padding: 5px 10px; border-radius: 6px; font-size: 12px;
  border: 1px solid var(--dsw-alias-border-l1); background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.mb-history-row { font-size: 12px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; line-height: 1.8; }
.mb-tags { display: flex; flex-wrap: wrap; gap: 6px; }
@media (max-width: 720px) {
  .mb-body { flex-direction: column; }
  .mb-pane { width: 100%; max-height: 46%; border-right: none; border-bottom: 1px solid var(--dsw-alias-border-l1); }
  .mb-detail { padding: 16px 16px 32px; }
}
`

    function Field(props) {
      return h('div', { className: 'mb-field' },
        h('div', { className: 'mb-field-label' }, props.label),
        h('div', { className: 'mb-field-value' + (props.mono ? ' mb-mono' : '') }, props.children),
        h('div', { className: 'mb-actions' }, props.actions))
    }

    function EntryForm(props) {
      const t = props.t
      const initial = props.initial
      const editing = Boolean(initial.id)
      const hasSecret = Boolean(initial.has_secret)
      // 密钥永远不预填：列表里拿到的是占位圆点，填进去再保存会把真密钥覆盖掉。
      const [draft, setDraft] = React.useState(() => ({
        id: initial.id,
        title: initial.title || '',
        kind: initial.kind || 'account',
        account: initial.account || '',
        secret: '',
        url: initial.url || '',
        body: initial.body || '',
        tags: (initial.tags || []).join(', '),
      }))
      const [clearSecret, setClearSecret] = React.useState(false)
      const [error, setError] = React.useState('')
      const [busy, setBusy] = React.useState(false)
      const set = (key) => (event) => setDraft((current) => ({ ...current, [key]: event.target.value }))

      async function submit(event) {
        event.preventDefault()
        if (!String(draft.title || '').trim()) {
          setError(t.needTitle)
          return
        }
        setBusy(true)
        setError('')
        try {
          const payload = {
            id: draft.id,
            title: draft.title,
            kind: draft.kind,
            account: draft.account,
            url: draft.url,
            body: draft.body,
            tags: draft.tags,
          }
          // 空的密钥输入框 = 不改动已有密钥；点了"清除密钥"才传 null。
          if (draft.secret) payload.secret = draft.secret
          else if (clearSecret) payload.secret = null
          await props.onSave(payload)
        } catch (problem) {
          setError(problem && problem.message ? problem.message : String(problem))
        } finally {
          setBusy(false)
        }
      }

      const secretPlaceholder = clearSecret
        ? t.secretCleared
        : hasSecret
          ? t.secretKeep(initial.secret_length || 0)
          : ''

      return h('form', { className: 'mb-form', onSubmit: submit },
        error ? h('div', { className: 'mb-banner' }, error) : null,
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-title' }, t.formTitle),
          h('input', { id: 'mb-f-title', className: 'mb-input', value: draft.title, onChange: set('title'), autoFocus: true })),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-kind' }, t.formKind),
          h('select', { id: 'mb-f-kind', className: 'mb-input', value: draft.kind, onChange: set('kind') },
            KINDS.map((kind) => h('option', { key: kind, value: kind }, t.kind[kind])))),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-account' }, t.formAccount),
          h('input', { id: 'mb-f-account', className: 'mb-input', value: draft.account, onChange: set('account') })),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-secret' }, t.formSecret),
          h('div', { className: 'mb-row' },
            h('input', {
              id: 'mb-f-secret',
              className: 'mb-input mb-mono',
              value: draft.secret,
              placeholder: secretPlaceholder,
              onChange: (event) => { setClearSecret(false); set('secret')(event) },
              spellCheck: false,
              autoComplete: 'off',
            }),
            h('button', {
              type: 'button',
              className: 'mb-btn',
              onClick: () => setDraft((current) => ({ ...current, secret: generatePassword() })),
            }, t.genPassword),
            hasSecret
              ? h('button', {
                  type: 'button',
                  className: 'mb-btn',
                  onClick: () => { setClearSecret(true); setDraft((current) => ({ ...current, secret: '' })) },
                  disabled: clearSecret,
                }, t.clearSecret)
              : null)),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-url' }, t.formUrl),
          h('input', { id: 'mb-f-url', className: 'mb-input', value: draft.url, onChange: set('url') })),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-tags' }, t.formTags),
          h('input', { id: 'mb-f-tags', className: 'mb-input', value: draft.tags, onChange: set('tags') })),
        h('div', null,
          h('label', { className: 'mb-label', htmlFor: 'mb-f-body' }, t.formBody),
          h('textarea', { id: 'mb-f-body', className: 'mb-textarea', value: draft.body, onChange: set('body') })),
        h('div', { className: 'mb-hint' }, editing ? t.formHintEdit : t.formHint),
        h('div', { className: 'mb-actions' },
          h('button', { type: 'submit', className: 'mb-btn mb-btn-primary', disabled: busy }, t.save),
          h('button', { type: 'button', className: 'mb-btn', onClick: props.onCancel }, t.cancel)))
    }

    function Panel() {
      const language = useLang()
      const t = DICT[language] || DICT.zh

      const [phase, setPhase] = React.useState('loading')
      const [status, setStatus] = React.useState(null)
      const [error, setError] = React.useState('')
      const [items, setItems] = React.useState([])
      const [query, setQuery] = React.useState('')
      const [kind, setKind] = React.useState('all')
      const [selectedId, setSelectedId] = React.useState(null)
      const [mode, setMode] = React.useState('view')
      const [revealed, setRevealed] = React.useState(null)
      const [confirmDelete, setConfirmDelete] = React.useState(false)
      const [toast, setToast] = React.useState('')
      const [passInput, setPassInput] = React.useState('')
      const [passBusy, setPassBusy] = React.useState(false)
      const [passError, setPassError] = React.useState('')

      const selected = items.find((item) => item.id === selectedId) || null

      const flash = React.useCallback((message) => {
        setToast(message)
        window.setTimeout(() => setToast((current) => (current === message ? '' : current)), 1800)
      }, [])

      const load = React.useCallback(async () => {
        try {
          const info = await rpc('status')
          setStatus(info)
          if (!info.ok) {
            setPhase(info.needs === 'bootstrap' ? 'init' : 'error')
            setError(info.needs === 'bootstrap' ? '' : info.error || '')
            return
          }
          if (info.locked) {
            setPhase('locked')
            setError('')
            return
          }
          const data = await rpc('list', {})
          setItems(data.items)
          setPhase('ready')
          setError('')
        } catch (problem) {
          if (problem && problem.code === 'locked') {
            setPhase('locked')
            setError('')
            return
          }
          setPhase('error')
          setError(problem && problem.message ? problem.message : String(problem))
        }
      }, [])

      async function submitPassphrase() {
        setPassBusy(true)
        setPassError('')
        try {
          if (phase === 'locked') await rpc('unlock', { passphrase: passInput })
          else if (phase === 'init') await rpc('bootstrap', { passphrase: passInput })
          else await rpc('set-passphrase', { passphrase: passInput })
          setPassInput('')
          setMode('view')
          setToast(t.passDone)
          window.setTimeout(() => setToast((current) => (current === t.passDone ? '' : current)), 1800)
          setPhase('loading')
          await load()
        } catch (problem) {
          setPassError(problem && problem.message ? problem.message : String(problem))
        } finally {
          setPassBusy(false)
        }
      }

      React.useEffect(() => {
        load()
      }, [load])

      React.useEffect(() => {
        setRevealed(null)
        setConfirmDelete(false)
      }, [selectedId])

      const filtered = React.useMemo(() => {
        const needle = query.trim().toLowerCase()
        return items.filter((item) => {
          if (kind !== 'all' && item.kind !== kind) return false
          if (!needle) return true
          return [item.title, item.account, item.url, item.body, ...(item.tags || [])]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle))
        })
      }, [items, kind, query])

      async function copyValue(id, field) {
        try {
          let value = ''
          if (field === 'secret') {
            const entry = await rpc('get', { id, reveal: true })
            value = entry.secret || ''
          } else {
            const entry = await rpc('get', { id, reveal: false })
            value = entry[field] || ''
          }
          if (!value) return
          const ok = await writeClipboard(value)
          flash(ok ? t.copied : t.copyFail)
        } catch (problem) {
          flash(problem && problem.message ? problem.message : String(problem))
        }
      }

      async function revealSecret(id) {
        if (revealed && revealed.id === id) {
          setRevealed(null)
          return
        }
        try {
          const entry = await rpc('get', { id, reveal: true })
          setRevealed({ id, secret: entry.secret || '' })
        } catch (problem) {
          flash(problem && problem.message ? problem.message : String(problem))
        }
      }

      async function saveEntry(draft) {
        const saved = await rpc('save', { entry: draft })
        const data = await rpc('list', {})
        setItems(data.items)
        setSelectedId(saved.id)
        setMode('view')
        flash(t.saved)
      }

      async function removeEntry(id) {
        try {
          await rpc('delete', { id })
          const data = await rpc('list', {})
          setItems(data.items)
          setSelectedId(null)
          setMode('view')
          setConfirmDelete(false)
          flash(t.deleted)
        } catch (problem) {
          flash(problem && problem.message ? problem.message : String(problem))
        }
      }

      function startNew() {
        setSelectedId(null)
        setMode('edit')
      }

      const ready = phase === 'ready'
      const head = h('div', { className: 'mb-head' },
        h('span', { className: 'mb-head-mark' }, h(Keyhole, { size: 17 })),
        h('span', { className: 'mb-head-title' }, t.title),
        h('span', { className: 'mb-head-count' }, ready ? t.count(items.length) : ''),
        h('span', { className: 'mb-head-spacer' }),
        ready
          ? h('button', {
              className: 'mb-btn mb-btn-ghost',
              onClick: () => { setMode('passphrase'); setPassInput(''); setPassError('') },
            }, t.passphrase)
          : null,
        ready ? h('button', { className: 'mb-btn mb-btn-primary', onClick: startNew }, t.newEntry) : null)

      if (phase === 'loading') {
        return h('div', { className: 'mb-root' },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          head,
          h('div', { className: 'mb-empty' },
            h('span', { className: 'mb-empty-mark' }, h(Keyhole, { size: 32 })),
            h('div', { className: 'mb-empty-hint' }, t.loading)))
      }

      if (phase === 'locked') {
        return h('div', { className: 'mb-root' },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          head,
          h('div', { className: 'mb-detail' },
            h('div', { className: 'mb-lockbox' },
              h('span', { className: 'mb-empty-mark' }, h(Keyhole, { size: 36 })),
              h('div', { className: 'mb-empty-title' }, t.lockedTitle),
              h('div', { className: 'mb-empty-hint' }, t.lockedHint),
              h('form', {
                className: 'mb-form',
                onSubmit: (event) => { event.preventDefault(); submitPassphrase() },
              },
                h('div', null,
                  h('label', { className: 'mb-label', htmlFor: 'mb-pass' }, t.passLabel),
                  h('input', {
                    id: 'mb-pass',
                    type: 'password',
                    className: 'mb-input mb-mono',
                    value: passInput,
                    onChange: (event) => setPassInput(event.target.value),
                    autoFocus: true,
                    autoComplete: 'current-password',
                  })),
                passError ? h('div', { className: 'mb-banner' }, passError) : null,
                h('button', {
                  type: 'submit',
                  className: 'mb-btn mb-btn-primary',
                  disabled: passBusy || passInput.length < 12,
                }, t.unlock)))))
      }

      if (phase === 'init') {
        return h('div', { className: 'mb-root' },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          head,
          h('div', { className: 'mb-detail' },
            h('div', { className: 'mb-lockbox' },
              h('span', { className: 'mb-empty-mark' }, h(Keyhole, { size: 36 })),
              h('div', { className: 'mb-empty-title' }, t.initTitle),
              h('div', { className: 'mb-empty-hint' }, t.initHint),
              h('form', {
                className: 'mb-form',
                onSubmit: (event) => { event.preventDefault(); submitPassphrase() },
              },
                h('div', null,
                  h('label', { className: 'mb-label', htmlFor: 'mb-init' }, t.passLabel),
                  h('input', {
                    id: 'mb-init',
                    type: 'password',
                    className: 'mb-input mb-mono',
                    value: passInput,
                    onChange: (event) => setPassInput(event.target.value),
                    autoFocus: true,
                    autoComplete: 'new-password',
                  })),
                passError ? h('div', { className: 'mb-banner' }, passError) : null,
                h('div', { className: 'mb-hint' }, t.passWarn),
                h('button', {
                  type: 'submit',
                  className: 'mb-btn mb-btn-primary',
                  disabled: passBusy || passInput.length < 12,
                }, t.initCreate)))))
      }

      if (phase === 'error') {
        return h('div', { className: 'mb-root' },
          h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
          head,
          h('div', { className: 'mb-detail' },
            h('div', { className: 'mb-banner' }, `${t.locked}：${error || '未知原因'}`),
            h('button', { className: 'mb-btn', onClick: () => { setPhase('loading'); load() } }, t.retry)))
      }

      const listPane = h('div', { className: 'mb-pane' },
        h('div', { className: 'mb-search' },
          h('input', {
            className: 'mb-input',
            placeholder: t.search,
            value: query,
            onChange: (event) => setQuery(event.target.value),
            'aria-label': t.search,
          })),
        h('div', { className: 'mb-filters' },
          h('button', { className: 'mb-chip', 'data-active': String(kind === 'all'), onClick: () => setKind('all'), type: 'button' }, t.all),
          KINDS.map((value) => h('button', {
            key: value,
            type: 'button',
            className: 'mb-chip',
            'data-active': String(kind === value),
            onClick: () => setKind(value),
          }, t.kind[value]))),
        h('div', { className: 'mb-items' },
          filtered.length === 0
            ? h('div', { className: 'mb-empty', style: { minHeight: '160px' } },
                h('span', { className: 'mb-empty-mark' }, h(Keyhole, { size: 26 })),
                h('div', { className: 'mb-empty-hint' }, items.length ? t.noMatch : t.emptyTitle))
            : filtered.map((item) => h('button', {
                key: item.id,
                type: 'button',
                className: 'mb-item',
                'data-active': String(item.id === selectedId),
                onClick: () => { setSelectedId(item.id); setMode('view') },
              },
                h('div', { className: 'mb-item-row' },
                  h('span', { className: 'mb-dot' + (item.has_secret ? '' : ' mb-dot-off'), title: item.has_secret ? t.hasSecret : t.secretHidden }),
                  h('span', { className: 'mb-item-title' }, item.title),
                  h('span', { className: 'mb-kind' }, t.kind[item.kind] || item.kind)),
                h('div', { className: 'mb-item-sub' },
                  [item.account, formatTime(item.updated_at)].filter(Boolean).join(' · '))))))

      let detail
      if (mode === 'passphrase') {
        const info = (status && status.passphrase) || {}
        const configured = Boolean(info.configured)
        detail = h('div', { className: 'mb-detail' },
          h('div', { className: 'mb-detail-title' }, t.passTitle),
          h('div', { className: 'mb-detail-meta' },
            h('span', { className: 'mb-kind' }, configured ? t.passSet : t.passNotSet),
            configured ? h('span', null, `key_id ${info.key_id || '—'} · ${formatTime(info.created_at)}`) : null),
          h('div', { className: 'mb-hint', style: { marginTop: '14px', maxWidth: '34em' } }, t.passIntro),
          h('form', {
            className: 'mb-form',
            onSubmit: (event) => { event.preventDefault(); submitPassphrase() },
          },
            h('div', null,
              h('label', { className: 'mb-label', htmlFor: 'mb-pass-set' }, t.passLabel),
              h('input', {
                id: 'mb-pass-set',
                type: 'password',
                className: 'mb-input mb-mono',
                value: passInput,
                onChange: (event) => setPassInput(event.target.value),
                autoComplete: 'new-password',
              })),
            passError ? h('div', { className: 'mb-banner' }, passError) : null,
            h('div', { className: 'mb-hint' }, t.passWarn),
            h('div', { className: 'mb-actions' },
              h('button', {
                type: 'submit',
                className: 'mb-btn mb-btn-primary',
                disabled: passBusy || passInput.length < 12,
              }, configured ? t.passReplace : t.passSave),
              h('button', {
                type: 'button',
                className: 'mb-btn',
                onClick: () => { setMode('view'); setPassInput(''); setPassError('') },
              }, t.cancel))))
      } else if (mode === 'edit') {
        detail = h('div', { className: 'mb-detail' },
          h('div', { className: 'mb-detail-title' }, selected ? t.edit : t.newEntry),
          h(EntryForm, {
            key: selected ? selected.id : 'new',
            t,
            initial: selected || { title: '', kind: 'account', account: '', secret: '', url: '', body: '', tags: [] },
            onSave: saveEntry,
            onCancel: () => { setMode('view'); if (!selected) setSelectedId(null) },
          }))
      } else if (!selected) {
        detail = h('div', { className: 'mb-detail' },
          h('div', { className: 'mb-empty' },
            h('span', { className: 'mb-empty-mark' }, h(Keyhole, { size: 40 })),
            h('div', { className: 'mb-empty-title' }, t.emptyTitle),
            h('div', { className: 'mb-empty-hint' }, t.emptyHint),
            h('button', { className: 'mb-btn mb-btn-primary', onClick: startNew }, t.newEntry)))
      } else {
        const showing = revealed && revealed.id === selected.id ? revealed.secret : null
        const fields = []
        if (selected.account) {
          fields.push(h(Field, {
            key: 'account',
            label: t.account,
            actions: h('button', { className: 'mb-btn mb-btn-ghost', onClick: () => copyValue(selected.id, 'account') }, t.copy),
          }, selected.account))
        }
        if (selected.has_secret) {
          fields.push(h(Field, {
            key: 'secret',
            label: t.secret,
            mono: true,
            actions: h('div', { className: 'mb-actions' },
              h('button', {
                className: 'mb-btn mb-btn-ghost',
                onClick: () => revealSecret(selected.id),
              }, showing === null ? t.reveal : t.hide),
              h('button', { className: 'mb-btn mb-btn-ghost', onClick: () => copyValue(selected.id, 'secret') }, t.copy)),
          }, showing === null ? (selected.secret || '•'.repeat(Math.min(selected.secret_length, 12))) : showing))
        }
        if (selected.url) {
          fields.push(h(Field, {
            key: 'url',
            label: t.url,
            actions: h('button', { className: 'mb-btn mb-btn-ghost', onClick: () => copyValue(selected.id, 'url') }, t.copy),
          }, selected.url))
        }
        if (selected.tags && selected.tags.length) {
          fields.push(h(Field, {
            key: 'tags',
            label: t.tags,
            actions: null,
          }, h('div', { className: 'mb-tags' }, selected.tags.map((tag) => h('span', { key: tag, className: 'mb-kind' }, tag)))))
        }
        if (selected.history && selected.history.length) {
          fields.push(h(Field, {
            key: 'history',
            label: t.history,
            actions: null,
          }, h('div', { className: 'mb-history' },
            selected.history.slice(-4).reverse().map((item, index) => h('div', {
              key: index,
              className: 'mb-history-row',
            }, `${formatTime(item.at)} · ${item.fields.join('、')} · ${item.source === 'tool' ? t.byTool : t.byUi}`)))))
        }
        if (selected.body) {
          fields.push(h(Field, { key: 'body', label: t.doc, actions: null }, selected.body))
        }

        detail = h('div', { className: 'mb-detail' },
          h('div', { className: 'mb-detail-title' }, selected.title),
          h('div', { className: 'mb-detail-meta' },
            h('span', { className: 'mb-kind' }, t.kind[selected.kind] || selected.kind),
            h('span', null, `${t.updated} ${formatTime(selected.updated_at)}`)),
          h('div', { className: 'mb-fields' }, fields),
          h('div', { className: 'mb-actions', style: { marginTop: '20px' } },
            h('button', { className: 'mb-btn', onClick: () => { setMode('edit'); setConfirmDelete(false) } }, t.edit),
            confirmDelete
              ? h('button', { className: 'mb-btn mb-btn-danger', onClick: () => removeEntry(selected.id) }, t.delConfirm)
              : h('button', { className: 'mb-btn mb-btn-danger', onClick: () => setConfirmDelete(true) }, t.del),
            confirmDelete ? h('button', { className: 'mb-btn', onClick: () => setConfirmDelete(false) }, t.cancel) : null))
      }

      return h('div', { className: 'mb-root' },
        h('style', { dangerouslySetInnerHTML: { __html: CSS } }),
        head,
        h('div', { className: 'mb-body' }, listPane, detail),
        toast ? h('div', { className: 'mb-toast' }, toast) : null)
    }

    function apply(ctx) {
      ctx.inject(['locale'], (scope) => {
        const push = (snapshot) => setLang(/^zh/i.test(snapshot.active || '') ? 'zh' : 'en')
        push(scope.locale.getSnapshot())
        scope.on('locale/change', push)
      })
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register({ name: 'sidebar.panellist', id: PANEL, order: 8, label: () => DICT[lang].panel }, Keyhole))
      ctx.slots.inject('main', () => ctx.slots.register({ name: 'main', key: PANEL }, Panel))
    }

    return { inject: ['slots'], apply }
  },
})
