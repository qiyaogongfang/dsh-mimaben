# dsh-mimaben · 密码本

[中文](README.md) | [English](README.en.md)

DSH 左侧栏里的本机加密密码本：记录账号密码、API Key、密钥和文档，也能让模型在对话里按需读写。
数据只存在本机，AES-256-GCM 加密；没有云端、没有账号体系、不联网。

## 安装

在 DSH 的插件管理里安装 `dsh-mimaben`。也可以让 agent 执行 `install_bundle`，target 填下面任意一种：

| target | 用途 |
|---|---|
| `dsh-mimaben` | 从 npm 装（推荐，国内走 npmmirror 镜像） |
| `github:qiyaogongfang/dsh-mimaben` | 不用 npm 账号，取仓库默认分支 |
| 克隆目录的绝对路径 | 要改代码时 |

装完刷新页面，左侧栏出现钥匙孔图标。

**首次打开**：Windows 直接可用（密钥由 Windows 账户保管，免输口令）；macOS / Linux 会让你设一个主口令，之后每次打开输入。

## 使用

**侧栏**：搜索、按类型筛选、新建、编辑、删除。密钥显示为占位符，点「显示」才向本机要一次原值；点「复制」可以不显示直接进剪贴板。

**对话**：模型按需调用这些工具。

| 工具 | 作用 |
|---|---|
| `mimaben_save` | 新建；带 `id` 时只覆盖给出的字段 |
| `mimaben_update` | 改一条：只传要改的字段，`clear` 清空指定字段 |
| `mimaben_list` | 列出条目（不含密钥正文） |
| `mimaben_get` | 取详情；`reveal="true"` 才返回密钥原值 |
| `mimaben_delete` | 删一条 |

密钥默认不进对话，只有你明确要原值时才会写入当次记录。密码本锁定时工具会提示先在侧栏解锁。

## 多端同步

把 `data` 目录放在各设备都能读写的位置（移动硬盘、Syncthing 或共享盘），每台设备首次打开输一次主口令。

| 文件 | 是否同步 |
|---|---|
| `store.enc.json` | 是 |
| `store-key.passphrase.json` | 是 |
| `store-key.dpapi` | 否（绑定 Windows 账户，别的机器解不开） |

不在默认位置时用环境变量 `MIMABEN_STORE_DIR` 指定。冲突按条目「最后写入生效」，并发写入有锁和哈希校验保护。

## 安全模型

- 数据密钥 32 字节随机数，只缓存于进程内存，磁盘上没有明文。
- 两条解锁路径包的是同一把密钥：Windows DPAPI 与主口令（PBKDF2-SHA256 600,000 次 → AES-256-GCM）。
- 主口令不落盘、不进日志、不进对话记录。
- 写入接口只接受同源 POST 并校验 `x-mimaben` 请求头；服务只监听 `127.0.0.1`。
- 页面永不预填密钥；服务端收到纯 `•` 时按「不修改」处理。

## 数据位置

按顺序取第一个命中的：`MIMABEN_STORE_DIR` → `<插件目录>/../data`（里面已有库时）→ `$DSH_HOME/mimaben/data` →
平台用户目录（`%LOCALAPPDATA%\dsh-mimaben`、`~/Library/Application Support/dsh-mimaben` 等）。

## 修改机制

页面「编辑」、`mimaben_update`、`mimaben_save` 带 `id`，三条路径语义一致：**没传的字段不动，显式 `null` 清空**。
每次修改留一条记录（时间、改了哪些字段、来源），最多 10 条；只记字段名，不存旧值。

## 限制

- 免输口令只在 Windows 可用；其它系统每次打开需输入主口令。
- 条目为文本字段，不支持二进制附件。
- 没有云端同步，靠文件层同步。
- 冲突为条目级最后写入生效，不提供版本回滚。

## 许可

MIT © qiyaogongfang
