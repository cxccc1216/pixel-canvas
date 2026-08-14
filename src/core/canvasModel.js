// 像素数据模型：多帧动画支持，每帧一个 Uint32Array
// 打包格式按标准 RGBA 内存布局（little-endian Uint32 = 0xAABBGGRR），
// 可直接与 ImageData 的 Uint32Array 视图互转，无需逐字节拷贝。
// 兼容约定：this.data 始终指向当前帧数组，既有绘制代码无需改动。

export const DEFAULT_SIZE = 32
export const MAX_UNDO = 30

export class PixelCanvas {
  constructor(width = DEFAULT_SIZE, height = DEFAULT_SIZE) {
    this.width = width
    this.height = height
    this.frames = [new Uint32Array(width * height)] // 0 = 全透明
    this.currentFrame = 0
    this.data = this.frames[0]
    this.undoStack = []
    this.redoStack = []
    this.maxUndo = MAX_UNDO
  }

  index(x, y) {
    return y * this.width + x
  }

  getPixel(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return 0
    return this.data[this.index(x, y)]
  }

  setPixel(x, y, color) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    this.data[this.index(x, y)] = color
  }

  // ===== 帧操作 =====

  get frameCount() {
    return this.frames.length
  }

  setCurrentFrame(i) {
    if (i < 0 || i >= this.frames.length || i === this.currentFrame) return
    this.currentFrame = i
    this.data = this.frames[i]
  }

  /** 复制当前帧并追加为新帧，返回新帧索引 */
  addFrame() {
    const f = this.data.slice()
    this.frames.push(f)
    this.currentFrame = this.frames.length - 1
    this.data = f
    this.resetHistory()
    return this.currentFrame
  }

  /** 在指定帧后插入其副本，返回新帧索引 */
  duplicateFrame(i = this.currentFrame) {
    const idx = Math.min(i + 1, this.frames.length)
    this.frames.splice(idx, 0, this.frames[i].slice())
    this.currentFrame = idx
    this.data = this.frames[idx]
    this.resetHistory()
    return idx
  }

  /** 删除指定帧（至少保留 1 帧），返回当前帧索引 */
  deleteFrame(i = this.currentFrame) {
    if (this.frames.length <= 1) return this.currentFrame
    this.frames.splice(i, 1)
    this.currentFrame = Math.min(i, this.frames.length - 1)
    this.data = this.frames[this.currentFrame]
    this.resetHistory()
    return this.currentFrame
  }

  /** 移动帧到新位置（用于排序） */
  moveFrame(from, to) {
    if (
      from === to ||
      from < 0 ||
      from >= this.frames.length ||
      to < 0 ||
      to >= this.frames.length
    )
      return
    const [f] = this.frames.splice(from, 1)
    this.frames.splice(to, 0, f)
    this.currentFrame = to
    this.data = this.frames[to]
    this.resetHistory()
  }

  // ===== 撤销/重做（作用于当前帧） =====

  resetHistory() {
    this.undoStack = []
    this.redoStack = []
  }

  snapshot() {
    return this.data.slice()
  }

  restore(snap) {
    this.data.set(snap)
  }

  pushHistory() {
    this.undoStack.push(this.snapshot())
    if (this.undoStack.length > this.maxUndo) this.undoStack.shift()
    this.redoStack.length = 0
  }

  canUndo() {
    return this.undoStack.length > 0
  }

  canRedo() {
    return this.redoStack.length > 0
  }

  undo() {
    if (!this.canUndo()) return
    this.redoStack.push(this.snapshot())
    this.restore(this.undoStack.pop())
  }

  redo() {
    if (!this.canRedo()) return
    this.undoStack.push(this.snapshot())
    this.restore(this.redoStack.pop())
  }

  // ===== 结构操作 =====

  resize(w, h, fill = 0) {
    const apply = (src) => {
      const nd = new Uint32Array(w * h)
      if (fill !== 0) nd.fill(fill)
      const cw = Math.min(w, this.width)
      const ch = Math.min(h, this.height)
      for (let y = 0; y < ch; y++) {
        for (let x = 0; x < cw; x++) {
          nd[y * w + x] = src[y * this.width + x]
        }
      }
      return nd
    }
    this.frames = this.frames.map(apply)
    this.width = w
    this.height = h
    this.currentFrame = 0
    this.data = this.frames[0]
    this.resetHistory()
  }

  clear(color = 0) {
    this.frames.forEach((f) => f.fill(color))
    this.resetHistory()
  }

  /**
   * 从像素数组载入（用于导入转换结果 / 工程文件），重置为单帧
   * @param {number} w
   * @param {number} h
   * @param {Array|Uint32Array} colors
   * @param {Array<Array|Uint32Array>} [allFrames] 多帧工程数据
   */
  loadPixels(w, h, colors, allFrames) {
    this.width = w
    this.height = h
    if (allFrames && allFrames.length) {
      this.frames = allFrames.map((f) => new Uint32Array(f))
    } else {
      this.frames = [new Uint32Array(colors)]
    }
    this.currentFrame = 0
    this.data = this.frames[0]
    this.resetHistory()
  }

  /** 序列化为可 JSON 化的工程对象（含全部帧） */
  serialize() {
    return {
      app: 'pixel-canvas',
      version: 2,
      width: this.width,
      height: this.height,
      frames: this.frames.map((f) => Array.from(f)),
    }
  }
}

// 打包颜色（AABBGGRR 布局，与 ImageData little-endian 一致）
// 注意：JS 位运算结果为有符号 32 位，必须 >>> 0 转无符号，
// 才能与 Uint32Array 存取的值保持一致（否则 alpha>=128 时返回负值）。
export function rgba(r, g, b, a = 255) {
  return (
    ((a & 0xff) << 24) |
    ((b & 0xff) << 16) |
    ((g & 0xff) << 8) |
    (r & 0xff)
  ) >>> 0
}

export function toRGBA(color) {
  return [
    color & 0xff, // R
    (color >>> 8) & 0xff, // G
    (color >>> 16) & 0xff, // B
    (color >>> 24) & 0xff, // A
  ]
}

export function toHex(color) {
  const [r, g, b, a] = toRGBA(color)
  const hex = (c) => c.toString(16).padStart(2, '0')
  return a === 255
    ? `#${hex(r)}${hex(g)}${hex(b)}`
    : `#${hex(r)}${hex(g)}${hex(b)}${hex(a)}`
}

export function hexToRgba(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255
  return rgba(r, g, b, a)
}
