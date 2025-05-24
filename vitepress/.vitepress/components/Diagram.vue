<script setup>
import { ref, onMounted, onUnmounted, useSlots, defineProps, watch } from 'vue'
import { renderSvgAdvanced, parse } from '@nomnoml/nomnoml'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { nomnoml, errorField, addErrorEffect, cachedComponentsEffect } from './nomnomlMode'

// Constants for zoom control
const ZOOM_STEP = 0.1
const MIN_ZOOM = 0.5
const MAX_ZOOM = 3

const container = ref(null)
const diagramWrapper = ref(null)
const editorContainer = ref(null)
const slots = useSlots()
let editor = null

// State for zoom and pan functionality
let currentZoom = 1
let translateX = 0
let translateY = 0
let isPanning = false
let startX = 0
let startY = 0
let lastValidSource = ''

const props = defineProps({
    direction: {
        type: String,
        default: undefined,
        validator: (val) => !val || val === 'down' || val === 'right',
    },
    size: {
        type: String,
        default: 'medium',
    },
    fullPage: {
        type: Boolean,
        default: false,
    },
})

function injectDirection(content, direction) {
    if (!direction) return content
    // Only inject if not already present
    if (/^#direction:/m.test(content)) return content
    return `#direction: ${direction}\n${content}`
}

// Function to clear error highlighting
const clearErrorHighlighting = () => {
  if (editor) {
    editor.dispatch({
      effects: addErrorEffect.of(null)
    })
  }
}

// Function to highlight error location
const highlightError = (line, column) => {
  console.log('Highlighting error at line:', line, 'column:', column)
  if (!editor) return
  
  editor.dispatch({
    effects: addErrorEffect.of({ line, column })
  })
}

// Function to extract components from text
function getExistingComponents(layoutNode) {
  try {
  
  const components = new Set();
  
  function traverseAST(node) {
    const id = node.id;
    if (id) {
      components.add(id);
    }
  
    if (node.children) {
      node.children.forEach(traverseAST);
    }
  }

    layoutNode.nodes.forEach(traverseAST);
  
    console.log(components)
    return Array.from(components);
  } catch (e) {
    return [];
  }
}

const renderDiagram = (content = null) => {
  if (!container.value) return
  
  try {
    // Clear any previous errors
    clearErrorHighlighting()
    
    // If no content is provided, use the editor content
    const source = content || (editor ? editor.state.doc.toString() : '')
    
    
    
    // Render the diagram as SVG
    const processed = injectDirection(source, props.direction)
    let r = renderSvgAdvanced(processed)
    const svg = r.svg
    container.value.innerHTML = svg
    lastValidSource = source
    
    // Cache the valid components
    // Try to extract components before rendering
    const components = getExistingComponents(r.layout)
    if (editor) {
      editor.dispatch({
        effects: cachedComponentsEffect.of(components)
      })
    }
    
    // Update the transform
    updateDiagramTransform()
    
    // Update cursor style
    if (diagramWrapper.value) {
      diagramWrapper.value.style.cursor = currentZoom > 1 ? 'grab' : 'default'
    }
  } catch (err) {
    console.error('Error rendering diagram:', err)
    
    // Extract line and column from error message if possible
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
    const lineMatch = errorMessage.match(/line (\d+)/)
    const columnMatch = errorMessage.match(/column (\d+)/)
    
    if (lineMatch && columnMatch) {
      const line = parseInt(lineMatch[1])
      const column = parseInt(columnMatch[1])
      highlightError(line, column)
    }
    
    // If we have a last valid source, render that instead
    if (lastValidSource && container.value) {
      try {
        const processed = injectDirection(lastValidSource, props.direction)
        container.value.innerHTML = renderSvg(processed)
      } catch (e) {
        console.error('Failed to render last valid source:', e)
      }
    }
  }
}

onMounted(() => {
    // Get the slot content directly from the default slot
    const slotContent = slots.default?.();   
    const diagramContent = slotContent?.[0]?.children || ''    

    editor = new EditorView({
        state: EditorState.create({
            doc: diagramContent,
            extensions: [
                basicSetup,
                nomnoml,
                errorField,
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        renderDiagram()
                    }
                })
            ]
        }),
        parent: editorContainer.value
    })
    
    // Apply full-page specific styling if needed
    if (props.fullPage) {
        editorContainer.value.classList.add('full-page-editor')
    }

    renderDiagram(diagramContent)
})

// Watch for changes to the fullPage prop
watch(() => props.fullPage, (newValue) => {
    if (editorContainer.value) {
        if (newValue) {
            editorContainer.value.classList.add('full-page-editor')
        } else {
            editorContainer.value.classList.remove('full-page-editor')
            
            // Reset zoom and transform when exiting full-page mode
            resetZoom()
        }
    }
    
    // Force redraw to adjust layout
    if (editor) {
        editor.requestMeasure()
    }
})

onUnmounted(() => {
    editor?.destroy()
})



