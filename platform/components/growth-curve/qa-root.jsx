// QA-only Remotion root for this component. The shared lab root
// (platform/remotion/component-root.jsx) is owned by the central control and is not touched by
// this card, so this file registers the same kind of single-component QA composition locally.
// It renders the real component through the shared, read-only production projection.
import React from "react";
import {AbsoluteFill, Composition, Sequence, registerRoot} from "remotion";
import {GrowthCurve} from "./GrowthCurve.jsx";
import {createSampleState, resolveTheme} from "./model.js";
import {projectProductionStateForRemotion} from "../../remotion/production-projection.js";

export const COMPOSITION_ID = "GrowthCurve";
const sample = createSampleState();

export function GrowthCurveSample({projection}) {
  const product = projection.compositionProps;
  const instance = product.shots[0].componentInstances[0];
  return <AbsoluteFill style={{backgroundColor: "transparent"}}>
    <Sequence from={instance.timing.startFrame} durationInFrames={instance.timing.durationInFrames}>
      <GrowthCurve {...instance.props} theme={resolveTheme(product.theme, instance.props.theme)} durationInFrames={instance.timing.durationInFrames}/>
    </Sequence>
  </AbsoluteFill>;
}

function Root() {
  const {width, height, fps, durationInFrames} = sample.technical;
  return <Composition
    id={COMPOSITION_ID} component={GrowthCurveSample}
    width={width} height={height} fps={fps} durationInFrames={durationInFrames}
    defaultProps={{projection: projectProductionStateForRemotion(sample, {renderTarget: "motion"})}}
    calculateMetadata={({props}) => ({...props.projection.compositionMetadata})}
  />;
}

registerRoot(Root);
