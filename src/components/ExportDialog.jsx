import { useRef, useState } from 'react'
import { PixelCanvas } from '../core/canvasModel.js'
import { renderFrameToCanvas } from '../core/renderer.js'

const SCALES = [
  { scale: 1, desc: '原尺寸' },
  { scale: 4, desc: '适合预览' },
  { scale: 8, desc: '适合展示' },
  { scale: 16, desc: '高清导出' },
]

// 导出 PNG 单边像素上限，防止超大画布 + 高倍数导出撑爆内存
const MAX_EXPORT_EDGE = 4096

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function ExportDialog({ model, onClose, onImportProject }) {
  const [scale, setScale] = useState(4)
  const importRef = useRef(null)

  // 当前画布允许的最大放大倍数（超限选项自动隐藏）
  const maxScale = Math.max(1, Math.floor(MAX_EXPORT_EDGE / Math.max(model.width, model.height)))
  const scales = SCALES.filter((o) => o.scale <= maxScale)
  const effectiveScale = scales.some((o) => o.scale === scale) ? scale : scales[scales.length - 1].scale

  const handleExportPng = () => {
    // 导出当前帧 PNG
    const canvas = renderFrameToCanvas(model, effectiveScale)
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `pixel-frame${model.currentFrame + 1}-${model.width}x${model.height}.png`)
    }, 'image/png')
  }

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(model.serialize())], { type: 'application/json' })
    downloadBlob(blob, `pixel-${model.width}x${model.height}.json`)
  }

  const handleImportJson = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const project = JSON.parse(reader.result)
        if (!project || typeof project.width !== 'number') {
          throw new Error('格式不正确')
        }
        const m = new PixelCanvas(project.width, project.height)
        if (Array.isArray(project.frames) && project.frames.length) {
          // v2 多帧工程
          m.loadPixels(project.width, project.height, project.frames[0], project.frames)
        } else if (Array.isArray(project.data)) {
          // v1 单帧工程（兼容）
          m.loadPixels(project.width, project.height, project.data)
        } else {
          throw new Error('格式不正确')
        }
        onImportProject(m)
      } catch (err) {
        alert('导入失败：文件不是有效的像素画工程文件')
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">导出 / 保存</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form-label">导出 PNG 图片（放大倍数）</div>
        <div className="export-options">
          {scales.map((o) => (
            <button
              key={o.scale}
              className={`export-option ${effectiveScale === o.scale ? 'active' : ''}`}
              onClick={() => setScale(o.scale)}
            >
              <div className="scale">{o.scale}×</div>
              <div className="desc">{o.desc}</div>
            </button>
          ))}
        </div>
        <div className="form-hint" style={{ marginBottom: 14 }}>
          最终尺寸：{model.width * effectiveScale} × {model.height * effectiveScale} 像素
        </div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleExportPng}>
          ⬇ 下载 PNG
        </button>

        <div className="divider" />

        <div className="form-label">工程文件（保留全部帧，可继续编辑）</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={handleExportJson}>
            ⬇ 导出工程 (.json)
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={() => importRef.current?.click()}>
            ⬆ 导入工程
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={(e) => handleImportJson(e.target.files[0])}
          />
        </div>
        <div className="form-hint" style={{ marginTop: 8 }}>
          工程文件可随时导入继续编辑；页面也会自动保存草稿，刷新不丢失。
        </div>
      </div>
    </div>
  )
}
