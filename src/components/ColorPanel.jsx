import { useState } from 'react'
import { PALETTES, paletteToUint32 } from '../core/palette.js'
import { toHex, toRGBA, hexToRgba, rgba } from '../core/canvasModel.js'

const TRANSPARENT_HEX = '__transparent__'

// 笔刷大小预设（像素格）
const BRUSH_SIZES = [1, 2, 3, 4, 6, 8, 12, 16]

export default function ColorPanel({
  color,
  onColorChange,
  paletteName,
  onPaletteChange,
  recentColors,
  brushSize,
  onBrushSizeChange,
  removeTolerance,
  onRemoveToleranceChange,
  onCollapse,
}) {
  const palette = PALETTES[paletteName] || PALETTES.default
  const paletteColors = paletteToUint32(palette.colors)
  const [hexText, setHexText] = useState('')
  const [showTransparent] = useState(false)

  const currentHex = color === 0 ? TRANSPARENT_HEX : toHex(color)

  const handleSwatch = (c) => {
    onColorChange(c)
  }

  const handleHexChange = (e) => {
    setHexText(e.target.value)
  }

  const handleHexCommit = () => {
    const t = hexText.trim().replace(/^#/, '')
    if (/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(t)) {
      onColorChange(hexToRgba('#' + t))
    }
    setHexText('')
  }

  const [r, g, b] = toRGBA(color)

  return (
    <div className="color-panel">
      <div className="panel-header">
        <div className="panel-title" style={{ marginBottom: 0 }}>
          调色板
        </div>
        <button className="rail-hide" onClick={onCollapse} title="隐藏调色板">
          ▶
        </button>
      </div>
      <select
        className="palette-select"
        value={paletteName}
        onChange={(e) => onPaletteChange(e.target.value)}
      >
        {Object.entries(PALETTES).map(([key, p]) => (
          <option key={key} value={key}>
            {p.name}
          </option>
        ))}
      </select>

      <div className="swatches">
        {paletteColors.map((c, i) => (
          <button
            key={i}
            className={`swatch ${currentHex === toHex(c) ? 'selected' : ''}`}
            style={{ background: toHex(c) }}
            onClick={() => handleSwatch(c)}
            title={toHex(c)}
          />
        ))}
      </div>

      <div className="section">
        <div className="panel-title">自定义颜色</div>
        <div className="custom-color-row">
          <input
            type="color"
            value={color === 0 ? '#ffffff' : currentHex.slice(0, 7)}
            onChange={(e) => onColorChange(hexToRgba(e.target.value))}
          />
          <input
            className="hex-input"
            placeholder={currentHex === TRANSPARENT_HEX ? '#000000' : currentHex}
            value={hexText}
            onChange={handleHexChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleHexCommit()
            }}
            onBlur={handleHexCommit}
          />
        </div>
        <div className="form-hint">
          当前颜色：RGB({r}, {g}, {b})
        </div>
      </div>

      <div className="section">
        <div className="panel-title">笔刷大小（像素格）</div>
        <div className="brush-sizes">
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              className={`brush-chip ${brushSize === s ? 'active' : ''}`}
              onClick={() => onBrushSizeChange(s)}
              title={`${s} × ${s} 像素`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="brush-preview-row">
          <span
            className="brush-preview"
            style={{ width: brushSize * 2, height: brushSize * 2 }}
          />
          <span className="form-hint">
            铅笔/橡皮 · {brushSize} × {brushSize} 方块
          </span>
        </div>
      </div>

      <div className="section">
        <div className="panel-title">去色容差（相近色匹配）</div>
        <div className="tolerance-row">
          <input
            type="range"
            min="0"
            max="128"
            step="4"
            value={removeTolerance}
            onChange={(e) => onRemoveToleranceChange(Number(e.target.value))}
          />
          <span className="tolerance-val">{removeTolerance}</span>
        </div>
        <div className="form-hint">
          去色块按色差匹配相近色，0 = 精确。白色背景出现几种近似白时调大容差可一次清除
        </div>
      </div>

      {recentColors.length > 0 && (
        <div className="section">
          <div className="panel-title">最近使用</div>
          <div className="recent-swatches">
            {recentColors.map((hex) => (
              <button
                key={hex}
                className="swatch"
                style={{ background: hex }}
                onClick={() => onColorChange(hexToRgba(hex))}
                title={hex}
              />
            ))}
          </div>
        </div>
      )}

      <div className="section">
        <div className="panel-title">快捷键</div>
        <div className="form-hint">B 铅笔 · E 橡皮 · G 油漆桶 · I 取色器 · R 去色块</div>
        <div className="form-hint">空格拖拽平移 · 滚轮缩放 · Ctrl+Z 撤销</div>
      </div>
    </div>
  )
}
