<script setup>
import { ref, onMounted, onUnmounted, useSlots, defineProps, watch } from 'vue'
import { renderSvgAdvanced, renderSvg, parse } from '@nomnoml/nomnoml'
import { EditorView, basicSetup } from 'codemirror'
import { EditorState } from '@codemirror/state'
import { nomnoml, errorField, addErrorEffect, cachedComponentsEffect } from './nomnomlMode'
import { buildDrawioXmlFromSource } from '../../../architext/src/export-drawio'
import { reparentAndSerialize } from '../../../architext/src/ast-rewrite'

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
let lastLayout = {}
let isDraggingNode = false
let draggingNodeId = null
let dragStartClientX = 0
let dragStartClientY = 0
let dragStartNodeX = 0
let dragStartNodeY = 0
let dragOriginalTransform = ''
let currentDropTargetId = null

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
    // collect node positions for dragging
    lastLayout = {}
    const collect = (part) => {
      for (const n of part.nodes || []) {
        lastLayout[n.id] = { x: n.x, y: n.y }
        for (const cp of n.parts || []) collect(cp)
      }
    }
    collect(r.layout)
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

// Helpers for manual positioning
function upsertPosDirective(source, nodeId, x, y) {
  const lines = source.split('\n')
  const posRegex = /^#pos:\s*(.*)$/i
  const fmtName = (s) => (/\s|;/.test(s) ? `"${s.replace(/\"/g, '\\"')}"` : s)
  let found = false
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(posRegex)
    if (m) {
      const map = new Map()
      const text = m[1]
      const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/g
      let mm
      while ((mm = re.exec(text))) {
        const id = (mm[1] ?? mm[2]).trim()
        map.set(id, { x: parseFloat(mm[3]), y: parseFloat(mm[4]) })
      }
      map.set(nodeId, { x, y })
      const rebuilt = Array.from(map.entries())
        .map(([k, v]) => `${fmtName(k)}=${v.x.toFixed(1)},${v.y.toFixed(1)}`)
        .join('; ')
      lines[i] = `#pos: ${rebuilt}`
      found = true
      break
    }
  }
  if (!found) lines.unshift(`#pos: ${fmtName(nodeId)}=${x.toFixed(1)},${y.toFixed(1)}`)
  return lines.join('\n')
}

function removePosDirective(source, nodeId) {
  const lines = source.split('\n')
  const posRegex = /^#pos:\s*(.*)$/i
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(posRegex)
    if (m) {
      const map = new Map()
      const text = m[1]
      const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/g
      let mm
      while ((mm = re.exec(text))) {
        const id = (mm[1] ?? mm[2]).trim()
        map.set(id, true)
      }
      if (map.has(nodeId)) {
        map.delete(nodeId)
        const fmtName = (s) => (/\s|;/.test(s) ? `"${s}"` : s)
        // We don't have stored coordinates anymore; just rebuild remaining pairs as-is
        const rebuilt = Array.from(map.keys())
          .map((k) => `${fmtName(k)}=0,0`)
          .join('; ')
        if (rebuilt) lines[i] = `#pos: ${rebuilt}`
        else lines.splice(i, 1)
      }
      break
    }
  }
  return lines.join('\n')
}

function upsertParentDirective(source, childId, parentId) {
  const lines = source.split('\n')
  const parentRegex = /^#parent:\s*(.*)$/i
  const fmtName = (s) => (/\s|;/.test(s) ? `"${s}"` : s)
  let found = false
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(parentRegex)
    if (m) {
      const map = new Map()
      const text = m[1]
      const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*(?:"([^"]+)"|([^;\s]+))/g
      let mm
      while ((mm = re.exec(text))) {
        const id = (mm[1] ?? mm[2]).trim()
        const parent = (mm[3] ?? mm[4]).trim()
        map.set(id, parent)
      }
      map.set(childId, parentId)
      const rebuilt = Array.from(map.entries())
        .map(([k, v]) => `${fmtName(k)}=${fmtName(v)}`)
        .join('; ')
      lines[i] = `#parent: ${rebuilt}`
      found = true
      break
    }
  }
  if (!found) lines.unshift(`#parent: ${fmtName(childId)}=${fmtName(parentId)}`)
  return lines.join('\n')
}

function findNodeGroupElement(target) {
  let el = target
  while (el && el !== container.value) {
    if (el?.getAttribute && el.getAttribute('data-name')) return el
    el = el.parentElement
  }
  return null
}

