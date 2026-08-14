// 绘制工具逻辑：铅笔 / 橡皮 / 油漆桶 / 取色器 / 去色块

export const TOOLS = {
  pencil: { id: 'pencil', name: '铅笔', key: 'B' },
  eraser: { id: 'eraser', name: '橡皮', key: 'E' },
  fill: { id: 'fill', name: '油漆桶', key: 'G' },
  picker: { id: 'picker', name: '取色器', key: 'I' },
  removeColor: { id: 'removeColor', name: '去色块', key: 'R' },
  edgeClean: { id: 'edgeClean', name: '边缘修复', key: 'F' },
}

export const TOOL_ORDER = ['pencil', 'eraser', 'fill', 'picker', 'removeColor', 'edgeClean']

// 对称模式
export const SYMMETRY = {
  none: { id: 'none', name: '关闭' },
  vertical: { id: 'vertical', name: '左右对称' },
  horizontal: { id: 'horizontal', name: '上下对称' },
  both: { id: 'both', name: '十字对称' },
}

export const SYMMETRY_ORDER = ['none', 'vertical', 'horizontal', 'both']

/**
 * 计算 (x,y) 在对称模式下的全部镜像点（含自身）
 * @param {number} x y
 * @param {number} w h 画布宽高
 * @param {string} axis none|vertical|horizontal|both
 * @returns {Array<[number, number]>}
 */
export function symmetricPoints(x, y, w, h, axis) {
  const pts = [[x, y]]
  if (axis === 'vertical' || axis === 'both') pts.push([w - 1 - x, y])
  if (axis === 'horizontal' || axis === 'both') pts.push([x, h - 1 - y])
  if (axis === 'both') pts.push([w - 1 - x, h - 1 - y])
  return pts
}

/**
 * 方形笔刷绘制：以 (cx,cy) 为中心画 size×size 像素块（含对称镜像）
 * 偶数尺寸以锚点 (cx - (size-1)/2) 起画，保证覆盖 size 个像素
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} cx cy 中心像素坐标
 * @param {number} size 笔刷边长（像素格，>=1）
 * @param {number} color 颜色（Uint32）
 * @param {string} axis 对称模式
 */
export function paintBrush(model, cx, cy, size, color, axis) {
  const w = model.width
  const h = model.height
  const x0 = cx - Math.floor((size - 1) / 2)
  const y0 = cy - Math.floor((size - 1) / 2)
  const x1 = cx + Math.floor(size / 2)
  const y1 = cy + Math.floor(size / 2)
  for (let py = y0; py <= y1; py++) {
    if (py < 0 || py >= h) continue
    for (let px = x0; px <= x1; px++) {
      if (px < 0 || px >= w) continue
      for (const [mx, my] of symmetricPoints(px, py, w, h, axis)) {
        model.setPixel(mx, my, color)
      }
    }
  }
}

/**
 * 画两点之间的线（逐像素步进，供铅笔/橡皮拖拽使用）
 * @param {(x:number, y:number) => void} draw 绘制回调
 * @param {number} x0 y0 x1 y1 像素坐标
 */
