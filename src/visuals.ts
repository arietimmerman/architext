import { Config, NodeLayouter, Style, TextStyle, Visual, Visualizer } from './domain'
import { LayoutedNode, LayoutedPart } from './layouter'
import { Graphics } from './Graphics'
import { sum, last, range } from './util'
import { Vec } from './vector'

export function buildStyle(
  conf: Partial<Style>,
  title: Partial<TextStyle>,
  body: Partial<TextStyle> = {}
): Style {
  return {
    title: {
      bold: title.bold || false,
      underline: title.underline || false,
      italic: title.italic || false,
      center: title.center || false,
    },
    body: {
      bold: body.bold || false,
      underline: body.underline || false,
      italic: body.italic || false,
      center: body.center || false,
    },
    dashed: conf.dashed || false,
    fill: conf.fill || undefined,
    stroke: conf.stroke || undefined,
    visual: conf.visual || 'class',
    direction: conf.direction || undefined,
  }
}

// prettier-ignore
export const styles: { [key: string]: Style } = {
  abstract:    buildStyle({ visual:'class' }, { center:true, italic:true }),
  actor:       buildStyle({ visual:'actor' }, { center:true }, { center: true }),
  choice:      buildStyle({ visual:'rhomb' }, { center:true }, { center: true }),
  class:       buildStyle({ visual:'class' }, { center:true, bold:true }),
  database:    buildStyle({ visual:'database' }, { center:true, bold:true }, { center: true }),
  end:         buildStyle({ visual:'end' }, {}),
  frame:       buildStyle({ visual:'frame' }, {}),
  hidden:      buildStyle({ visual:'hidden' }, {}),
  input:       buildStyle({ visual:'input' }, { center:true }),
  instance:    buildStyle({ visual:'class' }, { center:true, underline:true }),
  label:       buildStyle({ visual:'none' }, { center:true }),
  lollipop:    buildStyle({ visual:'lollipop' }, { center:true }),
  note:        buildStyle({ visual:'note' }, {}),
  pipe:        buildStyle({ visual:'pipe' }, { center:true, bold: true }),
  package:     buildStyle({ visual:'package' }, {}),
  receiver:    buildStyle({ visual:'receiver' }, {}),
  reference:   buildStyle({ visual:'class', dashed:true }, { center:true }),
  sender:      buildStyle({ visual:'sender' }, {}),
  socket:      buildStyle({ visual:'socket' }, {}),
  start:       buildStyle({ visual:'start' }, {}),
  state:       buildStyle({ visual:'roundrect' }, { center:true }),
  sync:        buildStyle({ visual:'sync' }, { center:true }),
  table:       buildStyle({ visual:'table' }, { center:true, bold:true }),
  transceiver: buildStyle({ visual:'transceiver' }, {}),
  usecase:     buildStyle({ visual:'ellipse' }, { center:true }, { center: true }),
  interface:   buildStyle({ visual:'interface', fill: '#bfffff' }, { center:true }, { center: true }),
  process:     buildStyle({ visual:'process', fill: '#bfffff' }, { center:true }, { center: true }),
  device:      buildStyle({ visual:'device', fill: '#bfffff' }, { center:true }, { center: true }),
  communication_network: buildStyle({ visual:'communication_network', fill: '#bfffff' }, { center:true }, { center: true }),
  system_software: buildStyle({ visual:'system_software', fill: '#bfffff' }, { center:true }, { center: true }),
  artifact:    buildStyle({ visual:'artifact', fill: '#bfffff' }, { center:true }, { center: true }),
  contract:    buildStyle({ visual:'contract', fill: '#bfffff' }, { center:true }, { center: true }),
  role:        buildStyle({ visual:'role' }, { center:true }),
  collaboration: buildStyle(
    { visual: 'collaboration', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  component: buildStyle(
    { visual: 'component', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  function: buildStyle(
    { visual: 'function', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  interaction: buildStyle(
    { visual: 'interaction', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  node: buildStyle(
    { visual: 'node', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  event: buildStyle(
    { visual: 'event', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  service: buildStyle(
    { visual: 'service', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  data: buildStyle(
    { visual: 'data', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  object: buildStyle(
    { visual: 'object', fill: '#bfffff' },
    { center: true },
    { center: true }
  ),
  application: buildStyle(
    { visual: 'component', fill: '#dae8fc' },
    { center: true },
    { center: true }
  ),
  business: buildStyle(
    { visual: 'component', fill: '#fff2cc' },
    { center: true },
    { center: true }
  ),
  technology: buildStyle(
    { visual: 'component', fill: '#afffaf' },
    { center: true },
    { center: true }
  ),
}

function offsetBox(config: Config, clas: LayoutedNode, offset: Vec) {
  clas.width = Math.max(...clas.parts.map((e) => e.width ?? 0))
  clas.height = sum(clas.parts, (e) => e.height ?? 0 ?? 0)
  clas.dividers = []
  let y = 0
  for (const comp of clas.parts) {
    comp.x = 0 + offset.x
    comp.y = y + offset.y
    comp.width = clas.width
    y += comp.height ?? 0 ?? 0
    if (comp != last(clas.parts))
      clas.dividers.push([
        { x: 0, y: y },
        { x: clas.width, y: y },
      ])
  }
}
function box(config: Config, clas: LayoutedNode) {
  offsetBox(config, clas, { x: 0, y: 0 })
}

function archimate(config: Config, clas: LayoutedNode) {
  clas.width = Math.max(160, ...clas.parts.map((e) => e.width ?? 0))
  clas.height = Math.max(90,sum(clas.parts, (e) => e.height ?? 0 ?? 0))
  clas.dividers = []
  let y = 29
  for (const comp of clas.parts) {
    comp.x = 0 + 0
    comp.y = y + 0
    comp.width = clas.width
    y += comp.height ?? 0 ?? 0
    if (comp != last(clas.parts))
      clas.dividers.push([
        { x: 0, y: y },
        { x: clas.width, y: y },
      ])
  }
}

function icon(config: Config, clas: LayoutedNode) {
  clas.dividers = []
  clas.parts = []
  clas.width = config.fontSize * 2.5
  clas.height = config.fontSize * 2.5
}

function labelledIcon(config: Config, clas: LayoutedNode) {
  clas.width = config.fontSize * 1.5
  clas.height = config.fontSize * 1.5
  clas.dividers = []
  let y = config.direction == 'LR' ? clas.height - config.padding : -clas.height / 2
  for (const comp of clas.parts) {
    if (config.direction == 'LR') {
      comp.x = clas.width / 2 - (comp.width ?? 0) / 2
      comp.y = y
    } else {
      comp.x = clas.width / 2 + config.padding / 2
      comp.y = y
    }
    y += comp.height ?? 0 ?? 0
  }
}

export const layouters: { [key in Visual]: NodeLayouter } = {
  actor: archimate,
  class: box,
  database: function (config: Config, clas: LayoutedNode) {
    clas.width = Math.max(...clas.parts.map((e) => e.width ?? 0))
    clas.height = sum(clas.parts, (e) => e.height ?? 0) + config.padding * 2
    clas.dividers = []
    let y = config.padding * 1.5
    for (const comp of clas.parts) {
      comp.x = 0
      comp.y = y
      comp.width = clas.width
      y += comp.height ?? 0
      if (comp != last(clas.parts)) {
        const path = range([0, Math.PI], 16).map((a) => ({
          x: clas.width * 0.5 * (1 - Math.cos(a)),
          y: y + config.padding * (0.75 * Math.sin(a) - 0.5),
        }))
        clas.dividers.push(path)
      }
    }
  },
  ellipse: function (config: Config, clas: LayoutedNode) {
    const width = Math.max(...clas.parts.map((e) => e.width ?? 0))
    const height = sum(clas.parts, (e) => e.height ?? 0)
    clas.width = width * 1.25
    clas.height = height * 1.25
    clas.dividers = []
    let y = height * 0.125
    const sq = (x: number) => x * x
    const rimPos = (y: number) => Math.sqrt(sq(0.5) - sq(y / clas.height - 0.5)) * clas.width
    for (const comp of clas.parts) {
      comp.x = width * 0.125
      comp.y = y
      comp.width = width
      y += comp.height ?? 0
      if (comp != last(clas.parts))
        clas.dividers.push([
          { x: clas.width / 2 + rimPos(y) - 1, y: y },
          { x: clas.width / 2 - rimPos(y) + 1, y: y },
        ])
    }
  },
  end: icon,
  frame: function (config: Config, clas: LayoutedNode) {
    const w = clas.parts[0].width ?? 0
    const h = clas.parts[0].height ?? 0
    clas.parts[0].width = h / 2 + (clas.parts[0].width ?? 0)
    box(config, clas)
    if (clas.dividers?.length) clas.dividers.shift()
    clas.dividers?.unshift([
      { x: 0, y: h },
      { x: w - h / 4, y: h },
      { x: w + h / 4, y: h / 2 },
      { x: w + h / 4, y: 0 },
    ])
  },
  hidden: function (config: Config, clas: LayoutedNode) {
    clas.dividers = []
    clas.parts = []
    clas.width = 1
    clas.height = 1
  },
  input: box,
  
  lollipop: labelledIcon,
  none: box,
  note: box,
  package: box,
  pipe: function box(config: Config, clas: LayoutedNode) {
    offsetBox(config, clas, { x: -config.padding / 2, y: 0 })
  },
  receiver: box,
  rhomb: function (config: Config, clas: LayoutedNode) {
    const width = Math.max(...clas.parts.map((e) => e.width ?? 0))
    const height = sum(clas.parts, (e) => e.height ?? 0)
    clas.width = width * 1.5
    clas.height = height * 1.5
    clas.dividers = []
    let y = height * 0.25
    for (const comp of clas.parts) {
      comp.x = width * 0.25
      comp.y = y
      comp.width = width
      y += comp.height ?? 0
      const slope = clas.width / clas.height
      if (comp != last(clas.parts))
        clas.dividers.push([
          {
            x: clas.width / 2 + (y < clas.height / 2 ? y * slope : (clas.height - y) * slope),
            y: y,
          },
          {
            x: clas.width / 2 - (y < clas.height / 2 ? y * slope : (clas.height - y) * slope),
            y: y,
          },
        ])
    }
  },
  roundrect: box,
  sender: box,
  socket: labelledIcon,
  start: icon,
  sync: function (config: Config, clas: LayoutedNode) {
    clas.dividers = []
    clas.parts = []
    if (config.direction == 'LR') {
      clas.width = config.lineWidth * 3
      clas.height = config.fontSize * 5
    } else {
      clas.width = config.fontSize * 5
      clas.height = config.lineWidth * 3
    }
  },
  table: function (config: Config, clas: LayoutedNode) {
    if (clas.parts.length == 1) {
      box(config, clas)
      return
    }
    const gridcells = clas.parts.slice(1)
    const rows: LayoutedPart[][] = [[]]
    function isRowBreak(e: LayoutedPart): boolean {
      return !e.lines.length && !e.nodes.length && !e.assocs.length
    }
    function isRowFull(e: LayoutedPart): boolean {
      const current = last(rows)
      return rows[0] != current && rows[0].length == current.length
    }
    function isEnd(e: LayoutedPart): boolean {
      return e == last(gridcells)
    }
    for (const comp of gridcells) {
      if (!isEnd(comp) && isRowBreak(comp) && last(rows).length) {
        rows.push([])
      } else if (isRowFull(comp)) {
        rows.push([comp])
      } else {
        last(rows).push(comp)
      }
    }
    const header = clas.parts[0]
    const cellW = Math.max(
      (header.width ?? 0) / rows[0].length,
      ...gridcells.map((e) => e.width ?? 0)
    )
    const cellH = Math.max(...gridcells.map((e) => e.height ?? 0))
    clas.width = cellW * rows[0].length
    clas.height = (header.height ?? 0) + cellH * rows.length
    const hh = header.height ?? 0
    clas.dividers = [
      [
        { x: 0, y: header.height ?? 0 },
        { x: 0, y: header.height ?? 0 },
      ],
      ...rows.map((e, i) => [
        { x: 0, y: hh + i * cellH },
        { x: clas.width ?? 0, y: hh + i * cellH },
      ]),
      ...rows[0].map((e, i) => [
        { x: (i + 1) * cellW, y: hh },
        { x: (i + 1) * cellW, y: clas.height },
      ]),
    ]
    header.x = 0
    header.y = 0
    header.width = clas.width
    for (let i = 0; i < rows.length; i++) {
      for (let j = 0; j < rows[i].length; j++) {
        const cell = rows[i][j]
        cell.x = j * cellW
        cell.y = hh + i * cellH
        cell.width = cellW
      }
    }
    clas.parts = clas.parts.filter((e) => !isRowBreak(e))
  },
  transceiver: box,
  component: archimate,
  interface: archimate,
  process: archimate,
  device: archimate,
  communication_network: archimate,
  system_software: archimate,
  artifact: archimate,
  collaboration: archimate,
  function: archimate,
  interaction: archimate,
  node: archimate,
  event: archimate,
  service: archimate,
  data: archimate,
  object: archimate,
  role: archimate,
  contract: archimate,
  application: function (config: Config, clas: LayoutedNode) {
    // Use the same layouter as component
    layouters.component(config, clas);
  },
  business: function (config: Config, clas: LayoutedNode) {
    // Use the same layouter as component
    layouters.component(config, clas);
  },
  technology: function (config: Config, clas: LayoutedNode) {
    // Use the same layouter as component
    layouters.component(config, clas);
  }
}

export const visualizers: { [key in Visual]: Visualizer } = {
  actor: function (node, x, y, config, g) {
    // Draw the main rounded rectangle
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the actor icon in the top right corner
    const iconWidth = 20; // Reduced from 25
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 5;
    
    // Draw stick figure
    const a = 6; // Reduced from 8 to make figure smaller
    const yp = iconY + a * 1.5;
    const faceCenter = { x: iconX + iconWidth/2, y: yp };
    
    // Draw the actor figure
    g.circle(faceCenter, a/1.5).fillAndStroke();
    g.path([
      { x: iconX + iconWidth/2, y: yp + a },
      { x: iconX + iconWidth/2, y: yp + 2.5 * a },
    ]).stroke();
    g.path([
      { x: iconX + iconWidth/2 - a, y: yp + 1.5 * a },
      { x: iconX + iconWidth/2 + a, y: yp + 1.5 * a },
    ]).stroke();
    g.path([
      { x: iconX + iconWidth/2 - a, y: yp + 3.5 * a },
      { x: iconX + iconWidth/2, y: yp + 2.5 * a },
      { x: iconX + iconWidth/2 + a, y: yp + 3.5 * a },
    ]).stroke();
  },
  class: function (node, x, y, config, g) {
    g.rect(x, y, node.width, node.height).fillAndStroke()
  },
  database: function (node, x, y, config, g) {
    const pad = config.padding
    const cy = y - pad / 2
    const pi = 3.1416
    g.rect(x, y + pad, node.width, node.height - pad * 2).fill()
    g.path([
      { x: x, y: cy + pad * 1.5 },
      { x: x, y: cy - pad * 0.5 + node.height },
    ]).stroke()
    g.path([
      { x: x + node.width, y: cy + pad * 1.5 },
      { x: x + node.width, y: cy - pad * 0.5 + node.height },
    ]).stroke()
    g.ellipse({ x: node.x, y: cy + pad * 1.5 }, node.width, pad * 1.5).fillAndStroke()
    g.ellipse(
      { x: node.x, y: cy - pad * 0.5 + node.height },
      node.width,
      pad * 1.5,
      0,
      pi
    ).fillAndStroke()
  },
  ellipse: function (node, x, y, config, g) {
    g.ellipse({ x: node.x, y: node.y }, node.width, node.height).fillAndStroke()
  },
  end: function (node, x, y, config, g) {
    g.circle({ x: node.x, y: y + node.height / 2 }, node.height / 3).fillAndStroke()
    g.fillStyle(config.stroke)
    g.circle({ x: node.x, y: y + node.height / 2 }, node.height / 3 - config.padding / 2).fill()
  },
  frame: function (node, x, y, config, g) {
    g.rect(x, y, node.width, node.height).fillAndStroke()
  },
  hidden: function (node, x, y, config, g) {},
  input: function (node, x, y, config, g) {
    g.circuit([
      { x: x + config.padding, y: y },
      { x: x + node.width, y: y },
      { x: x + node.width - config.padding, y: y + node.height },
      { x: x, y: y + node.height },
    ]).fillAndStroke()
  },
  lollipop: function (node, x, y, config, g) {
    g.circle({ x: node.x, y: y + node.height / 2 }, node.height / 2.5).fillAndStroke()
  },
  none: function (node, x, y, config, g) {},
  note: function (node, x, y, config, g) {
    g.circuit([
      { x: x, y: y },
      { x: x + node.width - config.padding, y: y },
      { x: x + node.width, y: y + config.padding },
      { x: x + node.width, y: y + node.height },
      { x: x, y: y + node.height },
      { x: x, y: y },
    ]).fillAndStroke()
    g.path([
      { x: x + node.width - config.padding, y: y },
      { x: x + node.width - config.padding, y: y + config.padding },
      { x: x + node.width, y: y + config.padding },
    ]).stroke()
  },
  package: function (node, x, y, config, g) {
    const headHeight = node.parts[0].height ?? 0
    g.rect(x, y + headHeight, node.width, node.height - headHeight).fillAndStroke()
    const w = g.measureText(node.parts[0].lines[0]).width + 2 * config.padding
    g.circuit([
      { x: x, y: y + headHeight },
      { x: x, y: y },
      { x: x + w, y: y },
      { x: x + w, y: y + headHeight },
    ]).fillAndStroke()
  },
  pipe: function (node, x, y, config, g) {
    const pad = config.padding
    const pi = 3.1416
    g.rect(x, y, node.width, node.height).fill()
    g.path([
      { x: x, y: y },
      { x: x + node.width, y: y },
    ]).stroke()
    g.path([
      { x: x, y: y + node.height },
      { x: x + node.width, y: y + node.height },
    ]).stroke()
    g.ellipse({ x: x + node.width, y: node.y }, pad * 1.5, node.height).fillAndStroke()
    g.ellipse({ x: x, y: node.y }, pad * 1.5, node.height, pi / 2, (pi * 3) / 2).fillAndStroke()
  },
  receiver: function (node, x, y, config, g) {
    g.circuit([
      { x: x - config.padding, y: y },
      { x: x + node.width, y: y },
      { x: x + node.width, y: y + node.height },
      { x: x - config.padding, y: y + node.height },
      { x: x, y: y + node.height / 2 },
    ]).fillAndStroke()
  },
  rhomb: function (node, x, y, config, g) {
    g.circuit([
      { x: node.x, y: y },
      { x: x + node.width, y: node.y },
      { x: node.x, y: y + node.height },
      { x: x, y: node.y },
    ]).fillAndStroke()
  },
  roundrect: function (node, x, y, config, g) {
    const r = Math.min(config.padding * 2 * config.leading, node.height / 2)
    g.roundRect(x, y, node.width, node.height, r).fillAndStroke()
  },
  sender: function (node, x, y, config, g) {
    g.circuit([
      { x: x, y: y },
      { x: x + node.width - config.padding, y: y },
      { x: x + node.width, y: y + node.height / 2 },
      { x: x + node.width - config.padding, y: y + node.height },
      { x: x, y: y + node.height },
    ]).fillAndStroke()
  },
  socket: function (node, x, y, config, g) {
    const from = config.direction === 'TB' ? Math.PI : Math.PI / 2
    const to = config.direction === 'TB' ? 2 * Math.PI : -Math.PI / 2
    g.ellipse({ x: node.x, y: node.y }, node.width, node.height, from, to).stroke()
  },
  start: function (node, x, y, config, g) {
    g.fillStyle(config.stroke)
    g.circle({ x: node.x, y: y + node.height / 2 }, node.height / 2.5).fill()
  },
  sync: function (node, x, y, config, g) {
    g.fillStyle(config.stroke)
    g.rect(x, y, node.width, node.height).fillAndStroke()
  },
  table: function (node, x, y, config, g) {
    g.rect(x, y, node.width, node.height).fillAndStroke()
  },
  transceiver: function (node, x, y, config, g) {
    g.circuit([
      { x: x - config.padding, y: y },
      { x: x + node.width - config.padding, y: y },
      { x: x + node.width, y: y + node.height / 2 },
      { x: x + node.width - config.padding, y: y + node.height },
      { x: x - config.padding, y: y + node.height },
      { x: x, y: y + node.height / 2 },
    ]).fillAndStroke()
  },
  component: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle
    const rx = 0; // rounded corner radius
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the component icon in the top right corner
    const iconWidth = 35;
    const iconHeight = 23;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Draw the component icon (rectangle with two tabs)
    g.fillStyle(config.fill[0]);
    g.rect(iconX, iconY, iconWidth, iconHeight).fillAndStroke();
    
    // Draw the tabs
    g.rect(iconX - 6, iconY + 3, 12, 7).fillAndStroke();
    g.rect(iconX - 6, iconY + 13, 12, 7).fillAndStroke();
  },
  device: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // here the device visual
    
    // Draw the main rounded rectangle (same as process)
    const rx = 15;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();

    // Device icon dimensions and position (80% of the original size)
    const iconScale = 0.8;
    const iconWidth = 30 * iconScale;
    const iconHeight = 20 * iconScale;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 10;

    // Draw the device body (rounded rectangle)
    g.roundRect(iconX, iconY, iconWidth, iconHeight, (rx / 2) * iconScale).fillAndStroke();

    // Draw the device "feet" (bottom path)
    const footHeight = 9 * iconScale;
    const footOffset = 7.5 * iconScale;
    const footLeftX = iconX + footOffset;
    const footRightX = iconX + iconWidth - footOffset;
    const footY = iconY + iconHeight;
    const footBottomY = footY + footHeight;

    g.path([
      { x: footLeftX, y: footY },
      { x: iconX, y: footBottomY },
      { x: iconX + iconWidth, y: footBottomY },
      { x: footRightX, y: footY }
    ]).fillAndStroke();

    
  },
  process: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 10;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the process icon (arrow)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Create points for the arrow
    const points = [
      // Shaft start (left)
      { x: iconX, y: iconY + iconHeight * 0.4 },
      // Shaft end (right)
      { x: iconX + iconWidth * 0.6, y: iconY + iconHeight * 0.4 },
      // Head upper point
      { x: iconX + iconWidth * 0.6, y: iconY + iconHeight * 0.15 },
      // Arrow tip
      { x: iconX + iconWidth, y: iconY + iconHeight * 0.5 },
      // Head lower point
      { x: iconX + iconWidth * 0.6, y: iconY + iconHeight * 0.85 },
      // Shaft end (right)
      { x: iconX + iconWidth * 0.6, y: iconY + iconHeight * 0.6 },
      // Shaft end (left)
      { x: iconX, y: iconY + iconHeight * 0.6 }
    ];
    
    // Draw the arrow icon
    g.circuit(points).fillAndStroke();
  },
  system_software: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the system software icon (two overlapping circles)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Calculate circle dimensions
    const radius = iconHeight/2 - 2;
    const centerY = iconY + iconHeight/2;
    
    // Draw two overlapping circles
    // Left circle
    const leftCenterX = iconX + radius + 2;
    g.circle({x: leftCenterX, y: centerY}, radius).fillAndStroke();
    
    // Right circle
    const rightCenterX = iconX + iconWidth - radius - 2;
    g.circle({x: rightCenterX, y: centerY}, radius).fillAndStroke();
  },
  communication_network: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the network icon (parallelogram with connection points)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Calculate points for the parallelogram shape
    const skewFactor = 0.4; // Controls the skew of the parallelogram
    const points = [
      { x: iconX, y: iconY + iconHeight }, // Bottom-left
      { x: iconX + iconWidth * (1 - skewFactor), y: iconY + iconHeight }, // Bottom-right
      { x: iconX + iconWidth, y: iconY }, // Top-right
      { x: iconX + iconWidth * skewFactor, y: iconY }, // Top-left
    ];
    
    // Draw the parallelogram outline
    g.circuit(points).fillAndStroke();
    
    // Draw connection points (dots) at each corner
    const dotRadius = 4;
    const dots = [
      { x: iconX + 2, y: iconY + iconHeight - 2 }, // Bottom-left
      { x: iconX + iconWidth * (1 - skewFactor) - 2, y: iconY + iconHeight - 2 }, // Bottom-right
      { x: iconX + iconWidth - 2, y: iconY + 2 }, // Top-right
      { x: iconX + iconWidth * skewFactor + 2, y: iconY + 2 }, // Top-left
    ];

    // Draw each connection point as a filled black circle
    dots.forEach(dot => {
      g.fillStyle('#000000');
      g.circle(dot, dotRadius).fill();
      g.strokeStyle('#000000');
      g.circle(dot, dotRadius).stroke();
    });
    
  },
  interface: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the interface icon (circle with line/socket)
    const iconWidth = 25;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Draw circle for interface
    g.circle({x: iconX + iconWidth/2, y: iconY + iconHeight/2}, iconWidth/2 - 2).fillAndStroke();
    
    // Draw a line extending to the left (the interface connection)
    g.path([
      {x: iconX, y: iconY + iconHeight/2},
      {x: iconX + iconWidth/2 - 2, y: iconY + iconHeight/2}
    ]).stroke();
  },
  collaboration: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the collaboration icon (two overlapping circles)
    const iconWidth = 30;
    const iconHeight = 20;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Calculate dimensions for the two circles
    const circleRadius = iconHeight/2 - 2;
    
    // Draw two overlapping circles
    
    g.circle({x: iconX + circleRadius + 2, y: iconY + iconHeight/2}, circleRadius).fillAndStroke();
    g.circle({x: iconX + iconWidth - circleRadius - 2, y: iconY + iconHeight/2}, circleRadius).fillAndStroke();
  },
  function: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 10;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the function icon (small hexagon with top peak and bottom notch)
    const iconWidth = 30;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Create points for the small function icon
    const points = [
      // Left slope start
      { x: iconX, y: iconY + iconHeight * 0.33 },
      // Top peak
      { x: iconX + iconWidth * 0.5, y: iconY },
      // Right slope end
      { x: iconX + iconWidth, y: iconY + iconHeight * 0.33 },
      // Right-hand bottom
      { x: iconX + iconWidth, y: iconY + iconHeight * 0.97 },
      // Bottom notch
      { x: iconX + iconWidth * 0.5, y: iconY + iconHeight * 0.66 },
      // Left-hand bottom
      { x: iconX, y: iconY + iconHeight * 0.97 }
    ];
    
    // Draw the polygon icon
    
    g.circuit(points).fillAndStroke();
  },
  artifact: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the artifact icon (document with folded corner)
    const iconWidth = 20;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Calculate folded corner size (about 1/3 of the icon width)
    const foldSize = iconWidth * 0.4;
    
    // Create points for the document shape with folded corner
    const points = [
      { x: iconX, y: iconY }, // Start at top-left
      { x: iconX + iconWidth - foldSize, y: iconY }, // Top edge until fold
      { x: iconX + iconWidth, y: iconY + foldSize }, // Fold diagonal
      { x: iconX + iconWidth, y: iconY + iconHeight }, // Right edge
      { x: iconX, y: iconY + iconHeight }, // Bottom edge
      { x: iconX, y: iconY } // Back to start
    ];
    
    // Draw the main document shape
    g.fillStyle(config.fill[0]);
    g.circuit(points).fillAndStroke();
    
    // Draw the folded corner triangle
    const foldPoints = [
      { x: iconX + iconWidth - foldSize, y: iconY },
      { x: iconX + iconWidth - foldSize, y: iconY + foldSize },
      { x: iconX + iconWidth, y: iconY + foldSize }
    ];
    
    g.circuit(foldPoints).fillAndStroke();
  },
  node: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the node icon (3D box with perspective)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Calculate 3D effect measurements
    const depth = 8; // The 3D depth effect
    
    // Draw the main face of the box
    const mainFace = [
      { x: iconX, y: iconY + depth }, // Top-left
      { x: iconX + iconWidth - depth, y: iconY + depth }, // Top-right
      { x: iconX + iconWidth - depth, y: iconY + iconHeight }, // Bottom-right
      { x: iconX, y: iconY + iconHeight }, // Bottom-left
      { x: iconX, y: iconY + depth } // Back to start
    ];
    g.circuit(mainFace).fillAndStroke();
    
    // Draw the top face (in perspective)
    const topFace = [
      { x: iconX, y: iconY + depth }, // Bottom-left
      { x: iconX + iconWidth - depth, y: iconY + depth }, // Bottom-right
      { x: iconX + iconWidth, y: iconY }, // Top-right
      { x: iconX + depth, y: iconY }, // Top-left
      { x: iconX, y: iconY + depth } // Back to start
    ];
    g.circuit(topFace).fillAndStroke();
    
    // Draw the right face (in perspective)
    const rightFace = [
      { x: iconX + iconWidth - depth, y: iconY + depth }, // Top-left
      { x: iconX + iconWidth, y: iconY }, // Top-right
      { x: iconX + iconWidth, y: iconY + iconHeight - depth }, // Bottom-right
      { x: iconX + iconWidth - depth, y: iconY + iconHeight }, // Bottom-left
    ];
    g.circuit(rightFace).fillAndStroke();
  },
  interaction: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the interaction icon (two half-circles with a gap)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 2;
    const iconY = y + 12;
    
    // Calculate dimensions for the half-circles
    const radius = iconHeight/2 - 2;
    const centerY = iconY + iconHeight/2;
    
    // Draw left half-circle
    
    
    // Create points for the left half-circle
    const leftCenterX = iconX + radius;
    const leftCenterY = centerY;
    
    // Generate points for the left half-circle
    const leftHalfCirclePoints = [];
    for (let i = 0; i <= 16; i++) {
      const angle = Math.PI/2 + (Math.PI * i) / 16;
      leftHalfCirclePoints.push({
        x: leftCenterX + radius * Math.cos(angle),
        y: leftCenterY + radius * Math.sin(angle)
      });
    }
    
    // Draw the left half-circle
    g.path(leftHalfCirclePoints).fillAndStroke();
    
    // Add stroke for the left side of the gap
    g.path([
      {x: leftCenterX, y: leftCenterY - radius},
      {x: leftCenterX, y: leftCenterY + radius}
    ]).stroke();
    
    // Create points for the right half-circle - moved closer to the left half-circle
    const gapSize = -14; // Smaller gap size
    const rightCenterX = leftCenterX + radius * 2 + gapSize;
    const rightCenterY = centerY;
    
    // Generate points for the right half-circle
    const rightHalfCirclePoints = [];
    for (let i = 0; i <= 16; i++) {
      const angle = -Math.PI/2 + (Math.PI * i) / 16;
      rightHalfCirclePoints.push({
        x: rightCenterX + radius * Math.cos(angle),
        y: rightCenterY + radius * Math.sin(angle)
      });
    }
    
    // Draw the right half-circle
    g.path(rightHalfCirclePoints).fillAndStroke();
    
    // Add stroke for the right side of the gap
    g.path([
      {x: rightCenterX, y: rightCenterY - radius},
      {x: rightCenterX, y: rightCenterY + radius}
    ]).stroke();
  },
  event: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the event icon (notched rectangle with right semicircle)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Create points for the event icon
    
    
    // Start with the notched rectangle part
    const notchDepth = iconHeight * 0.25;
    const rectWidth = iconWidth * 0.7;
    
    const points = [
      { x: iconX, y: iconY }, // Start at top-left
      { x: iconX + rectWidth, y: iconY }, // Top edge
    ];
    
    // Add points for the right semicircle
    const radius = iconHeight / 2;
    for (let i = 0; i <= 16; i++) {
      const angle = (-Math.PI/2) + (Math.PI * i) / 16;
      points.push({
        x: iconX + rectWidth + Math.cos(angle) * radius,
        y: iconY + iconHeight/2 + Math.sin(angle) * radius
      });
    }
    
    // Complete the shape
    points.push(
      { x: iconX + rectWidth, y: iconY + iconHeight }, // Bottom-right
      { x: iconX, y: iconY + iconHeight }, // Bottom-left
      { x: iconX + notchDepth, y: iconY + iconHeight/2 }, // Notch point
      { x: iconX, y: iconY } // Back to start
    );
    
    // Draw the event icon
    g.circuit(points).fillAndStroke();
  },
  service: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the service icon (pill shape - fully rounded rectangle)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Draw the pill shape
    
    g.roundRect(iconX, iconY, iconWidth, iconHeight, iconHeight/2).fillAndStroke();
  },
  data: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (same as component)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the data icon (rectangle with header separator)
    const iconWidth = 35;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 10;
    const iconY = y + 12;
    
    // Draw the main rectangle of the icon
    
    g.rect(iconX, iconY, iconWidth, iconHeight).fillAndStroke();
    
    // Draw the header separator line about 1/3 from the top
    const headerHeight = iconHeight * 0.35;
    g.path([
      { x: iconX, y: iconY + headerHeight },
      { x: iconX + iconWidth, y: iconY + headerHeight }
    ]).stroke();
  },
  object: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // "object" is a synonym of "data"
    visualizers.data(node, x, y, config, g);
  },
  application: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Use the same visualizer as component but with the application style
    visualizers.component(node, x, y, config, g);
  },
  business: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Use the same visualizer as component but with the business style
    visualizers.component(node, x, y, config, g);
  },
  technology: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Use the same visualizer as component but with the technology style
    visualizers.component(node, x, y, config, g);
  },
  role: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rounded rectangle (similar to other component types)
    const rx = 3;
    g.roundRect(x, y, node.width, node.height, rx).fillAndStroke();
    
    // Draw the role icon in the top right corner (cylinder/drum shape)
    const iconWidth = 40;
    const iconHeight = 25;
    const iconX = x + node.width - iconWidth - 5;
    const iconY = y + 8;
    
    // Set proportions to match the SVG example
    // Keep the proportion between rx and ry similar to the SVG (51:90 ratio)
    const ellipseRXRatio = 51/90;
    const ellipseRY = iconHeight / 2;
    const ellipseRX = ellipseRY * ellipseRXRatio;
    
    // Positions for the elements
    const leftCenterX = iconX + ellipseRX;
    const rightCenterX = iconX + iconWidth - ellipseRX;
    const centerY = iconY + iconHeight / 2;
    const rectWidth = rightCenterX - leftCenterX;
    
    // 1. Draw the middle rectangle (no stroke on sides)
    g.fillStyle(config.fill[0]);
    g.rect(leftCenterX, iconY, rectWidth, iconHeight).fill();
    
    // 2. Draw left half-ellipse
    const leftArcPoints = [];
    for (let i = 0; i <= 16; i++) {
      const angle = Math.PI/2 + (Math.PI * i) / 16;
      leftArcPoints.push({
        x: leftCenterX + ellipseRX * Math.cos(angle),
        y: centerY + ellipseRY * Math.sin(angle)
      });
    }
    g.path(leftArcPoints).fillAndStroke();
    
    // 3. Draw right half-ellipse
    const rightArcPoints = [];
    for (let i = 0; i <= 32; i++) {
      // Complete full ellipse on the right (0 to 2π)
      const angle = (2 * Math.PI * i) / 32;
      rightArcPoints.push({
        x: rightCenterX + ellipseRX * Math.cos(angle),
        y: centerY + ellipseRY * Math.sin(angle)
      });
    }
    g.path(rightArcPoints).fillAndStroke();
    
    // 4. Draw top and bottom lines of the rectangle
    g.path([
      { x: leftCenterX, y: iconY },
      { x: rightCenterX, y: iconY }
    ]).stroke();
    
    g.path([
      { x: leftCenterX, y: iconY + iconHeight },
      { x: rightCenterX, y: iconY + iconHeight }
    ]).stroke();
  },
  contract: (node: LayoutedNode, x: number, y: number, config: Config, g: Graphics) => {
    // Draw the main rectangle based on the SVG example
    g.roundRect(x, y, node.width, node.height, 0).fillAndStroke();
    
    // Draw the contract icon in the top right corner
    const iconWidth = 40;
    const iconHeight = 30;
    const iconX = x + node.width - iconWidth - 5;
    const iconY = y + 8;
    
    // Draw the contract icon (rectangle with two horizontal lines)
    g.fillStyle(config.fill[0]);
    g.rect(iconX, iconY, iconWidth, iconHeight).fillAndStroke();
    
    // Calculate positions for the two horizontal divider lines inside the icon
    // Using the same proportions as the SVG (60/188 and 128/188)
    const firstLineYIcon = iconY + iconHeight * (60/188);
    const secondLineYIcon = iconY + iconHeight * (128/188);
    
    // Draw the two horizontal divider lines inside the icon
    g.path([
      { x: iconX, y: firstLineYIcon },
      { x: iconX + iconWidth, y: firstLineYIcon }
    ]).stroke();
    
    g.path([
      { x: iconX, y: secondLineYIcon },
      { x: iconX + iconWidth, y: secondLineYIcon }
    ]).stroke();
    
   
  }
}

function handleEvent(e: MouseEvent | TouchEvent): void {
  e.preventDefault();
  e.stopPropagation();
  
  if (e instanceof MouseEvent) {
    // Handle mouse events
    // ... existing mouse event handling code ...
  } else if (e instanceof TouchEvent) {
    // Handle touch events
    // ... existing touch event handling code ...
  }
}
