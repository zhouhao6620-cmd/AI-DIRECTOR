// 来源与适配说明（COMP-01 组件创建试点）
//
// 来源：用户 2026-09-15 下发的参考图「find-skills 技能介绍卡」
// （原件见 docs/component-assets/references/COMP-01_reference_find-skills-card.png）。
// 参考图实测（原图 816×714；内容区左边界 x≈70、内容宽≈650 px）：
//   标题（等宽粗体）墨高 53 px、宽 418 px / 11 字符；标题下蓝色短线 7 px 高 × 358 px 宽
//   （≈0.55 内容宽）；钩子句中文墨高 46 px、行距 67 px；正文 33 px、行距 58 px；
//   胶囊文字 26 px、胶囊盒 322 × 70 px；卡底对角渐变 #26334F → #101728；
//   强调蓝 #538BFE；正文 #C6CBDD；标题 #F4F8FF。
//
// 本项目把参考图的 650 px 内容宽等比换算到既有卡类组件的 620 px 内容宽，
// 因此下面这套字号（58 / 47 / 34 / 27）与参考图的实际比例一致。
//
// 补建与适配差异（详见 docs/component-assets/COMP-01_QA_REPORT.md）：
//   1. 参考图是单卡；本组件的内容树是 2–4 张卡的数组，实例时长均分给每张卡，
//      一张说完自动切到下一张，切换节奏由实例时长决定、不写死；
//   2. 每一行文字都按 620 px 内容宽测量换行，超出行数上限时明确拒绝，不裁切、不缩字；
//   3. 参考图的固定版式改成安全区内的 0–1 比例位置，与项目其他卡类组件一致。

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  cardContentWidth: 620,
  paddingX: 40,
  paddingY: 40,
  radius: 26,
  gridSize: 46,
  topHighlightHeight: 4,
  topHighlightRatio: 0.6,
  skillFontSize: 58,
  skillFontWeight: 700,
  skillLineHeight: 1.16,
  skillLetterSpacingEm: -0.01,
  accentBarHeight: 7,
  accentBarWidthRatio: 0.55,
  accentBarRadius: 3.5,
  accentBarMarginTop: 22,
  accentBarMarginBottom: 30,
  hookFontSize: 47,
  hookFontWeight: 700,
  hookLineHeight: 1.36,
  dividerThickness: 1,
  dividerMarginTop: 34,
  dividerMarginBottom: 32,
  bodyFontSize: 34,
  bodyFontWeight: 400,
  bodyLineHeight: 1.6,
  badgeMarginTop: 38,
  badgeFontSize: 27,
  badgeFontWeight: 500,
  badgeLineHeight: 1.25,
  badgePaddingX: 26,
  badgePaddingY: 15,
  badgeDotSize: 10,
  badgeGap: 12,
  badgeBorderWidth: 1,
  badgeFillAlpha: 0.14,
  badgeBorderAlpha: 0.38,
  enterMs: 420,
  enterOffsetY: 24,
  enterScaleFrom: 0.985,
  lineTypingDelayMs: 200,
  lineTypingMs: 460,
  hookDelayMs: 620,
  hookRevealMs: 520,
  hookStaggerMs: 110,
  dividerDelayMs: 560,
  dividerRevealMs: 420,
  bodyDelayMs: 760,
  bodyRevealMs: 420,
  badgeDelayMs: 980,
  badgeRevealMs: 320,
  exitMs: 320,
  exitOffsetY: -14,
  minSlotMs: 2600,
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const MONO_FAMILY = '"SF Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

export const SAFE_SIDE_RATIO = 0.0625;
export const SAFE_VERTICAL_RATIO = 0.08;
export const MIN_SCALE = 0.62;
export const MAX_SKILL_LINES = 2;
export const MAX_HOOK_LINES = 2;
export const MAX_BODY_LINES = 3;
export const MIN_CARDS = 2;
export const MAX_CARDS = 4;

const round = value => Number(value.toFixed(3));

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

