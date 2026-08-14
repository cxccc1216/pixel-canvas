// 多帧动画 + 对称 + GIF 导出 验证脚本（Node 运行）
import { PixelCanvas, rgba } from '../src/core/canvasModel.js'
import { symmetricPoints, paintBrush, removeColor, removeColorRegion, removeColorTolerance, removeColorRegionTolerance } from '../src/core/tools.js'
import { exportGIF } from '../src/core/gifExporter.js'

let failed = 0
const assert = (cond, msg) => {
  if (!cond) {
    console.error('✗ FAIL:', msg)
    failed++
  } else {
    console.log('✓', msg)
  }
}

// ===== 1. 多帧模型 =====
const m = new PixelCanvas(4, 4)
assert(m.frameCount === 1, '初始 1 帧')

m.setPixel(0, 0, rgba(255, 0, 0))
m.addFrame()
assert(m.frameCount === 2, 'addFrame 后 2 帧')
assert(m.data !== m.frames[0], '新帧为独立数组（非共享引用）')
assert(m.getPixel(0, 0) === rgba(255, 0, 0), 'addFrame 复制当前帧内容')

m.setPixel(1, 1, rgba(0, 255, 0))
m.setCurrentFrame(0)
assert(m.getPixel(1, 1) === 0, '帧间数据隔离（改第2帧不影响第1帧）')
m.setCurrentFrame(1)
assert(m.getPixel(1, 1) === rgba(0, 255, 0), '切回第 2 帧数据正确')

const cur = m.duplicateFrame(0)
assert(m.frameCount === 3 && m.currentFrame === 1, 'duplicateFrame 在指定帧后插入并选中')

m.moveFrame(2, 0)
assert(m.currentFrame === 0 && m.frames[0] === m.data, 'moveFrame 移动并更新当前帧')

m.deleteFrame(0)
m.deleteFrame(0)
m.deleteFrame(0)
assert(m.frameCount === 1, '删除帧最少保留 1 帧')

// 撤销作用于当前帧
m.setCurrentFrame(0)
m.setPixel(2, 2, rgba(1, 2, 3))
m.pushHistory()
m.setPixel(2, 2, 0)
m.undo()
assert(m.getPixel(2, 2) === rgba(1, 2, 3), 'undo 恢复当前帧绘制')

// 序列化/反序列化（多帧工程）
const m2 = new PixelCanvas(4, 4)
m2.setPixel(0, 0, rgba(9, 9, 9))
m2.addFrame()
m2.setPixel(1, 1, rgba(8, 8, 8))
const s = m2.serialize()
assert(s.frames.length === 2 && s.width === 4 && s.height === 4, 'serialize 含全部帧')
const m3 = new PixelCanvas(1, 1)
m3.loadPixels(s.width, s.height, s.frames[0], s.frames)
assert(m3.frameCount === 2, 'loadPixels 还原帧数')
// loadPixels 载入后默认当前帧为第 1 帧（设计行为），切到第 2 帧验证数据
m3.setCurrentFrame(1)
assert(m3.getPixel(1, 1) === rgba(8, 8, 8), 'loadPixels 还原第 2 帧数据')

// ===== 2. 对称点计算 =====
assert(symmetricPoints(1, 2, 8, 8, 'none').length === 1, '关闭对称：1 个点')
const pv = symmetricPoints(1, 2, 8, 8, 'vertical')
assert(pv.length === 2 && pv[1][0] === 6 && pv[1][1] === 2, '垂直对称：镜像 x')
const ph = symmetricPoints(1, 2, 8, 8, 'horizontal')
assert(ph.length === 2 && ph[1][0] === 1 && ph[1][1] === 5, '水平对称：镜像 y')
const pb = symmetricPoints(1, 2, 8, 8, 'both')
assert(pb.length === 4, '十字对称：4 个点')
// 中心点在十字对称下只映射到自身（去重后 1 个点），这是正确行为
const pc = symmetricPoints(3, 3, 7, 7, 'both')
assert(new Set(pc.map((p) => p.join(','))).size === 1, '奇数尺寸中心点去重后仅自身')
// 非中心点十字对称应产生 4 个互不重复的点
const pn = symmetricPoints(1, 1, 7, 7, 'both')
assert(new Set(pn.map((p) => p.join(','))).size === 4, '非中心点十字对称 4 点互不重复')

