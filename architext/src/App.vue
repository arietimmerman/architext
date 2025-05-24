<template>
  <div class="container">
    <div class="editor-container">
      <div class="editor" ref="editorContainer"></div>
      <div class="diagram-container" ref="diagramContainer">
        <div class="zoom-controls">
          <button @click="zoomIn" title="Zoom In">+</button>
          <button @click="zoomOut" title="Zoom Out">-</button>
          <button @click="resetZoom" title="Reset Zoom">↺</button>
          <button @click="exportSvg" title="Export SVG">↓</button>
        </div>
        <div class="diagram-wrapper" 
             ref="diagramWrapper"
             @mousedown="startPanning"
             @mousemove="pan"
             @mouseup="stopPanning"
             @mouseleave="stopPanning">
          <div ref="svgContainer" class="svg-container"></div>
        </div>
        <div v-if="error" class="error-message">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { draw, renderSvg } from 'nomnoml'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { nomnoml } from './nomnoml-mode'
import { Decoration, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import { lineNumbers } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'

const editorContainer = ref<HTMLElement | null>(null)
const diagramContainer = ref<HTMLElement | null>(null)
const diagramWrapper = ref<HTMLElement | null>(null)
const svgContainer = ref<HTMLElement | null>(null)
const error = ref('')
let editor: EditorView | null = null
let lastValidSource: string | null = null
let currentZoom = 1
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2

// Panning state
let isPanning = false
let startX = 0
let startY = 0
let translateX = 0
let translateY = 0

// Define a state effect for updating error decorations
const addErrorEffect = StateEffect.define<{line: number, column: number} | null>()

// Define a state field to store the error decorations
const errorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(errors, tr) {
    // Clear errors when the document changes
    if (tr.docChanged) {
      return Decoration.none
    }
    
    // Update errors when the effect is dispatched
    for (const e of tr.effects) {
      if (e.is(addErrorEffect)) {
        if (e.value === null) {
          return Decoration.none
        }
        
        const { line, column } = e.value
        const doc = tr.state.doc
        const lineStart = doc.line(line).from
        const errorPos = lineStart + column - 1
        
        // Create decorations
        const builder = new RangeSetBuilder<Decoration>()
        
        // Add line decoration
        builder.add(lineStart, lineStart, Decoration.line({
          class: 'cm-error-line',
          attributes: { title: error.value }
        }))
        
        // Add character decoration
        builder.add(errorPos, errorPos + 1, Decoration.mark({
          class: 'cm-error',
          attributes: { title: error.value }
        }))
        
        return builder.finish()
      }
    }
    
    return errors
  },
  provide: f => EditorView.decorations.from(f)
})

// Function to clear error highlighting
const clearErrorHighlighting = () => {
  if (editor) {
    editor.dispatch({
      effects: addErrorEffect.of(null)
    })
  }
}

// Function to highlight error location
const highlightError = (line: number, column: number) => {
  if (!editor) return
  
  editor.dispatch({
    effects: addErrorEffect.of({ line, column })
  })
}

const startPanning = (event: MouseEvent) => {
  if (currentZoom > 1) {
    isPanning = true
    startX = event.clientX - translateX
    startY = event.clientY - translateY
    if (diagramWrapper.value) {
      diagramWrapper.value.style.cursor = 'grabbing'
    }
  }
}

const pan = (event: MouseEvent) => {
  if (isPanning && currentZoom > 1) {
    event.preventDefault()
    translateX = event.clientX - startX
    translateY = event.clientY - startY
    updateDiagramTransform()
  }
}

const stopPanning = () => {
  isPanning = false
  if (diagramWrapper.value) {
    diagramWrapper.value.style.cursor = currentZoom > 1 ? 'grab' : 'default'
  }
}

const zoomIn = () => {
  if (currentZoom < MAX_ZOOM) {
    currentZoom += ZOOM_STEP
    updateDiagram()
  }
}

const zoomOut = () => {
  if (currentZoom > MIN_ZOOM) {
    currentZoom -= ZOOM_STEP
    updateDiagram()
  }
}

const resetZoom = () => {
  currentZoom = 1
  translateX = 0
  translateY = 0
  updateDiagram()
}

