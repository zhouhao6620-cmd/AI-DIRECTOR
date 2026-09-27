// 按技能 V1.2 第 4.1 节写法：结构用 Interactive.* + name，动效用内联 interpolate()，
// 位移与缩放用 translate / scale 属性（不用 transform 字符串），输出范围与 easing 硬编码。
// 已知取舍：本组件的时间轴由内容字段 stepMs 驱动，关键帧的输入范围是计算值，在 Studio 里会灰显
//（官方技能允许这种情况：灰显只表示不可编辑，功能照常）；可交互的是元素选择与样式编辑。
import React, {useMemo} from "react";
import {AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  Activity, Atom, Brain, Droplet, Flame, HeartPulse, Layers, Leaf, Pill, Shield, Target, TrendingUp, Zap,
} from "lucide-react";
import {
  DEFAULT_DIRECTION, FONT_FAMILY, SOURCE_GEOMETRY, calculateStageFlowLayout, panelTimeline,
  resolveActiveStageIndex, spineGeometryFor, spineOpacityAt,
} from "./layout.js";
import {ACCENTS, COMPONENT_ID, SURFACE_TOKENS, assertStageFlowProps} from "./model.js";

// 图标白名单（与 content.schema.json 的 enum、layout 的 ICON_IDS 同源）。
const ICONS = {
  shield: Shield, activity: Activity, "heart-pulse": HeartPulse, brain: Brain, layers: Layers,
  target: Target, "trending-up": TrendingUp, zap: Zap, droplet: Droplet, atom: Atom,
  pill: Pill, flame: Flame, leaf: Leaf,
};

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};
// 项目既有缓动：连线生长、面板展开与其他组件同一条（硬编码，供 Studio 识别）。
const ease = Easing.bezier(0.22, 1, 0.36, 1);
// CL-08：按文字角色字号的离散档位（小／中／大），只作用于声明的角色。
const TEXT_SIZE_SCALES = {SMALL: 0.85, MEDIUM: 1, LARGE: 1.18};

