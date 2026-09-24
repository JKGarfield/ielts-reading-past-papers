import { spawnSync, execFileSync } from 'node:child_process'
import { readFile, writeFile, copyFile, rm, readdir, stat } from 'node:fs/promises'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = join(root, 'dist')
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], {
  cwd: root, stdio: 'inherit', env: { ...process.env, VITE_STATIC_MODE: 'true' }
})
if (result.status !== 0) process.exit(result.status || 1)

// The native Vue renderer imports its own JSON chunks. These duplicate legacy
// browser registries are not referenced by the current app and exceed the
// Pages dashboard's 1,000-file limit when shipped alongside native chunks.
await rm(join(output, 'assets/generated'), { recursive: true, force: true })
await copyFile(join(root, 'LICENSE'), join(output, 'LICENSE.txt'))
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const source = `https://github.com/JKGarfield/ielts-reading-past-papers/tree/${commit}`
const description = 'IELTS reading practice and timed mock tests with automatic marking. Answers and practice history stay in this browser.'
let html = await readFile(join(output, 'index.html'), 'utf8')
html = html.replace(/<link rel="canonical"[^>]*>/g, '').replace(/<meta property="og:url"[^>]*>/g, '')
  .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*/g, `$1${description}`)
await writeFile(join(output, 'index.html'), html)
await writeFile(join(output, 'robots.txt'), 'User-agent: *\nAllow: /\n')
await rm(join(output, 'sitemap.xml'), { force: true })
await writeFile(join(output, 'build-info.json'), JSON.stringify({ commit, mode: 'static', source }, null, 2))
await writeFile(join(output, 'open-source.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>源码与许可证 · IELTS Reading</title><style>body{font:16px/1.8 system-ui,sans-serif;max-width:760px;margin:60px auto;padding:0 24px;color:#243247}a{color:#165fa6}code{overflow-wrap:anywhere}</style></head><body><h1>源码与许可证</h1><p>本网站基于 <a href="https://github.com/hwttop5/ielts-reading-past-papers">IELTS Reading Past Papers</a> 开源项目修改，保留原作者及贡献者的版权声明。</p><p>修改内容包括可选单篇和三篇模考界面、匹配题交互适配，以及不依赖 AI 或账号服务的静态部署模式。修改版本维护者：JKGarfield（2026）。</p><p>程序依据 <a href="/LICENSE.txt">GNU GPL v3</a> 发布，不提供担保。<a href="${source}">获取与当前部署对应的源码及构建脚本</a>。版本：<code>${commit}</code>。</p><p>阅读材料与 PDF 的权利归各自权利人所有；软件许可证不代表对第三方材料另行授权。本网站不是雅思官方考试平台。</p><p>本版本的答案、成绩及学习记录保存在当前浏览器中，不提供账号云同步。自动评分依据题库标准答案，无需 AI 服务。</p><p><a href="/home">返回网站</a></p></body></html>`)
await writeFile(join(output, '_headers'), '/sw.js\n  Cache-Control: no-cache\n/build-info.json\n  Cache-Control: no-cache\n')
async function files(path) {
  const list = []
  for (const item of await readdir(path, { withFileTypes: true })) {
    const child = join(path, item.name)
    if (item.isDirectory()) list.push(...await files(child))
    else list.push(child)
  }
  return list
}
const assets = await files(output)
if (assets.length > 1000) throw new Error(`Pages dashboard supports 1,000 files; got ${assets.length}`)
for (const path of assets) if ((await stat(path)).size > 25 * 1024 * 1024) throw new Error(`Asset exceeds 25 MiB: ${path}`)
console.log(`Static deployment ready: ${assets.length} assets. Source revision: ${commit}`)
