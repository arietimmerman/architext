import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'nomnoml',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => `nomnoml.${format}.js`
    },
    rollupOptions: {
      input: {
        webapp: resolve(__dirname, 'webapp/index.ts'),
        lib: resolve(__dirname, 'src/index.ts'),
        cli: resolve(__dirname, 'src/cli.ts')
      },
      output: [
        {
          format: 'cjs',
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'webapp') return 'webapp.cjs'
            if (chunkInfo.name === 'cli') return 'nomnoml-cli.cjs'
            return 'nomnoml.cjs.js'
          },
          exports: 'named',
          sourcemap: true
        },
        {
          format: 'es',
          entryFileNames: (chunkInfo) => {
            if (chunkInfo.name === 'webapp') return 'webapp.js'
            if (chunkInfo.name === 'cli') return 'nomnoml-cli.js'
            return 'nomnoml.js'
          },
          sourcemap: true
        }
      ],
      external: ['react', 'react-dom', 'jszip', 'dagre', 'fs', 'path']
    },
    sourcemap: true,
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      // Map the dist/nomnoml.js import to the source files for development
      '../dist/nomnoml.js': resolve(__dirname, 'src/index.ts'),
    }
  },
  // Configure TypeScript
  esbuild: {
    loader: 'tsx',
    include: /\.(tsx?|jsx?)$/,
  },
  // Configure source maps for better debugging
  css: {
    devSourcemap: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'dagre'],
    exclude: ['fs', 'path']
  }
})