export function drawLine(draw, x0, y0, x1, y1) {
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy
  let x = x0
  let y = y0
  for (;;) {
    draw(x, y)
    if (x === x1 && y === y1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
}

/**
 * 油漆桶：BFS 泛洪填充，返回填充像素数
 */
export function floodFill(model, x, y, fillColor) {
  const target = model.getPixel(x, y)
  if (target === fillColor) return 0
  const { width, height, data } = model
  const stack = [x, y]
  let count = 0
  while (stack.length) {
    const cy = stack.pop()
    const cx = stack.pop()
    if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue
    const i = cy * width + cx
    if (data[i] !== target) continue
    data[i] = fillColor
    count++
    stack.push(cx + 1, cy, cx - 1, cy, cx, cy + 1, cx, cy - 1)
  }
  return count
}

// 油漆桶跨行优化版（扫描线泛洪填充），避免 BFS 在大面积填充时栈过大
export function floodFillScanline(model, x, y, fillColor) {
  const target = model.getPixel(x, y)
  if (target === fillColor) return 0
  const { width, height, data } = model
  const queue = [[x, y]]
  let count = 0
  while (queue.length) {
    const [sx, sy] = queue.pop()
    let left = sx
    while (left >= 0 && data[sy * width + left] === target) left--
    left++
    let right = sx
    while (right < width && data[sy * width + right] === target) right++
    right--
    for (let cx = left; cx <= right; cx++) {
      data[sy * width + cx] = fillColor
      count++
    }
    // 检查上下行
    for (let ny = sy - 1; ny <= sy + 1; ny += 2) {
      if (ny < 0 || ny >= height) continue
      let inSpan = false
      for (let cx = left; cx <= right; cx++) {
        if (data[ny * width + cx] === target) {
          if (!inSpan) {
            queue.push([cx, ny])
            inSpan = true
          }
        } else {
          inSpan = false
        }
      }
    }
  }
  return count
}

/**
 * 取色：返回像素颜色（Uint32）
 */
export function pickColor(model, x, y) {
  return model.getPixel(x, y)
}

/**
 * 去除色块：消除当前帧中所有与指定颜色相同的像素（变为透明）
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} color 要消除的颜色（Uint32）
 * @returns {number} 消除的像素数量
 */
export function removeColor(model, color) {
  let count = 0
  const data = model.data
  for (let i = 0; i < data.length; i++) {
    if (data[i] === color) {
      data[i] = 0
      count++
    }
  }
  return count
}

/**
 * 按连通区域去除色块：只清除与 (x,y) 四连通的同色区域（变为透明）
 * 复用扫描线泛洪填充，填充目标为透明色。
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} x y 目标像素坐标
 * @returns {number} 清除的像素数量
 */
export function removeColorRegion(model, x, y) {
  return floodFillScanline(model, x, y, 0)
}

/**
 * 带容差的颜色匹配：色差 ≤ tolerance 视为同一颜色
 */
function colorMatch(c1, c2, tolerance) {
  if (tolerance <= 0) return c1 === c2
  if (c1 === c2) return true
  const r1 = c1 & 0xff
  const g1 = (c1 >>> 8) & 0xff
  const b1 = (c1 >>> 16) & 0xff
  const r2 = c2 & 0xff
  const g2 = (c2 >>> 8) & 0xff
  const b2 = (c2 >>> 16) & 0xff
  const dr = r1 - r2
  const dg = g1 - g2
  const db = b1 - b2
  return dr * dr + dg * dg + db * db <= tolerance * tolerance
}

/**
 * 容差去除色块：消除当前帧中所有与指定颜色"相近"（色差 ≤ tolerance）的像素
 * tolerance = 0 时与 removeColor 完全一致（精确匹配）
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} color 目标颜色
 * @param {number} tolerance 容差（0 = 精确）
 * @returns {number} 清除的像素数量
 */
export function removeColorTolerance(model, color, tolerance) {
  let count = 0
  const data = model.data
  for (let i = 0; i < data.length; i++) {
    if (colorMatch(data[i], color, tolerance)) {
      data[i] = 0
      count++
    }
  }
  return count
}

/**
 * 容差连通区域去除：只清除与 (x,y) 色差 ≤ tolerance 的四连通区域（BFS）
 * tolerance = 0 时与 removeColorRegion 等价
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} x y 目标像素坐标
 * @param {number} tolerance 容差（0 = 精确）
 * @returns {number} 清除的像素数量
 */
export function removeColorRegionTolerance(model, x, y, tolerance) {
  const w = model.width
  const h = model.height
  const target = model.getPixel(x, y)
  if (target === 0) return 0
  const data = model.data
  const visited = new Uint8Array(data.length)
  const stack = [[x, y]]
  visited[y * w + x] = 1
  let count = 0
  while (stack.length) {
    const [cx, cy] = stack.pop()
    const i = cy * w + cx
    if (!colorMatch(data[i], target, tolerance)) continue
    data[i] = 0
    count++
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const ni = ny * w + nx
      if (visited[ni]) continue
      visited[ni] = 1
      if (colorMatch(data[ni], target, tolerance)) stack.push([nx, ny])
    }
  }
  return count
}

/**
 * 边缘去杂色：从画布四周边界向内做容差泛洪，删除"与边缘连通且颜色相近"的区域（背景抠除）。
 * - 起点为边界上所有非透明像素，向内部 4 连通蔓延；
 * - 蔓延基准为"相邻已删除像素的颜色"（逐像素传播），渐变/近似色背景也能整片清除；
 * - 内部与边缘不连通的相近色区域不受影响（不会误删内部）；
 * - tolerance = 0 时仅清除与边缘连通且颜色完全相同的像素。
 * 局限：前景主体若贴到画布边缘会被当作背景误删，建议内容留边。
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @param {number} tolerance 容差（0 = 精确）
 * @returns {number} 清除的像素数量
 */
export function removeEdgeBackground(model, tolerance) {
  const w = model.width
  const h = model.height
  const data = model.data
  const visited = new Uint8Array(data.length)
  const stack = []
  // 边界入栈：第 0 行 / 最后一行 / 第 0 列 / 最后一列 的非透明像素
  for (let x = 0; x < w; x++) {
    if (data[x] !== 0) {
      visited[x] = 1
      stack.push([x, 0])
    }
    if (h > 1) {
      const bi = (h - 1) * w + x
      if (data[bi] !== 0) {
        visited[bi] = 1
        stack.push([x, h - 1])
      }
    }
  }
  for (let y = 1; y < h - 1; y++) {
    const li = y * w
    if (data[li] !== 0) {
      visited[li] = 1
      stack.push([0, y])
    }
    if (w > 1) {
      const ri = y * w + (w - 1)
      if (data[ri] !== 0) {
        visited[ri] = 1
        stack.push([w - 1, y])
      }
    }
  }
  let count = 0
  while (stack.length) {
    const [cx, cy] = stack.pop()
    const i = cy * w + cx
    const c = data[i]
    if (c === 0) continue
    data[i] = 0
    count++
    for (const [nx, ny] of [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const ni = ny * w + nx
      if (visited[ni]) continue
      visited[ni] = 1
      if (data[ni] !== 0 && colorMatch(data[ni], c, tolerance)) stack.push([nx, ny])
    }
  }
  return count
}

/**
 * 边缘颜色统一（去白边/去色边）：把物体轮廓最外一圈的颜色改成相邻主体色。
 * - 边缘像素 = 非透明且 4 邻域存在透明（或画布外侧）的像素；
 * - 新颜色取 8 邻域中"内部像素"（非边缘非透明）出现最多的颜色，无内部邻居时退化为任意非透明邻居的多数色；
 * - 只处理当前最外一圈；重复执行可逐圈向内统一（内圈若已是主体色则颜色不变）。
 * @param {import('./canvasModel.js').PixelCanvas} model
 * @returns {number} 改动的像素数量
 */
export function unifyEdgeColor(model) {
  const w = model.width
  const h = model.height
  const data = model.data
  const n = data.length
  const isEdge = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (data[i] === 0) continue
      for (const [nx, ny] of [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || data[ny * w + nx] === 0) {
          isEdge[i] = 1
          break
        }
      }
    }
  }
  const fixes = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      if (!isEdge[i]) continue
      const inner = []
      const any = []
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (data[ni] === 0) continue
          any.push(data[ni])
          if (!isEdge[ni]) inner.push(data[ni])
        }
      }
      const src = inner.length ? inner : any
      if (!src.length) continue
      const counts = new Map()
      let best = src[0]
      let bestN = 0
      for (const c of src) {
        const cn = (counts.get(c) || 0) + 1
        counts.set(c, cn)
        if (cn > bestN) {
          bestN = cn
          best = c
        }
      }
      if (best !== data[i]) fixes.push([i, best])
    }
  }
  for (const [i, c] of fixes) data[i] = c
  return fixes.length
}
