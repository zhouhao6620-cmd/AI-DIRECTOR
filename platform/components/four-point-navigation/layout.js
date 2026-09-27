// Start from the source geometry. Widen only if wrapped content cannot fit
// vertically, then reduce uniformly. Never drop text to preserve a fixed box.
export function calculateNavigationLayout({content, width, height, size, position}, measure) {
  const safeX = width * (84 / 1080);
  const safeY = height * 0.08;
  const maxWidth = width - safeX * 2;
  const maxHeight = height - safeY * 2 - 48;
  let layout;
  for (let factor = size; factor >= 32 / 42; factor -= 0.025) {
    for (let cardWidth = 430 * size; ; cardWidth = Math.min(maxWidth, cardWidth + 80 * size)) {
      const titleSize = 68 * factor, textSize = 42 * factor;
      const titleSpacing = -2 * factor, textSpacing = factor;
      const titleLines = wrapText(content.title, cardWidth, titleSize, 800, titleSpacing, measure);
      const column = 66 * factor, columnGap = 18 * factor;
      const padLeft = 14 * factor, padRight = 22 * factor, padY = 12 * factor, border = 2 * factor;
      const rows = content.items.map(item => {
        const lines = wrapText(item.label, cardWidth - padLeft - padRight - column - columnGap - border * 2, textSize, 720, textSpacing, measure);
        return {id:item.id,label:item.label,lines,height:Math.max(92 * factor,lines.length * textSize * 1.2 + padY * 2 + border * 2)};
      });
      const titleHeight = titleLines.length * titleSize * 1.12;
      const titleGap = 36 * factor, gap = 20 * factor;
      const cardHeight = titleHeight + titleGap + rows.reduce((sum,row)=>sum+row.height,0) + gap * (rows.length - 1);
      if (cardHeight <= maxHeight) {
        layout = {factor,cardWidth,cardHeight,titleSize,textSize,titleSpacing,textSpacing,titleLines,titleHeight,titleGap,gap,column,columnGap,padLeft,padRight,padY,border,badge:62*factor,rows};
        break;
      }
      if (cardWidth === maxWidth) break;
    }
    if (layout) break;
  }
  if (!layout) throw new Error("文字无法在安全区域内完整显示，请缩短文字或调整大小。");
  return {
    ...layout,
    x: safeX + (width - safeX * 2 - layout.cardWidth) * position.x,
    y: safeY + (height - safeY * 2 - layout.cardHeight - 48) * position.y,
  };
}

function wrapText(text, maxWidth, fontSize, fontWeight, letterSpacing, measure) {
  const lines = [];
  let line = "";
  const graphemes = [...new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(text)].map(s => s.segment);
  for (const char of graphemes) {
    if (line && measure(line + char, fontSize, fontWeight, letterSpacing) > maxWidth) {
      lines.push(line);
      line = char;
    } else line += char;
  }
  if (line) lines.push(line);
  return lines;
}
