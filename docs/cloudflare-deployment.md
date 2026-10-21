# Cloudflare Pages 个人模考部署

本分支 `deploy/cloudflare-static` 用于用户明确选择的 Cloudflare 托管，与上游模考 PR 分支独立。

- 平台：Cloudflare Pages，Direct Upload，免费静态托管。
- 项目名：`jk-ielts-reading`。
- 生产地址：`https://jk-ielts-reading.pages.dev`。
- 构建：`npm ci` 后运行 `npm run build:static`。
- 上传目录：`dist` 的内容（不是源代码或父目录）。可以打包为 ZIP 通过控制台上传。
- 不需要 AI API 地址或数据库；不要把任何密钥写入前端构建环境。

静态模式保留题库、PDF、单篇/三篇考试、浏览器内批改和历史记录。隐藏 AI 助教、登录和云同步，关闭继承的站点统计，不向原作者后端发送请求。记录只保存在当前浏览器，清理浏览器数据会删除记录。

`build:static` 显式启用 `VITE_STATIC_MODE=true`，从输出中移除原站点 canonical/sitemap 和旧版浏览器题库注册文件。Vue 原生题目及解析已经作为独立 chunks 打包，因此不依赖这些重复文件。每次构建检查 Pages 直接上传的 1,000 文件和单文件 25 MiB 限制。

发布前提交并推送当前分支，然后重新构建。`build-info.json` 与 `/open-source.html` 会记录构建时 Git commit，链接该公开版本的完整源码；`LICENSE.txt` 保留 GPL v3。

上传时选择本项目的新 Production deployment，发布后检查 `/build-info.json`、`/home`、`/exam-setup` 和任一题目 PDF，以及做题、交卷与刷新恢复。Pages 原生 SPA 回退支持 `/exam`、`/exam-suite` 等前端路由，输出不包含 `404.html`。

Direct Upload 项目后续可以继续在控制台上传或使用 Wrangler；不能在同一个项目直接切换为 Git integration，若需要自动发布可另外配置 CI 上传。

## 本机 API Token 钥匙串配置

运行以下命令，在终端隐藏输入 Token。脚本先只读验证本项目的 API 访问，成功后通过 macOS Security.framework 存入钥匙串；不会发布网站。Token 应由用户配置为本账户的 Cloudflare Pages Edit 权限。只读验证成功不代表写权限已验证。

```bash
bash scripts/cloudflare-keychain.sh setup
bash scripts/cloudflare-keychain.sh verify
```

已有条目不会自动覆盖；主动轮换使用 `setup --replace`。首次编译需要 macOS Command Line Tools，二进制位于已忽略的 `.cache/cloudflare-keychain/helper`。系统可能要求允许钥匙串访问；重新编译后也可能再次询问。

- 账户 ID：`c4d213dc2d40b5a6466eac72cd47af6c`。
- 钥匙串 service：`codex.cloudflare.api-token`；account 为上述账户 ID。
- 不在文档、源码、环境文件或聊天中保存 Token。不得直接运行会把密码打印到终端的读取命令。
- 本脚本目前提供配置和只读验证。后续 Wrangler 上传应在进程内部读取此条目并注入 `CLOUDFLARE_API_TOKEN`，不可把读取结果打印到工具输出或作为命令参数传递。
- 控制台曾显示生产分支为 `main`；本地分支为 `deploy/cloudflare-static`。发布前重新读取项目配置确认目标分支，不能隐式使用本地分支。
- 2026-10-09 用户已存储 Token，代理通过钥匙串读取并成功验证本项目 API 访问，确认生产分支为 `main`。未执行部署，未验证写权限。未来使用仍应重新验证，凭据可能被撤销或过期。
- Codex 沙箱内读取钥匙串曾返回状态 `-50`；同一验证命令在批准的沙箱外执行成功。遇到此情况应申请受控的沙箱外只读验证，不要认定 Token 丢失、要求用户重复输入或把凭据导出到文件。

## API Token 生产上传

固定使用 Wrangler `4.151.3`。首次先安装到 npm 缓存（此命令不读取 Token）：

```bash
npx --yes wrangler@4.151.3 --version
```

提交、推送并运行 `npm run build:static` 后，执行：

```bash
bash scripts/cloudflare-keychain.sh deploy
```

包装器只使用本项目的钥匙串条目，在进程内将凭据注入 Wrangler 环境。它先重新读取项目并确认生产分支为 `main`，检查源码已提交、构建版本与 HEAD 一致、输出是纯静态站点，再执行固定命令：

```bash
npx --offline --yes wrangler@4.151.3 pages deploy dist --project-name jk-ielts-reading --branch main --commit-hash <HEAD> --commit-dirty=false
```

仅上传本项目 `dist`；不创建或修改其他 Pages 项目、Functions、Workers 或账户配置。发布后再次运行 `verify`，核对生产部署 ID、源码版本及稳定地址的 `/build-info.json`，并通过站内更新提示检查新界面。已有答题记录和浏览器数据应保留。