// ===== 2.5 笔刷绘制 =====
const brush = new PixelCanvas(8, 8)
paintBrush(brush, 4, 4, 3, rgba(255, 0, 0), 'none')
let brushCount = 0
for (let i = 0; i < 64; i++) if (brush.data[i] !== 0) brushCount++
assert(brushCount === 9, `3×3 笔刷覆盖 9 像素（实际 ${brushCount}）`)

// 偶数尺寸：2×2 覆盖 4 像素
const brushEven = new PixelCanvas(8, 8)
paintBrush(brushEven, 4, 4, 2, rgba(0, 255, 0), 'none')
let evenCount = 0
for (let i = 0; i < 64; i++) if (brushEven.data[i] !== 0) evenCount++
assert(evenCount === 4, `2×2 笔刷覆盖 4 像素（实际 ${evenCount}）`)

// 边界裁剪：画布边缘笔刷不越界
const brushEdge = new PixelCanvas(8, 8)
paintBrush(brushEdge, 0, 0, 5, rgba(0, 0, 255), 'none')
// 5×5 笔刷中心 (0,0) → 覆盖 x 0-2, y 0-2 共 9 像素
let edgeCount = 0
for (let i = 0; i < 64; i++) if (brushEdge.data[i] !== 0) edgeCount++
assert(edgeCount === 9, `边缘笔刷裁剪正确（实际 ${edgeCount}）`)

// 对称 + 笔刷：左右对称时笔刷块镜像
const brushSym = new PixelCanvas(8, 8)
paintBrush(brushSym, 2, 4, 2, rgba(255, 255, 0), 'vertical')
let symCount = 0
for (let i = 0; i < 64; i++) if (brushSym.data[i] !== 0) symCount++
// 2×2 块（x1-2）→ 镜像到 x5-6，共 8 像素
assert(symCount === 8, `对称笔刷 2×2 块 ×2 侧 = 8 像素（实际 ${symCount}）`)
const hasMirror = brushSym.getPixel(4, 4) === rgba(255, 255, 0) && brushSym.getPixel(5, 4) === rgba(255, 255, 0)
assert(hasMirror, '对称笔刷在镜像侧正确绘制')

// ===== 2.6 去除色块 =====
const rm = new PixelCanvas(4, 4)
const RED = rgba(255, 0, 0)
const BLUE = rgba(0, 0, 255)
rm.setPixel(0, 0, RED)
rm.setPixel(1, 0, RED)
rm.setPixel(2, 2, BLUE)
rm.setPixel(3, 3, RED)
const removed = removeColor(rm, RED)
assert(removed === 3, `去除 3 个红色像素（实际 ${removed}）`)
assert(rm.getPixel(0, 0) === 0 && rm.getPixel(1, 0) === 0 && rm.getPixel(3, 3) === 0, '红色像素已变透明')
assert(rm.getPixel(2, 2) === BLUE, '其他颜色不受影响')
assert(removeColor(rm, RED) === 0, '重复去除返回 0（无该色像素）')
// 多帧隔离：去除只作用于当前帧
const rm2 = new PixelCanvas(2, 2)
rm2.setPixel(0, 0, RED)
rm2.addFrame()
rm2.frames[1][0] = RED
rm2.setCurrentFrame(0)
removeColor(rm2, RED)
assert(rm2.frames[0][0] === 0 && rm2.frames[1][0] === RED, '去除仅作用于当前帧，不影响其他帧')

// ===== 2.7 按连通区域去除色块 =====
const rr = new PixelCanvas(4, 4)
rr.setPixel(0, 0, RED)
rr.setPixel(1, 0, RED) // 与 (0,0) 连通
rr.setPixel(3, 3, RED) // 孤立红色块
rr.setPixel(2, 2, BLUE)
const regCount = removeColorRegion(rr, 0, 0)
assert(regCount === 2, `连通区域清除 2 像素（实际 ${regCount}）`)
assert(rr.getPixel(0, 0) === 0 && rr.getPixel(1, 0) === 0, '连通区域已变透明')
assert(rr.getPixel(3, 3) === RED, '不相连的孤立同色块保留')
assert(rr.getPixel(2, 2) === BLUE, '其他颜色不受影响')

