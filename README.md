# dsh-mimaben · 密码本

DSH 左侧栏里的本机加密密码本：记录账号密码、API Key、密钥和文档，也能在对话里让模型按需读写。

An encrypted, local-first credential vault for [DeepSeek Harness](https://github.com/deepseek-ai). One sidebar panel, five agent tools, AES-256-GCM at rest, and no data ever leaves your machine — every install starts as its own empty vault with its own key.

- **本机优先**：数据只在本机，加密存放；没有云端、没有账号、不联网。
- **对话可用**：说「记一下 ……」就存，问「把那个 Key 给我」就取；密钥默认不回显。
- **多端可同步**：文件夹同步（移动硬盘 / Syncthing / 共享盘）加一个主口令，就能在几台设备上共用同一份加密库。
- **可改**：字段级修改、修改记录，改一个字段不会顺手抹掉别的。

## 安装

**从 npm**（发布后）：

```
plugin_manager → install_bundle → target: dsh-mimaben
```

**从源码**（把本仓库克隆到本地任意目录）：

```
plugin_manager → install_bundle → target: <本机绝对路径>
```

装完刷新页面，左侧栏出现钥匙孔图标。首次打开：

- **Windows**：直接可用。密钥由 Windows 账户（DPAPI）保管，打开时免输口令。
- **macOS / Linux**：没有 DPAPI，会让你设一个主口令来保管密钥，之后每次打开输入它。

## 使用

**侧栏**：搜索、按类型筛选、新建、编辑、删除。密钥默认显示 `••••••`，点「显示」才向 Host 要一次原值；点「复制」可以不显示直接进剪贴板。新建表单里有生成随机密码。

**对话**（模型可调用）：

| 工具 | 作用 |
|---|---|
| `mimaben_save` | 新建；带 `id` 时只覆盖给出的字段 |
| `mimaben_update` | 改一条：只传要改的字段，其余不动；`clear` 清空指定字段 |
| `mimaben_list` | 按关键词、类型列出条目（不含密钥正文） |
| `mimaben_get` | 取一条详情；`reveal="true"` 才给密钥原值 |
| `mimaben_delete` | 删一条 |

密钥默认不进对话；只有明确要原值时才会写进那一次对话记录。密码本锁定（刚同步到新设备）时工具会提示先去侧栏解锁——主口令故意没有工具入口，只能人自己输。

## 多端同步

同一份密码本在几台设备上共用的方式：让 `data` 目录落在各设备都能读写的位置，每台设备第一次打开输一次主口令。

1. 在已解锁的设备上：侧栏「密码本 → 主口令」，设一个至少 12 位的主口令，记住它。
2. 同步这两个文件，**不要**同步第三个：

| 文件 | 内容 | 同步 |
|---|---|---|
| `store.enc.json` | 全部条目，AES-256-GCM 密文 | 要 |
| `store-key.passphrase.json` | 主口令包住的同一把数据密钥 | 要 |
| `store-key.dpapi` | 同一把密钥，Windows DPAPI 包着 | 不要（绑账户，别的机器解不开） |

3. 新设备第一次打开显示「这台设备还没有解锁」，输入主口令；之后本机会顺手用 DPAPI 封一份，下次免输入。

**冲突策略**：写入前读一遍并比对文件哈希，另一台刚写过就重读重改，两边改不同条目都不丢；两个进程同时写同一份文件时由 `store.lock` 互斥（崩溃遗留的锁超过 15 秒会被接管）。改同一条目以最后写入为准。

## 安全模型

- 数据密钥 32 字节随机数，只在 Host 进程内存里缓存，磁盘上没有明文。
- 两条解锁路径包的是**同一把**数据密钥：Windows DPAPI（便捷，绑账户）与主口令（PBKDF2-SHA256 600,000 次 → AES-256-GCM，可移植）。
- 主口令不落盘、不进日志、不进对话记录。
- 写入接口只接受同源 POST 且要求 `x-mimaben` 请求头（挡跨站写入），服务只监听 `127.0.0.1`。
- 两道防线防止误覆盖密钥：页面永不预填密钥；服务端收到纯 `•` 时按「不修改」处理。

## 数据位置

按顺序取第一个命中的目录：

| 顺序 | 位置 | 用途 |
|---|---|---|
| 1 | 环境变量 `MIMABEN_STORE_DIR` | 指向同步目录、共享盘、移动硬盘 |
| 2 | `<插件目录>/../data`（里面已有库时） | 便携安装 / 老安装继续用 |
| 3 | `$DSH_HOME/mimaben/data` | 有 DSH_HOME 时的默认位置 |
| 4 | `%LOCALAPPDATA%\dsh-mimaben`、`~/Library/Application Support/dsh-mimaben`、`$XDG_DATA_HOME/dsh-mimaben` | 各平台默认 |

## 修改机制

三条路径语义一致：页面「编辑」、`mimaben_update`、`mimaben_save` 带 `id`。

**字段级合并**：没传的字段 = 不动，显式 `null` = 清空。所以「只改标题」不会抹掉账号和密钥。

**修改记录**：每次改动记一条 `{时间, 改了哪些字段, 来源}`，最多 10 条，详情页和 `mimaben_get` 可见。只记字段名、不存旧值，避免密钥副本在文件里越堆越多。

## 限制

- 免输口令的便捷解锁只在 Windows 上有；其它系统每次打开要输主口令。
- 条目是文本字段（标题、账号、密钥、链接、正文、标签），不存二进制附件。
- 没有云端同步服务：同步靠文件层面（移动硬盘 / Syncthing / 共享盘）。
- 冲突只做条目级最后写入生效；修改记录不存旧值，因此没有版本回滚。

## 开发

- 测试版本：DSH 0.2.2-rc.1（`engines.dsh: >=0.2.2-rc.1 <0.3.0`）。
- 三个文件构成 Host 半边：`index.js`（路由 + 工具 + 提示段）、`store.js`（加密存储、密钥槽、并发写入）；`client.js` 是浏览器半边（侧栏图标 + 面板）。
- 改 Host 半边后不用重启 DSH：把插件那条关掉再打开即重新加载模块；只改 `client.js` 刷新页面即可。

## License

MIT © qiyaogongfang