// 按内容宽度做字素级换行；measure(text, fontSize, fontWeight, letterSpacing, fontFamily)。
export function wrapText(text, maxWidth, fontSize, fontWeight, letterSpacing, measure, fontFamily) {
  const lines = [];
  let line = "";
  const graphemes = [...new Intl.Segmenter("zh", {granularity: "grapheme"}).segment(text)].map(item => item.segment);
  for (const grapheme of graphemes) {
    if (line && measure(line + grapheme, fontSize, fontWeight, letterSpacing, fontFamily) > maxWidth) {
      lines.push(line);
      line = grapheme;
    } else line += grapheme;
  }
  if (line) lines.push(line);
  return lines;
}

export function naturalCardWidth() {
  const g = SOURCE_GEOMETRY;
  return g.paddingX * 2 + g.cardContentWidth;
}

// 数据胶囊整串文字，空串按「没有胶囊」处理（实验页清空即收起，不留空位）。
export function badgeTextOf(card) {
  return typeof card?.badge === "string" ? card.badge.trim() : "";
}

export function measureCard(card, measure) {
  const g = SOURCE_GEOMETRY;
  const skillLetterSpacing = g.skillFontSize * g.skillLetterSpacingEm;
  const skill = wrapText(card.skill, g.cardContentWidth, g.skillFontSize, g.skillFontWeight, skillLetterSpacing, measure, MONO_FAMILY);
  const hook = wrapText(card.hook, g.cardContentWidth, g.hookFontSize, g.hookFontWeight, 0, measure, FONT_FAMILY);
  const body = wrapText(card.body, g.cardContentWidth, g.bodyFontSize, g.bodyFontWeight, 0, measure, FONT_FAMILY);
  const badge = badgeTextOf(card);
  const badgeBoxHeight = badge
    ? g.badgeBorderWidth * 2 + g.badgePaddingY * 2 + g.badgeFontSize * g.badgeLineHeight
    : 0;

  const reasons = [];
  if (skill.length > MAX_SKILL_LINES) reasons.push("技能名过长");
  if (hook.length > MAX_HOOK_LINES) reasons.push("钩子观点过长");
  if (body.length > MAX_BODY_LINES) reasons.push("说明过长");

  const skillBlock = skill.length * g.skillFontSize * g.skillLineHeight;
  const barBlock = g.accentBarMarginTop + g.accentBarHeight + g.accentBarMarginBottom;
  const hookBlock = hook.length * g.hookFontSize * g.hookLineHeight;
  const dividerBlock = g.dividerMarginTop + g.dividerThickness + g.dividerMarginBottom;
  const bodyBlock = body.length * g.bodyFontSize * g.bodyLineHeight;
  const badgeBlock = badge ? g.badgeMarginTop + badgeBoxHeight : 0;

  return {
    skill, hook, body, badge,
    badgeBoxHeight,
    skillLetterSpacing,
    skillBlock, barBlock, hookBlock, dividerBlock, bodyBlock, badgeBlock,
    height: g.paddingY * 2 + skillBlock + barBlock + hookBlock + dividerBlock + bodyBlock + badgeBlock,
    reasons,
  };
}

const cardLabel = (card, index) => {
  const skill = typeof card?.skill === "string" && card.skill.trim() ? card.skill.trim() : `第 ${index + 1} 张`;
  return `第 ${index + 1} 张卡「${skill}」`;
};

export function measureCards(cards, measure) {
  const measured = cards.map(card => measureCard(card, measure));
  const reasons = measured.flatMap((card, index) => card.reasons.map(reason => `${cardLabel(cards[index], index)}：${reason}`));
  return {
    cards: measured,
    width: naturalCardWidth(),
    // 所有卡共用一个卡盒，取最高的那张决定盒高，切换时版式不跳。
    height: Math.max(...measured.map(card => card.height)),
    reasons,
  };
}

// 实例时长均分给每张卡；每张卡低于可读下限时明确拒绝，不静默压时长。
export function resolveCardTimeline({cardCount, durationInFrames, fps}) {
  const durationMs = (durationInFrames / fps) * 1000;
  const slotMs = durationMs / cardCount;
  const minimumMs = SOURCE_GEOMETRY.minSlotMs * cardCount;
  if (slotMs < SOURCE_GEOMETRY.minSlotMs) return {
    tooShort: true,
    slotMs,
    reason: `${cardCount} 张卡每张至少需要 ${(SOURCE_GEOMETRY.minSlotMs / 1000).toFixed(1)} 秒，当前总时长只有 ${(durationMs / 1000).toFixed(1)} 秒；请延长片段到 ${(minimumMs / 1000).toFixed(1)} 秒以上或减少卡数。`,
  };
  const slotFrames = durationInFrames / cardCount;
  return {
    tooShort: false,
    slotMs,
    slotFrames,
    minimumMs,
    indexAtFrame: frame => Math.min(cardCount - 1, Math.max(0, Math.floor(frame / slotFrames))),
  };
}

