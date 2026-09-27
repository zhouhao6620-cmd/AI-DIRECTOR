import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, MONO_FAMILY, SOURCE_GEOMETRY, calculateSkillIntroCardLayout, rgbaFromHex} from "./layout.js";
import {ACCENTS, COMPONENT_ID, SURFACE_TOKENS, assertSkillIntroCardProps, resolveCardAccent} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// 与项目其他卡类组件同一条缓动：520 ms cubic-bezier(0.22, 1, 0.36, 1)。
const ease = Easing.bezier(0.22, 1, 0.36, 1);
// 蓝线的「打字机」展开比整体入场更利落：0.16 / 1 / 0.3 / 1。
const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export function SkillIntroCard({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertSkillIntroCardProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateSkillIntroCardLayout(
    {content, position, size, width, height, durationInFrames, fps},
    (text, fontSize, fontWeight, letterSpacing, fontFamily) => measureText({
      text, fontFamily: fontFamily ?? FONT_FAMILY, fontSize, fontWeight, letterSpacing,
    }).width,
  ), [content, position, size, width, height, durationInFrames, fps]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const g = SOURCE_GEOMETRY;

  // 实例时长均分给每张卡：当前卡的时间从本卡时间槽的起点重新计。
  const timeline = layout.timeline;
  const index = timeline.indexAtFrame(frame);
  const localMs = ((frame - index * timeline.slotFrames) / fps) * 1000;
  const card = layout.cards[index];
  const isLast = index === content.cards.length - 1;
  // 每张卡可以单独取一套项目主题色：INHERIT 跟随本实例主题（默认参考图原色蓝）。
  const accentKey = resolveCardAccent(content.cards[index], theme);
  const accent = ACCENTS[accentKey][surface];
  const at = (fromMs, durationMs, easing = ease) => interpolate(
    localMs, [fromMs, fromMs + durationMs], [0, 1], {...clamp, easing},
  );

  const enter = at(0, g.enterMs);
  // 非最后一张卡在时间槽末尾退场，下一张卡紧接着入场。
  const exit = isLast ? 0 : at(timeline.slotMs - g.exitMs, g.exitMs, Easing.linear);
  // 蓝线：从左到右像打字机一样展开，然后定住不动。
  const lineTyping = at(g.lineTypingDelayMs, g.lineTypingMs, easeOut);
  const dividerReveal = at(g.dividerDelayMs, g.dividerRevealMs, easeOut);
  const bodyReveal = at(g.bodyDelayMs, g.bodyRevealMs);
  const badgeReveal = at(g.badgeDelayMs, g.badgeRevealMs);

  const cardBorder = Math.max(1, Math.round(layout.scale));

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID} data-theme={theme} data-surface={surface}
      data-scale={layout.scale} data-card-count={content.cards.length} data-active-card={index}
      data-card-accent={accentKey}
      style={{
        position: "absolute", left: layout.x, top: layout.y,
        width: layout.blockWidth, height: layout.blockHeight,
        boxSizing: "border-box", borderRadius: layout.radius,
        background: tokens.card, border: `${cardBorder}px solid ${tokens.cardBorder}`,
        boxShadow: tokens.cardShadow, overflow: "hidden",
        opacity: enter * (1 - exit),
        transform: `translateY(${interpolate(enter, [0, 1], [g.enterOffsetY, 0]) + interpolate(exit, [0, 1], [0, g.exitOffsetY])}px)`
          + ` scale(${interpolate(enter, [0, 1], [g.enterScaleFrom, 1]) * interpolate(exit, [0, 1], [1, 0.99])})`,
        transformOrigin: "center center",
      }}
    >
      {/* 参考图卡面上的极淡网格纹理 */}
      <div data-sic-grid style={{
        position: "absolute", inset: 0,
        backgroundImage: `repeating-linear-gradient(90deg, ${tokens.grid} 0 1px, transparent 1px ${layout.gridSize}px),`
          + ` repeating-linear-gradient(0deg, ${tokens.grid} 0 1px, transparent 1px ${layout.gridSize}px)`,
      }}/>
      {/* 参考图卡片上沿左侧那段更亮的蓝色高光边 */}
      <div data-sic-highlight style={{
        position: "absolute", left: 0, top: 0,
        width: layout.topHighlightWidth, height: layout.topHighlightHeight,
        // 参考图上沿：左侧最亮，到约 70% 处淡出。
        background: `linear-gradient(90deg, ${accent} 0%, ${rgbaFromHex(accent, 0.36)} 45%, ${rgbaFromHex(accent, 0)} 100%)`,
      }}/>

      <div style={{position: "relative", padding: `${layout.paddingY}px ${layout.paddingX}px`}}>
        <div data-sic-skill style={{
          fontFamily: MONO_FAMILY, fontSize: layout.skillFontSize, fontWeight: g.skillFontWeight,
          lineHeight: layout.skillLineHeight, letterSpacing: `${layout.skillLetterSpacing}px`, color: tokens.ink,
        }}>
          {card.skill.map((line, lineIndex) => <div data-text-line key={lineIndex} style={{whiteSpace: "pre"}}>{line}</div>)}
        </div>

        <div data-sic-line-progress={lineTyping.toFixed(3)} style={{height: layout.accentBarHeight, marginTop: layout.accentBarMarginTop, marginBottom: layout.accentBarMarginBottom}}>
          <div data-sic-line style={{
            width: layout.accentBarWidth, height: layout.accentBarHeight, borderRadius: layout.accentBarRadius,
            background: accent, transform: `scaleX(${lineTyping})`, transformOrigin: "left center",
          }}/>
        </div>

        <div data-sic-hook data-hook-lines={card.hook.length} style={{
          color: accent, fontSize: layout.hookFontSize, fontWeight: g.hookFontWeight, lineHeight: layout.hookLineHeight,
        }}>
          {card.hook.map((line, lineIndex) => {
            const reveal = at(g.hookDelayMs + lineIndex * g.hookStaggerMs, g.hookRevealMs);
            return <div key={lineIndex} style={{overflow: "hidden"}}>
              <div data-text-line style={{
                whiteSpace: "pre",
                transform: `translateY(${interpolate(reveal, [0, 1], [112, 0], clamp)}%)`,
                opacity: interpolate(reveal, [0, 0.4], [0, 1], clamp),
              }}>{line}</div>
            </div>;
          })}
        </div>

        <div data-sic-divider style={{
          height: layout.dividerThickness, marginTop: layout.dividerMarginTop, marginBottom: layout.dividerMarginBottom,
          background: tokens.divider, transform: `scaleX(${dividerReveal})`, transformOrigin: "left center",
        }}/>

        <div data-sic-body data-body-lines={card.body.length} style={{
          fontSize: layout.bodyFontSize, lineHeight: layout.bodyLineHeight, color: tokens.body,
          opacity: bodyReveal, transform: `translateY(${interpolate(bodyReveal, [0, 1], [10, 0], clamp)}px)`,
        }}>
          {card.body.map((line, lineIndex) => <div data-text-line key={lineIndex} style={{whiteSpace: "pre"}}>{line}</div>)}
        </div>

        {card.badge ? <div style={{display: "flex", marginTop: layout.badgeMarginTop}}>
          <div data-sic-badge style={{
            display: "inline-flex", alignItems: "center", gap: layout.badgeGap,
            padding: `${layout.badgePaddingY}px ${layout.badgePaddingX}px`, borderRadius: 999,
            border: `${layout.badgeBorderWidth}px solid ${rgbaFromHex(accent, g.badgeBorderAlpha)}`,
            background: rgbaFromHex(accent, g.badgeFillAlpha),
            color: accent, fontSize: layout.badgeFontSize, fontWeight: g.badgeFontWeight, lineHeight: layout.badgeLineHeight,
            opacity: badgeReveal, transform: `scale(${interpolate(badgeReveal, [0, 1], [0.92, 1], clamp)})`,
            transformOrigin: "left center",
          }}>
            <span data-sic-badge-dot style={{
              width: layout.badgeDotSize, height: layout.badgeDotSize, borderRadius: "50%", background: accent, flex: "none",
            }}/>
            <span style={{whiteSpace: "pre"}}>{card.badge}</span>
          </div>
        </div> : null}
      </div>
    </div>
  </AbsoluteFill>;
}
