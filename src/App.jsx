import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { PixelCanvas, hexToRgba, toHex } from './core/canvasModel.js'
import Toolbar from './components/Toolbar.jsx'
import ColorPanel from './components/ColorPanel.jsx'
import CanvasArea from './components/CanvasArea.jsx'
import AnimationPanel from './components/AnimationPanel.jsx'
import ReferencePanel from './components/ReferencePanel.jsx'
import NewCanvasDialog from './components/NewCanvasDialog.jsx'
import ConvertDialog from './components/ConvertDialog.jsx'
import ExportDialog from './components/ExportDialog.jsx'

const DRAFT_KEY = 'pixel-canvas-draft'
const SYMMETRY_CYCLE = ['none', 'vertical', 'horizontal', 'both']

export default function App() {
  const [model, setModel] = useState(() => new PixelCanvas(32, 32))
  const [modelKey, setModelKey] = useState(0)
  const [version, bump] = useReducer((x) => x + 1, 0)
  const [tool, setTool] = useState('pencil')
  const [color, setColor] = useState(() => hexToRgba('#111111'))
  const [brushSize, setBrushSize] = useState(1)
  const [removeTolerance, setRemoveTolerance] = useState(32) // 去色块容差（0=精确匹配）
  const [showGrid, setShowGrid] = useState(true)
  const [symmetry, setSymmetry] = useState('none')
  const [onionPrev, setOnionPrev] = useState(false)
  const [onionNext, setOnionNext] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [dialog, setDialog] = useState(null) // 'new' | 'convert' | 'export' | null
  const [paletteName, setPaletteName] = useState('default')
  const [recentColors, setRecentColors] = useState([])
  // 主题（默认跟随系统，可手动切换并持久化）
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('pixel-canvas-theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  // 应用主题到 <html> 并持久化
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('pixel-canvas-theme', theme)
  }, [theme])

  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const [refImg, setRefImg] = useState(null) // 原图对照：图片地址（objectURL）
  const [refVisible, setRefVisible] = useState(false) // 原图对照窗口显隐
  const refFileRef = useRef(null)
  // 栏位折叠状态
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [bottomOpen, setBottomOpen] = useState(true)
  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem('pixel-canvas-welcome-seen')
  )

  const refreshHistory = useCallback(() => {
    setCanUndo(model.canUndo())
    setCanRedo(model.canRedo())
  }, [model])

  const handleChanged = useCallback(() => {
    bump()
    refreshHistory()
  }, [refreshHistory])

  const addRecent = useCallback((c) => {
    setRecentColors((prev) => {
      const hex = toHex(c)
      return [hex, ...prev.filter((h) => h !== hex)].slice(0, 8)
    })
  }, [])

  const handleColorChange = useCallback(
    (c) => {
      setColor(c)
      addRecent(c)
    },
    [addRecent]
  )

  const handlePick = useCallback(
    (c) => {
      setColor(c)
      setTool('pencil')
      addRecent(c)
    },
    [addRecent]
  )

  const handleUndo = useCallback(() => {
    model.undo()
    handleChanged()
  }, [model, handleChanged])

  const handleRedo = useCallback(() => {
    model.redo()
    handleChanged()
  }, [model, handleChanged])

  // ===== 帧操作 =====
  const handleFrameChange = useCallback(
    (i) => {
      if (i < 0 || i >= model.frameCount || i === model.currentFrame) return
      model.setCurrentFrame(i)
      setCurrentFrame(i)
      bump()
    },
    [model]
  )

  const handleAddFrame = useCallback(() => {
    const i = model.addFrame()
    setCurrentFrame(i)
    bump()
  }, [model])

  const handleDeleteFrame = useCallback(
    (i) => {
      const cur = model.deleteFrame(i)
      setCurrentFrame(cur)
      bump()
      refreshHistory()
    },
    [model, refreshHistory]
  )

  const handleDuplicateFrame = useCallback(() => {
    const i = model.duplicateFrame()
    setCurrentFrame(i)
    bump()
  }, [model])

  const handleMoveFrame = useCallback(
    (from, to) => {
      model.moveFrame(from, to)
      setCurrentFrame(to)
      bump()
    },
    [model]
  )

  // 对称模式循环切换
  const cycleSymmetry = useCallback(() => {
    setSymmetry((s) => SYMMETRY_CYCLE[(SYMMETRY_CYCLE.indexOf(s) + 1) % SYMMETRY_CYCLE.length])
  }, [])

  // 洋葱皮开关
  const toggleOnion = useCallback((which) => {
    if (which === 'prev') setOnionPrev((s) => !s)
    else setOnionNext((s) => !s)
  }, [])

  // 全局快捷键
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') document.activeElement.blur()
        return
      }
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) handleRedo()
        else handleUndo()
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        handleRedo()
      } else if (e.key.toLowerCase() === 'b') setTool('pencil')
      else if (e.key.toLowerCase() === 'e') setTool('eraser')
      else if (e.key.toLowerCase() === 'g') setTool('fill')
      else if (e.key.toLowerCase() === 'i') setTool('picker')
      else if (e.key.toLowerCase() === 'r') setTool('removeColor')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleUndo, handleRedo])

  // 恢复本地草稿（兼容单帧 v1 / 多帧 v2）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const { width, height, data, frames } = JSON.parse(saved)
        const w = width || 32
        const h = height || 32
        const m = new PixelCanvas(w, h)
        if (Array.isArray(frames) && frames.length) {
          m.loadPixels(w, h, frames[0], frames)
        } else {
          m.loadPixels(w, h, data || [])
        }
        setModel(m)
        setCurrentFrame(0)
        setModelKey((k) => k + 1)
      }
    } catch {
      // 草稿损坏则忽略
    }
  }, [])

  // 自动保存草稿（防抖，含全部帧；大画布超 localStorage 上限时降级为单帧）
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        let json = JSON.stringify(model.serialize())
        // localStorage 通常约 5MB 上限，超限时降级只保存当前帧（v1 格式）
        if (json.length > 3_500_000) {
          json = JSON.stringify({
            app: 'pixel-canvas',
            version: 1,
            width: model.width,
            height: model.height,
            data: Array.from(model.data),
          })
        }
        localStorage.setItem(DRAFT_KEY, json)
      } catch {
        // localStorage 容量满则忽略
      }
    }, 800)
    return () => clearTimeout(t)
  }, [model, modelKey, version, currentFrame])

  // 新建画布
  const handleNewCanvas = useCallback((w, h, bgColor) => {
    const m = new PixelCanvas(w, h)
    if (bgColor !== 0) m.clear(bgColor)
    setModel(m)
    setCurrentFrame(0)
    setModelKey((k) => k + 1)
    setDialog(null)
  }, [])

  // 应用转换结果（自动打开原图对照窗口）
  const handleApplyConvert = useCallback(
    (pixels, w, h, img) => {
      model.loadPixels(w, h, pixels)
      setCurrentFrame(0)
      setModelKey((k) => k + 1)
      bump()
      refreshHistory()
      if (img && img.src) {
        setRefImg(img.src)
        setRefVisible(true)
      }
      setDialog(null)
    },
    [model, refreshHistory]
  )

  // 工具栏「原图」开关：有图则切换显隐；无图则弹出本地图片选择
  const handleToggleRef = useCallback(() => {
    if (refImg) {
      setRefVisible((v) => !v)
    } else {
      refFileRef.current?.click()
    }
  }, [refImg])

  // 直接选择本地图片作为原图（不经过转换也可对照）
  const handleRefFile = useCallback((e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    setRefImg(URL.createObjectURL(f))
    setRefVisible(true)
  }, [])

  // 导入工程文件
  const handleImportProject = useCallback((m) => {
    setModel(m)
    setCurrentFrame(0)
    setModelKey((k) => k + 1)
    setDialog(null)
  }, [])

  const closeWelcome = () => {
    setShowWelcome(false)
    localStorage.setItem('pixel-canvas-welcome-seen', '1')
  }

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <div className="logo-badge">像</div>
          <span>像素画布</span>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={() => setDialog('new')}>
            🆕 新建
          </button>
          <button className="btn btn-primary" onClick={() => setDialog('convert')}>
            🖼️ 图片转像素
          </button>
          <button className="btn" onClick={() => setDialog('export')}>
            ⬇ 导出
          </button>
        </div>
        <div className="header-spacer" />
        <div className="header-actions">
          <button
            className="btn btn-icon"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="btn btn-icon" disabled={!canUndo} onClick={handleUndo} title="撤销 Ctrl+Z">
            ↩
          </button>
          <button
            className="btn btn-icon"
            disabled={!canRedo}
            onClick={handleRedo}
            title="重做 Ctrl+Shift+Z"
          >
            ↪
          </button>
        </div>
      </header>

      <div className="main">
        <div className={`side-rail left ${leftOpen ? '' : 'collapsed'}`}>
          {leftOpen ? (
            <Toolbar
              tool={tool}
              onToolChange={setTool}
              showGrid={showGrid}
              onToggleGrid={() => setShowGrid((s) => !s)}
              symmetry={symmetry}
              onCycleSymmetry={cycleSymmetry}
              refActive={refVisible}
              onToggleRef={handleToggleRef}
              onCollapse={() => setLeftOpen(false)}
            />
          ) : (
            <button className="rail-toggle" onClick={() => setLeftOpen(true)} title="展开工具栏">
              ▶
            </button>
          )}
        </div>
        <div style={{ position: 'relative', flex: 1, minWidth: 0, display: 'flex' }}>
          <CanvasArea
            model={model}
            modelKey={modelKey}
            tool={tool}
            color={color}
            brushSize={brushSize}
            showGrid={showGrid}
            symmetry={symmetry}
            onionPrev={onionPrev}
            onionNext={onionNext}
            theme={theme}
            version={version}
            onChanged={handleChanged}
            onPick={handlePick}
            removeTolerance={removeTolerance}
          />
          {showWelcome && (
            <div className="welcome">
              <div className="welcome-card">
                <h2>👋 欢迎使用像素画布</h2>
                <p>面向零基础像素游戏创作者的免费工具</p>
                <div className="welcome-steps">
                  <div className="step">
                    <span className="step-num">1</span>
                    <span>点击「图片转像素」，导入图片自动生成像素画</span>
                  </div>
                  <div className="step">
                    <span className="step-num">2</span>
                    <span>转换结果可继续自由编辑、精修细节</span>
                  </div>
                  <div className="step">
                    <span className="step-num">3</span>
                    <span>底部动画面板可做逐帧动画，导出 GIF 或 PNG</span>
                  </div>
                </div>
                <button className="welcome-close" onClick={closeWelcome}>
                  开始创作
                </button>
              </div>
            </div>
          )}
        </div>
        <div className={`side-rail right ${rightOpen ? '' : 'collapsed'}`}>
          {rightOpen ? (
            <ColorPanel
              color={color}
              onColorChange={handleColorChange}
              paletteName={paletteName}
              onPaletteChange={setPaletteName}
              recentColors={recentColors}
              brushSize={brushSize}
              onBrushSizeChange={setBrushSize}
              removeTolerance={removeTolerance}
              onRemoveToleranceChange={setRemoveTolerance}
              onCollapse={() => setRightOpen(false)}
            />
          ) : (
            <button className="rail-toggle" onClick={() => setRightOpen(true)} title="展开调色板">
              ◀
            </button>
          )}
        </div>
      </div>

      {bottomOpen ? (
        <AnimationPanel
          model={model}
          version={version}
          currentFrame={currentFrame}
          onFrameChange={handleFrameChange}
        onAddFrame={handleAddFrame}
        onDeleteFrame={handleDeleteFrame}
        onDuplicateFrame={handleDuplicateFrame}
        onMoveFrame={handleMoveFrame}
        onionPrev={onionPrev}
        onionNext={onionNext}
        onToggleOnion={toggleOnion}
        onCollapse={() => setBottomOpen(false)}
      />
      ) : (
        <button className="bottom-rail" onClick={() => setBottomOpen(true)} title="展开帧动画栏">
          ▲ 展开帧动画栏
        </button>
      )}

      {dialog === 'new' && <NewCanvasDialog onClose={() => setDialog(null)} onApply={handleNewCanvas} />}
      {dialog === 'convert' && (
        <ConvertDialog onClose={() => setDialog(null)} onApply={handleApplyConvert} />
      )}
      {dialog === 'export' && (
        <ExportDialog model={model} onClose={() => setDialog(null)} onImportProject={handleImportProject} />
      )}

      {refImg && refVisible && (
        <ReferencePanel src={refImg} onClose={() => setRefVisible(false)} />
      )}
      <input
        ref={refFileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleRefFile}
      />
    </div>
  )
}