const onSvgMouseDown = (ev) => {
  const group = findNodeGroupElement(ev.target)
  if (group) {
    const id = group.getAttribute('data-name')
    if (id && lastLayout[id]) {
      isDraggingNode = true
      draggingNodeId = id
      dragStartClientX = ev.clientX
      dragStartClientY = ev.clientY
      dragStartNodeX = lastLayout[id].x
      dragStartNodeY = lastLayout[id].y
      dragOriginalTransform = group.getAttribute('transform') || ''
      ev.preventDefault()
      ev.stopPropagation()
      group.style.cursor = 'grabbing'
    }
  }
}

const onWindowMouseMove = (ev) => {
  if (!isDraggingNode || !draggingNodeId) return
  const dx = (ev.clientX - dragStartClientX) / currentZoom
  const dy = (ev.clientY - dragStartClientY) / currentZoom
  const newX = dragStartNodeX + dx
  const newY = dragStartNodeY + dy
  const findGroup = () => {
    const groups = container.value?.querySelectorAll('g[data-name]')
    if (!groups) return null
    for (const g of Array.from(groups)) {
      if (g.getAttribute('data-name') === draggingNodeId) return g
    }
    return null
  }
  const group = findGroup()
  if (group) {
    const tx = (newX - lastLayout[draggingNodeId].x).toFixed(1)
    const ty = (newY - lastLayout[draggingNodeId].y).toFixed(1)
    const base = dragOriginalTransform ? dragOriginalTransform + ' ' : ''
    group.setAttribute('transform', `${base}translate(${tx}, ${ty})`)
  }

  // Highlight potential drop target
  const els = document.elementsFromPoint(ev.clientX, ev.clientY)
  let targetId = null
  for (const e of els) {
    const g = e.closest && e.closest('g[data-name]')
    if (g) {
      const id = g.getAttribute('data-name')
      if (id && id !== draggingNodeId) { targetId = id; break }
    }
  }
  if (targetId !== currentDropTargetId) {
    if (currentDropTargetId && container.value) {
      const prev = container.value.querySelector(`g[data-name="${currentDropTargetId}"]`)
      prev?.classList?.remove('drop-target')
    }
    if (targetId && container.value) {
      const next = container.value.querySelector(`g[data-name="${targetId}"]`)
      next?.classList?.add('drop-target')
    }
    currentDropTargetId = targetId
  }
}

const onWindowMouseUp = (ev) => {
  if (!isDraggingNode || !draggingNodeId || !editor) return
  const dx = (ev.clientX - dragStartClientX) / currentZoom
  const dy = (ev.clientY - dragStartClientY) / currentZoom
  const newX = dragStartNodeX + dx
  const newY = dragStartNodeY + dy
  const source = editor.state.doc.toString()
  let text = source
  const els = document.elementsFromPoint(ev.clientX, ev.clientY)
  let containerId = null
  for (const e of els) {
    const g = e.closest && e.closest('g[data-name]')
    if (g) {
      const id = g.getAttribute('data-name')
      if (id && id !== draggingNodeId) { containerId = id; break }
    }
  }
  if (containerId) text = removePosDirective(text, draggingNodeId)
  else text = upsertPosDirective(text, draggingNodeId, newX, newY)
  const updated = reparentAndSerialize(text, draggingNodeId, containerId || 'root')
  editor.dispatch({ changes: { from: 0, to: source.length, insert: updated } })
  isDraggingNode = false
  draggingNodeId = null
  // Clear highlight
  if (currentDropTargetId && container.value) {
    const prev = container.value.querySelector(`g[data-name="${currentDropTargetId}"]`)
    prev?.classList?.remove('drop-target')
  }
  currentDropTargetId = null
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
    if (container.value) {
      // Use capture to avoid competing panning handlers
      container.value.addEventListener('mousedown', onSvgMouseDown, { capture: true })
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('mouseup', onWindowMouseUp)
    }
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
    if (container.value) container.value.removeEventListener('mousedown', onSvgMouseDown, { capture: true })
    window.removeEventListener('mousemove', onWindowMouseMove)
    window.removeEventListener('mouseup', onWindowMouseUp)
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

// Export draw.io
const exportDrawio = () => {
  if (editor && container.value) {
    const source = editor.state.doc.toString()
    const xml = buildDrawioXmlFromSource(source)
    const blob = new Blob([xml], { type: 'application/xml' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'diagram.drawio'
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
                <button class="control-button" @click="exportDrawio" title="Export draw.io">
                    <span class="icon">⤓</span>
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

/* Improve hit testing and cursor for draggable nodes */
.diagram-container :deep(g[data-name]) {
    cursor: grab;
    pointer-events: all;
}

/* Highlight potential drop target container */
.diagram-container :deep(g.drop-target) path,
.diagram-container :deep(g.drop-target) rect,
.diagram-container :deep(g.drop-target) ellipse {
    stroke: #4a90e2 !important;
    stroke-width: 2.5px !important;
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
