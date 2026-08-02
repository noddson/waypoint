import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative asset paths work on both the repository root and GitHub Pages project URLs.
export default defineConfig({ base: './', plugins: [react()] })
