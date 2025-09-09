import { Vec } from './vector'

export interface Rect {
  left: number
  right: number
  top: number
  bottom: number
}

export type Direction = 'LR' | 'TB'

function rectContainsPoint(r: Rect, p: Vec): boolean {
  return p.x > r.left && p.x < r.right && p.y > r.top && p.y < r.bottom
}

function segmentIntersectsRect(p1: Vec, p2: Vec, r: Rect): boolean {
  // Only axis-aligned segments are expected
  if (p1.x === p2.x) {
    const x = p1.x
    if (x <= r.left || x >= r.right) return false
    const minY = Math.min(p1.y, p2.y)
    const maxY = Math.max(p1.y, p2.y)
    return !(maxY <= r.top || minY >= r.bottom)
  } else if (p1.y === p2.y) {
    const y = p1.y
    if (y <= r.top || y >= r.bottom) return false
    const minX = Math.min(p1.x, p2.x)
    const maxX = Math.max(p1.x, p2.x)
    return !(maxX <= r.left || minX >= r.right)
  }
  // Should not happen
  return false
}

function segmentCrossesAny(p1: Vec, p2: Vec, obstacles: Rect[]): boolean {
  for (const r of obstacles) {
    if (segmentIntersectsRect(p1, p2, r)) return true
  }
  return false
}

function uniqueSorted(nums: number[]): number[] {
  const set = new Set<number>(nums.map((n) => Math.round(n * 10) / 10))
  return Array.from(set).sort((a, b) => a - b)
}

function simplify(path: Vec[]): Vec[] {
  if (path.length <= 2) return path
  const out: Vec[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const a = out[out.length - 1]
    const b = path[i]
    const c = path[i + 1]
    if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) continue
    out.push(b)
  }
  out.push(path[path.length - 1])
  return out
}

function manhattan(a: Vec, b: Vec): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

interface NodeKey {
  x: number
  y: number
}

function keyOf(p: Vec): string {
  return `${p.x},${p.y}`
}

export type Side = 'left' | 'right' | 'top' | 'bottom'

export interface PortSelection {
  startPort: Vec
  endPort: Vec
  startSide: Side
  endSide: Side
}

export function choosePorts(
  aCenter: Vec,
  aSize: { w: number; h: number },
  bCenter: Vec,
  bSize: { w: number; h: number },
  dir: Direction
): PortSelection {
  const aLeft = { x: aCenter.x - aSize.w / 2, y: aCenter.y }
  const aRight = { x: aCenter.x + aSize.w / 2, y: aCenter.y }
  const aTop = { x: aCenter.x, y: aCenter.y - aSize.h / 2 }
  const aBottom = { x: aCenter.x, y: aCenter.y + aSize.h / 2 }

  const bLeft = { x: bCenter.x - bSize.w / 2, y: bCenter.y }
  const bRight = { x: bCenter.x + bSize.w / 2, y: bCenter.y }
  const bTop = { x: bCenter.x, y: bCenter.y - bSize.h / 2 }
  const bBottom = { x: bCenter.x, y: bCenter.y + bSize.h / 2 }

  const candidates: { sp: Vec; ep: Vec; sside: Side; eside: Side; cost: number }[] = []
  const cands = [
    { sp: aRight, ep: bLeft, sside: 'right' as Side, eside: 'left' as Side },
    { sp: aLeft, ep: bRight, sside: 'left' as Side, eside: 'right' as Side },
    { sp: aBottom, ep: bTop, sside: 'bottom' as Side, eside: 'top' as Side },
    { sp: aTop, ep: bBottom, sside: 'top' as Side, eside: 'bottom' as Side },
  ]
  for (const c of cands) candidates.push({ ...c, cost: manhattan(c.sp, c.ep) })

  // Prefer along direction
  if (dir === 'LR') {
    candidates.sort((u, v) => {
      const bias = (p: { sp: Vec; ep: Vec; sside: Side; eside: Side }) =>
        (p.sside === 'right' && p.eside === 'left' ? -1000 : 0) + u.cost
      return bias(u) - bias(v)
    })
  } else {
    candidates.sort((u, v) => {
      const bias = (p: { sp: Vec; ep: Vec; sside: Side; eside: Side }) =>
        (p.sside === 'bottom' && p.eside === 'top' ? -1000 : 0) + u.cost
      return bias(u) - bias(v)
    })
  }

  const best = candidates[0]
  return { startPort: best.sp, endPort: best.ep, startSide: best.sside, endSide: best.eside }
}

