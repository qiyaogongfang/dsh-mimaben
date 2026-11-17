# dsh-mimaben

[中文](README.md) | [English](README.en.md)

DSH 左侧栏里的本机加密密码本。记录账号密码、API Key、密钥和文档，也可以让模型在对话里按需读写。

- **数据只留本机**：AES-256-GCM 加密，没有云端、没有账号体系、不联网。
- **密钥默认不出现**：页面上显示占位符，对话里默认不回显，需要时再取。
- **可多端共用**：通过目录同步（移动硬盘 / Syncthing / 共享盘）配合主口令，多台设备共用同一份加密库。
- **可安全修改**：字段级修改，只改给出的字段；每次改动留一条修改记录。

## 环境要求

| 项目 | 要求 |
|---|---|
| DSH | 0.2.2-rc.1 及以上（0.2.x） |
| Node.js | ^22.19.0 或 >=24.0.0 |
| 操作系统 | Windows 免输口令（DPAPI）；macOS / Linux 使用主口令 |

## 安装

### 方式一：npm（推荐）

```
plugin_manager → install_bundle → target: dsh-mimaben
```

国内会走 npmmirror 镜像；要钉版本就写 `dsh-mimaben@1.0.0`。

### 方式二：直接从 GitHub 安装

```
plugin_manager → install_bundle → target: github:qiyaogongfang/dsh-mimaben
```

不需要 npm 账号，取仓库默认分支。

### 方式三：本地目录（要改代码时）

```powershell
git clone https://github.com/qiyaogongfang/dsh-mimaben.git
```

在 DSH 的插件管理中安装该目录；也可以让 agent 执行 `plugin_manager` 的 `install_bundle`，
target 填克隆目录的绝对路径。

### 验证安装

刷新页面后左侧栏出现钥匙孔图标；或让 agent 调用 `mimaben_list`，返回条目数即表示可用。

### 首次打开

- **Windows**：直接可用。密钥由 Windows 账户（DPAPI）保管，打开时免输口令。
- **macOS / Linux**：系统没有 DPAPI，首次打开需设置主口令以保管密钥，之后每次输入。

## 使用

**侧栏**：搜索、按类型筛选、新建、编辑、删除。密钥默认显示为占位符，点「显示」才向 Host
请求一次原值；点「复制」可在不显示的情况下直接写入剪贴板。新建表单支持生成随机密码。

**对话**：以下工具由模型按需调用。

| 工具 | 作用 |
|---|---|
| `mimaben_save` | 新建；带 `id` 时只覆盖给出的字段 |
| `mimaben_update` | 修改一条：只传要改的字段，`clear` 清空指定字段 |
| `mimaben_list` | 按关键词、类型列出条目（不含密钥正文） |
| `mimaben_get` | 读取一条详情；`reveal="true"` 才返回密钥原值 |
| `mimaben_delete` | 删除一条 |

密钥默认不进入对话；仅当用户明确要求原值时，该值才会写入当次对话记录。密码本处于锁定状态时
（例如刚同步到新设备），工具会提示先在侧栏解锁。主口令不提供工具入口，需由使用者本人输入。

## 多端同步

让 `data` 目录落在各设备均可读写的位置（移动硬盘、Syncthing 或网盘同步目录、局域网共享盘），
每台设备首次打开时输入一次主口令。不在默认位置时，用环境变量 `MIMABEN_STORE_DIR` 指定。

1. 在已解锁的设备上：侧栏「密码本 → 主口令」，设置至少 12 位的主口令并妥善保存。
2. 同步以下文件：

| 文件 | 内容 | 是否同步 |
|---|---|---|
| `store.enc.json` | 全部条目，AES-256-GCM 密文 | 是 |
| `store-key.passphrase.json` | 主口令封装的同一把数据密钥 | 是 |
| `store-key.dpapi` | 同一把数据密钥，Windows DPAPI 封装 | 否（绑定账户，其他机器无法解开） |

3. 新设备首次打开显示「这台设备还没有解锁」，输入主口令即可；随后该设备会用 DPAPI 再封装一份，
   下次打开免输口令。

**冲突处理**：写入前读取文件并比对哈希，若其他设备刚写入则重新读取后重试，因此两端修改不同条目
不会互相覆盖。多进程同时写入同一文件时由 `store.lock` 互斥（进程崩溃遗留的锁超过 15 秒会被接管）。
同一条目被并发修改时，以最后写入为准。

