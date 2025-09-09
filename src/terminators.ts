import { Config } from './domain'
import { Graphics } from './Graphics'
import { LayoutedAssoc } from './layouter'
import { last, range } from './util'
import { Vec, diff, normalize, add, mult, rot } from './vector'

const empty = false
const filled = true

export function getPath(config: Config, r: LayoutedAssoc): Vec[] {
  // Use the orthogonal path provided by the layouter (ports + rays already included)
  return r.path!.slice(1, -1)
}

function terminatorSize(id: string): number {
  if (id === '>' || id === '<') return 5
  if (id === ':>' || id === '<:') return 10
  if (id === '+') return 14
  if (id === 'o') return 14
  if (id === '(' || id === ')') return 11
  if (id === '(o' || id === 'o)') return 11
  if (id === '>o' || id === 'o<') return 15
  if (id === '|>' || id === '<|') return 10
  return 0
}

export function drawTerminators(
  g: Graphics,
  config: Config,
  r: LayoutedAssoc,
  drawnPath?: Vec[]
) {
  // Prefer the actually drawn path so marker direction is collinear
  const path = drawnPath ? drawnPath.slice() : r.path!.slice(1, -1)
  const start = drawnPath ? path[0] : r.path![1]
  const end = drawnPath ? last(path) : r.path![r.path!.length - 2]

  const tokens = r.type.split(/[-_]/)
  // End marker uses forward path
  drawArrowEnd(last(tokens), path, end)
  // Start marker uses reversed path for direction at the start
  drawArrowEnd(tokens[0], path.slice().reverse(), start)

  function drawArrowEnd(id: string, path: Vec[], end: Vec) {
    const dir = normalize(diff(path[path.length - 2], last(path)))
    const size = (config.spacing * config.arrowSize) / 30
    if (id === '>' || id === '<') drawArrow(dir, size, filled, end)
    else if (id === ':>' || id === '<:') drawArrow(dir, size, empty, end)
    else if (id === '+') drawDiamond(dir, size, filled, end)
    else if (id === 'o') drawDiamond(dir, size, empty, end)
    else if (id === '(' || id === ')') {
      drawSocket(dir, size, 11, end)
      drawStem(dir, size, 5, end)
    } else if (id === '(o' || id === 'o)') {
      drawSocket(dir, size, 11, end)
      drawStem(dir, size, 5, end)
      drawBall(dir, size, 11, end)
    } else if (id === '>o' || id === 'o<') {
      drawArrow(dir, size * 0.75, empty, add(end, mult(dir, size * 10)))
      drawStem(dir, size, 8, end)
      drawBall(dir, size, 8, end)
    } else if (id === '|>' || id === '<|') {
      drawClosedTriangle(dir, size, end)
    } else if (id === '.') {
      drawDot(dir, size, end)
    }
  }

  function drawBall(nv: Vec, size: number, stem: number, end: Vec) {
    const center = add(end, mult(nv, size * stem))
    g.fillStyle(config.fill[0])
    g.ellipse(center, size * 6, size * 6).fillAndStroke()
  }

  function drawStem(nv: Vec, size: number, stem: number, end: Vec) {
    const center = add(end, mult(nv, size * stem))
    g.path([center, end]).stroke()
  }

  function drawSocket(nv: Vec, size: number, stem: number, end: Vec) {
    const base = add(end, mult(nv, size * stem))
    const t = rot(nv)
    const socket = range([-Math.PI / 2, Math.PI / 2], 12).map((a) =>
      add(base, add(mult(nv, -6 * size * Math.cos(a)), mult(t, 6 * size * Math.sin(a))))
    )
    g.path(socket).stroke()
  }

  function drawArrow(nv: Vec, size: number, isOpen: boolean, end: Vec) {
    const x = (s: number) => add(end, mult(nv, s * size))
    const y = (s: number) => mult(rot(nv), s * size)
    const arrow = [
      add(x(10), y(4)),
      x(isOpen && !config.fillArrows ? 5 : 10),
      add(x(10), y(-4)),
      end,
    ]
    g.save()
    g.fillStyle(isOpen ? config.stroke : config.fill[0])
    g.circuit(arrow).fillAndStroke()
    g.restore()
  }

  function drawDiamond(nv: Vec, size: number, isOpen: boolean, end: Vec) {
    const x = (s: number) => add(end, mult(nv, s * size))
    const y = (s: number) => mult(rot(nv), s * size)
    const arrow = [add(x(7), y(4)), x(14), add(x(7), y(-4)), end]
    g.save()
    g.fillStyle(isOpen ? config.stroke : config.fill[0])
    g.circuit(arrow).fillAndStroke()
    g.restore()
  }

  function drawClosedTriangle(nv: Vec, size: number, end: Vec) {
    const x = (s: number) => add(end, mult(nv, s * size))
    const y = (s: number) => mult(rot(nv), s * size)
    const arrow = [
      add(x(10), y(4)),
      x(10),
      add(x(10), y(-4)),
      end,
    ]
    g.save()
    g.fillStyle(config.stroke)
    g.circuit(arrow).fillAndStroke()
    g.restore()
  }

  function drawDot(nv: Vec, size: number, end: Vec) {
    const center = add(end, mult(nv, size * 4))
    g.save()
    g.fillStyle(config.stroke)
    g.circle(center, size * 2).fillAndStroke()
    g.restore()
  }
}
