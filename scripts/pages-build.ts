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

async function run(cmd: string[], cwd = root) {
  const proc = Bun.spawn(cmd, { cwd, stdout: 'inherit', stderr: 'inherit' })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${cmd.join(' ')} failed with ${code}`)
  }
}

await rm(dist, { recursive: true, force: true })
await run(['bun', 'install'], join(root, 'web'))
await run(['bun', 'run', 'build'], join(root, 'web'))
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

const workerOut = join(root, 'worker-build')
await rm(workerOut, { recursive: true, force: true })
await run(
  [
    'bun',
    'x',
    'wrangler',
    'pages',
    'functions',
    'build',
    join(root, 'functions'),
    '--outdir',
    workerOut,
    '--build-output-directory',
    dist,
    '--compatibility-date',
    '2026-09-07',
  ],
  join(root, 'web'),
)

console.log('Pages bundle ready at dist/; worker at worker-build/')
