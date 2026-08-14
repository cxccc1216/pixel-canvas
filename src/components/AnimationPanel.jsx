import { useEffect, useRef, useState } from 'react'
import { exportGIF } from '../core/gifExporter.js'

const GIF_SCALES = [
  { scale: 1, label: '1x' },
  { scale: 2, label: '2x' },
  { scale: 4, label: '4x' },
]

// 单帧缩略图
function FrameThumb({ model, index, active, version, onSelect, onDelete, onMove }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const cv = canvasRef.current
    if (!cv) return
    const w = model.width
    const h = model.height
    // 大画布缩略图放大倍数收敛，控制内存（目标最长边 ≈96px）
    const maxDim = Math.max(w, h)
    const scale = Math.max(1, Math.min(4, Math.floor(96 / maxDim)))
    cv.width = Math.max(1, w) * scale
    cv.height = Math.max(1, h) * scale
    const ctx = cv.getContext('2d')
    const imgData = ctx.createImageData(Math.max(1, w), Math.max(1, h))
    new Uint32Array(imgData.data.buffer).set(model.frames[index])
    ctx.putImageData(imgData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(cv, 0, 0, w, h, 0, 0, cv.width, cv.height)
  }, [model, index, version])

  const isFirst = index === 0
  const isLast = index === model.frameCount - 1

  return (
    <div className={`anim-thumb ${active ? 'active' : ''}`} onClick={() => onSelect(index)}>
      <canvas ref={canvasRef} />
      <div className="anim-thumb-label">{index + 1}</div>
      <div className="anim-thumb-actions">
        <button
          className="anim-thumb-btn"
          disabled={isFirst}
          onClick={(e) => {
            e.stopPropagation()
            onMove(index, index - 1)
          }}
          title="左移"
        >
          ◀
        </button>
        <button
          className="anim-thumb-btn"
          disabled={isLast}
          onClick={(e) => {
            e.stopPropagation()
            onMove(index, index + 1)
          }}
          title="右移"
        >
          ▶
        </button>
        <button
          className="anim-thumb-btn danger"
          disabled={model.frameCount <= 1}
          onClick={(e) => {
            e.stopPropagation()
            onDelete(index)
          }}
          title="删除帧"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function AnimationPanel({
  model,
  version,
  currentFrame,
  onFrameChange,
  onAddFrame,
  onDeleteFrame,
  onDuplicateFrame,
  onMoveFrame,
  onionPrev,
  onionNext,
  onToggleOnion,
  onCollapse,
}) {
  const [playing, setPlaying] = useState(false)
  const [fps, setFps] = useState(8)
  const [showGif, setShowGif] = useState(false)
  const [gifScale, setGifScale] = useState(4)

  // GIF 放大倍数上限：输出边长 ≤ 2048，避免大画布编码卡顿/超限
  const gifMaxScale = Math.max(1, Math.floor(2048 / Math.max(model.width, model.height)))
  const gifScales = GIF_SCALES.filter((o) => o.scale <= gifMaxScale)
  const effectiveGifScale = gifScales.some((o) => o.scale === gifScale)
    ? gifScale
    : gifScales[gifScales.length - 1].scale

  // 播放循环
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      const next = (model.currentFrame + 1) % model.frameCount
      onFrameChange(next)
    }, 1000 / fps)
    return () => clearInterval(id)
  }, [playing, fps, model, onFrameChange, version])

  // 帧结构变化时停止播放
  useEffect(() => {
    setPlaying(false)
  }, [model.frameCount])

  const handleExportGif = () => {
    const bytes = exportGIF(
      model.frames,
      model.width,
      model.height,
      Math.round(1000 / fps),
      effectiveGifScale
    )
    const blob = new Blob([bytes], { type: 'image/gif' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `animation-${model.width * effectiveGifScale}x${model.height * effectiveGifScale}.gif`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
    setShowGif(false)
  }

  return (
    <div className="anim-panel">
      <div className="anim-toolbar">
        <div className="anim-controls">
          <button
            className="anim-btn"
            disabled={currentFrame <= 0}
            onClick={() => onFrameChange(currentFrame - 1)}
            title="上一帧"
          >
            ⏮
          </button>
          <button
            className={`anim-btn play ${playing ? 'active' : ''}`}
            onClick={() => setPlaying((p) => !p)}
            title={playing ? '暂停' : '播放'}
          >
            {playing ? '⏸' : '▶'}
          </button>
          <button
            className="anim-btn"
            disabled={currentFrame >= model.frameCount - 1}
            onClick={() => onFrameChange(currentFrame + 1)}
            title="下一帧"
          >
            ⏭
          </button>
          <span className="anim-frame-info">
            {currentFrame + 1} / {model.frameCount} 帧
          </span>
        </div>

        <div className="anim-opts">
          <label className="anim-opt">
            帧率
            <input
              type="range"
              min="1"
              max="24"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
            />
            <span className="anim-fps">{fps} FPS</span>
          </label>
          <label className="anim-check">
            <input
              type="checkbox"
              checked={onionPrev}
              onChange={() => onToggleOnion('prev')}
            />
            洋葱皮(前)
          </label>
          <label className="anim-check">
            <input
              type="checkbox"
              checked={onionNext}
              onChange={() => onToggleOnion('next')}
            />
            洋葱皮(后)
          </label>
        </div>

        <div className="anim-actions">
          <button className="anim-btn primary" onClick={onAddFrame} title="复制当前帧并添加为新帧">
            ＋ 添加帧
          </button>
          <button
            className="anim-btn"
            onClick={onDuplicateFrame}
            disabled={model.frameCount >= 64}
            title="复制当前帧到其后"
          >
            ⧉ 复制帧
          </button>
          <div className="anim-gif">
            <button className="anim-btn primary" onClick={() => setShowGif((s) => !s)}>
              🎞 导出 GIF {showGif ? '▲' : '▼'}
            </button>
            {showGif && (              <div className="anim-gif-menu">
                <div className="gif-scale-row">
                  {gifScales.map((o) => (
                    <button
                      key={o.scale}
                      className={`size-chip ${effectiveGifScale === o.scale ? 'active' : ''}`}
                      onClick={() => setGifScale(o.scale)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="form-hint">
                  输出 {model.width * effectiveGifScale} × {model.height * effectiveGifScale} · 无限循环 · 透明背景
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleExportGif}>
                  ⬇ 下载 GIF
                </button>
              </div>
            )}
          </div>
          <button className="anim-btn" onClick={onCollapse} title="隐藏帧动画栏">
            ▼
          </button>
        </div>
      </div>

      <div className="anim-frames">
        {model.frames.map((_, i) => (
          <FrameThumb
            key={i}
            model={model}
            index={i}
            active={i === currentFrame}
            version={version}
            onSelect={onFrameChange}
            onDelete={onDeleteFrame}
            onMove={onMoveFrame}
          />
        ))}
      </div>
    </div>
  )
}
