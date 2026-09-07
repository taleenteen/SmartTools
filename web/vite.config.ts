import { createReadStream, existsSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import { defineConfig, type Plugin } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
}

const PAGE_ALIASES: Record<string, string> = {}

function isInside(root: string, target: string): boolean {
  const rel = relative(root, target)
  return rel !== '' && !rel.startsWith('..') && !rel.startsWith(`..${sep}`)
}

function serveRepoStatic(): Plugin {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  const allowedFiles = new Set(['config.html', 'toolsindex.html', 'about.html', 'data.js'])

  function resolveRel(urlPath: string): string | null {
    const aliased = PAGE_ALIASES[urlPath]
    if (aliased) return aliased
    const stripped = urlPath.replace(/^\//, '')
    if (allowedFiles.has(stripped)) return stripped
    if (stripped.startsWith('tools/') || stripped.startsWith('shared/')) return stripped
    return null
  }

  function handle(req: { url?: string }, res: import('node:http').ServerResponse, next: () => void) {
    const urlPath = decodeURIComponent((req.url || '').split('?')[0] || '')
    const rel = resolveRel(urlPath)
    if (!rel) {
      next()
      return
    }
    const abs = resolve(join(repoRoot, normalize(rel)))
    if (!isInside(repoRoot, abs) || !existsSync(abs) || !statSync(abs).isFile()) {
      next()
      return
    }
    res.setHeader('Content-Type', MIME[extname(abs)] || 'application/octet-stream')
    createReadStream(abs).pipe(res)
  }

  return {
    name: 'serve-repo-static',
    configureServer(server) {
      server.middlewares.use((req, res, next) => handle(req, res, next))
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => handle(req, res, next))
    },
  }
}

function serveRepoDataJs(): Plugin {
  const dataFile = fileURLToPath(new URL('../data.js', import.meta.url))
  return {
    name: 'serve-repo-data-js',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.split('?')[0] !== '/data.js') {
          next()
          return
        }
        try {
          const body = await readFile(dataFile, 'utf8')
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.end(body)
        } catch {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), vueDevTools(), serveRepoStatic(), serveRepoDataJs()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
      },
    },
  },
})
