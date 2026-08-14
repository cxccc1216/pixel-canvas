import { TOOLS, TOOL_ORDER, SYMMETRY } from '../core/tools.js'

const ICONS = {
  pencil: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 21-4.3-4.3a2 2 0 0 1 0-2.83L13.5 3.1a2 2 0 0 1 2.83 0l4.6 4.6a2 2 0 0 1 0 2.83L10.8 21a2 2 0 0 1-1.42.59Z" />
      <path d="m5 11 8 8" />
      <path d="M13 21h8" />
    </svg>
  ),
  fill: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 11H5l7 7z" />
      <path d="M12 3a3 3 0 0 0-3 3c0 1.2 1.5 2.6 3 4 1.5-1.4 3-2.8 3-4a3 3 0 0 0-3-3Z" />
      <path d="M19 11v1a4 4 0 0 1-8 0v-1" />
    </svg>
  ),
  picker: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 22 1-1h3l9-9" />
      <path d="M3 21v-3l9-9" />
      <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9" />
      <path d="M9 12l3 3" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </svg>
  ),
  symmetry: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h18" />
      <path d="M3 12c3 3 5 5 5 8M3 12c3-3 5-5 5-8M21 12c-3 3-5 5-5 8M21 12c-3-3-5-5-5-8" />
    </svg>
  ),
  reference: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="m21 15-5-5L5 21" />
    </svg>
  ),
  removeColor: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 16 8-8" />
      <path d="M8 8h8v8" />
    </svg>
  ),
  edgeClean: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 5v14M5 12h14" />
      <path d="M12 8l-2-2 2-2M12 16l-2 2 2 2M16 12l-2-2 2-2M8 12l2-2-2-2" />
    </svg>
  ),
}

const SYMMETRY_LABEL = {
  none: '关闭',
  vertical: '左右对称',
  horizontal: '上下对称',
  both: '十字对称',
}

export default function Toolbar({
  tool,
  onToolChange,
  showGrid,
  onToggleGrid,
  symmetry,
  onCycleSymmetry,
  refActive,
  onToggleRef,
  onCollapse,
}) {
  return (
    <div className="toolbar">
      <button className="rail-hide" onClick={onCollapse} title="隐藏工具栏">
        ◀
      </button>
      {TOOL_ORDER.map((id) => (
        <button
          key={id}
          className={`tool-btn ${tool === id ? 'active' : ''}`}
          onClick={() => onToolChange(id)}
          title={`${TOOLS[id].name}（快捷键 ${TOOLS[id].key}）`}
        >
          {ICONS[id]}
          <span className="tool-name">{TOOLS[id].name}</span>
        </button>
      ))}
      <div className="toolbar-divider" />
      <button
        className={`tool-btn ${symmetry !== 'none' ? 'active' : ''}`}
        onClick={onCycleSymmetry}
        title={`对称绘制：${SYMMETRY_LABEL[symmetry]}（点击切换）`}
      >
        {ICONS.symmetry}
        <span className="tool-name">{SYMMETRY_LABEL[symmetry]}</span>
      </button>
      <button
        className={`tool-btn ${refActive ? 'active' : ''}`}
        onClick={onToggleRef}
        title="原图对照：显示/隐藏转换前的原图窗口（未选过图时点击可选择本地图片）"
      >
        {ICONS.reference}
        <span className="tool-name">原图</span>
      </button>
      <button
        className={`tool-btn ${showGrid ? 'active' : ''}`}
        onClick={onToggleGrid}
        title="显示/隐藏网格"
      >
        {ICONS.grid}
        <span className="tool-name">网格</span>
      </button>
    </div>
  )
}
