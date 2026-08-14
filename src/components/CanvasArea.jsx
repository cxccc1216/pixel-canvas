import { useEffect, useRef, useState } from 'react'
import { Renderer } from '../core/renderer.js'
import {
  drawLine,
  floodFillScanline,
  pickColor,
  paintBrush,
  removeColorTolerance,
  removeColorRegionTolerance,
  removeEdgeBackground,
} from '../core/tools.js'

export default function CanvasArea({
  model,
  modelKey,
  tool,
  color,
  brushSize,
  showGrid,
  symmetry,
  onionPrev,
  onionNext,
  theme,
  version,
  onChanged,
  onPick,
  removeTolerance,
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const drawingRef = useRef(false)
  const lastRef = useRef(null)
  const panningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const offsetStartRef = useRef({ x: 0, y: 0 })
  const spaceDownRef = useRef(false)
  const [spaceDown, setSpaceDown] = useState(false)
  const [zoom, setZoom] = useState(16)
  const [hover, setHover] = useState(null)

  // 初始化渲染器 + 尺寸自适应 + 画布居中
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const renderer = new Renderer(canvas, model)
    renderer.showGrid = showGrid
    renderer.zoom = 16
    renderer.setTheme()
    rendererRef.current = renderer

    const resize = () => {
      canvas.width = Math.max(1, container.clientWidth)
      canvas.height = Math.max(1, container.clientHeight)
      renderer.render()
    }
    resize()

    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // 居中画布
    renderer.offsetX = Math.max(0, (canvas.width - model.width * renderer.zoom) / 2)
    renderer.offsetY = Math.max(0, (canvas.height - model.height * renderer.zoom) / 2)
    renderer.render()

    return () => {
      ro.disconnect()
      rendererRef.current = null
    }
    // 注意：仅当画布模型替换（新建/导入/转换应用）时重建渲染器，
    // showGrid 变化走下方独立 effect，避免重置缩放与平移。
  }, [model, modelKey])

  // showGrid / symmetry / 洋葱皮 / 主题 / version 变化 → 同步渲染器并重渲染
  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    r.showGrid = showGrid
    r.symmetry = symmetry
    r.onionPrev = onionPrev
    r.onionNext = onionNext
    r.setTheme()
    r.render()
  }, [showGrid, symmetry, onionPrev, onionNext, theme, version])

  // 笔刷绘制回调：铅笔/橡皮落点 → 方形笔刷块（含对称镜像）
  const makeDraw = (drawColor) => (x, y) => {
    paintBrush(model, x, y, brushSize, drawColor, symmetry)
  }

  // 空格键按下进入平移模式
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !e.repeat && !(e.target instanceof HTMLInputElement)) {
        spaceDownRef.current = true
        setSpaceDown(true)
        e.preventDefault()
      }
    }
    const up = (e) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        setSpaceDown(false)
        panningRef.current = false
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  // 获取鼠标在 canvas 逻辑坐标
  const getPos = (e) => {
    const cv = canvasRef.current
    const rect = cv.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * cv.width) / rect.width,
      y: ((e.clientY - rect.top) * cv.height) / rect.height,
    }
  }

  const handleMouseDown = (e) => {
    if (e.button !== 0) return
    const r = rendererRef.current
    if (!r) return

    if (spaceDownRef.current) {
      panningRef.current = true
      const p = getPos(e)
      panStartRef.current = p
      offsetStartRef.current = { x: r.offsetX, y: r.offsetY }
      return
    }

    const p = getPos(e)
    const w = r.screenToWorld(p.x, p.y)
    if (!w) return
    const [wx, wy] = w

    if (tool === 'picker') {
      onPick(pickColor(model, wx, wy))
      return
    }

    if (tool === 'removeColor') {
      // 点击目标色块：默认清除连通区域（按容差匹配相近色）；Shift+点击 清除全画布相近色
      const target = model.getPixel(wx, wy)
      if (target === 0) return // 透明区域无需处理
      model.pushHistory()
      if (e.shiftKey) {
        removeColorTolerance(model, target, removeTolerance)
      } else {
        removeColorRegionTolerance(model, wx, wy, removeTolerance)
      }
      onChanged()
      return
    }

    if (tool === 'edgeClean') {
      // 边缘去杂色：点击任意处即从画布四边向内泛洪清除背景相近色（支持撤销）
      model.pushHistory()
      removeEdgeBackground(model, removeTolerance)
      onChanged()
      return
    }

    if (tool === 'fill') {
      model.pushHistory()
      floodFillScanline(model, wx, wy, color)
      onChanged()
      return
    }

    // pencil / eraser
    drawingRef.current = true
    lastRef.current = [wx, wy]
    model.pushHistory()
    makeDraw(tool === 'eraser' ? 0 : color)(wx, wy)
    onChanged()
  }

  const handleMouseMove = (e) => {
    const r = rendererRef.current
    if (!r) return
    const p = getPos(e)

    const w = r.screenToWorld(p.x, p.y)
    setHover(w ? { x: w[0], y: w[1] } : null)

    if (panningRef.current) {
      r.offsetX = offsetStartRef.current.x + (p.x - panStartRef.current.x)
      r.offsetY = offsetStartRef.current.y + (p.y - panStartRef.current.y)
      r.render()
      return
    }

    if (!drawingRef.current || !lastRef.current) return
    const w2 = r.screenToWorld(p.x, p.y)
    if (!w2) return
    const [wx, wy] = w2
    const drawColor = tool === 'eraser' ? 0 : color
    const [lx, ly] = lastRef.current
    drawLine(makeDraw(drawColor), lx, ly, wx, wy)
    lastRef.current = [wx, wy]
    onChanged()
  }

  const handleMouseUp = () => {
    drawingRef.current = false
    lastRef.current = null
    panningRef.current = false
  }

  const handleMouseLeave = () => {
    drawingRef.current = false
    lastRef.current = null
    setHover(null)
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const r = rendererRef.current
    if (!r) return
    const p = getPos(e)
    const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
    const newZoom = Math.min(48, Math.max(2, r.zoom * factor))
    // 以光标位置为中心缩放
    const wx = (p.x - r.offsetX) / r.zoom
    const wy = (p.y - r.offsetY) / r.zoom
    r.zoom = newZoom
    r.offsetX = p.x - wx * newZoom
    r.offsetY = p.y - wy * newZoom
    r.render()
    setZoom(newZoom)
  }

  return (
    <div className="canvas-area">
      <div className="canvas-wrap" ref={containerRef}>
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          style={{ cursor: spaceDown ? 'grab' : 'crosshair' }}
        />
      </div>
      <div className="canvas-statusbar">
        <span>
          画布 {model.width} × {model.height}
        </span>
        <span>
          {hover
            ? `坐标 (${hover.x}, ${hover.y})`
            : tool === 'fill'
              ? '点击填充颜色区域'
              : tool === 'picker'
                ? '点击取色'
              : tool === 'removeColor'
                ? `点击清除连通色块 · Shift+点击清除全画布 · 容差 ${removeTolerance}`
                : tool === 'edgeClean'
                  ? `点击从边缘向内清除背景相近色 · 内部颜色不受影响 · 容差 ${removeTolerance}`
                  : '滚轮缩放 · 空格拖拽平移'}
        </span>
        <span>缩放 {zoom}×</span>
      </div>
    </div>
  )
}
