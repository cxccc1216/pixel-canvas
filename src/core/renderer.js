// 渲染器：把像素模型绘制到 canvas，支持缩放/平移/网格/洋葱皮/对称轴提示/主题
export class Renderer {
  constructor(canvas, model) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.model = model
    this.zoom = 16
    this.offsetX = 0
    this.offsetY = 0
    this.showGrid = true
    this.symmetry = 'none' // none|vertical|horizontal|both
    this.onionPrev = false // 洋葱皮：前一帧
    this.onionNext = false // 洋葱皮：后一帧
    // 主题相关颜色（setTheme 时从 CSS 变量读取，与 UI 保持一致）
    this.checkerBg = '#ffffff'
    this.checkerCell = '#f0f0f0'
    this.gridColor = 'rgba(120, 130, 150, 0.35)'
    this.imageData = null
    this.u32 = null
    this.onionImageData = null
    this.onionU32 = null
  }

  /** 根据主题从 CSS 变量同步画布配色 */
  setTheme() {
    const cs = getComputedStyle(document.documentElement)
    const read = (name, fallback) => {
      const v = cs.getPropertyValue(name).trim()
      return v || fallback
    }
    this.checkerBg = read('--checker-bg', '#ffffff')
    this.checkerCell = read('--checker-cell', '#f0f0f0')
    const isDark = document.documentElement.dataset.theme === 'dark'
    this.gridColor = isDark ? 'rgba(200, 208, 220, 0.26)' : 'rgba(120, 130, 150, 0.35)'
  }

  _ensureBuffers() {
    const { width, height } = this.model
    if (!this.imageData || this.imageData.width !== width || this.imageData.height !== height) {
      this.imageData = this.ctx.createImageData(width, height)
      this.u32 = new Uint32Array(this.imageData.data.buffer)
      this.onionImageData = this.ctx.createImageData(width, height)
      this.onionU32 = new Uint32Array(this.onionImageData.data.buffer)
    }
  }

  setModel(model) {
    this.model = model
    this._ensureBuffers()
    this.render()
  }

  render() {
    const { ctx, canvas, model } = this
    const w = model.width
    const h = model.height
    const zoom = this.zoom
    const ox = this.offsetX
    const oy = this.offsetY
    this._ensureBuffers()

    // 1. 清空 + 棋盘格背景（颜色随主题）
    ctx.fillStyle = this.checkerBg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    const cell = 10
    ctx.fillStyle = this.checkerCell
    for (let gy = 0; gy * cell < h * zoom + 2; gy++) {
      for (let gx = 0; gx * cell < w * zoom + 2; gx++) {
        if ((gx + gy) % 2 === 0) continue
        const px = ox + gx * cell
        const py = oy + gy * cell
        ctx.fillRect(px, py, cell, cell)
      }
    }
    ctx.imageSmoothingEnabled = false

    // 2. 洋葱皮帧（半透明叠加，画在当前帧之下）
    if ((this.onionPrev || this.onionNext) && model.frames.length > 1) {
      const prevIdx = model.currentFrame - 1
      const nextIdx = model.currentFrame + 1
      const drawOnion = (idx, alpha) => {
        if (idx < 0 || idx >= model.frames.length) return
        this.onionU32.set(model.frames[idx])
        ctx.putImageData(this.onionImageData, 0, 0)
        ctx.globalAlpha = alpha
        ctx.drawImage(canvas, 0, 0, w, h, ox, oy, w * zoom, h * zoom)
        ctx.globalAlpha = 1
      }
      if (this.onionPrev) drawOnion(prevIdx, 0.32)
      if (this.onionNext) drawOnion(nextIdx, 0.18)
    }

    // 3. 当前帧
    this.u32.set(model.data)
    ctx.putImageData(this.imageData, 0, 0)
    ctx.drawImage(canvas, 0, 0, w, h, ox, oy, w * zoom, h * zoom)

    // 4. 对称轴提示线
    if (this.symmetry !== 'none') {
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      if (this.symmetry === 'vertical' || this.symmetry === 'both') {
        const ax = ox + (w / 2) * zoom
        ctx.beginPath()
        ctx.moveTo(ax, oy)
        ctx.lineTo(ax, oy + h * zoom)
        ctx.stroke()
      }
      if (this.symmetry === 'horizontal' || this.symmetry === 'both') {
        const ay = oy + (h / 2) * zoom
        ctx.beginPath()
        ctx.moveTo(ox, ay)
        ctx.lineTo(ox + w * zoom, ay)
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // 5. 网格线
    if (this.showGrid && zoom >= 6) {
      ctx.strokeStyle = this.gridColor
      ctx.lineWidth = 1
      ctx.beginPath()
      for (let gx = 0; gx <= w; gx++) {
        const px = Math.round(ox + gx * zoom) + 0.5
        ctx.moveTo(px, oy)
        ctx.lineTo(px, oy + h * zoom)
      }
      for (let gy = 0; gy <= h; gy++) {
        const py = Math.round(oy + gy * zoom) + 0.5
        ctx.moveTo(ox, py)
        ctx.lineTo(ox + w * zoom, py)
      }
      ctx.stroke()
    }
  }

  /** 屏幕坐标 → 像素坐标（在画布内返回 [x,y]，否则 null） */
  screenToWorld(sx, sy) {
    const w = this.model.width
    const h = this.model.height
    const px = Math.floor((sx - this.offsetX) / this.zoom)
    const py = Math.floor((sy - this.offsetY) / this.zoom)
    if (px < 0 || py < 0 || px >= w || py >= h) return null
    return [px, py]
  }
}

// 兼容旧用法：单帧导出渲染（按帧导出 PNG）
export function renderFrameToCanvas(model, scale) {
  const canvas = document.createElement('canvas')
  canvas.width = model.width * scale
  canvas.height = model.height * scale
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const tmp = document.createElement('canvas')
  tmp.width = model.width
  tmp.height = model.height
  const tctx = tmp.getContext('2d')
  const imgData = tctx.createImageData(model.width, model.height)
  new Uint32Array(imgData.data.buffer).set(model.data)
  tctx.putImageData(imgData, 0, 0)
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)
  return canvas
}

// 通用：把一帧像素数组渲染到 canvas（供 GIF 导出 / 缩略图）
export function renderFrameDataToCanvas(data, w, h, scale = 1) {
  const canvas = document.createElement('canvas')
  canvas.width = w * scale
  canvas.height = h * scale
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  const tmp = document.createElement('canvas')
  tmp.width = w
  tmp.height = h
  const tctx = tmp.getContext('2d')
  const imgData = tctx.createImageData(w, h)
  new Uint32Array(imgData.data.buffer).set(data)
  tctx.putImageData(imgData, 0, 0)
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height)
  return canvas
}

// 兼容旧引用（供现有导出逻辑使用）
export function renderModelToCanvas(model, scale) {
  return renderFrameToCanvas(model, scale)
}
