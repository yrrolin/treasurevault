import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Use relative asset URLs so GitHub Pages can load the app from /treasurevault/.
  base: './',
})
