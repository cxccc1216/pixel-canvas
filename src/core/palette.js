// 预设色板（十六进制 → {r,g,b}）
import { hexToRgba, toRGBA } from './canvasModel.js'

const toRGB = (hex) => {
  const [r, g, b] = toRGBA(hexToRgba(hex))
  return { r, g, b }
}

export const PALETTES = {
  default: {
    name: '经典 16 色',
    colors: [
      '#000000', '#ffffff', '#ff0000', '#ff7700', '#ffdd00', '#00cc00',
      '#0099ff', '#6633cc', '#ff66cc', '#cc6633', '#999999', '#dddddd',
      '#00cccc', '#ff00ff', '#99ff99', '#003366',
    ],
  },
  pico8: {
    name: 'Pico-8 (32 色)',
    colors: [
      '#000000', '#1D2B53', '#7E2553', '#008751', '#AB5236', '#5F574F',
      '#C2C3C7', '#FFF1E8', '#FF004D', '#FFA300', '#FFEC27', '#00E436',
      '#29ADFF', '#83769C', '#FF77A8', '#FFCCAA', '#291814', '#111D35',
      '#422136', '#125359', '#742F29', '#49333B', '#A28879', '#F3EF7D',
      '#BE1250', '#FF6C24', '#A8E72E', '#00B543', '#065AB5', '#754665',
      '#FF6E59', '#FF9D81',
    ],
  },
  gameboy: {
    name: 'Game Boy (4 色)',
    colors: ['#0F380F', '#306230', '#8BAC0F', '#9BBC0F'],
  },
  default16: {
    name: 'Windows 16 色',
    colors: [
      '#000000', '#000080', '#008000', '#008080', '#800000', '#800080',
      '#808000', '#808080', '#c0c0c0', '#0000ff', '#00ff00', '#00ffff',
      '#ff0000', '#ff00ff', '#ffff00', '#ffffff',
    ],
  },
}

// 预设色板转为 {r,g,b} 数组（供转换算法使用）
export function paletteToRGB(hexColors) {
  return hexColors.map(toRGB)
}

// 预设色板转为 Uint32 数组（供调色板组件使用）
export function paletteToUint32(hexColors) {
  return hexColors.map((hex) => hexToRgba(hex))
}

export function getPaletteByName(name) {
  return PALETTES[name] || PALETTES.default
}