// 环绕区域：清除闭合区域内部（扫线填充正确性）
const ring = new PixelCanvas(5, 5)
// 画一个红色环（外圈），内部不同色不连通 → 清除外圈环
for (let x = 0; x < 5; x++) {
  ring.setPixel(x, 0, RED)
  ring.setPixel(x, 4, RED)
  ring.setPixel(0, x, RED)
  ring.setPixel(4, x, RED)
}
ring.setPixel(2, 2, BLUE) // 环内部孤立蓝色
const ringCount = removeColorRegion(ring, 0, 0)
assert(ringCount === 16, `清除外圈环 16 像素（实际 ${ringCount}）`)
assert(ring.getPixel(2, 2) === BLUE, '环内部非连通像素保留')

// 点击透明区域：返回 0 且不报错
const empty = new PixelCanvas(3, 3)
assert(removeColorRegion(empty, 1, 1) === 0, '透明区域去除返回 0')

// ===== 3. GIF 导出 =====
const g = new PixelCanvas(16, 16)
g.setPixel(0, 0, rgba(255, 0, 0))
g.addFrame()
g.frames[1][0] = rgba(0, 0, 255)
const bytes = exportGIF(g.frames, g.width, g.height, 100, 2)
assert(bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46, 'GIF 文件头 GIF')
assert(bytes[3] === 0x38 && bytes[4] === 0x39, 'GIF89a 版本')
assert(bytes.length > 100, `GIF 数据非空（${bytes.length} 字节）`)

// ===== 4. 去色容差 =====
const tol = new PixelCanvas(4, 4)
const W1 = rgba(255, 255, 255)
const W2 = rgba(252, 254, 253) // 近似白
const W3 = rgba(240, 240, 245) // 稍远一点的灰白
tol.setPixel(0, 0, W1)
tol.setPixel(1, 0, W2)
tol.setPixel(2, 0, W3)
tol.setPixel(3, 0, RED)
// 容差 32：清除 W1/W2（距离 ~4），W3（距离 ~22）也清除，RED 保留
const tolCount = removeColorTolerance(tol, W1, 32)
assert(tolCount === 3, `容差 32 清除 3 个近白像素（实际 ${tolCount}）`)
assert(tol.getPixel(0, 0) === 0 && tol.getPixel(1, 0) === 0 && tol.getPixel(2, 0) === 0, '近白像素已清除')
assert(tol.getPixel(3, 0) === RED, '红色不受容差影响')
// 容差 0 = 精确匹配
const tol0 = new PixelCanvas(3, 1)
tol0.setPixel(0, 0, W1)
tol0.setPixel(1, 0, W2)
assert(removeColorTolerance(tol0, W1, 0) === 1, '容差 0 只清除精确匹配像素')

// 容差连通区域：连通且相近的一起清，隔断的相近色保留
const tolR = new PixelCanvas(5, 3)
for (let x = 0; x < 3; x++) {
  tolR.setPixel(x, 0, W1)
  tolR.setPixel(x, 1, W2) // 与上面连通且相近
}
tolR.setPixel(4, 0, W1) // 隔断的近白
tolR.setPixel(4, 1, W1)
const tolRCount = removeColorRegionTolerance(tolR, 0, 0, 32)
assert(tolRCount === 6, `容差连通区域清除 6 像素（实际 ${tolRCount}）`)
assert(tolR.getPixel(4, 0) === W1 && tolR.getPixel(4, 1) === W1, '隔断的相近色保留')
assert(removeColorRegionTolerance(tolR, 4, 0, 32) === 2, '再点隔断区域可单独清除')

console.log(failed === 0 ? '\n✅ 全部测试通过' : `\n❌ ${failed} 项失败`)
process.exit(failed === 0 ? 0 : 1)
