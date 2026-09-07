/**
 * Assemble a Cloudflare Pages output directory.
 * Vue app becomes `/`. config.html / toolsindex.html stay as rollback copies.
 */
import { cp, mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const webDist = join(root, 'web', 'dist')

async function run(cmd: string[]) {
  const proc = Bun.spawn(cmd, { cwd: root, stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${cmd.join(' ')} failed with ${code}`)
  }
}

await rm(dist, { recursive: true, force: true })
await run(['bun', 'install', '--cwd', 'web'])
await run(['bun', 'run', '--cwd', 'web', 'build'])
await mkdir(dist, { recursive: true })
await cp(webDist, dist, { recursive: true })

const staticCopies = [
  'config.html',
  'toolsindex.html',
  'about.html',
  'data.js',
  'robots.txt',
  '_redirects',
]

for (const file of staticCopies) {
  await cp(join(root, file), join(dist, file))
}

await cp(join(root, 'tools'), join(dist, 'tools'), { recursive: true })
await cp(join(root, 'shared'), join(dist, 'shared'), { recursive: true })

console.log('Pages bundle ready at dist/')
