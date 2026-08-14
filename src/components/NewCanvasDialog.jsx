import { useState } from 'react'
import { rgba } from '../core/canvasModel.js'

const PRESETS = [16, 32, 64, 128, 256, 512]

const BG_OPTIONS = [
  { id: 'transparent', name: '透明', color: 0 },
  { id: 'white', name: '白色', color: rgba(255, 255, 255) },
  { id: 'black', name: '黑色', color: rgba(0, 0, 0) },
]

export default function NewCanvasDialog({ onClose, onApply }) {
  const [preset, setPreset] = useState(32)
  const [width, setWidth] = useState(32)
  const [height, setHeight] = useState(32)
  const [custom, setCustom] = useState(false)
  const [bg, setBg] = useState('transparent')

  const pickPreset = (s) => {
    setPreset(s)
    setCustom(false)
    setWidth(s)
    setHeight(s)
  }

  const clampSize = (v) => Math.max(1, Math.min(512, Math.round(v) || 1))

  const handleCreate = () => {
    const w = clampSize(width)
    const h = clampSize(height)
    const bgColor = BG_OPTIONS.find((o) => o.id === bg).color
    onApply(w, h, bgColor)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">新建画布</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-row">
          <div className="form-label">推荐尺寸（像素游戏常用）</div>
          <div className="size-presets">
            {PRESETS.map((s) => (
              <button
                key={s}
                className={`size-chip ${!custom && preset === s ? 'active' : ''}`}
                onClick={() => pickPreset(s)}
              >
                {s} × {s}
              </button>
            ))}
          </div>
        </div>

        <div className="form-row">
          <div className="form-label">自定义尺寸（1 ~ 512）</div>
          <div className="input-grid">
            <input
              className="field-input"
              type="number"
              min="1"
              max="512"
              value={width}
              onChange={(e) => {
                setCustom(true)
                setWidth(e.target.value)
              }}
            />
            <input
              className="field-input"
              type="number"
              min="1"
              max="512"
              value={height}
              onChange={(e) => {
                setCustom(true)
                setHeight(e.target.value)
              }}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-label">背景色</div>
          <div className="size-presets">
            {BG_OPTIONS.map((o) => (
              <button
                key={o.id}
                className={`size-chip ${bg === o.id ? 'active' : ''}`}
                onClick={() => setBg(o.id)}
              >
                {o.name}
              </button>
            ))}
          </div>
          {(width > 256 || height > 256) && (
            <div className="form-hint">
              大画布（≥256px）更吃性能与内存，建议游戏素材优先使用 ≤128px。
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleCreate}>
            创建画布
          </button>
        </div>
      </div>
    </div>
  )
}
