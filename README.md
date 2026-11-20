<p align="center">
  <img src="https://gcore.jsdelivr.net/gh/qiyaogongfang/dsh-mimaben@main/assets/banner.svg" alt="dsh-mimaben 密码本" width="100%" />
</p>

<h1 align="center">密码本 · dsh-mimaben</h1>

<p align="center"><strong>存在本机、加密落盘的账号本。<br/>也能让 AI 在对话里帮你记和取。</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-mimaben"><img src="https://img.shields.io/npm/v/dsh-mimaben?style=for-the-badge&color=2f7a5f&logo=npm" alt="npm 版本" /></a>
  <a href="https://www.npmjs.com/package/dsh-mimaben"><img src="https://img.shields.io/npm/dm/dsh-mimaben?style=for-the-badge&color=92a8b3" alt="每月下载量" /></a>
  <a href="https://github.com/qiyaogongfang/dsh-mimaben"><img src="https://img.shields.io/github/stars/qiyaogongfang/dsh-mimaben?style=for-the-badge&color=e1af78" alt="GitHub Stars" /></a>
  <img src="https://img.shields.io/github/license/qiyaogongfang/dsh-mimaben?style=for-the-badge&color=5fa8b2" alt="MIT License" />
  <img src="https://img.shields.io/badge/dependencies-0-92a8b3?style=for-the-badge" alt="零运行时依赖" />
  <img src="https://img.shields.io/badge/encryption-AES--256--GCM-2f7a5f?style=for-the-badge" alt="AES-256-GCM" />
</p>

<p align="center"><a href="README.en.md">English</a> · <a href="https://github.com/qiyaogongfang/dsh-mimaben">⭐ 觉得有用就点个 Star</a></p>

---

## 它解决什么

| 以前 | 现在 |
| :-- | :-- |
| 密码散在 txt、备忘录、聊天记录里 | 一个侧栏就能查、能复制 |
| 每换一台机器就要重新翻找一遍 | 同步两个文件，多端共用一份库 |
| 想让 AI 帮忙查，又不敢把密码贴进对话 | 默认只给「有没有、多长」，要原值才取 |

- **打开就有。** 侧栏常驻，搜索、按类型筛选、一键复制，不用记路径。
- **AI 能帮你记。** 说「记一下 腾讯云的 SecretKey 是 xxx」就存进去；问「密码本里有 Cloudflare 的什么」就列出来。
- **密钥不轻易露脸。** 页面上是占位符，对话里默认不回显；只有你明确要原值时才出现。

## 安装

**方式一：npm（推荐）**

```bash
npm install dsh-mimaben
```

或在 DeepSeek Harness 的插件里搜 `dsh-mimaben` 安装；让 agent 代劳时 target 填 `dsh-mimaben`。
国内走 npmmirror 镜像，要钉版本就写 `dsh-mimaben@1.0.6`。

**方式二：git clone（想改代码时）**

```bash
git clone https://github.com/qiyaogongfang/dsh-mimaben.git
```

然后把克隆目录的绝对路径作为 target 装进 DSH：

```
plugin_manager → install_bundle → target: /你的路径/dsh-mimaben
```

**方式三：不 clone，直接用 GitHub 源**

```
plugin_manager → install_bundle → target: github:qiyaogongfang/dsh-mimaben
```

装完刷新页面，左侧栏出现钥匙孔图标。

**第一次打开**：Windows 直接可用（密钥由 Windows 账户保管，免输口令）；macOS / Linux 会让你设一个主口令，之后每次打开输入。

## 用法

**侧栏**：搜索、按类型筛选、新建、编辑、删除。密钥显示为占位符，点「显示」才向本机要一次原值；点「复制」可以不显示直接进剪贴板。

**对话**：模型按需调用这些工具。

| 工具 | 作用 |
| :-- | :-- |
| `mimaben_save` | 新建；带 `id` 时只覆盖给出的字段 |
| `mimaben_update` | 改一条：只传要改的字段，`clear` 清空指定字段 |
| `mimaben_list` | 列出条目（不含密钥正文） |
| `mimaben_get` | 取详情；`reveal="true"` 才返回密钥原值 |
| `mimaben_delete` | 删一条 |

密钥默认不进对话，只有你明确要原值时才会写入当次记录。密码本锁定时，工具会提示先在侧栏解锁。

## 多端同步

把 `data` 目录放在各设备都能读写的位置（移动硬盘、Syncthing、共享盘），每台设备首次打开输一次主口令。

| 文件 | 是否同步 |
| :-- | :-- |
| `store.enc.json` | 是 |
| `store-key.passphrase.json` | 是 |
| `store-key.dpapi` | 否（绑定 Windows 账户，别的机器解不开） |

不在默认位置时用环境变量 `MIMABEN_STORE_DIR` 指定。冲突按条目「最后写入生效」，并发写入有锁和哈希校验保护。

## 安全

- 数据密钥 32 字节随机数，只缓存于进程内存，磁盘上没有明文。
- 两条解锁路径包的是同一把密钥：Windows DPAPI 与主口令（PBKDF2-SHA256 600,000 次 → AES-256-GCM）。
- 主口令不落盘、不进日志、不进对话记录。
- 写入接口只接受同源 POST 并校验 `x-mimaben` 请求头；服务只监听 `127.0.0.1`。
- 页面永不预填密钥；服务端收到纯 `•` 时按「不修改」处理。

## 数据在哪

按顺序取第一个命中的：`MIMABEN_STORE_DIR` → `<插件目录>/../data`（里面已有库时）→ `$DSH_HOME/mimaben/data` →
平台用户目录（Windows 是 `%LOCALAPPDATA%\dsh-mimaben`）。

## 限制

- 免输口令只在 Windows 可用；其它系统每次打开需输入主口令。
- 条目是文本字段，不支持二进制附件。
- 没有云端同步，靠文件层同步。
- 冲突为条目级最后写入生效，不提供版本回滚。

## 许可

MIT © qiyaogongfang
