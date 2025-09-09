import { Config, Measurer, RelationLabel, Style } from './domain'
import { indexBy } from './util'
import { Vec } from './vector'
import * as dagre from 'dagre'
import { layouters, styles } from './visuals'
import { EdgeLabel, GraphLabel, GraphNode } from 'graphre/decl/types'
import { Part, Node, Association } from './parser'
import { routeBestWithRays } from './orthogonalRouter'

type Quadrant = 1 | 2 | 3 | 4

export type LayoutedNode = Omit<Node, 'parts'> & {
  x: number
  y: number
  width: number
  height: number
  layoutWidth: number
  layoutHeight: number
  dividers?: Vec[][]
  parts: LayoutedPart[]
}

export type LayoutedPart = Omit<Part, 'nodes' | 'assocs'> & {
  width?: number
  height?: number
  offset?: Vec
  x?: number
  y?: number
  nodes: LayoutedNode[]
  assocs: LayoutedAssoc[]
}

export type LayoutedAssoc = Association & {
  path: Vec[]
  x?: number
  y?: number
  width?: number
  height?: number
  startLabel: EdgeLabel
  endLabel: EdgeLabel
}

export function layout(measurer: Measurer, config: Config, ast: Part): LayoutedPart {
  function measureLines(lines: string[], fontWeight: 'normal' | 'bold') {
    if (!lines.length) return { width: 0, height: config.padding }
    measurer.setFont(config.font, config.fontSize, fontWeight, 'normal')
    return {
      width: Math.round(Math.max(...lines.map(measurer.textWidth)) + 2 * config.padding),
      height: Math.round(measurer.textHeight() * lines.length + 2 * config.padding),
    }
  }

  function layoutCompartment(c: Part, compartmentIndex: number, style: Style) {
    const textSize = measureLines(c.lines, compartmentIndex ? 'normal' : 'bold')

    if (!c.nodes.length && !c.assocs.length) {
      const layoutedPart = c as LayoutedPart
      layoutedPart.width = textSize.width
      layoutedPart.height = textSize.height
      layoutedPart.offset = { x: config.padding, y: config.padding }
      return
    }

    const styledConfig = {
      ...config,
      direction: style.direction ?? config.direction,
    }
    const layoutedNodes = c.nodes as LayoutedNode[]
    const layoutedAssoc = c.assocs as LayoutedAssoc[]
    for (let i = 0; i < layoutedAssoc.length; i++) layoutedAssoc[i].id = `${i}`
    for (const e of layoutedNodes) layoutNode(e, styledConfig)

    const g = new dagre.graphlib.Graph({
      multigraph: true,
      directed: true
    })
    g.setGraph({
      rankdir: style.direction || config.direction,
      nodesep: config.spacing,
      edgesep: config.spacing,
      ranksep: config.spacing,
      acyclicer: config.acyclicer,
      ranker: config.ranker,
    })
    for (const e of layoutedNodes) {
      g.setNode(e.id, { width: e.layoutWidth, height: e.layoutHeight })
    }
    for (const r of layoutedAssoc) {
      if (r.type.indexOf('_') > -1) {
        g.setEdge(r.start, r.end, { minlen: 0 }, r.id)
      } else if ((config.gravity ?? 1) != 1) {
        g.setEdge(r.start, r.end, { minlen: config.gravity }, r.id)
      } else {
        g.setEdge(r.start, r.end, {}, r.id)
      }
    }
    dagre.layout(g)

    const rels = indexBy(c.assocs as LayoutedAssoc[], 'id')
    const nodes = indexBy(c.nodes as LayoutedNode[], 'id')
    for (const name of g.nodes()) {
      const node = g.node(name)
      if (node && typeof node.x === 'number' && typeof node.y === 'number') {
        nodes[name].x = node.x
        nodes[name].y = node.y
      }
    }
    // Override positions with explicit coordinates when provided via node attributes
    for (const n of Object.values(nodes)) {
      const ax = (n as any).attr?.x
      const ay = (n as any).attr?.y
      const px = ax != null ? Number(ax) : undefined
      const py = ay != null ? Number(ay) : undefined
      if (px != null && !Number.isNaN(px)) n.x = px
      if (py != null && !Number.isNaN(py)) n.y = py
    }
    let left = 0
    let right = 0
    let top = 0
    let bottom = 0

    // Precompute which nodes are fixed
    const isFixed: Record<string, boolean> = {}
    for (const [id, n] of Object.entries(nodes)) {
      const ax = (n as any).attr?.x
      const ay = (n as any).attr?.y
      isFixed[id] = ax != null || ay != null
    }

    for (const edgeObj of g.edges()) {
      const start = nodes[edgeObj.v]
      const end = nodes[edgeObj.w]
      const rel = rels[edgeObj.name]

      // Compute ports and route orthogonally
      const dir = styledConfig.direction ?? config.direction
      const margin = config.edgeMargin + config.padding + 2
      const obstacles = Object.entries(nodes)
        .filter(([id]) => id !== edgeObj.v && id !== edgeObj.w)
        .map(([_, n]) => ({
          left: n.x - (n.width ?? 0) / 2 - margin,
          right: n.x + (n.width ?? 0) / 2 + margin,
          top: n.y - (n.height ?? 0) / 2 - margin,
          bottom: n.y + (n.height ?? 0) / 2 + margin,
        }))
      const { full } = routeBestWithRays(
        { x: start.x, y: start.y },
        { w: start.width, h: start.height },
        { x: end.x, y: end.y },
        { w: end.width, h: end.height },
        dir,
        obstacles,
        margin
      )
      rel.path = [{ x: start.x, y: start.y }, ...full, { x: end.x, y: end.y }]

      const startP = rel.path[1]
      const endP = rel.path[rel.path.length - 2]
      layoutLabel(rel.startLabel, startP, adjustQuadrant(quadrant(startP, start) ?? 4, start, end))
      layoutLabel(rel.endLabel, endP, adjustQuadrant(quadrant(endP, end) ?? 2, end, start))

      const startLabelX = rel.startLabel.x ?? 0
      const startLabelY = rel.startLabel.y ?? 0
      const startLabelWidth = rel.startLabel.width ?? 0
      const startLabelHeight = rel.startLabel.height ?? 0
      const endLabelX = rel.endLabel.x ?? 0
      const endLabelY = rel.endLabel.y ?? 0
      const endLabelWidth = rel.endLabel.width ?? 0
      const endLabelHeight = rel.endLabel.height ?? 0

      const pts = rel.path
      left = Math.min(left, startLabelX, endLabelX, ...pts.map((e: Vec) => e.x))
      right = Math.max(
        right,
        startLabelX + startLabelWidth,
        endLabelX + endLabelWidth,
        ...pts.map((e: Vec) => e.x)
      )
      top = Math.min(top, startLabelY, endLabelY, ...pts.map((e: Vec) => e.y))
      bottom = Math.max(
        bottom,
        startLabelY + startLabelHeight,
        endLabelY + endLabelHeight,
        ...pts.map((e: Vec) => e.y)
      )
    }
    // Include node extents to capture nodes that have explicit positions outside dagre bounds
    for (const n of Object.values(nodes)) {
      const nx = n.x
      const ny = n.y
      const nw = n.width ?? 0
      const nh = n.height ?? 0
      const nleft = nx - nw / 2
      const nright = nx + nw / 2
      const ntop = ny - nh / 2
      const nbottom = ny + nh / 2
      left = Math.min(left, nleft)
      right = Math.max(right, nright)
      top = Math.min(top, ntop)
      bottom = Math.max(bottom, nbottom)
    }

    const graph = g.graph()
    const width = Math.max((graph.width ?? 0) + (left < 0 ? -left : 0), right - left)
    const height = Math.max((graph.height ?? 0) + (top < 0 ? -top : 0), bottom - top)
    const graphHeight = height ? height + 2 * config.gutter : 0
    const graphWidth = width ? width + 2 * config.gutter : 0

    const part = c as LayoutedPart
    part.width = Math.max(textSize.width, graphWidth)

    // Check if this compartment has child nodes
    const hasChildren = c.nodes && c.nodes.length > 0
    
    // Calculate padding based on whether there are children
    const topPadding = hasChildren ? config.padding * 5 : config.padding
    const bottomPadding = hasChildren ? config.padding * 4 : config.padding
    const sidePadding = config.padding
    
    // When there are children, move text up by reducing the graphHeight gap
    const textLiftAmount = hasChildren ? config.padding * 3 : 0
    
    part.width += 2 * sidePadding
    part.height = textSize.height + (graphHeight - textLiftAmount) + topPadding + bottomPadding
    part.offset = { x: sidePadding - left, y: topPadding - top - textLiftAmount }
  }

  function toPoint(o: Vec): Vec {
    return { x: o.x, y: o.y }
  }

  function layoutLabel(label: RelationLabel, point: Vec, quadrant: Quadrant) {
    if (!label.text) {
      label.width = 0
      label.height = 0
      label.x = point.x
      label.y = point.y
    } else {
      const fontSize = config.fontSize
      const lines = label.text.split('`')
      label.width = Math.max(...lines.map((l) => measurer.textWidth(l)))
      label.height = fontSize * lines.length
      label.x =
        point.x + (quadrant == 1 || quadrant == 4 ? config.padding : -label.width - config.padding)
      label.y =
        point.y + (quadrant == 3 || quadrant == 4 ? config.padding : -label.height - config.padding)
    }
  }

  // find basic quadrant using relative position of endpoint and block rectangle
  function quadrant(point: Vec, node: LayoutedNode): Quadrant | undefined {
    if (point.x < node.x && point.y < node.y) return 1
    if (point.x > node.x && point.y < node.y) return 2
    if (point.x > node.x && point.y > node.y) return 3
    if (point.x < node.x && point.y > node.y) return 4
    return undefined
  }

  // Flip basic label quadrant if needed, to avoid crossing a bent relationship line
  function adjustQuadrant(quadrant: Quadrant, point: Vec, opposite: Vec): Quadrant {
    if (opposite.x == point.x || opposite.y == point.y) return quadrant
    const flipHorizontally: Quadrant[] = [4, 3, 2, 1]
    const flipVertically: Quadrant[] = [2, 1, 4, 3]
    const oppositeQuadrant =
      opposite.y < point.y ? (opposite.x < point.x ? 2 : 1) : opposite.x < point.x ? 3 : 4
    // if an opposite relation end is in the same quadrant as a label, we need to flip the label
    if (oppositeQuadrant === quadrant) {
      if (config.direction === 'LR') return flipHorizontally[quadrant - 1]
      if (config.direction === 'TB') return flipVertically[quadrant - 1]
    }
    return quadrant
  }

  function layoutNode(node: LayoutedNode, config: Config): void {
    const style = config.styles[node.type] || styles.class
    for (let i = 0; i < node.parts.length; i++) {
      layoutCompartment(node.parts[i], i, style)
    }
    const visual = layouters[style.visual] ?? layouters.class
    visual(config, node)
    node.layoutWidth = (node.width ?? 0) + 2 * config.edgeMargin
    node.layoutHeight = (node.height ?? 0) + 2 * config.edgeMargin
  }

  const root = ast as LayoutedPart
  layoutCompartment(root, 0, styles.class)
  return root
}
