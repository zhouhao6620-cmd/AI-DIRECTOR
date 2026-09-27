import React from "react";
import {AbsoluteFill, Composition, Sequence, registerRoot, useCurrentFrame, useVideoConfig} from "remotion";
import {EvidenceMediaCard} from "./EvidenceMediaCard.jsx";
import {createSampleState, resolveTheme} from "./model.js";
import {projectProductionStateForRemotion} from "../../remotion/production-projection.js";

// QA-only composition root; the production composition root is owned by 总控 and
// does not list this component until the batch close.
export const QA_COMPOSITION_ID = "EvidenceMediaCardQa";
export const PREVIEW_COMPOSITION_ID = "EvidenceMediaCardPreview";
// A synthetic motion fixture, rendered once by the QA script into the component's
// own fixtures directory, so the video path is verified with real motion.
export const FIXTURE_COMPOSITION_ID = "EvidenceMediaFixtureClip";
export const COMPONENT_ID = "CMP-EVD-001";

const BACKDROP = {
  backgroundImage: [
    "radial-gradient(80% 70% at 50% 8%, rgba(60, 70, 110, 0.26), transparent 60%)",
    "linear-gradient(160deg, #15151d 0%, #0e0e14 60%, #0b0b10 100%)",
  ].join(", "),
  gridImage: "radial-gradient(rgba(255, 255, 255, 0.045) 1.6px, transparent 1.6px)",
};

function EvidenceMediaCardSample({projection, backdrop = false}) {
  if (!["preview", "motion"].includes(projection.renderTarget)) throw new Error("组件样板只渲染内容预览与 Motion Layer。");
  const product = projection.compositionProps;
  const instance = [
    ...(product.globalPackaging ?? []),
    ...(product.shots ?? []).flatMap(shot => shot.componentInstances ?? []),
  ].find(candidate => candidate.componentId === COMPONENT_ID);
  if (!instance) throw new Error(`QA 状态里没有 ${COMPONENT_ID} 实例。`);
  return <AbsoluteFill style={{backgroundColor: "transparent"}}>
    {backdrop && <AbsoluteFill style={{backgroundColor: "#0b0b10", backgroundImage: BACKDROP.backgroundImage}}/>}
    {backdrop && <AbsoluteFill style={{backgroundImage: BACKDROP.gridImage, backgroundSize: "44px 44px"}}/>}
    <Sequence from={instance.timing.startFrame} durationInFrames={instance.timing.durationInFrames}>
      <EvidenceMediaCard
        {...instance.props}
        theme={resolveTheme(product.theme, instance.props.theme)}
        durationInFrames={instance.timing.durationInFrames}
      />
    </Sequence>
  </AbsoluteFill>;
}

function EvidenceMediaFixtureClip() {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const progress = frame / Math.max(1, fps * 2 - 1);
  return <AbsoluteFill style={{backgroundColor: "#101826", color: "#ffffff", fontFamily: "Inter, system-ui, sans-serif"}}>
    <div style={{position: "absolute", left: 60, top: 60, fontSize: 46, fontWeight: 800}}>SYNTHETIC CLIP</div>
    <div style={{position: "absolute", left: 60, top: 130, fontSize: 32, color: "#8b93a3"}}>frame {frame} · 项目内合成测试素材</div>
    <div data-fixture-bar style={{
      position: "absolute", left: 80 + (width - 440) * progress, top: height / 2 - 70,
      width: 200, height: 140, borderRadius: 18, background: "#5fa0fa",
    }}/>
    <div style={{
      position: "absolute", right: 80, bottom: 60 + 40 * Math.sin(progress * Math.PI * 2),
      width: 120, height: 120, borderRadius: 60, background: "#f0a24f",
    }}/>
    <div style={{position: "absolute", left: 60, bottom: 60, fontFamily: "monospace", fontSize: 26, color: "#8b93a3"}}>
      {(frame / fps).toFixed(2)}s · {width}×{height} · {fps} fps
    </div>
  </AbsoluteFill>;
}

const sample = createSampleState();
const meta = sample.technical;

function Root() {
  const projection = projectProductionStateForRemotion(sample, {renderTarget: "motion"});
  const calculateMetadata = ({props}) => ({
    ...props.projection.compositionMetadata,
    defaultCodec: "prores",
    defaultVideoImageFormat: "png",
    defaultPixelFormat: "yuva444p10le",
    defaultProResProfile: "4444",
  });
  return <>
    <Composition
      id={QA_COMPOSITION_ID} component={EvidenceMediaCardSample}
      width={meta.width} height={meta.height} fps={meta.fps} durationInFrames={meta.durationInFrames}
      defaultProps={{projection, backdrop: false}} calculateMetadata={calculateMetadata}
    />
    <Composition
      id={PREVIEW_COMPOSITION_ID} component={EvidenceMediaCardSample}
      width={meta.width} height={meta.height} fps={meta.fps} durationInFrames={meta.durationInFrames}
      defaultProps={{projection, backdrop: true}} calculateMetadata={calculateMetadata}
    />
    <Composition id={FIXTURE_COMPOSITION_ID} component={EvidenceMediaFixtureClip} width={1280} height={720} fps={30} durationInFrames={60}/>
  </>;
}

registerRoot(Root);