// Export the SVG diagram
const exportSvg = () => {
  if (editor && container.value) {
    const source = editor.state.doc.toString()
    const processed = injectDirection(source, props.direction)
    const svg = renderSvg(processed)
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

// Pan functionality
const startPanning = (event) => {
    console.log('startPanning')
  // Only start panning on left mouse button (button === 0)
  if (currentZoom > 1 && event.button === 0) {
    event.preventDefault() // Prevent text selection
    isPanning = true
    startX = event.clientX - translateX
    startY = event.clientY - translateY
    if (diagramWrapper.value) {
      diagramWrapper.value.style.cursor = 'grabbing'
    }
  }
}

const pan = (event) => {
  if (isPanning && currentZoom > 1) {
    event.preventDefault()
    event.stopPropagation() // Prevent event bubbling
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

// Zoom functionality
const zoomIn = () => {
  if (currentZoom < MAX_ZOOM) {
    currentZoom += ZOOM_STEP
    renderDiagram()
  }
}

const zoomOut = () => {
  if (currentZoom > MIN_ZOOM) {
    currentZoom -= ZOOM_STEP
    renderDiagram()
  }
}

const resetZoom = () => {
  currentZoom = 1
  translateX = 0
  translateY = 0
  renderDiagram()
}

const updateDiagramTransform = () => {
  if (diagramWrapper.value) {
    diagramWrapper.value.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentZoom})`
  }
}
</script>

<template>
    <div  @mousedown="startPanning"
                @mousemove="pan"
                @mouseup="stopPanning"
                @mouseleave="stopPanning" class="diagram-wrapper" :class="{ 'full-page': props.fullPage }">
        <div ref="editorContainer" class="editor"></div>
        <div class="diagram-container" :class="`size-${props.size}`">
            <div v-if="props.fullPage" class="diagram-controls">
                <button class="control-button" @click="zoomIn" title="Zoom In">
                    <span class="icon">+</span>
                </button>
                <button class="control-button" @click="zoomOut" title="Zoom Out">
                    <span class="icon">-</span>
                </button>
                <button class="control-button" @click="resetZoom" title="Reset Zoom">
                    <span class="icon">↺</span>
                </button>
                <button class="control-button" @click="exportSvg" title="Export SVG">
                    <span class="icon">↓</span>
                </button>
            </div>
            <div 
                ref="diagramWrapper" 
                class="diagram-wrapper-inner"
               
            >
                <div class="svg-container" ref="container"></div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.diagram-wrapper {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.diagram-wrapper.full-page {
    flex-direction: row;
    height: calc(100vh - 100px); /* Adjust height as needed, leaving space for header/footer */
}

.full-page .editor,
.full-page .diagram-container {
    width: 50%;
    height: 100%;
    overflow: auto;

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
}

.full-page .editor :deep(.cm-editor) {
    height: 100%;
    max-height: 100%;
}

.editor :deep(.cm-editor) {
    min-height: calc(1em * 1.5);
    /* 2 lines */
    max-height: calc(10em * 1.5);
    /* 10 lines */
    border: 1px solid #ddd;
    border-radius: 8px;
    overflow: auto;
}

.editor :deep(.cm-meta) {
    color: #7a3e9d;
}

.editor :deep(.cm-comment) {
    color: #998;
    font-style: italic;
}

.editor :deep(.cm-keyword) {
    color: #07a;
}

.editor :deep(.cm-bracket) {
    color: #997;
}

.editor :deep(.cm-operator) {
    color: #a67f59;
}

.editor :deep(.cm-error-line) {
    background-color: rgba(255, 0, 0, 0.05);
}

.editor :deep(.cm-error) {
    background-color: rgba(255, 0, 0, 0.3);
    border-bottom: 1px solid red;
}

.diagram-container {
    background-color: #f5f5f5;
    border-radius: 8px;
    margin: 0 0 16px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden; /* Ensure content stays within bounds */
}

.full-page .diagram-container {
    margin: 0;
    padding: 16px;
    height: 100%; /* Ensure it takes full height */
}

/* Diagram controls */
.diagram-controls {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 8px;
    z-index: 10;
}

.control-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 4px;
    background-color: rgba(255, 255, 255, 0.8);
    border: 1px solid #ddd;
    cursor: pointer;
    transition: all 0.2s ease;
}

.control-button:hover {
    background-color: rgba(255, 255, 255, 1);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.control-button .icon {
    font-size: 16px;
    font-weight: bold;
}

/* Diagram wrapper for panning and zooming */
.diagram-wrapper-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-origin: center center;
    will-change: transform;
    touch-action: none; /* Prevents default touch behaviors */
    user-select: none; /* Prevents text selection during drag */
}

.full-page .diagram-wrapper-inner {
    cursor: default;
    overflow: hidden; /* Ensure content stays within bounds */
}

.full-page .diagram-wrapper-inner:hover {
    cursor: grab;
}

.full-page .diagram-wrapper-inner:active {
    cursor: grabbing;
}

.diagram-container svg {
    width: 100%;
    height: auto;
}

.diagram-container.size-small svg {
    max-height: 200px;
}
.diagram-container.size-medium svg {
    max-height: 400px;
}
.diagram-container.size-large svg {
    max-height: 600px;
}
body .full-page.size-large.diagram-container svg {
    max-width: 100%;
  max-height: 100%;
  object-fit: contain;

}

/* Full-page responsive adjustments */
@media (max-width: 768px) {
    .diagram-wrapper.full-page {
        flex-direction: column;
        height: auto;
    }
    
    .full-page .editor,
    .full-page .diagram-container {
        width: 100%;
        height: auto;
    }
    
    .full-page .editor :deep(.cm-editor) {
        min-height: calc(5em * 1.5);
        max-height: calc(15em * 1.5);
    }
}
</style>