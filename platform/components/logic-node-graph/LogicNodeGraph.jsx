import React, {useMemo} from "react";
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {FONT_FAMILY, SOURCE_GEOMETRY, calculateLogicNodeGraphLayout} from "./layout.js";
import {ACCENTS, SURFACE_TOKENS, assertLogicNodeGraphProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
const EASE = Easing.bezier(0.22, 1, 0.36, 1);
const NODE_MS = SOURCE_GEOMETRY.nodeEnterMs;
const LINE_MS = SOURCE_GEOMETRY.lineDrawMs;

export function LogicNodeGraph({content, stepMs, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertLogicNodeGraphProps({content, stepMs, surface, theme, durationInFrames}, {fps, width, height});
  const layout = useMemo(() => calculateLogicNodeGraphLayout({
    content, width, height,
    measure: (text, fontSize, fontWeight) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight}).width,
  }), [content, width, height]);
  if (layout.overflow.length) {
    const first = layout.overflow[0];
    const message = first.type === "NODE_TOO_WIDE"
      ? `节点「${first.label ?? ""}」名称过长，超出单行卡片可用宽度；请缩短名称。`
      : first.type === "NODES_TOO_CLOSE"
        ? `当前画幅下节点「${first.a}」与「${first.b}」会互相重叠；请减少分支 / 二级节点，缩短名称，或使用横屏画幅。`
        : first.type === "TOO_MANY_NODES"
          ? "节点总数超过 13 个上限；请减少分支或二级节点。"
          : "节点布局超出画布安全区；请减少节点或缩短名称。";
    throw new Error(message);
  }

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const framesOf = ms => (ms / 1000) * fps;
  const timeMs = (frame / fps) * 1000;
  const nodeById = new Map(layout.nodes.map(node => [node.id, node]));

  return <AbsoluteFill style={{pointerEvents: "none", backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id="CMP-LNG-001"
      data-surface={surface} data-theme={theme}
      data-node-count={layout.nodeCount}
      data-link-count={layout.links.length}
      data-entered-count={layout.nodes.filter(node => timeMs >= node.enterAtMs).length}
      style={{position: "absolute", inset: 0, width, height}}
    >
      <svg data-lng-lines width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{position: "absolute", inset: 0}}>
        {layout.links.map(link => {
          const target = nodeById.get(link.to);
          const progress = interpolate(frame, [framesOf(target.enterAtMs), framesOf(target.enterAtMs + LINE_MS)], [0, 1], {...clamp, easing: EASE});
          if (progress <= 0) return null;
          return <path
            key={link.id}
            data-lng-link={link.id}
            data-lng-link-from={link.from}
            data-lng-link-to={link.to}
            d={link.line.d}
            fill="none"
            stroke={accent}
            strokeWidth={SOURCE_GEOMETRY.connectorStrokeWidth * layout.scale}
            strokeLinecap="round"
            strokeDasharray={link.line.length}
            strokeDashoffset={link.line.length * (1 - progress)}
            opacity={0.9}
          />;
        })}
      </svg>

      {layout.nodes.map(node => {
        const enter = interpolate(frame, [framesOf(node.enterAtMs), framesOf(node.enterAtMs + NODE_MS)], [0, 1], {...clamp, easing: EASE});
        const isCenter = node.kind === "CENTER";
        const isLeaf = node.kind === "LEAF";
        const borderColor = isLeaf ? tokens.glassBorder : accent;
        return <div
          key={node.id}
          data-lng-node-id={node.id}
          data-lng-node-kind={node.kind}
          data-lng-node-order={node.order}
          data-lng-node-x={node.x.toFixed(2)}
          data-lng-node-y={node.y.toFixed(2)}
          style={{
            position: "absolute",
            left: node.x - node.width / 2, top: node.y - node.height / 2,
            width: node.width, height: node.height, boxSizing: "border-box",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: node.radius,
            border: `${Math.max(1, node.borderWidth)}px solid ${borderColor}`,
            background: isCenter ? `linear-gradient(160deg, ${hexWithAlpha(accent, 0.34)}, ${hexWithAlpha(accent, 0.12)}), ${tokens.node}` : tokens.glass,
            backgroundColor: isCenter ? tokens.node : tokens.node,
            boxShadow: tokens.cardShadow,
            padding: `0 ${node.paddingX}px`,
            opacity: enter,
            transform: `scale(${interpolate(enter, [0, 1], [0.86, 1])})`,
          }}
        >
          <span data-lng-node-label style={{
            whiteSpace: "pre", color: isLeaf ? tokens.muted : tokens.ink,
            fontSize: node.fontSize, fontWeight: node.fontWeight, lineHeight: 1.2,
          }}>{node.label}</span>
        </div>;
      })}
    </div>
  </AbsoluteFill>;
}

function hexWithAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
