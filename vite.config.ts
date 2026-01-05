import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'redirect-trailing-slash',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/return-to-work-cost') {
            res.writeHead(301, { Location: '/return-to-work-cost/' })
            res.end()
            return
          }
          next()
        })
      },
    },
  ],
  base: '/return-to-work-cost/',
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 5173,
  },
  preview: {
    port: 4173,
  },
})

