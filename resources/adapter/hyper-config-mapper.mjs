// HyperFrames Adapter｜配置映射（冒烟测试版）
//
// Role: Reference（冒烟测试件，不是基线）
// 作用：把工作台 Inspector 的四组配置（布局方向 / 内容素材 / 颜色布局 / 动画设置）映射成
//       HyperFrames 的 Variables 与 CSS Custom Properties。
//
// 事实源：本文件的 SURFACE_TOKENS / ACCENTS / resolveTheme / resolveCardAccent 与
//        workbench-v0/platform/components/skill-intro-card/model.js 逐字同源（2026-09-19 复制）。
//        本目录只做只读复制，组件基线改动时需同步；不改动原文件。

// 参考图实测色（DARK）。浅底是同一套层级在浅色画布上的映射，不是参考图自带的状态。
export const SURFACE_TOKENS = {
  DARK: {
    ink: "#F4F8FF",
    body: "#C7CDDF",
    muted: "rgba(199,205,223,0.72)",
    card: "linear-gradient(155deg, #26334F 0%, #1A2338 46%, #101728 100%)",
    grid: "rgba(255,255,255,0.022)",
    cardBorder: "rgba(122,160,255,0.18)",
    divider: "rgba(199,205,223,0.16)",
    cardShadow: "0 34px 80px rgba(4,8,20,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
  },
  LIGHT: {
    ink: "#16203A",
    body: "rgba(22,32,58,0.78)",
    muted: "rgba(22,32,58,0.62)",
    card: "linear-gradient(155deg, #FFFFFF 0%, #F2F5FC 46%, #E6EBF7 100%)",
    grid: "rgba(22,32,58,0.05)",
    cardBorder: "rgba(30,99,216,0.20)",
    divider: "rgba(22,32,58,0.14)",
    cardShadow: "0 24px 60px rgba(88,110,160,0.20), inset 0 1px 0 rgba(255,255,255,0.90)",
  },
};

// 参考图的强调蓝是 #538BFE；其余三套沿用项目既有主题色。
export const ACCENTS = {
  SOURCE: {DARK: "#538BFE", LIGHT: "#1E63D8"},
  BLUE: {DARK: "#538BFE", LIGHT: "#1E63D8"},
  ORANGE: {DARK: "#F0A24F", LIGHT: "#D97A1C"},
  RED: {DARK: "#E88686", LIGHT: "#CF5555"},
  PURPLE: {DARK: "#8F86EA", LIGHT: "#6353D6"},
};

export const CARD_ACCENT_MODES = ["INHERIT", "BLUE", "ORANGE", "RED", "PURPLE"];
export const SURFACES = ["DARK", "LIGHT"];
export const CARD_SLOTS = [1, 2, 3, 4];

export function resolveTheme(projectTheme = "BLUE", instanceTheme = "SOURCE") {
  const result = instanceTheme === "FOLLOW_PROJECT" ? projectTheme : instanceTheme;
  if (!ACCENTS[result]) throw new Error("未知主题。");
  return result;
}

// 单张卡的强调色：没写或写 INHERIT 就跟随实例主题，其余按四套项目主题取色。
export function resolveCardAccent(card, instanceTheme = "SOURCE") {
  const declared = card?.accent ?? "INHERIT";
  if (!CARD_ACCENT_MODES.includes(declared)) throw new Error(`未知的单卡强调色：${declared}`);
  return declared === "INHERIT" ? instanceTheme : declared;
}

// 把 surface 换成一组 CSS Custom Property，交给 HyperFrames 注入 Composition 根元素。
export function toCssTokens(surface = "DARK") {
  return SURFACE_TOKENS[surface] ?? SURFACE_TOKENS.DARK;
}

// 内容 + 主题 + 底色 → HyperFrames Variables。
// 说明：这里只产出「标量」变量（单句文字 / 颜色 / 枚举），复杂内容树仍由编译器生成结构，
//      不把整棵 JSON 塞进一个 string variable（见调研指南 §36）。
export function toVariables({
  content,
  surface = "DARK",
  instanceTheme = "SOURCE",
  projectTheme = "BLUE",
  position = {x: 0.5, y: 0.5},
  size = 1,
  durationSeconds = 12,
} = {}) {
  if (!content?.cards?.length) throw new Error("内容为空：技能介绍卡至少需要 2 张卡。");
  const theme = resolveTheme(projectTheme, instanceTheme);
  const variables = {
    surface,
    size,
    duration: durationSeconds,
    "position-x": position.x,
    "position-y": position.y,
  };
  content.cards.forEach((card, index) => {
    const slot = index + 1;
    variables[`card${slot}_skill`] = card.skill;
    variables[`card${slot}_hook`] = card.hook;
    variables[`card${slot}_body`] = card.body;
    variables[`card${slot}_badge`] = card.badge ?? "";
    variables[`accent-${slot}`] = ACCENTS[resolveCardAccent(card, theme)][surface];
  });
  // 未使用的卡槽显式清空：合成以"第一个空槽位"作为内容结束点。
  for (let slot = content.cards.length + 1; slot <= CARD_SLOTS.length; slot += 1) {
    variables[`card${slot}_skill`] = "";
    variables[`card${slot}_hook`] = "";
    variables[`card${slot}_body`] = "";
    variables[`card${slot}_badge`] = "";
  }
  return {theme, surface, tokens: toCssTokens(surface), variables};
}
