import { useEffect, useRef, useState } from 'react'

const MIN_W = 140
const MIN_H = 120
const MAX_W = 640
const MAX_H = 560

// 缩放范围（支持缩小到 0.2×，含 0.5 档）；滚轮连续缩放，按钮按档位跳转
const MIN_ZOOM = 0.2
const MAX_ZOOM = 8
const ZOOM_STEPS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]

/**
 * 原图对照浮动窗口：可拖动移动、滚轮/按钮缩放内容、右下角调整大小、透明度调节
 */
export default function ReferencePanel({ src, onClose }) {
  const [pos, setPos] = useState({ x: 24, y: 72 })
  const [size, setSize] = useState({ w: 240, h: 240 })
  const [opacity, setOpacity] = useState(0.9)
  const [zoom, setZoom] = useState(1)
  const bodyRef = useRef(null)

  // 原生非被动滚轮监听：保证 preventDefault 生效
  // （React onWheel 是被动监听，缩小时 preventDefault 失效会带动页面滚动）
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      setZoom((z) =>
        Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      )
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 按档位缩放（dir: -1 缩小 / +1 放大）
  const stepZoom = (dir) => {
    setZoom((z) => {
      let cur = ZOOM_STEPS.indexOf(z)
      if (cur === -1) {
        cur = ZOOM_STEPS.findIndex((s) => s >= z)
        if (cur === -1) cur = ZOOM_STEPS.length - 1
      }
      const next = Math.max(0, Math.min(ZOOM_STEPS.length - 1, cur + dir))
      return ZOOM_STEPS[next]
    })
  }

  // 拖动移动（标题栏）
  const dragRef = useRef(null)
  const onTitlePointerDown = (e) => {
    if (e.button !== 0) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ox: pos.x,
      oy: pos.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onTitlePointerMove = (e) => {
    if (!dragRef.current) return
    setPos({
      x: dragRef.current.ox + (e.clientX - dragRef.current.startX),
      y: dragRef.current.oy + (e.clientY - dragRef.current.startY),
    })
  }
  const onTitlePointerUp = () => {
    dragRef.current = null
  }

  // 调整窗口大小（右下角手柄）
  const resizeRef = useRef(null)
  const onResizePointerDown = (e) => {
    if (e.button !== 0) return
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      ow: size.w,
      oh: size.h,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onResizePointerMove = (e) => {
    if (!resizeRef.current) return
    const dw = e.clientX - resizeRef.current.startX
    const dh = e.clientY - resizeRef.current.startY
    setSize({
      w: Math.min(MAX_W, Math.max(MIN_W, resizeRef.current.ow + dw)),
      h: Math.min(MAX_H, Math.max(MIN_H, resizeRef.current.oh + dh)),
    })
  }
  const onResizePointerUp = () => {
    resizeRef.current = null
  }

  // 双击标题栏重置
  const handleDoubleClick = () => {
    setPos({ x: 24, y: 72 })
    setSize({ w: 240, h: 240 })
    setZoom(1)
    setOpacity(0.9)
  }

  return (
    <div
      className="ref-panel"
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h, opacity: 1 }}
    >
      <div
        className="ref-title"
        onPointerDown={onTitlePointerDown}
        onPointerMove={onTitlePointerMove}
        onPointerUp={onTitlePointerUp}
        onDoubleClick={handleDoubleClick}
        title="拖动移动 · 双击还原"
      >
        <span>🖼️ 原图对照</span>
        <button className="ref-close" onClick={onClose} title="关闭对照窗口">
          ✕
        </button>
      </div>
      <div className="ref-body" ref={bodyRef}>
        <img
          src={src}
          alt="原图"
          draggable={false}
          style={{ opacity, transform: `scale(${zoom})` }}
        />
        <div className="ref-hint">滚轮缩放图片</div>
      </div>
      <div className="ref-tools">
        <label className="ref-opacity" title="透明度">
          ◐
          <input
            type="range"
            min="0.15"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
          />
        </label>
        <div className="ref-zoom-controls">
          <button
            className="ref-zoom-btn"
            onClick={() => stepZoom(-1)}
            disabled={zoom <= MIN_ZOOM}
            title="缩小"
          >
            −
          </button>
          <button
            className="ref-zoom-val"
            onClick={() => setZoom(1)}
            title="点击恢复 100%"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            className="ref-zoom-btn"
            onClick={() => stepZoom(1)}
            disabled={zoom >= MAX_ZOOM}
            title="放大"
          >
            ＋
          </button>
        </div>
      </div>
      <div
        className="ref-resize"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        title="拖动调整窗口大小"
      />
    </div>
  )
}
