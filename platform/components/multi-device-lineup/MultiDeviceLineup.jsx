// 按技能 V1.4 §4.1「Remotion 实现规范（自持）」写法：
//   结构用 Interactive.* + name（每台设备、机身、屏幕、标签都是可选中元素）；
//   动效用内联 spring() / interpolate()，输出范围、easing、extrapolate 全部硬编码；
//   位移与缩放用 CSS 的独立属性 translate / scale（不拼 transform 字符串）；不用 CSS 过渡。
// 已知取舍（与 stage-flow 同一处理）：版式尺寸是「来源机身尺寸 × factor」的计算值，这些 style 在 Studio
// 里会灰显（不可编辑但功能正常）；可交互的是元素选择与文案。
// 来源：RemotionUI `multi-device-lineup`（MIT）；适配差异见 ./layout.js 顶部注释与 definition.json。
import React, {useMemo} from "react";
import {AbsoluteFill, Interactive, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {measureText} from "@remotion/layout-utils";
import {
  EASE_ENTER, FONT_FAMILY, SOURCE_GEOMETRY, SOURCE_MOTION, calculateMultiDeviceLineupLayout,
} from "./layout.js";
import {COMPONENT_ID, PALETTES, SURFACE_TOKENS, assertMultiDeviceLineupProps} from "./model.js";

const clamp = {extrapolateLeft: "clamp", extrapolateRight: "clamp"};

export function MultiDeviceLineup({content, position, size, surface, theme, durationInFrames}) {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();
  assertMultiDeviceLineupProps({content, position, size, surface, theme, durationInFrames}, {fps, width, height});

  const layout = useMemo(() => calculateMultiDeviceLineupLayout({
    content, width, height, size, position,
    measure: (text, fontSize, fontWeight, letterSpacing) => measureText({
      text, fontFamily: FONT_FAMILY, fontSize, fontWeight, letterSpacing,
    }).width,
  }), [content, width, height, size, position]);
  if (layout.rejection) throw new Error(layout.rejection);

  const tokens = SURFACE_TOKENS[surface];
  const accent = PALETTES[theme][0];
  const factor = layout.factor;
  const source = SOURCE_GEOMETRY;

  return <AbsoluteFill name="MultiDeviceLineup｜多设备排列" style={{backgroundColor: "transparent", fontFamily: FONT_FAMILY}}>
    <div
      data-component-id={COMPONENT_ID}
      data-theme={theme}
      data-surface={surface}
      data-scale={Number(factor.toFixed(4))}
      data-device-count={layout.devices.length}
      data-row-count={layout.rows.length}
      data-box-width={Number(layout.boxWidth.toFixed(2))}
      data-box-height={Number(layout.boxHeight.toFixed(2))}
      style={{
        position: "absolute",
        left: layout.x,
        top: layout.y,
        width: layout.boxWidth,
        height: layout.boxHeight,
      }}
    >
      <Interactive.Div
        name="设备列"
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: source.deviceGap * factor,
        }}
      >
        {layout.devices.map((device) => {
          // 来源：手机 → 平板 → 笔记本，delay 4 帧、错峰 9 帧；弹簧阻尼 17 / 刚度 150 / 质量 0.75 且不过冲。
          const start = SOURCE_MOTION.delayFrames + device.order * SOURCE_MOTION.staggerFrames;
          const rise = spring({
            frame: frame - start,
            fps,
            config: {
              damping: 17,
              stiffness: 150,
              mass: 0.75,
              overshootClamping: true,
            },
          });
          const fade = interpolate(
            frame,
            [start, start + SOURCE_MOTION.fadeFrames],
            [0, 1],
            {easing: EASE_ENTER, ...clamp},
          );
          const riseScale = interpolate(rise, [0, 1], [SOURCE_MOTION.riseScaleFrom, SOURCE_MOTION.riseScaleTo], {
            output: "perceptual-scale",
            ...clamp,
          });
          const spec = device.frame;
          return <Interactive.Div
            key={device.id}
            name={device.label}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: source.labelGap * factor,
              opacity: fade,
              translate: `0 ${(1 - rise) * SOURCE_MOTION.risePx * factor}px`,
              scale: String(riseScale),
            }}
          >
            <Interactive.Div
              name="机身"
              style={{
                position: "relative",
                width: spec.width * factor,
                height: spec.height * factor,
                borderRadius: spec.radius * factor,
                background: tokens.bezel,
                border: `${source.frameBorder * factor}px solid ${tokens.frameBorder}`,
                boxShadow: `inset 0 ${source.bezelInsetShadow * factor}px 0 ${tokens.bezelInset}, 0 ${
                  source.shadowY * factor
                }px ${source.shadowBlur * factor}px rgba(0, 0, 0, ${source.shadowOpacity})`,
                padding: spec.bezel * factor,
              }}
            >
              <Interactive.Div
                name="屏幕"
                style={{
                  width: spec.screenW * factor,
                  height: spec.screenH * factor,
                  borderRadius: spec.screenRadius * factor,
                  background: tokens.screen,
                  overflow: "hidden",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  padding: `${source.screenPadY * factor}px ${source.screenPadX * factor}px`,
                }}
              >
                {/* 一套设计在三档宽度上：字号不随宽度缩放，宽的那台多出来的是留白。 */}
                <div style={{
                  color: tokens.title,
                  fontSize: source.titleFontSize * factor,
                  fontWeight: source.titleFontWeight,
                  whiteSpace: "pre",
                }}>{content.screen.title}</div>
                <div style={{
                  height: source.accentHeight * factor,
                  width: "100%",
                  borderRadius: source.accentRadius * factor,
                  background: accent,
                  marginTop: source.rowGap * factor,
                }}/>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: source.rowGap * factor,
                  marginTop: source.dividerMarginY * factor,
                }}>
                  {layout.rows.map((row) => <div key={row.id} style={{
                    color: tokens.row,
                    fontSize: source.rowFontSize * factor,
                    fontWeight: source.rowFontWeight,
                    whiteSpace: "pre",
                  }}>{`· ${row.text}`}</div>)}
                </div>
              </Interactive.Div>

              {device.kind === "phone" ? <div style={{
                position: "absolute",
                top: (spec.bezel + source.phoneNotchOffset) * factor,
                left: "50%",
                translate: "-50% 0",
                width: source.phoneNotchWidth * factor,
                height: source.phoneNotchHeight * factor,
                borderRadius: 999,
                background: tokens.notch,
              }}/> : null}

              {device.kind === "tablet" ? <div style={{
                position: "absolute",
                top: (spec.bezel / 2) * factor,
                left: "50%",
                translate: "-50% 0",
                width: source.tabletCameraSize * factor,
                height: source.tabletCameraSize * factor,
                borderRadius: 999,
                background: tokens.camera,
              }}/> : null}
            </Interactive.Div>

            {device.kind === "laptop" ? <div style={{
              width: (spec.width + source.laptopBaseExtra) * factor,
              height: source.laptopBaseHeight * factor,
              marginTop: -source.laptopBaseOverlap * factor,
              borderRadius: `0 0 ${7 * factor}px ${7 * factor}px`,
              background: tokens.base,
              boxShadow: `0 ${8 * factor}px ${18 * factor}px rgba(0, 0, 0, 0.5)`,
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                top: 0,
                left: "50%",
                translate: "-50% 0",
                width: source.laptopHingeWidth * factor,
                height: source.laptopHingeHeight * factor,
                borderRadius: `0 0 ${3 * factor}px ${3 * factor}px`,
                background: tokens.hinge,
              }}/>
            </div> : null}

            <div style={{
              color: tokens.label,
              fontSize: source.labelFontSize * factor,
              fontWeight: 600,
              letterSpacing: `${source.labelFontSize * source.labelLetterSpacingEm * factor}px`,
              textTransform: "uppercase",
            }}>{device.label}</div>
          </Interactive.Div>;
        })}
      </Interactive.Div>
    </div>
  </AbsoluteFill>;
}
