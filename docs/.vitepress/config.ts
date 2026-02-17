import { defineConfig } from 'vitepress'
import { readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const org = process.env.GITHUB_ORG
const repo = process.env.GITHUB_REPO
const branch = 'main' // adjust if needed

export default defineConfig({
  title: 'Value Flows',
  description: 'Documentation',
  base: `/${repo}/`,

  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Docs', link: '/getting-started' }
    ],

    sidebar: getSidebar('docs'),

    search: {
      provider: 'local'
    },

    editLink: {
      pattern: `https://github.com/${org}/${repo}/blob/${branch}/docs/:path`,
      text: 'View this page on GitHub'
    }
  }
})

/**
 * Auto-generate sidebar from the docs folder
 * - folders become sections
 * - index.md becomes section root
 * - filenames become page titles
 */
function getSidebar(docsRoot: string) {
  const root = join(process.cwd(), docsRoot)
  return buildSidebar(root, root)
}

function buildSidebar(root: string, current: string) {
  const entries = readdirSync(current)
  const items: any[] = []

  for (const entry of entries) {
    if (entry.startsWith('.')) continue

    const fullPath = join(current, entry)
    const relPath = relative(root, fullPath)

    if (statSync(fullPath).isDirectory()) {
      const children = buildSidebar(root, fullPath)
      if (children.length > 0) {
        items.push({
          text: titleFromName(entry),
          collapsed: false,
          items: children
        })
      }
    }

    if (entry.endsWith('.md') && entry !== 'index.md') {
      items.push({
        text: titleFromName(entry.replace('.md', '')),
        link: '/' + relPath.replace(/\\/g, '/').replace('.md', '')
      })
    }
  }

  return items
}

function titleFromName(name: string) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}