export function StageFlow({content, variant = DEFAULT_DIRECTION, position, size, surface, theme, durationInFrames, titleSize = "MEDIUM", stageLabelSize = "MEDIUM"}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  const textSizeScales = {title: TEXT_SIZE_SCALES[titleSize] ?? 1, stageLabel: TEXT_SIZE_SCALES[stageLabelSize] ?? 1};
  assertStageFlowProps({content, variant, position, size, surface, theme, durationInFrames, titleSize, stageLabelSize}, {fps, width, height});
  const layout = useMemo(() => calculateStageFlowLayout(
    {content, variant, position, size, width, height, durationInFrames, fps, textSizeScales},
    (text, fontSize, fontWeight, letterSpacing) => measureText({text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing}).width,
  ), [content, variant, position, size, width, height, durationInFrames, fps, titleSize, stageLabelSize]);
  if (layout.overflow) throw new Error(layout.reason);

  const tokens = SURFACE_TOKENS[surface];
  const accent = ACCENTS[theme][surface];
  const s = layout.scale;
  const node = layout.nodeMetrics;
  const panel = layout.panelMetrics;
  const titleMetrics = layout.titleMetrics;
  const sequence = layout.sequence;
  const timeMs = (frame / fps) * 1000;
  const requestedActive = content.activeStageIndex ?? -1;
  const autoMode = !(Number.isInteger(requestedActive) && requestedActive >= 0);
  const activeIndex = resolveActiveStageIndex({
    activeStageIndex: requestedActive, timeMs, sequence, stageCount: layout.nodes.length,
  });
  // 毫秒 → 帧。时间轴由内容字段驱动，所以这些输入范围在 Studio 里是计算值（灰显）。
  const frames = ms => (ms / 1000) * fps;

  return <AbsoluteFill name="StageFlow｜阶段流程" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID} data-theme={theme} data-surface={surface} data-scale={s}
      data-orientation={layout.orientation} data-stage-count={layout.nodes.length} data-active-stage={activeIndex}
      style={{position: "absolute", left: layout.block.x, top: layout.block.y, width: layout.block.width, height: layout.block.height}}
    >
      {/* 主脊：阶段之间的连线 + 方向箭头。描画方式沿用 RemotionUI connector-lines（pathLength=1 等速生长）。 */}
      <Interactive.Svg
        name="连接线层" width={layout.block.width} height={layout.block.height}
        viewBox={`0 0 ${layout.block.width} ${layout.block.height}`}
        style={{position: "absolute", left: 0, top: 0, overflow: "visible"}}
      >
        {layout.connectors.map(connector => {
          const opacity = spineOpacityAt({
            index: connector.index, activeIndex, timeMs, sequence, stageCount: layout.nodes.length,
          });
          const active = connector.index === activeIndex - 1;
          const strokeWidth = (active ? connector.activeStrokeWidth : connector.strokeWidth) * s;
          const arrowStrokeWidth = strokeWidth * SOURCE_GEOMETRY.arrowStrokeScale;
          const geometry = spineGeometryFor({
            orientation: layout.orientation,
            from: {x: connector.from.x * s, y: connector.from.y * s},
            to: {x: connector.to.x * s, y: connector.to.y * s},
            arrowWidth: layout.arrowWidth, arrowHeight: layout.arrowHeight,
          });
          return <Interactive.G key={connector.index} name={`连接线 ${connector.index + 1}`}>
            {/* 连线与箭头是同一件东西：同色、宽度接近，靠明暗区分当前 / 走过。 */}
            <Interactive.Path
              name="连线" d={geometry.d} fill="none" stroke={tokens.arrow} strokeWidth={strokeWidth}
              strokeLinecap="round" opacity={opacity} pathLength={1} strokeDasharray={1}
              strokeDashoffset={1 - interpolate(frame, [frames(connector.startMs), frames(connector.startMs + connector.durationMs)], [0, 1], {...clamp, easing: ease})}
            />
            {/* 箭头叠一层深色描边再画方向色，叠在实拍画面上也读得出来。 */}
            <Interactive.Path
              name="箭头描边" d={geometry.arrow} fill="none" stroke={tokens.arrowHalo}
              strokeWidth={arrowStrokeWidth * SOURCE_GEOMETRY.arrowHaloScale}
              strokeLinecap="round" strokeLinejoin="round"
              opacity={interpolate(frame, [frames(connector.startMs + connector.durationMs * 0.7), frames(connector.startMs + connector.durationMs)], [0, opacity], clamp)}
            />
            <Interactive.Path
              name="方向箭头" d={geometry.arrow} fill="none" stroke={tokens.arrow}
              strokeWidth={arrowStrokeWidth} strokeLinecap="round" strokeLinejoin="round"
              opacity={interpolate(frame, [frames(connector.startMs + connector.durationMs * 0.7), frames(connector.startMs + connector.durationMs)], [0, opacity], clamp)}
            />
          </Interactive.G>;
        })}
      </Interactive.Svg>

      {/* 标题：画面的表述，不是流程节点。留空则不占位置。 */}
      {layout.title.lines.length ? <Interactive.Div
        name="标题"
        style={{
          position: "absolute", left: 0, top: 0, width: layout.block.width,
          fontSize: titleMetrics.fontSize * s, fontWeight: titleMetrics.fontWeight,
          lineHeight: titleMetrics.lineHeight, letterSpacing: `${layout.title.letterSpacing * s}px`,
          color: tokens.ink,
          opacity: interpolate(frame, [0, frames(sequence.titleEnterMs)], [0, 1], {...clamp, easing: ease}),
          translate: interpolate(frame, [0, frames(sequence.titleEnterMs)], ["0px 12px", "0px 0px"], {...clamp, easing: ease}),
        }}
      >
        {layout.title.lines.map((line, index) => <div key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
      </Interactive.Div> : null}

      {/* 阶段节点：单行（图标 + 编号 + 名称）。竖向版纵列、横向版横排，坐标全部来自版式表。 */}
      {layout.nodes.map(item => {
        const enterFrom = frames(sequence.stageStartMs(item.index));
        const enterTo = enterFrom + frames(sequence.nodeEnterMs);
        const active = item.index === activeIndex;
        const Icon = ICONS[item.icon];
        return <Interactive.Div
          key={item.index} name={`阶段 ${item.number}`} data-stage={item.index} data-stage-active={active}
          style={{
            position: "absolute", left: item.x * s, top: item.y * s,
            width: item.width * s, height: item.height * s,
            opacity: interpolate(frame, [enterFrom, enterTo], [0, active ? 1 : SOURCE_GEOMETRY.inactiveOpacity], clamp),
            translate: interpolate(frame, [enterFrom, enterTo], ["0px 12px", "0px 0px"], {...clamp, easing: ease}),
            scale: interpolate(frame, [enterFrom, enterTo], [0.98, 1], {output: "perceptual-scale", ...clamp, easing: ease}),
          }}
        >
          <Interactive.Div
            name="卡片"
            style={{
              width: "100%", height: "100%", boxSizing: "border-box",
              display: "flex", flexDirection: "column", justifyContent: "center",
              padding: `${node.paddingY}px ${node.paddingX}px`,
              borderRadius: node.radius,
              border: `${node.borderWidth}px solid ${active ? accent : tokens.border}`,
              background: tokens.nodeFill, boxShadow: tokens.cardShadow,
            }}
          >
            <div style={{display: "flex", gap: node.indexGap, alignItems: "flex-start"}}>
              <div style={{display: "flex", gap: node.iconGap, alignItems: "flex-start", flex: "none"}}>
                {Icon ? <div data-stage-icon={item.icon} style={{flex: "none", marginTop: node.iconOffset, display: "flex", alignItems: "center"}}>
                  <Icon size={node.iconSize} strokeWidth={1.9} color={active ? accent : tokens.muted}/>
                </div> : null}
                <div data-stage-number style={{
                  fontSize: node.indexFontSize, fontWeight: node.indexFontWeight,
                  lineHeight: node.titleLineHeight, color: active ? accent : tokens.muted,
                  fontVariantNumeric: "tabular-nums", flex: "none",
                }}>{item.number}</div>
              </div>
              <div data-stage-title style={{
                flex: 1, fontSize: node.titleFontSize, fontWeight: node.titleFontWeight,
                lineHeight: node.titleLineHeight, color: active ? tokens.ink : tokens.muted,
              }}>
                {item.titleLines.map((line, index) => <div key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
              </div>
            </div>
          </Interactive.Div>
        </Interactive.Div>;
      })}

      {/* 当前阶段的展开：竖版向右、横版向下；上一条在下一条落地时收起（手风琴）。 */}
      {layout.nodes.map(item => {
        if (!item.detailLines.length) return null;
        const window = panelTimeline({
          sequence, stageCount: layout.nodes.length, index: item.index, activeIndex, autoMode,
        });
        if (!window.canOpen) return null;
        const openFrom = frames(window.openAt);
        const openTo = openFrom + frames(sequence.panelRevealMs);
        const closeFrom = Number.isFinite(window.closeAt) ? frames(window.closeAt) : null;
        const closeTo = closeFrom === null ? null : closeFrom + frames(sequence.panelRevealMs * 0.7);
        return <Interactive.Div
          key={`panel-${item.index}`} name={`阶段 ${item.number} 展开`} data-stage-panel={item.index}
          style={{
            position: "absolute", left: item.panel.x * s, top: item.panel.y * s,
            height: item.panel.height * s, overflow: "hidden",
            width: interpolate(frame, [openFrom, openTo], [0, item.panel.width * s], clamp),
            opacity: closeFrom === null
              ? interpolate(frame, [openFrom, openTo], [0, 1], clamp)
              : Math.max(0, interpolate(frame, [openFrom, openTo], [0, 1], clamp)
                - interpolate(frame, [closeFrom, closeTo], [0, 1], clamp)),
          }}
        >
          <Interactive.Div
            name="展开内容"
            style={{
              width: item.panel.width * s, height: item.panel.height * s, boxSizing: "border-box",
              padding: `${panel.paddingY}px ${panel.paddingX}px`,
              borderRadius: panel.radius, border: `${panel.borderWidth}px solid ${tokens.panelBorder}`,
              borderLeft: `${3 * s}px solid ${item.index === activeIndex ? accent : tokens.panelBorder}`,
              background: tokens.panelFill, boxShadow: tokens.panelShadow,
              fontSize: panel.fontSize, fontWeight: panel.fontWeight,
              lineHeight: panel.lineHeight, color: tokens.ink,
            }}
          >
            {item.detailLines.map((line, index) => <div key={index} style={{whiteSpace: "pre"}}>{line}</div>)}
          </Interactive.Div>
        </Interactive.Div>;
      })}
    </div>
  </AbsoluteFill>;
}