function scaledMetrics(scale) {
  const g = SOURCE_GEOMETRY;
  const contentWidth = round(g.cardContentWidth * scale);
  const blockWidth = round(naturalCardWidth() * scale);
  return {
    scale: round(scale),
    blockWidth,
    contentWidth,
    paddingX: round(g.paddingX * scale),
    paddingY: round(g.paddingY * scale),
    radius: round(g.radius * scale),
    gridSize: round(g.gridSize * scale),
    topHighlightHeight: round(g.topHighlightHeight * scale),
    topHighlightWidth: round(blockWidth * g.topHighlightRatio),
    skillFontSize: round(g.skillFontSize * scale),
    skillLineHeight: g.skillLineHeight,
    skillLetterSpacing: round(g.skillFontSize * g.skillLetterSpacingEm * scale),
    accentBarHeight: round(g.accentBarHeight * scale),
    accentBarWidth: round(contentWidth * g.accentBarWidthRatio),
    accentBarRadius: round(g.accentBarRadius * scale),
    accentBarMarginTop: round(g.accentBarMarginTop * scale),
    accentBarMarginBottom: round(g.accentBarMarginBottom * scale),
    hookFontSize: round(g.hookFontSize * scale),
    hookLineHeight: g.hookLineHeight,
    dividerThickness: round(g.dividerThickness * scale),
    dividerMarginTop: round(g.dividerMarginTop * scale),
    dividerMarginBottom: round(g.dividerMarginBottom * scale),
    bodyFontSize: round(g.bodyFontSize * scale),
    bodyLineHeight: g.bodyLineHeight,
    badgeMarginTop: round(g.badgeMarginTop * scale),
    badgeFontSize: round(g.badgeFontSize * scale),
    badgeLineHeight: g.badgeLineHeight,
    badgePaddingX: round(g.badgePaddingX * scale),
    badgePaddingY: round(g.badgePaddingY * scale),
    badgeDotSize: round(g.badgeDotSize * scale),
    badgeGap: round(g.badgeGap * scale),
    badgeBorderWidth: round(g.badgeBorderWidth * scale),
  };
}

export function calculateSkillIntroCardLayout({content, position, size, width, height, durationInFrames, fps = 30}, measure) {
  const measured = measureCards(content.cards, measure);
  if (measured.reasons.length) return {overflow: true, reason: `${measured.reasons.join("；")}：超过卡片的可读行数，请缩短文字。`};

  const timeline = resolveCardTimeline({cardCount: content.cards.length, durationInFrames, fps});
  if (timeline.tooShort) return {overflow: true, reason: timeline.reason};

  const safeX = width * SAFE_SIDE_RATIO;
  const safeY = height * SAFE_VERTICAL_RATIO;
  const availableWidth = width - safeX * 2;
  const availableHeight = height - safeY * 2;
  const scale = Math.min(size, availableWidth / measured.width, availableHeight / measured.height);
  if (scale < MIN_SCALE) return {
    overflow: true,
    reason: `内容超出安全区：需要缩到 ${(scale * 100).toFixed(0)}%，低于 ${(MIN_SCALE * 100).toFixed(0)}% 可读下限。请缩短文字或减少卡内行数。`,
  };

  const metrics = scaledMetrics(scale);
  const blockHeight = round(measured.height * scale);
  return {
    overflow: false,
    ...metrics,
    blockHeight,
    x: round(safeX + (availableWidth - metrics.blockWidth) * position.x),
    y: round(safeY + (availableHeight - blockHeight) * position.y),
    cards: measured.cards.map(card => ({skill: card.skill, hook: card.hook, body: card.body, badge: card.badge})),
    timeline,
  };
}
