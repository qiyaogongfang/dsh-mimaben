# 维护说明

面向维护者，不面向使用者。使用者只看 [README](README.md)。

## 发布

推 `v*` tag 即发布：GitHub Actions 用 npm trusted publishing（OIDC）发布，附 SLSA provenance。
仓库和 CI 里不存任何 token，发版也不需要 2FA 验证码。

```powershell
# 1. 改 package.json 的 version，并确认 README 是最新的（见下方检查表）
# 2. 提交推送
git push origin main
# 3. 打 tag 推送，触发发布
git tag v1.0.4
git push origin --tags
```

### 前提（已配好，换环境时核对）

- npm 包页面 Settings → **Trusted publishing** 登记了 `qiyaogongfang` / `dsh-mimaben` / `publish.yml`，
  且 **Allowed actions 勾了 Publish**（`npm stage publish` 默认允许，直接发布要单独授权）。
- CI 必须 **Node 24 + npm ≥ 11.5**：OIDC 发布是 npm 11.5 才支持的能力，旧版 npm 根本不会去换 token。
- `actions/setup-node` **不要设 `registry-url`**：它会写 `_authToken=${NODE_AUTH_TOKEN}`（空值），
  npm 以为已有凭据就不走 OIDC，注册表把发布当成匿名请求。
- workflow 里用 `NPM_CONFIG_REGISTRY` 指定注册表，并加一步校验 tag 与 `package.json` 版本一致。

## 发版检查表

1. README / MAINTAINING 改完了吗？tarball 里装的是**发布那一刻**的快照，发完再改就得补一个版本。
2. `package.json` 的 version 改了吗？tag 名必须是 `v` + 同一个版本号。
3. 推送 tag 后看 Actions：`publish` 工作流应当全绿。
4. **等 1.5~3 分钟**再查 registry：期间 packument 里可能只有 `0.0.0-stage` 占位版，`npm view` 也还是旧
   版本，属正常处理中，**不要重发**。
5. 核对 `npm view dsh-mimaben version`、`npm view dsh-mimaben dist-tags.latest`，
   以及 npm 页面上的 provenance 标记。

## 本地开发

DSH profile 里这个插件是 `link:Q:\mimaben\plugin`，改代码立刻生效（`client.js` 刷新页面即生效；
`index.js`、`store.js` 需要把插件那条关掉再打开，重新加载模块）。

源码与发布快照的关系：`Q:\mimaben\plugin` 是源码，`Q:\opensource\dsh-mimaben` 是推送用快照，
两边要同步（除 `.gitignore`、`.gitattributes`、`.github/`、`MAINTAINING.md` 之外应逐字节一致）。

| 文件 | 作用 |
|---|---|
| `index.js` | Host：HTTP 路由、工具注册、系统提示段 |
| `store.js` | 加密存储、密钥封装、并发写入 |
| `client.js` | 浏览器半边：侧栏图标与面板 |
| `locale/*.json` | 插件市场里的标题与描述 |

## 排查

| 现象 | 原因 |
|---|---|
| Actions 报 `ENEEDAUTH` | CI 里 npm < 11.5，没有尝试 OIDC |
| Actions 报 `E404 'pkg@ver' is not in this registry` | `registry-url` 写了空 token 占位；或 trusted publisher 没勾 Publish |
| 本地 `npm publish` 报 `E403` | 缺 2FA 码，或 token 没勾 Bypass 2FA |
| 发布成功但 `npm view` 还是旧版本 | registry 处理中，等 2~3 分钟 |
| npm 包里的 README 是旧的 | tarball 是发布那刻的快照，改文档要跟着发版 |
| 页面打不开 / 工具消失 | 插件被停用，或 DSH 重启后端口变了；看插件管理里的状态 |

## 版本历史

| 版本 | 说明 |
|---|---|
| 1.0.0 | 首发（bypass token 本地发布） |
| 1.0.1 | 修正包内 README |
| 1.0.2 | 首次用 OIDC 发布（手动触发验证） |
| 1.0.3 | 验证「推 tag 即发」 |
| 1.0.4 | README 精简，维护内容移到本文件 |
