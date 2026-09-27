import React, {useMemo} from "react";
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {calculateNavigationLayout} from "./layout.js";
import {THEMES, assertNavigationProps} from "./model.js";

// Preserved from the user-owned Remotion source (definition.provenance).
const fontFamily = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function FourPointNavigation({content, position, size, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertNavigationProps({content,position,size,theme,durationInFrames},{fps,width,height});
  const layout = useMemo(() => calculateNavigationLayout({content, position, size, width, height},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily, fontSize, fontWeight, letterSpacing}).width), [content, position, size, width, height]);
  const colors = THEMES[theme];
  const entrance = spring({frame, fps, config: {damping:18, stiffness:120}});
  const focusInterval = Math.min(fps * 1.35, durationInFrames / content.items.length);
  const active = Math.min(content.items.length - 1, Math.max(0, Math.floor(frame / focusInterval)));
  const f = layout.factor;

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily}}>
    <div data-component-id="CMP-NAV-004" data-theme={theme} data-active-index={active} style={{
      position: "absolute", left: layout.x, top: layout.y, width: layout.cardWidth,
      color: "#f8fafc", opacity: interpolate(frame, [0, 12], [0, 1], clamp),
      scale: interpolate(entrance, [0, 1], [0.88, 1]),
      translate: `0 ${interpolate(entrance, [0, 1], [48, 0])}px`, transformOrigin: "left top",
    }}>
      <div data-nav-title style={{fontSize: layout.titleSize, fontWeight: 800, lineHeight: 1.12, marginBottom: layout.titleGap,
        letterSpacing: layout.titleSpacing, textShadow: `0 ${4*f}px ${24*f}px rgba(0,0,0,0.28)`}}>
        {layout.titleLines.map((line, i) => <div data-text-line key={i} style={{whiteSpace: "pre"}}>{line}</div>)}
      </div>
      <div style={{display: "grid", gap: layout.gap}}>
        {layout.rows.map((row, index) => {
          const reveal = spring({frame: frame - 10 - index * 8, fps, config: {damping: 20, stiffness: 150}});
          const selected = index === active;
          return <div data-node-id={row.id} data-node-active={selected} key={row.id} style={{
            boxSizing: "border-box", width: layout.cardWidth, height: row.height,
            padding: `${layout.padY}px ${layout.padRight}px ${layout.padY}px ${layout.padLeft}px`, borderRadius: 24*f,
            display: "grid", gridTemplateColumns: `${layout.column}px 1fr`, gap: layout.columnGap, alignItems: "center",
            border: `${layout.border}px solid ${selected ? colors.accent : "rgba(255,255,255,0.2)"}`,
            backgroundColor: selected ? colors.active : "rgba(15,23,42,0.78)",
            boxShadow: selected ? `0 ${16*f}px ${46*f}px ${colors.shadow}` : `0 ${10*f}px ${30*f}px rgba(2,6,23,0.2)`,
            opacity: reveal, translate: `${interpolate(reveal, [0, 1], [-32, 0])}px 0`, scale: selected ? 1.035 : 1,
          }}>
            <div data-node-badge style={{display: "grid", placeItems: "center", width: layout.badge, height: layout.badge,
              borderRadius: 18*f, fontSize: 30*f, fontWeight: 850,
              backgroundColor: selected ? colors.pale : "rgba(255,255,255,0.1)", color: selected ? colors.ink : "#cbd5e1"}}>{index + 1}</div>
            <div data-node-text style={{fontSize: layout.textSize, fontWeight: 720, lineHeight: 1.2, letterSpacing: layout.textSpacing}}>
              {row.lines.map((line, i) => <div data-text-line key={i} style={{whiteSpace: "pre"}}>{line}</div>)}
            </div>
          </div>;
        })}
      </div>
    </div>
  </AbsoluteFill>;
}
