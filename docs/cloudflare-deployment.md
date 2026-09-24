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
