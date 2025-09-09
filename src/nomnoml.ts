import type { Config, Measurer } from './domain'
import { Graphics } from './Graphics'
import { layout, LayoutedPart } from './layouter'
import { parse } from './parser'
import { render } from './renderer'
import { GraphicsCanvas } from './GraphicsCanvas'
import { GraphicsSvg } from './GraphicsSvg'

interface Rect {
  width: number
  height: number
}

function fitCanvasSize(canvas: HTMLCanvasElement, rect: Partial<Rect>, zoom: number) {
  canvas.width = rect.width! * zoom
  canvas.height = rect.height! * zoom
}

function createMeasurer(config: Config, graphics: Graphics): Measurer {
  return {
    setFont(
      family: string,
      size: number,
      weight: 'bold' | 'normal',
      style: 'italic' | 'normal'
    ): void {
      graphics.setFont(family, size, weight, style)
    },
    textWidth(s: string): number {
      return graphics.measureText(s).width
    },
    textHeight(): number {
      return config.leading * config.fontSize
    },
  }
}

export { parse }

function parseAndRender(
  code: string,
  graphics: Graphics,
  canvas: HTMLCanvasElement | null,
  scale: number
) {
  const parsedDiagram = parse(code)
  // Apply position directives like: #pos: NodeId=x,y
  try {
    const posMap: Record<string, { x: number; y: number }> = {}
    const parentMap: Record<string, string> = {}
    for (const d of parsedDiagram.directives) {
      if (d.key.trim().toLowerCase() === 'pos' || d.key.trim().toLowerCase() === 'position') {
        // Parse entries of the form: Name=x,y; "Name With Space"=x,y
        const text = d.value
        const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text))) {
          const id = (m[1] ?? m[2]).trim()
          const x = parseFloat(m[3])
          const y = parseFloat(m[4])
          if (!Number.isNaN(x) && !Number.isNaN(y)) posMap[id] = { x, y }
        }
      } else if (d.key.trim().toLowerCase() === 'parent') {
        // Format: child=Parent; "Child"=Parent; Parent can be "root" to detach
        const text = d.value
        const re = /(?:^|;)\s*(?:"([^"]+)"|([^=;]+))\s*=\s*(?:"([^"]+)"|([^;\s]+))/g
        let m: RegExpExecArray | null
        while ((m = re.exec(text))) {
          const child = (m[1] ?? m[2]).trim()
          const parent = (m[3] ?? m[4]).trim()
          parentMap[child] = parent
        }
      }
    }

    if (Object.keys(posMap).length) {
      const applyPositions = (part: any) => {
        if (!part || !part.nodes) return
        for (const n of part.nodes) {
          const p = posMap[n.id]
          if (p) {
            n.attr = n.attr || ({} as any)
            n.attr.x = String(p.x)
            n.attr.y = String(p.y)
          }
          // Recurse into child parts
          if (n.parts) {
            for (const cp of n.parts) applyPositions(cp)
          }
        }
      }
      applyPositions(parsedDiagram.root)
    }

    if (Object.keys(parentMap).length) {
      // Build index of nodes to their current parent Part
      type Entry = { node: any; parentPart: any }
      const byId = new Map<string, Entry>()
      const indexParts = (part: any) => {
        for (const n of part.nodes || []) {
          byId.set(n.id, { node: n, parentPart: part })
          for (const cp of n.parts || []) indexParts(cp)
        }
      }
      indexParts(parsedDiagram.root)

      const rootPart = parsedDiagram.root as any
      for (const [childId, parentId] of Object.entries(parentMap)) {
        const entry = byId.get(childId)
        if (!entry) continue
        const srcPart = entry.parentPart
        let dstPart = rootPart
        if (parentId.toLowerCase() !== 'root') {
          const pEntry = byId.get(parentId)
          if (pEntry && pEntry.node?.parts?.[0]) dstPart = pEntry.node.parts[0]
          else continue
        }
        if (srcPart === dstPart) continue
        // Remove from source
        srcPart.nodes = (srcPart.nodes || []).filter((n: any) => n.id !== childId)
        // Add to destination
        dstPart.nodes = dstPart.nodes || []
        dstPart.nodes.push(entry.node)
        // Update index for child's subtree
        const reindex = (part: any) => {
          for (const n of part.nodes || []) {
            byId.set(n.id, { node: n, parentPart: part })
            for (const cp of n.parts || []) reindex(cp)
          }
        }
        reindex(dstPart)
      }
    }
  } catch (e) {
    // Non-fatal: ignore malformed pos directives
  }
  const config = parsedDiagram.config
  const measurer = createMeasurer(config, graphics)
  const graphLayout = layout(measurer, config, parsedDiagram.root)
  if (canvas) {
    fitCanvasSize(canvas, graphLayout, config.zoom * scale)
  }
  config.zoom *= scale
  render(graphics, config, graphLayout)
  return { config: config, layout: graphLayout }
}

