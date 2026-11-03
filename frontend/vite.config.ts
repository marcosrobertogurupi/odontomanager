import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const buildId = Date.now().toString()

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    {
      name: 'app-version-manifest',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `  <meta name="app-build-id" content="${buildId}" />\n  </head>`
        )
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({
            buildId,
            builtAt: new Date().toISOString(),
          }),
        })
      },
    },
  ],
})
