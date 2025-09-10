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
          <button @click="exportDrawio" title="Export draw.io">⤓</button>
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
import * as nomnoml from 'nomnoml'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { nomnoml } from './nomnoml-mode'
import { Decoration, DecorationSet } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { StateEffect, StateField } from '@codemirror/state'
import { lineNumbers } from '@codemirror/view'
import { keymap } from '@codemirror/view'
import { defaultKeymap } from '@codemirror/commands'
import { buildDrawioXmlFromSource } from './export-drawio'
import { reparentAndSerialize, addAssociationAndSerialize, removeAssociationAndSerialize } from './ast-rewrite'

const editorContainer = ref<HTMLElement | null>(null)
const diagramContainer = ref<HTMLElement | null>(null)
const diagramWrapper = ref<HTMLElement | null>(null)
const svgContainer = ref<HTMLElement | null>(null)
const error = ref('')
let editor: EditorView | null = null
let lastValidSource: string | null = null
let lastLayout: Record<string, { x: number; y: number; w?: number; h?: number }> = {}
let lastRels: Record<string, { id: string; start: string; end: string; type: string }> = {}
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
let isDraggingNode = false
let draggingNodeId: string | null = null
let dragStartClientX = 0
let dragStartClientY = 0
let dragStartNodeX = 0
let dragStartNodeY = 0
let dragOriginalTransform = ''
let currentDropTargetId: string | null = null
let connectSourceId: string | null = null
let connectorDot: SVGCircleElement | null = null

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
      
      // Render the diagram as SVG and capture layout
      const r = nomnoml.renderSvgAdvanced(source)
      svgContainer.value.innerHTML = r.svg
      // Build a quick lookup for node positions and sizes
      lastLayout = {}
      lastRels = {}
      const collect = (part: any) => {
        for (const n of part.nodes || []) {
          lastLayout[n.id] = { x: n.x, y: n.y, w: n.width, h: n.height }
          for (const cp of n.parts || []) collect(cp)
        }
      }
      collect(r.layout)
      const collectRels = (part: any) => {
        for (const a of part.assocs || []) {
          if (a.id) lastRels[a.id] = { id: a.id, start: a.start, end: a.end, type: a.type }
        }
        for (const n of part.nodes || []) for (const cp of n.parts || []) collectRels(cp)
      }
      collectRels(r.layout)
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
        svgContainer.value.innerHTML = nomnoml.renderSvg(lastValidSource)
      }
    }
  }
}