export function draw(canvas: HTMLCanvasElement, code: string, scale?: number): { config: Config } {
  return parseAndRender(code, GraphicsCanvas(canvas), canvas, scale || 1)
}

export function renderSvgAdvanced(
  code: string,
  document?: HTMLDocument
): { svg: string; layout: LayoutedPart } {
  const skCanvas = GraphicsSvg(document)
  const { config, layout } = parseAndRender(code, skCanvas, null, 1)
  return {
    svg: skCanvas.serialize(
      {
        width: layout.width!,
        height: layout.height!,
      },
      code,
      config.title
    ),
    layout: layout,
  }
}

export function renderSvg(
  code: string,
  document?: HTMLDocument
): string {
  let r = renderSvgAdvanced(code, document)
  return r.svg
}

export class ImportDepthError extends Error {
  constructor() {
    super('max_import_depth exceeded')
  }
}

type FileLoaderAsync = (filename: string) => Promise<string>

export async function processAsyncImports(
  source: string,
  loadFile: FileLoaderAsync,
  maxImportDepth: number = 10
): Promise<string> {
  if (maxImportDepth == -1) {
    throw new ImportDepthError()
  }

  async function lenientLoadFile(key: string): Promise<string> {
    try {
      return (await loadFile(key)) || ''
    } catch (e) {
      return ''
    }
  }

  const imports: { file: string; promise: Promise<string> }[] = []

  source.replace(/#import: *(.*)/g, (a: unknown, file: string) => {
    const promise = lenientLoadFile(file).then((contents) =>
      processAsyncImports(contents, loadFile, maxImportDepth - 1)
    )
    imports.push({ file, promise })
    return ''
  })

  const imported: Record<string, string> = {}
  for (const imp of imports) {
    imported[imp.file] = await imp.promise
  }

  return source.replace(/#import: *(.*)/g, (a: unknown, file: string) => imported[file])
}

type FileLoader = (filename: string) => string

export function processImports(
  source: string,
  loadFile: FileLoader,
  maxImportDepth: number = 10
): string {
  if (maxImportDepth == -1) {
    throw new ImportDepthError()
  }

  function lenientLoadFile(key: string) {
    try {
      return loadFile(key) || ''
    } catch (e) {
      return ''
    }
  }

  return source.replace(/#import: *(.*)/g, (a: unknown, file: string) =>
    processImports(lenientLoadFile(file), loadFile, maxImportDepth - 1)
  )
}

export function compileFile(filepath: string, maxImportDepth?: number): string {
  const fs = require('fs')
  const path = require('path')

  const directory = path.dirname(filepath)
  const rootFileName = path.basename(filepath)

  function loadFile(filename: string): string {
    return fs.readFileSync(path.join(directory, filename), { encoding: 'utf8' })
  }

  return processImports(loadFile(rootFileName), loadFile, maxImportDepth)
}
