import * as nomnoml from 'nomnoml'

type LayoutedPart = any
type LayoutedNode = any
type LayoutedAssoc = any

function xmlEncode(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function mapArchimate32Style(n: LayoutedNode): string {
  const t = (n.type || '').toLowerCase()
  const p = (n.attr?.stylePrefix || '').toLowerCase()

  // Defaults
  let shape = 'mxgraph.archimate3.application'
  let key = 'appType'
  let val = 'comp'

  const is = (s: string) => t.includes(s)

  if (p === 'business' || is('business')) {
    shape = 'mxgraph.archimate3.business'
    key = 'busType'
    if (is('actor')) val = 'actor'
    else if (is('role')) val = 'role'
    else if (is('process')) val = 'process'
    else if (is('service')) val = 'service'
    else if (is('event')) val = 'event'
    else if (is('object') || is('data')) val = 'object'
    else val = 'function'
  } else if (p === 'technology' || is('technology') || is('device') || is('node') || is('artifact')) {
    shape = 'mxgraph.archimate3.technology'
    key = 'tecType'
    if (is('device')) val = 'device'
    else if (is('node')) val = 'node'
    else if (is('artifact') || is('artifact')) val = 'artifact'
    else if (is('service')) val = 'service'
    else if (is('function') || is('process')) val = 'function'
    else val = 'node'
  } else {
    // Application (default)
    shape = 'mxgraph.archimate3.application'
    key = 'appType'
    if (is('service')) val = 'service'
    else if (is('interface')) val = 'interface'
    else if (is('function') || is('process')) val = 'function'
    else val = 'comp'
  }

  // archiType controls corner style (square, rounded, slanted)
  const archiType = 'square'
  return `shape=${shape};${key}=${val};archiType=${archiType};whiteSpace=wrap;html=1;`
}

function nodeValue(n: LayoutedNode): string {
  // Use first line of first compartment or id
  try {
    const first = n.parts?.[0]?.lines?.[0]
    if (first && typeof first === 'string') return first
  } catch (e) {}
  return n.id || ''
}

function collectAllNodes(part: LayoutedPart, acc: LayoutedNode[] = []): LayoutedNode[] {
  for (const n of part.nodes || []) {
    acc.push(n)
    for (const cp of n.parts || []) collectAllNodes(cp, acc)
  }
  return acc
}

function collectAllAssocs(part: LayoutedPart, acc: LayoutedAssoc[] = []): LayoutedAssoc[] {
  for (const a of part.assocs || []) acc.push(a)
  for (const n of part.nodes || []) {
    for (const cp of n.parts || []) collectAllAssocs(cp, acc)
  }
  return acc
}

export function buildDrawioXmlFromSource(source: string): string {
  const r = nomnoml.renderSvgAdvanced(source)
  const layout: LayoutedPart = r.layout

  // Basic mxGraph model structure
  const cells: string[] = []
  let idCounter = 2 // 0=root,1=layer
  const idMap = new Map<string, string>()

  // Root and layer
  cells.push('<mxCell id="0"/>')
  cells.push('<mxCell id="1" parent="0"/>')

  // Create vertex cells for nodes
  const nodes = collectAllNodes(layout)
  for (const n of nodes) {
    const id = String(++idCounter)
    idMap.set(n.id, id)
    const x = (n.x - (n.width || 0) / 2).toFixed(1)
    const y = (n.y - (n.height || 0) / 2).toFixed(1)
    const w = (n.width || 120).toFixed(1)
    const h = (n.height || 60).toFixed(1)
    const value = xmlEncode(nodeValue(n))
    const style = xmlEncode(mapArchimate32Style(n))
    cells.push(
      `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="1">` +
        `<mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>` +
      `</mxCell>`
    )
  }

  // Create edge cells for associations
  const assocs = collectAllAssocs(layout)
  for (const a of assocs) {
    if ((a.type || '') === '-/-') continue
    const eid = String(++idCounter)
    const source = idMap.get(a.start)
    const target = idMap.get(a.end)
    if (!source || !target) continue
    const points: string[] = []
    const path = a.path || []
    if (path.length > 2) {
      for (let i = 1; i < path.length - 1; i++) {
        const p = path[i]
        points.push(`<mxPoint x="${p.x.toFixed(1)}" y="${p.y.toFixed(1)}"/>`)
      }
    }
    const pointsXml = points.length ? `<Array as="points">${points.join('')}</Array>` : ''
    const style = xmlEncode(buildEdgeStyle(a.type || ''))
    cells.push(
      `<mxCell id="${eid}" style="${style}" edge="1" parent="1" source="${source}" target="${target}">` +
        `<mxGeometry relative="1" as="geometry">${pointsXml}</mxGeometry>` +
      `</mxCell>`
    )
  }

  const root = `<root>${cells.join('')}</root>`
  const model = `<mxGraphModel dx="1024" dy="768" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" math="0" shadow="0">${root}</mxGraphModel>`
  const diagram = `<diagram name="Page-1">${model}</diagram>`
  const xml = `<mxfile host="app.diagrams.net">${diagram}</mxfile>`
  return xml
}

function buildEdgeStyle(type: string): string {
  const parts: string[] = []
  parts.push('edgeStyle=orthogonalEdgeStyle')
  parts.push('orthogonalLoop=1')
  parts.push('rounded=0')
  parts.push('html=1')

  // dashed when "--" is present
  if (type.includes('--')) {
    parts.push('dashed=1')
    parts.push('dashPattern=8 8')
  }

  const tokens = type.split(/[-_]/)
  if (tokens.length) {
    const startTok = tokens[0]
    const endTok = tokens[tokens.length - 1]
    applyTerminator(parts, false, startTok)
    applyTerminator(parts, true, endTok)
  }
  return parts.join(';') + ';'
}

function applyTerminator(parts: string[], isEnd: boolean, tok: string) {
  const side = isEnd ? 'end' : 'start'
  const set = (k: string, v: string | number) => parts.push(`${k}=${v}`)
  switch (tok) {
    case '>':
    case '<':
      set(`${side}Arrow`, 'block')
      set(`${side}Fill`, 1)
      break
    case ':>':
    case '<:':
      set(`${side}Arrow`, 'open')
      set(`${side}Fill`, 0)
      break
    case '+':
      set(`${side}Arrow`, 'diamond')
      set(`${side}Fill`, 1)
      break
    case 'o':
      set(`${side}Arrow`, 'diamond')
      set(`${side}Fill`, 0)
      break
    case '|>':
    case '<|':
      set(`${side}Arrow`, 'classic')
      set(`${side}Fill`, 1)
      break
    case '.':
      set(`${side}Arrow`, 'oval')
      set(`${side}Fill`, 1)
      set(`${side}Size`, 6)
      break
    case '(':
    case ')':
    case '(o':
    case 'o)':
    case '>o':
    case 'o<':
      set(`${side}Arrow`, 'oval')
      set(`${side}Fill`, 0)
      set(`${side}Size`, 10)
      break
    default:
      set(`${side}Arrow`, 'none')
      break
  }
}
