import { defineConfig } from 'vitepress'
import { fileURLToPath, URL } from 'node:url'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Architext - Text to ArchiMate Diagrams",
  description: "Transform text into professional ArchiMate diagrams instantly. Perfect for enterprise architects, system designers, and documentation. Free online tool with no setup required.",
  appearance: false,
  head: [
    // Basic meta tags
    ['meta', { name: 'description', content: 'Transform text into professional ArchiMate diagrams instantly. Perfect for enterprise architects, system designers, and documentation. Free online tool with no setup required.' }],
    ['meta', { name: 'keywords', content: 'ArchiMate, enterprise architecture, diagram generator, architecture diagrams, system design, text to diagram, UML, documentation tool' }],
    ['meta', { name: 'author', content: 'Architext' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
    // Analytics
    ['script', { 
      defer: 'true', 
      src: 'https://cloud.umami.is/script.js',
      'data-website-id': 'fec552de-e560-4d06-af61-2ab85a89cb1f'
    }],
    // OpenGraph tags
    ['meta', { property: 'og:title', content: 'Architext - Text to ArchiMate Diagrams in Seconds' }],
    ['meta', { property: 'og:description', content: 'Create professional ArchiMate diagrams from text instantly. Free online tool for enterprise architects, system designers, and documentation teams.' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:image', content: '/architext-ogimage.png' }],
    ['meta', { property: 'og:url', content: 'https://architext.app' }],
    // Twitter Card tags
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'Architext - Text to ArchiMate Diagrams' }],
    ['meta', { name: 'twitter:description', content: 'Create professional ArchiMate diagrams from text instantly. Free online tool for enterprise architects.' }],
    ['meta', { name: 'twitter:image', content: '/architext-ogimage.png' }],
    // Additional SEO tags
    ['link', { rel: 'canonical', href: 'https://architext.app' }],
  ],
  vite: {
    resolve: {
      alias: {
        '@nomnoml': fileURLToPath(new URL('../../src', import.meta.url))
      }
    }
  },
  vue: {
    template: {
      compilerOptions: {
        whitespace: 'preserve'
      }
    }
  },
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Playground', link: '/playground' },
      { text: 'Guide', link: '/guide/' }
    ],

    sidebar: {
      // Sidebar for guide pages
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' }, // Added intro link
            { text: 'Relationships', link: '/guide/relationships' },
            { text: 'Elements', link: '/guide/elements' }
          ]
        }
      ]
    }

    
  }
})
