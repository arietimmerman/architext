import { parse } from 'nomnoml'

type Part = any
type Node = any
type Association = any

function serializePart(part: Part, indent: string): string {
  const out: string[] = []
  // Emit nodes
  for (const n of part.nodes || []) {
    out.push(serializeNode(n, indent))
  }
  // Emit associations as separate lines
  for (const a of part.assocs || []) {
    const s = `${indent}[${a.start}]${a.type}[${a.end}]`
    out.push(s)
  }
  return out.join('\n')
}

function serializeNode(n: Node, indent: string): string {
  const bodyIndent = indent + '  '
  const lines: string[] = []
  // meta <prefix:type attr=val ...>
  const attrs: string[] = []
  const a = n.attr || {}
  for (const [k, v] of Object.entries(a)) {
    if (v == null) continue
    if (k === 'id' || k === 'x' || k === 'y' || k === 'stylePrefix') continue
    attrs.push(`${k}=${String(v)}`)
  }
  const prefix = a.stylePrefix ? `${a.stylePrefix}:` : ''
  const type = n.type || 'class'
  const meta = `<${prefix}${type}${attrs.length ? ' ' + attrs.join(' ') : ''}>`

  // Header: first line of first part (title) if present
  const firstPart = n.parts?.[0]
  const title = firstPart?.lines?.[0] ?? n.id ?? ''
  const header = `${indent}[${meta} ${title}`
  lines.push(header)

  // Additional lines in first part
  const extra = (firstPart?.lines || []).slice(1)
  for (const ln of extra) lines.push(`${bodyIndent}${ln}`)

  // Children and internal associations in first part
  if (firstPart) {
    const inner = serializePart({ nodes: firstPart.nodes || [], assocs: firstPart.assocs || [], lines: [] }, bodyIndent)
    if (inner) lines.push(inner)
  }

  // Other compartments
  for (let i = 1; i < (n.parts?.length || 0); i++) {
    lines.push(`${bodyIndent}|`)
    const p = n.parts[i]
    // text lines
    for (const ln of p.lines || []) lines.push(`${bodyIndent}${ln}`)
  }

  // Close
  lines.push(`${indent}]`)
  return lines.join('\n')
}

export function reparentAndSerialize(source: string, childId: string, parentId: string | 'root'): string {
  const { root, directives } = parse(source)

  // Build index id -> { node, parentPart }
  type Entry = { node: Node; parentPart: Part }
  const byId = new Map<string, Entry>()
  const indexParts = (part: Part) => {
    for (const n of part.nodes || []) {
      byId.set(n.id, { node: n, parentPart: part })
      for (const cp of n.parts || []) indexParts(cp)
    }
  }
  indexParts(root)

  const entry = byId.get(childId)
  if (!entry) return source

  // Find destination part
  let dstPart: Part = root
  if (parentId !== 'root') {
    const pEntry = byId.get(parentId)
    if (!pEntry) return source
    // Ensure parent has a first compartment
    if (!pEntry.node.parts || !pEntry.node.parts.length) {
      pEntry.node.parts = [{ nodes: [], assocs: [], lines: [] }]
    }
    dstPart = pEntry.node.parts[0]
  }

  // Remove from current parent
  entry.parentPart.nodes = (entry.parentPart.nodes || []).filter((n: Node) => n.id !== childId)
  // Add to destination
  dstPart.nodes = dstPart.nodes || []
  dstPart.nodes.push(entry.node)

  // If moved into a parent container, remove all associations to/from this child everywhere
  if (parentId !== 'root') {
    const strip = (part: Part) => {
      part.assocs = (part.assocs || []).filter((a: Association) => a.start !== childId && a.end !== childId)
      for (const n of part.nodes || []) {
        for (const cp of n.parts || []) strip(cp)
      }
    }
    strip(root)
  }

  // Produce new source text (preserve directives like #pos, #direction, etc.)
  const dirText = (directives || [])
    .map((d: any) => `#${d.key}: ${d.value}`)
    .join('\n')
  const body = serializePart(root, '')
  return dirText ? dirText + '\n' + body : body
}

export function addAssociationAndSerialize(
  source: string,
  startId: string,
  endId: string,
  type: string
): string {
  const { root, directives } = parse(source)

  // Build parent chain for each node
  type Entry = { node: Node; parentPart: Part; chain: Part[] }
  const byId = new Map<string, Entry>()
  function walk(part: Part, chain: Part[]) {
    for (const n of part.nodes || []) {
      byId.set(n.id, { node: n, parentPart: part, chain })
      for (const cp of n.parts || []) walk(cp, [...chain, cp])
    }
  }
  walk(root, [root])

  const a = byId.get(startId)
  const b = byId.get(endId)
  if (!a || !b) return source

  // Find lowest common ancestor part
  let lca: Part = root
  const minLen = Math.min(a.chain.length, b.chain.length)
  for (let i = 0; i < minLen; i++) {
    if (a.chain[i] === b.chain[i]) lca = a.chain[i]
    else break
  }
  lca.assocs = lca.assocs || []
  lca.assocs.push({ type, start: startId, end: endId, startLabel: { text: '' }, endLabel: { text: '' } })

  const dirText = (directives || [])
    .map((d: any) => `#${d.key}: ${d.value}`)
    .join('\n')
  const body = serializePart(root, '')
  return dirText ? dirText + '\n' + body : body
}

export function removeAssociationAndSerialize(
  source: string,
  startId: string,
  endId: string,
  type: string
): string {
  const { root, directives } = parse(source)
  const strip = (part: Part) => {
    part.assocs = (part.assocs || []).filter(
      (a: Association) => !(a.start === startId && a.end === endId && a.type === type)
    )
    for (const n of part.nodes || []) for (const cp of n.parts || []) strip(cp)
  }
  strip(root)
  const dirText = (directives || [])
    .map((d: any) => `#${d.key}: ${d.value}`)
    .join('\n')
  const body = serializePart(root, '')
  return dirText ? dirText + '\n' + body : body
}
