// 中位切分法（Median Cut）颜色量化
// 把像素颜色按 RGB 立方体反复二分，得到 numColors 个颜色桶，取每桶均值作为调色板

/** RGB 颜色欧氏距离（0 ~ 441） */
export function colorDist(a, b) {
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

/**
 * @param {Array<[r,g,b]>} pixels 像素 RGB 数组（排序会就地修改顺序，仅用于取均值，安全）
 * @param {number} numColors 目标颜色数
 * @returns {Array<{r:number,g:number,b:number}>}
 */
export function medianCut(pixels, numColors) {
  if (!pixels.length) return []
  const boxes = [{ start: 0, end: pixels.length }]

  while (boxes.length < numColors) {
    let bestIdx = -1
    let bestRange = -1
    let bestChannel = 0

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]
      const count = box.end - box.start
      if (count < 2) continue
      let min = [255, 255, 255]
      let max = [0, 0, 0]
      for (let j = box.start; j < box.end; j++) {
        const p = pixels[j]
        for (let c = 0; c < 3; c++) {
          if (p[c] < min[c]) min[c] = p[c]
          if (p[c] > max[c]) max[c] = p[c]
        }
      }
      const ranges = [max[0] - min[0], max[1] - min[1], max[2] - min[2]]
      const chan = ranges.indexOf(Math.max(...ranges))
      if (ranges[chan] > bestRange) {
        bestRange = ranges[chan]
        bestIdx = i
        bestChannel = chan
      }
    }

    // 色差为 0（纯色/近似色）时无信息增益，提前停止
    if (bestRange <= 0) break

    if (bestIdx === -1) break // 无法再分割

    const box = boxes[bestIdx]
    const seg = pixels
      .slice(box.start, box.end)
      .sort((a, b) => a[bestChannel] - b[bestChannel])
    for (let j = 0; j < seg.length; j++) {
      pixels[box.start + j] = seg[j]
    }
    const mid = box.start + Math.floor(seg.length / 2)
    boxes.splice(bestIdx, 1, { start: box.start, end: mid }, { start: mid, end: box.end })
  }

  return boxes
    .filter((b) => b.end > b.start)
    .map((box) => {
      let r = 0
      let g = 0
      let b = 0
      const n = box.end - box.start
      for (let j = box.start; j < box.end; j++) {
        const p = pixels[j]
        r += p[0]
        g += p[1]
        b += p[2]
      }
      return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) }
    })
}
