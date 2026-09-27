import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, staticFile, useCurrentFrame, useVideoConfig} from "remotion";
import {FONT_FAMILY, calculateFreeMediaLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertFreeMediaProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const ENTER_MS = 460;

export function FreeMedia({content, variant, stepMs, surface = "DARK", theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertFreeMediaProps({content, variant, stepMs, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateFreeMediaLayout({content, variant, width, height, stepMs}), [content, variant, width, height, stepMs]);
  if (layout.overflow.length) {
    const first = layout.overflow[0];
    throw new Error(`媒体项「${first.id}」超出画布安全区（宽 ${Math.round(first.width)} px、高 ${Math.round(first.height)} px）；请缩小尺寸或调整归一化位置。`);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const framesOf = ms => (ms / 1000) * fps;
  const timeMs = (frame / fps) * 1000;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-MED-001"
      data-variant={variant} data-surface={surface} data-theme={theme}
      data-item-count={layout.items.length}
      data-entered-count={layout.items.filter(item => timeMs >= item.enterAtMs).length}
      style={{position: "absolute", inset: 0, width, height}}
    >
      {layout.items.map(item => {
        const enter = interpolate(frame, [framesOf(item.enterAtMs), framesOf(item.enterAtMs + ENTER_MS)], [0, 1], {...clamp, easing: EASE});
        const mediaStyle = {width: "100%", height: "100%", objectFit: item.fit === "COVER" ? "cover" : "contain", display: "block"};
        return <div
          key={item.id}
          data-fm-item-id={item.id}
          data-fm-item-kind={item.kind}
          data-fm-item-src={item.src}
          data-fm-item-fit={item.fit}
          data-fm-item-index={item.index}
          style={{
            position: "absolute", left: item.x, top: item.y, width: item.width, height: item.height,
            boxSizing: "border-box", overflow: "hidden",
            borderRadius: item.radius,
            opacity: enter * item.opacity,
            transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])})`,
            // BARE keeps the raw asset edges; FRAMED adds the HUD glass border + shadow.
            border: item.borderWidth ? `${item.borderWidth}px solid ${tokens.frameBorder}` : "none",
            boxShadow: item.borderWidth ? tokens.frameShadow : "none",
          }}
        >
          {item.kind === "VIDEO"
            ? <OffthreadVideo src={staticFile(item.src)} muted style={mediaStyle} pauseWhenBuffering/>
            : <Img src={staticFile(item.src)} style={mediaStyle}/>}
          {item.borderWidth ? <div data-fm-frame style={{
            position: "absolute", inset: 0, borderRadius: item.radius,
            boxShadow: `inset 0 0 0 1px ${accent}33`,
          }}/> : null}
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}
