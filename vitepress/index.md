---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Architext"
  text: "Transform Text to ArchiMate Diagrams Instantly"
  tagline: The intuitive text-based tool for creating professional ArchiMate diagrams. Streamline your enterprise architecture documentation with our powerful, easy-to-use language.
  image:
    src: /architext.svg
    alt: Architext - Enterprise Architecture Diagram Generator
  actions:
    - theme: brand
      text: Playground
      link: /playground
    - theme: alt
      text: Guide
      link: /guide

---

<script setup>
import Diagram from './.vitepress/components/Diagram.vue'
</script>
::: tip Try Architext Now - Free Online ArchiMate Tool
Experience the fastest way to create enterprise architecture diagrams. Start with our interactive Playground: simply type your architecture descriptions and watch as they transform into professional ArchiMate diagrams in real-time.
No installation, no setup - just instant results. Perfect for enterprise architects, solution designers, and documentation teams.
:::

<Diagram>[&lt;application:component&gt; Application Component]&#10;[Application Component]  --&gt; [&lt;application:data&gt; Data Object]&#10;[&lt;business:actor&gt; Business Actor]  .-|&gt; assignment [&lt;business:role&gt; Customer]&#10;[Customer]  &lt;- [&lt;business:service&gt; Business Service A]&#10;[Business Service A]  &lt;:-- [&lt;business:process&gt; Business Process A]&#10;[Business Process A]  --&gt; [&lt;business:data&gt; Business Object]&#10;[&lt;application:data&gt; Data Object]  --:&gt; [Business Object]&#10;[&lt;technology:service&gt; Technology Service A]  -&gt; [Application Component]&#10;[&lt;technology:node&gt; Platform A]  --:&gt; [Technology Service A]&#10;[Platform A]  --&gt; [&lt;technology:artifact&gt; Artifact]&#10;[Artifact]  --:&gt; [Data Object]&#10;[Application Component]  -&gt;  [Business Service A]&#10;[&lt;application:service&gt; Application Service A]  &lt;-  [Business Process A]&#10;[&lt;business:actor&gt; Business Actor 2]  .--|&gt; [Business Process A]</Diagram>