## 安全模型

- 数据密钥为 32 字节随机数，仅缓存于 Host 进程内存，磁盘上不存在明文。
- 两条解锁路径封装的是**同一把**数据密钥：Windows DPAPI（便捷，绑定账户）与主口令
  （PBKDF2-SHA256 600,000 次 → AES-256-GCM，可移植）。
- 主口令不落盘、不写入日志、不进入对话记录。
- 写入接口仅接受同源 POST，并校验 `x-mimaben` 请求头以防止跨站写入；服务仅监听 `127.0.0.1`。
- 两道防误覆盖措施：页面永不预填密钥；服务端收到仅由 `•` 组成的值按「不修改」处理。

## 数据位置

按以下顺序取第一个命中的位置：

| 顺序 | 位置 | 说明 |
|---|---|---|
| 1 | 环境变量 `MIMABEN_STORE_DIR` | 指向同步目录、共享盘或移动硬盘 |
| 2 | `<插件目录>/../data`（已存在库时） | 便携安装与既有安装沿用以避免丢数据 |
| 3 | `$DSH_HOME/mimaben/data` | 设置了 DSH_HOME 时的默认位置 |
| 4 | `%LOCALAPPDATA%\dsh-mimaben`、`~/Library/Application Support/dsh-mimaben`、`$XDG_DATA_HOME/dsh-mimaben` | 各平台默认位置 |

## 修改机制

三条路径语义一致：页面「编辑」、`mimaben_update`、`mimaben_save` 带 `id`。

**字段级合并**：未传入的字段保持不变，显式传 `null` 表示清空。因此「只改标题」不会影响账号与密钥。

**修改记录**：每次修改记录一条 `{时间, 变更字段, 来源}`，最多保留 10 条，详情页与 `mimaben_get`
均可查看。仅记录字段名，不保存旧值，避免密钥副本在文件中累积。

## 限制

- 免输口令的便捷解锁仅在 Windows 可用；其他系统每次打开需输入主口令。
- 条目为文本字段（标题、账号、密钥、链接、正文、标签），不支持二进制附件。
- 不提供云端同步服务：同步依赖文件层（移动硬盘 / Syncthing / 共享盘）。
- 冲突处理为条目级最后写入生效；修改记录不保存旧值，因此不提供版本回滚。

## 开发

- 测试版本：DSH 0.2.2-rc.1（`engines.dsh: >=0.2.2-rc.1 <0.3.0`）。
- `index.js`：Host 路由、工具注册、提示段；`store.js`：加密存储、密钥封装、并发写入；
  `client.js`：浏览器侧栏图标与面板。
- 修改 Host 侧代码后无需重启 DSH：在插件管理中关闭再启用该插件即可重新加载；仅修改
  `client.js` 时刷新页面即可。

## 发布

npm 侧用 **trusted publishing（OIDC）**：仓库和 CI 里都不存 token，发版也不需要 2FA 码。

每个版本的流程：

1. 改 `package.json` 的 `version`，提交并推送。
2. 打 tag 并推送：

   ```powershell
   git tag v1.0.4
   git push origin main --tags
   ```

3. `.github/workflows/publish.yml` 在 tag 上触发：校验 tag 与版本一致 → 用 OIDC 发布 → 自动生成
   provenance（npm 页面会显示"由 qiyaogongfang/dsh-mimaben 的 publish.yml 构建"）。

前提：包页面 Settings → **Trusted publishing** 已登记 `qiyaogongfang` / `dsh-mimaben` / `publish.yml`，
且 **Allowed actions 勾了 Publish**；CI 里必须用 **Node 24 + npm ≥ 11.5**——旧版 npm 不支持 OIDC 发布，
会报 `ENEEDAUTH`。

Publishing uses npm **trusted publishing (OIDC)**: no token is stored in the repository or the CI, and a
release needs no 2FA code. Bump the version, push a `v*` tag, and the workflow publishes with provenance
after checking that the tag matches `package.json`. Prerequisites: this repository and `publish.yml` are
registered under the package's Trusted publishing settings with **Publish** checked in Allowed actions,
and CI runs **Node 24 + npm ≥ 11.5** (older npm cannot do OIDC publishing and fails with `ENEEDAUTH`).

## 许可

MIT © qiyaogongfang