export function routeOrthogonal(
  startPort: Vec,
  endPort: Vec,
  obstacles: Rect[]
): Vec[] {
  // Build visibility grid from obstacle edges and ports
  const xs: number[] = [startPort.x, endPort.x]
  const ys: number[] = [startPort.y, endPort.y]
  for (const r of obstacles) {
    xs.push(r.left, r.right)
    ys.push(r.top, r.bottom)
  }
  const X = uniqueSorted(xs)
  const Y = uniqueSorted(ys)

  // Build vertices (outside all obstacles)
  const vertices: Vec[] = []
  for (const x of X) {
    for (const y of Y) {
      const p = { x, y }
      let inside = false
      for (const r of obstacles) {
        if (rectContainsPoint(r, p)) {
          inside = true
          break
        }
      }
      if (!inside) vertices.push(p)
    }
  }

  const neighbors = new Map<string, Vec[]>()
  // vertical neighbors along same X
  for (const x of X) {
    const col = vertices.filter((v) => v.x === x).sort((a, b) => a.y - b.y)
    for (let i = 0; i < col.length - 1; i++) {
      const a = col[i]
      const b = col[i + 1]
      if (!segmentCrossesAny(a, b, obstacles)) {
        const ak = keyOf(a)
        const bk = keyOf(b)
        if (!neighbors.has(ak)) neighbors.set(ak, [])
        if (!neighbors.has(bk)) neighbors.set(bk, [])
        neighbors.get(ak)!.push(b)
        neighbors.get(bk)!.push(a)
      }
    }
  }
  // horizontal neighbors along same Y
  for (const y of Y) {
    const row = vertices.filter((v) => v.y === y).sort((a, b) => a.x - b.x)
    for (let i = 0; i < row.length - 1; i++) {
      const a = row[i]
      const b = row[i + 1]
      if (!segmentCrossesAny(a, b, obstacles)) {
        const ak = keyOf(a)
        const bk = keyOf(b)
        if (!neighbors.has(ak)) neighbors.set(ak, [])
        if (!neighbors.has(bk)) neighbors.set(bk, [])
        neighbors.get(ak)!.push(b)
        neighbors.get(bk)!.push(a)
      }
    }
  }

  // A*
  const startKey = keyOf(startPort)
  const goalKey = keyOf(endPort)
  const openSet = new Set<string>([startKey])
  const cameFrom = new Map<string, string>()
  const gScore = new Map<string, number>([[startKey, 0]])
  const fScore = new Map<string, number>([[startKey, manhattan(startPort, endPort)]])

  function reconstruct(current: string): Vec[] {
    const out: Vec[] = []
    let cur = current
    while (cur) {
      const [x, y] = cur.split(',').map(Number)
      out.push({ x, y })
      const prev = cameFrom.get(cur)
      if (!prev) break
      cur = prev
    }
    return out.reverse()
  }

  while (openSet.size) {
    // node with lowest fScore
    let current: string | undefined
    let lowest = Infinity
    for (const k of openSet) {
      const f = fScore.get(k) ?? Infinity
      if (f < lowest) {
        lowest = f
        current = k
      }
    }
    if (!current) break
    if (current === goalKey) {
      return simplify(reconstruct(current))
    }
    openSet.delete(current)
    const [cx, cy] = current.split(',').map(Number)
    const curP = { x: cx, y: cy }
    const neigh = neighbors.get(current) || []
    for (const nb of neigh) {
      const nk = keyOf(nb)
      const tentative = (gScore.get(current) ?? Infinity) + manhattan(curP, nb)
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, current)
        gScore.set(nk, tentative)
        fScore.set(nk, tentative + manhattan(nb, endPort))
        openSet.add(nk)
      }
    }
  }

  // Fallback: simple elbow via mid-line
  const mid = { x: startPort.x, y: endPort.y }
  const alt = { x: endPort.x, y: startPort.y }
  const try1 = !segmentCrossesAny(startPort, mid, obstacles) &&
    !segmentCrossesAny(mid, endPort, obstacles)
  if (try1) return simplify([startPort, mid, endPort])
  const try2 = !segmentCrossesAny(startPort, alt, obstacles) &&
    !segmentCrossesAny(alt, endPort, obstacles)
  if (try2) return simplify([startPort, alt, endPort])
  // Last resort: straight line (will overlap if unavoidable)
  if (Math.abs(startPort.x - endPort.x) < Math.abs(startPort.y - endPort.y))
    return simplify([{ x: startPort.x, y: startPort.y }, { x: startPort.x, y: endPort.y }, endPort])
  else
    return simplify([{ x: startPort.x, y: startPort.y }, { x: endPort.x, y: startPort.y }, endPort])
}