const exportSvg = () => {
  if (editor && svgContainer.value) {
    const source = editor.state.doc.toString()
    const svg = nomnoml.renderSvg(source)
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

const exportDrawio = () => {
  if (!editor) return
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

// Helpers to update position directives in the source text
function upsertPosDirective(source: string, nodeId: string, x: number, y: number): string {
  const lines = source.split('\n')
  const posRegex = /^#pos:\s*(.*)$/i
  const fmtName = (s: string) => (/[\s;]/.test(s) ? `"${s.replace(/"/g, '\\"')}"` : s)
  let found = false
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(posRegex)
    if (m) {
      const map = new Map<string, { x: number; y: number }>()
      const text = m[1]
      const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/g
      let mm: RegExpExecArray | null
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
  if (!found) {
    lines.unshift(`#pos: ${fmtName(nodeId)}=${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return lines.join('\n')
}

function findNodeGroupElement(target: HTMLElement | null): SVGElement | null {
  let el: HTMLElement | null = target
  while (el && el !== svgContainer.value) {
    if ((el as any).getAttribute && (el as any).getAttribute('data-name')) return el as any
    el = el.parentElement
  }
  return null
}

const onSvgMouseDown = (ev: MouseEvent) => {
  if (!svgContainer.value) return
  const group = findNodeGroupElement(ev.target as HTMLElement)
  if (group) {
    const id = (group as any).getAttribute('data-name')
    if (id && lastLayout[id]) {
      isDraggingNode = true
      draggingNodeId = id
      dragStartClientX = ev.clientX
      dragStartClientY = ev.clientY
      dragStartNodeX = lastLayout[id].x
      dragStartNodeY = lastLayout[id].y
      dragOriginalTransform = (group as any).getAttribute('transform') || ''
      ev.preventDefault()
      ev.stopPropagation()
      // Visual hint
      (group as any).style.cursor = 'grabbing'
    }
  }
}

const onWindowMouseMove = (ev: MouseEvent) => {
  if (!isDraggingNode || !draggingNodeId) return
  const dx = (ev.clientX - dragStartClientX) / currentZoom
  const dy = (ev.clientY - dragStartClientY) / currentZoom
  const newX = dragStartNodeX + dx
  const newY = dragStartNodeY + dy
  // Live preview by translating the node group
  const findGroup = () => {
    const groups = svgContainer.value?.querySelectorAll('g[data-name]') as NodeListOf<SVGGElement> | undefined
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

  // Highlight potential drop target under pointer (excluding self)
  if (svgContainer.value) {
    const els = document.elementsFromPoint(ev.clientX, ev.clientY)
    let targetId: string | null = null
    for (const e of els) {
      const g = (e as HTMLElement).closest?.('g[data-name]') as SVGGElement | null
      if (g) {
        const id = g.getAttribute('data-name')
        if (id && id !== draggingNodeId) { targetId = id; break }
      }
    }
    if (targetId !== currentDropTargetId) {
      if (currentDropTargetId) {
        const prev = svgContainer.value.querySelector(`g[data-name="${currentDropTargetId}"]`) as SVGGElement | null
        prev?.classList.remove('drop-target')
      }
      if (targetId) {
        const next = svgContainer.value.querySelector(`g[data-name="${targetId}"]`) as SVGGElement | null
        next?.classList.add('drop-target')
      }
      currentDropTargetId = targetId
    }
  }
}

const onWindowMouseUp = (ev: MouseEvent) => {
  if (!isDraggingNode || !draggingNodeId || !editor) return
  const dx = (ev.clientX - dragStartClientX) / currentZoom
  const dy = (ev.clientY - dragStartClientY) / currentZoom
  const newX = dragStartNodeX + dx
  const newY = dragStartNodeY + dy
  // Determine potential container under pointer using DOM hit testing
  let source = editor.state.doc.toString()
  const els = document.elementsFromPoint(ev.clientX, ev.clientY)
  let containerId: string | null = null
  for (const e of els) {
    const g = (e as HTMLElement).closest?.('g[data-name]') as SVGGElement | null
    if (g) {
      const id = g.getAttribute('data-name')
      if (id && id !== draggingNodeId) { containerId = id; break }
    }
  }
  if (containerId) {
    // Moving into a container: remove fixed position for the child so layout can place it
    source = removePosDirective(source, draggingNodeId)
  } else {
    // Keep explicit position when not reparenting (or moving to root)
    source = upsertPosDirective(source, draggingNodeId, newX, newY)
  }
  // Rewrite source to nested syntax instead of #parent directive
  const updated = reparentAndSerialize(source, draggingNodeId, containerId || 'root')
  editor.dispatch({
    changes: { from: 0, to: source.length, insert: updated },
  })
  // Reset dragging state
  isDraggingNode = false
  draggingNodeId = null
  // Clear highlight
  if (currentDropTargetId && svgContainer.value) {
    const prev = svgContainer.value.querySelector(`g[data-name="${currentDropTargetId}"]`) as SVGGElement | null
    prev?.classList.remove('drop-target')
  }
  currentDropTargetId = null
  // Re-render will be triggered by update listener
}

function ensureConnectorDot(svg: SVGSVGElement, nodeId: string) {
  if (!lastLayout[nodeId]) return
  const pos = lastLayout[nodeId]
  const cx = pos.x + (pos.w || 0) / 2 + 6
  const cy = pos.y
  if (!connectorDot) {
    connectorDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle') as SVGCircleElement
    connectorDot.setAttribute('r', '5')
    connectorDot.setAttribute('fill', '#4a90e2')
    connectorDot.setAttribute('stroke', '#fff')
    connectorDot.setAttribute('stroke-width', '2')
    connectorDot.style.cursor = 'pointer'
    svg.appendChild(connectorDot)
    connectorDot.addEventListener('click', (e) => {
      e.stopPropagation()
      connectSourceId = nodeId
      connectorDot?.setAttribute('fill', '#e24a4a')
    })
  }
  connectorDot.setAttribute('cx', cx.toFixed(1))
  connectorDot.setAttribute('cy', cy.toFixed(1))
  connectorDot.setAttribute('data-for', nodeId)
  connectorDot.style.display = 'block'
}

function hideConnectorDot() {
  if (connectorDot) connectorDot.style.display = 'none'
}

function onSvgMouseOver(ev: MouseEvent) {
  const target = ev.target as HTMLElement
  const g = target.closest('g[data-name]') as SVGGElement | null
  if (!g || !svgContainer.value) return
  const nodeId = g.getAttribute('data-name') || ''
  const svg = svgContainer.value.querySelector('svg') as SVGSVGElement | null
  if (!svg) return
  ensureConnectorDot(svg, nodeId)
}

function onSvgMouseOut(ev: MouseEvent) {
  const target = ev.target as HTMLElement
  const g = target.closest('g[data-name]') as SVGGElement | null
  if (!g) return
  if (!connectSourceId) hideConnectorDot()
}

function promptConnectionType(): string | null {
  const options = [
    { key: '1', name: 'Association (solid)', type: '-' },
    { key: '2', name: 'Association (dashed)', type: '--' },
    { key: '3', name: 'Flow (arrow)', type: '->' },
    { key: '4', name: 'Generalization', type: '-|>' },
    { key: '5', name: 'Aggregation', type: 'o-' },
    { key: '6', name: 'Composition', type: '+-' },
    { key: '7', name: 'Dependency', type: '-:>' },
  ]
  const msg = 'Select connection type:\n' + options.map((o) => `${o.key}. ${o.name}`).join('\n')
  const choice = window.prompt(msg, '3')
  const found = options.find((o) => o.key === choice)
  return found ? found.type : null
}

function onSvgClick(ev: MouseEvent) {
  if (!svgContainer.value || !editor) return
  const target = ev.target as HTMLElement
  // Delete connector
  const relGroup = target.closest('g[data-rel]') as SVGGElement | null
  if (relGroup) {
    const relId = relGroup.getAttribute('data-rel') || ''
    const r = lastRels[relId]
    if (r) {
      const ok = window.confirm(`Delete connection ${r.start} ${r.type} ${r.end}?`)
      if (ok) {
        const source = editor.state.doc.toString()
        const updated = removeAssociationAndSerialize(source, r.start, r.end, r.type)
        editor.dispatch({ changes: { from: 0, to: source.length, insert: updated } })
      }
      return
    }
  }
  // Create connector if a source is selected
  const nodeGroup = target.closest('g[data-name]') as SVGGElement | null
  if (nodeGroup && connectSourceId) {
    const targetId = nodeGroup.getAttribute('data-name') || ''
    if (targetId && targetId !== connectSourceId) {
      const type = promptConnectionType()
      if (type) {
        const source = editor.state.doc.toString()
        const updated = addAssociationAndSerialize(source, connectSourceId, targetId, type)
        editor.dispatch({ changes: { from: 0, to: source.length, insert: updated } })
      }
    }
    connectSourceId = null
    hideConnectorDot()
  }
}

function removePosDirective(source: string, nodeId: string): string {
  const lines = source.split('\n')
  const posRegex = /^#pos:\s*(.*)$/i
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(posRegex)
    if (m) {
      const map = new Map<string, { x: number; y: number }>()
      const text = m[1]
      const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/g
      let mm: RegExpExecArray | null
      while ((mm = re.exec(text))) {
        const id = (mm[1] ?? mm[2]).trim()
        map.set(id, { x: parseFloat(mm[3]), y: parseFloat(mm[4]) })
      }
      if (map.delete(nodeId)) {
        const fmtName = (s: string) => (/\s|;/.test(s) ? `"${s}"` : s)
        const rebuilt = Array.from(map.entries())
          .map(([k, v]) => `${fmtName(k)}=${v.x.toFixed(1)},${v.y.toFixed(1)}`)
          .join('; ')
        if (rebuilt) lines[i] = `#pos: ${rebuilt}`
        else lines.splice(i, 1)
      }
      break
    }
  }
  return lines.join('\n')
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
    // Bind mouse handlers for dragging
    if (svgContainer.value) {
      // Use capture to preempt wrapper panning handlers
      svgContainer.value.addEventListener('mousedown', onSvgMouseDown, { capture: true } as any)
      window.addEventListener('mousemove', onWindowMouseMove)
      window.addEventListener('mouseup', onWindowMouseUp)
      svgContainer.value.addEventListener('mouseover', onSvgMouseOver)
      svgContainer.value.addEventListener('mouseout', onSvgMouseOut)
      svgContainer.value.addEventListener('click', onSvgClick)
    }
  }
})

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
  if (svgContainer.value) {
    svgContainer.value.removeEventListener('mousedown', onSvgMouseDown, { capture: true } as any)
    svgContainer.value.removeEventListener('mouseover', onSvgMouseOver)
    svgContainer.value.removeEventListener('mouseout', onSvgMouseOut)
    svgContainer.value.removeEventListener('click', onSvgClick)
  }
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
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

/* Improve hit testing and cursor for draggable nodes */
.svg-container :global(g[data-name]) {
  cursor: grab;
  pointer-events: all;
}

/* Highlight potential drop target container */
.svg-container :global(g.drop-target) path,
.svg-container :global(g.drop-target) rect,
.svg-container :global(g.drop-target) ellipse {
  stroke: #4a90e2 !important;
  stroke-width: 2.5px !important;
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
// (parent directive helper removed in favor of AST rewrite)
