import { useEffect, useRef, useState } from 'react'
import { loadImage, convertToPixelArt } from '../core/converter.js'
import { paletteToRGB, PALETTES } from '../core/palette.js'

const SIZE_PRESETS = [16, 32, 48, 64, 96, 128, 256, 512]

// 转换用预设色板（'' 表示自动量化生成）
const CONVERT_PALETTES = [
  { id: '', name: '自动（算法生成）' },
  { id: 'pico8', name: 'Pico-8 (32 色)' },
  { id: 'gameboy', name: 'Game Boy (4 色)' },
  { id: 'default16', name: 'Windows 16 色' },
]

export default function ConvertDialog({ onClose, onApply }) {
  const [img, setImg] = useState(null)
  const [fileName, setFileName] = useState('')
  const [width, setWidth] = useState(32)
  const [height, setHeight] = useState(32)
  const [numColors, setNumColors] = useState(16)
  const [dither, setDither] = useState(true)
  const [inkPreserve, setInkPreserve] = useState(true) // 描边优化：保持纯黑
  const [mergeColors, setMergeColors] = useState(true) // 合并相近颜色：消除伪白色
  const [paletteId, setPaletteId] = useState('')
  const [dragover, setDragover] = useState(false)
  const [preview, setPreview] = useState(null)
  const [applying, setApplying] = useState(false)
  const fileRef = useRef(null)
  const previewCanvasRef = useRef(null)
  const aspectRef = useRef(1)

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return
    setImg(null)
    setPreview(null)
    try {
      const image = await loadImage(file)
      setImg(image)
      setFileName(file.name)
      // 建议尺寸：长边 32~128 之间取接近 64 的值
      const longEdge = Math.max(image.width, image.height)
      const target = longEdge <= 64 ? 16 : longEdge <= 128 ? 32 : longEdge <= 256 ? 48 : 64
      aspectRef.current = image.width / image.height
      setWidth(Math.min(128, Math.max(16, Math.round(target))))
      setHeight(Math.min(128, Math.max(16, Math.round(target / aspectRef.current))))
    } catch (err) {
      alert(err.message)
    }
  }

  const setWidthFixed = (w) => {
    const nw = Math.max(1, Math.min(512, Math.round(w) || 1))
    setWidth(nw)
    setHeight(Math.max(1, Math.min(512, Math.round(nw / aspectRef.current))))
  }

  const setHeightFixed = (h) => {
    const nh = Math.max(1, Math.min(512, Math.round(h) || 1))
    setHeight(nh)
    setWidth(Math.max(1, Math.min(512, Math.round(nh * aspectRef.current))))
  }

  // 参数变化 → 防抖转换预览
  useEffect(() => {
    if (!img) return
    const t = setTimeout(() => {
      try {
        const presetPalette = paletteId
          ? paletteToRGB(PALETTES[paletteId].colors)
          : null
        const result = convertToPixelArt(img, {
          width,
          height,
          numColors,
          dither,
          inkPreserve,
          mergeColors,
          presetPalette,
        })
        setPreview(result)
      } catch (err) {
        console.error(err)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [img, width, height, numColors, dither, inkPreserve, mergeColors, paletteId])

  // 预览 canvas 渲染
  useEffect(() => {
    const cv = previewCanvasRef.current
    if (!cv || !preview) return
    cv.width = preview.width
    cv.height = preview.height
    const ctx = cv.getContext('2d')
    const imgData = ctx.createImageData(preview.width, preview.height)
    new Uint32Array(imgData.data.buffer).set(preview.pixels)
    ctx.putImageData(imgData, 0, 0)
  }, [preview])

  const handleApply = () => {
    if (!preview || applying) return
    setApplying(true)
    // 把原图一并传出，应用转换结果后自动打开原图对照窗口
    onApply(preview.pixels, preview.width, preview.height, img)
    // onApply 内部会关闭弹窗
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">图片转像素画</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="convert-layout">
          <div className="convert-left">
            <div
              className={`dropzone ${dragover ? 'dragover' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragover(true)
              }}
              onDragLeave={() => setDragover(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragover(false)
                handleFile(e.dataTransfer.files[0])
              }}
            >
              <div className="dropzone-icon">🖼️</div>
              <div>{img ? fileName : '点击或拖拽图片到此处'}</div>
              <div className="form-hint">支持 JPG / PNG / WebP / GIF（取首帧）</div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>

            {!img && (
              <div className="empty-upload">
                上传一张图片（游戏角色、图标、场景素材效果最佳），
                <br />
                自动转换为可编辑的像素画。
              </div>
            )}

            {img && (
              <div className="form-row" style={{ marginTop: 14 }}>
                <div className="form-label">目标尺寸</div>
                <div className="size-presets">
                  {SIZE_PRESETS.map((s) => (
                    <button
                      key={s}
                      className={`size-chip ${
                        Math.max(width, height) === s && !(width > s && height > s)
                          ? 'active'
                          : ''
                      }`}
                      onClick={() => setWidthFixed(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="input-grid">
                  <label>
                    <span className="form-hint">宽</span>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      max="512"
                      value={width}
                      onChange={(e) => setWidthFixed(e.target.value)}
                    />
                  </label>
                  <label>
                    <span className="form-hint">高（保持纵横比）</span>
                    <input
                      className="field-input"
                      type="number"
                      min="1"
                      max="512"
                      value={height}
                      onChange={(e) => setHeightFixed(e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="convert-right">
            <div className="panel-title">预览</div>
            <div className="preview-box">
              {preview ? (
                <canvas ref={previewCanvasRef} style={{ width: '100%', height: 'auto' }} />
              ) : (
                <div className="preview-empty">
                  {img ? '转换中…' : '上传图片后显示转换预览'}
                </div>
              )}
            </div>
          </div>
        </div>

        {img && (
          <div className="form-row" style={{ marginTop: 14 }}>
            <div className="form-label">转换参数</div>
            <div className="input-grid">
              <div>
                <div className="range-row">
                  <span className="form-hint">颜色数量</span>
                  <input
                    type="range"
                    min="2"
                    max="64"
                    value={numColors}
                    disabled={paletteId !== ''}
                    onChange={(e) => setNumColors(Number(e.target.value))}
                  />
                  <span className="value">{numColors}</span>
                </div>
              </div>
              <div>
                <span className="form-hint">调色板预设</span>
                <select
                  className="palette-select"
                  style={{ marginTop: 4, marginBottom: 0 }}
                  value={paletteId}
                  onChange={(e) => setPaletteId(e.target.value)}
                >
                  {CONVERT_PALETTES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={dither}
                onChange={(e) => setDither(e.target.checked)}
              />
              抖动（误差扩散，让过渡更平滑，低色数时效果明显）
            </label>
            <label className="checkbox-row" title="将原图黑色/深色描边像素强制转换为纯黑，避免抖动把杂色渗入描边">
              <input
                type="checkbox"
                checked={inkPreserve}
                onChange={(e) => setInkPreserve(e.target.checked)}
              />
              描边优化（保持纯黑线条，减少杂色）
            </label>
            <label className="checkbox-row" title="把色差极小的重复色（如压缩产生的几种近似白）合并为一种，背景更干净">
              <input
                type="checkbox"
                checked={mergeColors}
                onChange={(e) => setMergeColors(e.target.checked)}
              />
              合并相近颜色（消除伪白色等重复色）
            </label>
            {!inkPreserve && (
              <div className="form-hint">
                已关闭描边优化；若转换结果描边出现彩色杂色，建议重新开启。
              </div>
            )}
            <div className="form-hint">
              转换后结果会载入画布，你可以继续自由编辑修改。
            </div>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={!preview || applying}
            onClick={handleApply}
          >
            应用到画布
          </button>
        </div>
      </div>
    </div>
  )
}