export function routeWithRays(
  aCenter: Vec,
  aSize: { w: number; h: number },
  bCenter: Vec,
  bSize: { w: number; h: number },
  dir: Direction,
  obstacles: Rect[],
  margin: number
): { full: Vec[]; startPort: Vec; endPort: Vec } {
  const { startPort, endPort, startSide, endSide } = choosePorts(aCenter, aSize, bCenter, bSize, dir)

  // Compute ray points just outside the node boxes
  const aLeft = aCenter.x - aSize.w / 2
  const aRight = aCenter.x + aSize.w / 2
  const aTop = aCenter.y - aSize.h / 2
  const aBottom = aCenter.y + aSize.h / 2

  const bLeft = bCenter.x - bSize.w / 2
  const bRight = bCenter.x + bSize.w / 2
  const bTop = bCenter.y - bSize.h / 2
  const bBottom = bCenter.y + bSize.h / 2

  const startRay: Vec = { x: startPort.x, y: startPort.y }
  if (startSide === 'left') startRay.x = aLeft - margin
  if (startSide === 'right') startRay.x = aRight + margin
  if (startSide === 'top') startRay.y = aTop - margin
  if (startSide === 'bottom') startRay.y = aBottom + margin

  const endRay: Vec = { x: endPort.x, y: endPort.y }
  if (endSide === 'left') endRay.x = bLeft - margin
  if (endSide === 'right') endRay.x = bRight + margin
  if (endSide === 'top') endRay.y = bTop - margin
  if (endSide === 'bottom') endRay.y = bBottom + margin

  const mid = routeOrthogonal(startRay, endRay, obstacles)
  const full = simplify([startPort, startRay, ...mid, endRay, endPort])
  return { full, startPort, endPort }
}

function portForSide(center: Vec, size: { w: number; h: number }, side: Side): Vec {
  if (side === 'left') return { x: center.x - size.w / 2, y: center.y }
  if (side === 'right') return { x: center.x + size.w / 2, y: center.y }
  if (side === 'top') return { x: center.x, y: center.y - size.h / 2 }
  return { x: center.x, y: center.y + size.h / 2 }
}

function pathLength(p: Vec[]): number {
  let s = 0
  for (let i = 1; i < p.length; i++) s += manhattan(p[i - 1], p[i])
  return s
}

export function routeBestWithRays(
  aCenter: Vec,
  aSize: { w: number; h: number },
  bCenter: Vec,
  bSize: { w: number; h: number },
  dir: Direction,
  obstacles: Rect[],
  margin: number
): { full: Vec[]; startPort: Vec; endPort: Vec } {
  const pairs: Array<{ s: Side; e: Side }> = [
    { s: 'right', e: 'left' },
    { s: 'left', e: 'right' },
    { s: 'bottom', e: 'top' },
    { s: 'top', e: 'bottom' },
  ]

  let best: { full: Vec[]; startPort: Vec; endPort: Vec } | null = null
  let bestLen = Infinity
  for (const pair of pairs) {
    const sp = portForSide(aCenter, aSize, pair.s)
    const ep = portForSide(bCenter, bSize, pair.e)

    // Rays
    const aLeft = aCenter.x - aSize.w / 2
    const aRight = aCenter.x + aSize.w / 2
    const aTop = aCenter.y - aSize.h / 2
    const aBottom = aCenter.y + aSize.h / 2
    const bLeft = bCenter.x - bSize.w / 2
    const bRight = bCenter.x + bSize.w / 2
    const bTop = bCenter.y - bSize.h / 2
    const bBottom = bCenter.y + bSize.h / 2

    const sr: Vec = { x: sp.x, y: sp.y }
    if (pair.s === 'left') sr.x = aLeft - margin
    if (pair.s === 'right') sr.x = aRight + margin
    if (pair.s === 'top') sr.y = aTop - margin
    if (pair.s === 'bottom') sr.y = aBottom + margin

    const er: Vec = { x: ep.x, y: ep.y }
    if (pair.e === 'left') er.x = bLeft - margin
    if (pair.e === 'right') er.x = bRight + margin
    if (pair.e === 'top') er.y = bTop - margin
    if (pair.e === 'bottom') er.y = bBottom + margin

    const mid = routeOrthogonal(sr, er, obstacles)
    const full = simplify([sp, sr, ...mid, er, ep])
    const len = pathLength(full)
    if (len < bestLen) {
      best = { full, startPort: sp, endPort: ep }
      bestLen = len
    }
  }
  // Fallback to a single-port choice if everything failed (shouldn't happen)
  if (!best) return routeWithRays(aCenter, aSize, bCenter, bSize, dir, obstacles, margin)
  return best
}
