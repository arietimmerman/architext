import { Config, RelationLabel, TextStyle } from './domain'
import { Graphics } from './Graphics'
import { LayoutedAssoc, LayoutedNode, LayoutedPart } from './layouter'
import { drawTerminators, getPath } from './terminators'
import { last } from './util'
import { add, Vec } from './vector'
import { buildStyle, styles, visualizers } from './visuals'

export function render(graphics: Graphics, config: Config, compartment: LayoutedPart) {
  const g = graphics

  function renderCompartment(
    compartment: LayoutedPart,
    color: string | undefined,
    style: TextStyle,
    level: number
  ) {
    g.save()
    g.translate(compartment.offset!.x, compartment.offset!.y)
    g.fillStyle(color || config.stroke)
    
    // Check if this compartment has child nodes
    const hasChildren = compartment.nodes && compartment.nodes.length > 0
    
    // If it has children, text should be position at the bottom
    // Otherwise, it should be at the top
    if (hasChildren) {
      // For compartments with children, render text at the bottom
      const lineHeight = config.fontSize * config.leading
      // Remove extra padding at the bottom
      const bottomPadding = config.padding
      
      for (let i = 0; i < compartment.lines.length; i++) {
        const text = compartment.lines[i]
        g.textAlign(style.center ? 'center' : 'left')
        const x = style.center ? compartment.width! / 2 - config.padding : 0
        // Position text higher within the box by using a smaller bottom padding
        let y = compartment.height! - bottomPadding - (compartment.lines.length - 1 - i) * lineHeight - 50
        
        if (text) {
          g.fillText(text, x, y)
        }
        if (style.underline) {
          const w = g.measureText(text).width
          y += Math.round(config.fontSize * 0.2) + 0.5
          if (style.center) {
            g.path([
              { x: x - w / 2, y: y },
              { x: x + w / 2, y: y },
            ]).stroke()
          } else {
            g.path([
              { x: x, y: y },
              { x: x + w, y: y },
            ]).stroke()
          }
          g.lineWidth(config.lineWidth)
        }
      }
    } else {
      // For compartments without children, render text at the top (original behavior)
      for (let i = 0; i < compartment.lines.length; i++) {
        const text = compartment.lines[i]
        g.textAlign(style.center ? 'center' : 'left')
        const x = style.center ? compartment.width! / 2 - config.padding : 0
        let y = (0.5 + (i + 0.5) * config.leading) * config.fontSize
        
        if (text) {
          g.fillText(text, x, y)
        }
        if (style.underline) {
          const w = g.measureText(text).width
          y += Math.round(config.fontSize * 0.2) + 0.5
          if (style.center) {
            g.path([
              { x: x - w / 2, y: y },
              { x: x + w / 2, y: y },
            ]).stroke()
          } else {
            g.path([
              { x: x, y: y },
              { x: x + w, y: y },
            ]).stroke()
          }
          g.lineWidth(config.lineWidth)
        }
      }
    }
    
    g.save()
    g.translate(config.gutter, config.gutter)
    const pending: { rel: LayoutedAssoc; path: Vec[] }[] = []
    for (const r of compartment.assocs) {
      const p = renderRelation(r)
      pending.push({ rel: r, path: p })
    }
    for (const n of compartment.nodes) renderNode(n, level)
    // Draw terminators on top of nodes to avoid being hidden
    for (const { rel, path } of pending) drawTerminators(g, config, rel, path)
    g.restore()
    g.restore()
  }

  function renderNode(node: LayoutedNode, level: number) {
    const x = node.x - node.width / 2
    const y = node.y - node.height / 2
    
    // Get the base style for the node type
    let style = config.styles[node.type] || styles.class
    
    // If the node has a stylePrefix attribute, apply that style's fill color
    if (node.attr && node.attr.stylePrefix && config.styles[node.attr.stylePrefix]) {
      const prefixStyle = config.styles[node.attr.stylePrefix]
      // Only override the fill, keep the visual from the type
      style = {
        ...style,
        fill: prefixStyle.fill
      }
    }

    g.save()
    g.setData('name', node.id)
    g.setData('compartment', undefined)

    g.save()
    
    g.strokeStyle(style.stroke || config.stroke)
    if (style.dashed) {
      const dash = Math.max(4, 2 * config.lineWidth)
      g.setLineDash([dash, dash])
    }
    
    const drawNode = visualizers[style.visual] || visualizers.class
    drawNode(node, x, y, config, g)
    g.fillStyle(style.fill || config.fill[level] || last(config.fill))
    for (const divider of node.dividers!) {
      g.path(divider.map((e) => add(e, { x, y }))).stroke()
    }
    
    g.restore()

    let partIndex = 0
    for (let part of node.parts) {
      const textStyle = part === node.parts[0] ? style.title : style.body
      g.save()
      g.setData('compartment', String(partIndex))
      g.translate(x + part.x!, y + part.y!)
      g.setFont(
        config.font,
        config.fontSize,
        textStyle.bold ? 'bold' : 'normal',
        textStyle.italic ? 'italic' : 'normal'
      )
      
      renderCompartment(part, style.stroke, textStyle, level + 1)
      partIndex++
      g.restore()
    }

    g.restore()
  }

  function strokePath(p: Vec[]) {
    if (config.edges === 'rounded') {
      const radius = config.spacing * config.bendSize
      g.beginPath()
      g.moveTo(p[0].x, p[0].y)

      for (let i = 1; i < p.length - 1; i++) {
        g.arcTo(p[i].x, p[i].y, p[i + 1].x, p[i + 1].y, radius)
      }
      g.lineTo(last(p).x, last(p).y)
      g.stroke()
    } else g.path(p).stroke()
  }

  function renderLabel(label: RelationLabel) {
    if (!label || !label.text) return
    const fontSize = config.fontSize
    const lines = label.text.split('`')
    for (let i = 0; i < lines.length; i++) {
      g.fillText(lines[i], label.x!, label.y! + fontSize * (i + 1))
    }
  }

  function renderRelation(r: LayoutedAssoc): Vec[] {
    const path = getPath(config, r)

    g.fillStyle(config.stroke)
    g.setFont(config.font, config.fontSize, 'normal', 'normal')

    renderLabel(r.startLabel)
    renderLabel(r.endLabel)

    if (r.type !== '-/-') {
      if (r.type.includes('--')) {
        const dash = Math.max(4, 2 * config.lineWidth)
        g.save()
        g.setLineDash([dash, dash])
        strokePath(path)
        g.restore()
      } else strokePath(path)
    }

    return path
  }

  function setBackground() {
    g.clear()
    g.save()
    g.strokeStyle('transparent')
    g.fillStyle(config.background)
    g.rect(0, 0, compartment.width!, compartment.height!).fill()
    g.restore()
  }

  g.save()
  g.scale(config.zoom, config.zoom)
  setBackground()
  g.setFont(config.font, config.fontSize, 'bold', 'normal')
  g.lineWidth(config.lineWidth)
  g.lineJoin('round')
  g.lineCap('round')
  g.strokeStyle(config.stroke)
  renderCompartment(compartment, undefined, buildStyle({}, {}).title, 0)
  g.restore()
}
