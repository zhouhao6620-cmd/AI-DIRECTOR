import React from "react";
import {AbsoluteFill, Composition, Sequence, registerRoot} from "remotion";
import {EntityChips} from "./EntityChips.jsx";
import {createSampleState, resolveTheme} from "./model.js";
import {projectProductionStateForRemotion} from "../../remotion/production-projection.js";

// QA-only composition root; the production composition root is owned by 总控 and
// does not list this component until the batch close.
export const QA_COMPOSITION_ID = "EntityChipsQa";
export const PREVIEW_COMPOSITION_ID = "EntityChipsPreview";
export const COMPONENT_ID = "CMP-ENT-001";

const BACKDROP = {
  backgroundImage: [
    "radial-gradient(80% 70% at 50% 8%, rgba(60, 70, 110, 0.26), transparent 60%)",
    "linear-gradient(160deg, #15151d 0%, #0e0e14 60%, #0b0b10 100%)",
  ].join(", "),
  gridImage: "radial-gradient(rgba(255, 255, 255, 0.045) 1.6px, transparent 1.6px)",
};

function EntityChipsSample({projection, backdrop = false}) {
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
      <EntityChips
        {...instance.props}
        theme={resolveTheme(product.theme, instance.props.theme)}
        durationInFrames={instance.timing.durationInFrames}
      />
    </Sequence>
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
      id={QA_COMPOSITION_ID} component={EntityChipsSample}
      width={meta.width} height={meta.height} fps={meta.fps} durationInFrames={meta.durationInFrames}
      defaultProps={{projection, backdrop: false}} calculateMetadata={calculateMetadata}
    />
    <Composition
      id={PREVIEW_COMPOSITION_ID} component={EntityChipsSample}
      width={meta.width} height={meta.height} fps={meta.fps} durationInFrames={meta.durationInFrames}
      defaultProps={{projection, backdrop: true}} calculateMetadata={calculateMetadata}
    />
  </>;
}

registerRoot(Root);
