import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/.wwebjs_cache/**',
        '**/.wwebjs_auth/**',
        '**/whatsapp-profile-session/**',
        '**/whatsapp-sender.db**'
      ]
    }
  }
})