const updateDiagramTransform = () => {
  if (diagramWrapper.value) {
    diagramWrapper.value.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`
  }
}

const updateDiagram = () => {
  if (svgContainer.value && editor) {
    try {
      error.value = ''
      clearErrorHighlighting()
      const source = editor.state.doc.toString()
      
      // Render the diagram as SVG
      const svg = renderSvg(source)
      svgContainer.value.innerHTML = svg
      lastValidSource = source
      
      // Update the transform
      updateDiagramTransform()
      
      // Update cursor style
      if (diagramWrapper.value) {
        diagramWrapper.value.style.cursor = currentZoom > 1 ? 'grab' : 'default'
      }
    } catch (err) {
      console.error('Error rendering diagram:', err)
      error.value = err instanceof Error ? err.message : 'Unknown error occurred'
      
      // Extract line and column from error message if possible
      const lineMatch = error.value.match(/line (\d+)/)
      const columnMatch = error.value.match(/column (\d+)/)
      
      if (lineMatch && columnMatch) {
        const line = parseInt(lineMatch[1])
        const column = parseInt(columnMatch[1])
        highlightError(line, column)
      }
      
      // If we have a last valid source, render that instead
      if (lastValidSource && svgContainer.value) {
        svgContainer.value.innerHTML = renderSvg(lastValidSource)
      }
    }
  }
}

const exportSvg = () => {
  if (editor && svgContainer.value) {
    const source = editor.state.doc.toString()
    const svg = renderSvg(source)
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'diagram.svg'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }
}

onMounted(() => {
  if (editorContainer.value) {
    // Initialize CodeMirror
    const startState = EditorState.create({
      doc: `[<business:process> process]`,
      extensions: [
        nomnoml,
        errorField,
        lineNumbers(),
        keymap.of(defaultKeymap),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            updateDiagram()
          }
        })
      ]
    })
    
    editor = new EditorView({
      state: startState,
      parent: editorContainer.value
    })

    // Initial render
    updateDiagram()
  }
})

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>

<style>
.container {
  max-width: 100%;
  margin: 0;
  padding: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

h1 {
  text-align: center;
  color: #2c3e50;
  margin: 10px 0;
  padding: 10px;
}

.editor-container {
  display: flex;
  flex: 1;
  gap: 0;
  margin: 0;
  height: calc(100vh - 80px); /* Subtract header height */
}

.editor {
  width: 50%;
  height: 100%;
  border: none;
  border-right: 1px solid #ccc;
  border-radius: 0;
  overflow: hidden;
}

.diagram-container {
  width: 50%;
  height: 100%;
  border: none;
  border-radius: 0;
  overflow: hidden;
  position: relative;
  background-color: #f8f8f8;
}

.diagram-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-origin: center center;
  transition: transform 0.1s ease;
  will-change: transform;
}

.zoom-controls {
  position: absolute;
  top: 10px;
  right: 10px;
  display: flex;
  gap: 5px;
  z-index: 2;
}

.zoom-controls button {
  width: 30px;
  height: 30px;
  border: 1px solid #ccc;
  border-radius: 4px;
  background-color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  color: #333;
  transition: all 0.2s ease;
}

.zoom-controls button:hover {
  background-color: #f0f0f0;
  border-color: #999;
}

.zoom-controls button:active {
  background-color: #e0e0e0;
}

.svg-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.svg-container svg {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.error-message {
  color: #e74c3c;
  padding: 10px;
  background-color: #fde8e8;
  border-radius: 4px;
  margin: 10px;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1;
}

/* CodeMirror customizations */
.cm-editor {
  height: 100%;
  font-family: 'Fira Code', monospace;
  font-size: 14px;
}

.cm-gutters {
  border-right: 1px solid #eee;
  background-color: #f8f8f8;
}

.cm-lineNumbers {
  color: #999;
  padding: 0 8px;
}

/* Error highlighting */
.cm-error {
  background-color: rgba(255, 0, 0, 0.2);
  border-bottom: 2px solid #e74c3c;
}

.cm-error-line {
  background-color: rgba(255, 0, 0, 0.1);
}

/* Nomnoml syntax highlighting */
.cm-meta {
  color: #586e75;
}

.cm-comment {
  color: #859900;
  font-style: italic;
}

.cm-keyword {
  color: #b58900;
}

.cm-bracket {
  color: #268bd2;
}

.cm-operator {
  color: #cb4b16;
}
</style> 