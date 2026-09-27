import React from "react";
import {AbsoluteFill, Sequence} from "remotion";
import {componentRenderers} from "./component-renderers.jsx";

// Older source components keep their own visual geometry. The shared canvas
// transform gives them whole-instance placement and scaling without changing
// their source layout or default appearance.
const WRAPPED_POSITION = new Set(["CMP-CHP-001", "CMP-CHK-001", "CMP-ENT-001", "CMP-EVD-001", "CMP-LNG-001", "CMP-STP-001", "CMP-MED-001"]);
const WRAPPED_SIZE = new Set([...WRAPPED_POSITION, "CMP-SUB-001", "CMP-UIC-001"]);

// 整块缩放必须绕**组件自己的盒子**放大，不能绕画布中心：
// 靠左 / 靠上的来源组件（步骤打勾、字幕、界面标注等）一旦绕画布中心放大，就会随大小一起
// 漂移，看起来像「调大小把位置也一起改了」。落位仍由外层画布平移承担；大小改用独立的
// `scale` 属性挂在组件自己的根节点上——它以自身中心为原点，并且与组件自带的 `transform`
// 入场动画叠加而不是覆盖它（独立属性与 transform 互不覆盖）。
const INSTANCE_SCALE_RULE = "[data-instance-scope] [data-component-id]{scale: var(--instance-scale, 1);}";

function renderProps(instance) {
  const props = {...instance.props};
  const position = props.positionOffset ?? (WRAPPED_POSITION.has(instance.componentId) && typeof props.position === "object" ? props.position : null);
  const size = Number(props.size ?? 1);
  if (WRAPPED_SIZE.has(instance.componentId)) delete props.size;
  if (WRAPPED_POSITION.has(instance.componentId)) {
    delete props.positionOffset;
    if (["CMP-CHP-001", "CMP-LNG-001", "CMP-MED-001"].includes(instance.componentId)) delete props.position;
  }
  return {props, position, size};
}

// This is a component QA composition, not a Stage 2 production renderer.
// The parent validates the state before using the shared projection.
// Global packaging instances render first, then shot instances, so the global
// chapter bar and subtitle track sit under the shot content exactly as they will
// in a composed production render.
export function ComponentSample({projection}) {
  const product = projection.compositionProps;
  if (!["preview", "motion"].includes(projection.renderTarget)) throw new Error("组件样板只渲染内容预览与 Motion Layer。");
  const instances = [
    ...(product.globalPackaging ?? []),
    ...(product.shots ?? []).flatMap(shot => shot.componentInstances ?? []),
  ];
  return <AbsoluteFill style={{backgroundColor: "transparent"}}>
    <style>{INSTANCE_SCALE_RULE}</style>
    {instances.map(instance => {
      const renderer = componentRenderers[instance.componentId];
      if (!renderer) throw new Error(`未注册的组件实例：${instance.componentId}`);
      const {Component, resolveTheme} = renderer;
      const {props, position, size} = renderProps(instance);
      const scopedSize = WRAPPED_SIZE.has(instance.componentId);
      const transform = scopedSize
        ? `translate(${((position?.x ?? 0.5) - 0.5) * 100}%, ${((position?.y ?? 0.5) - 0.5) * 100}%)`
        : undefined;
      return <Sequence key={instance.instanceId} name={renderer.name} from={instance.timing.startFrame} durationInFrames={instance.timing.durationInFrames}>
        <AbsoluteFill data-instance-scope={scopedSize ? "" : undefined}
          style={scopedSize ? {transform, "--instance-scale": size} : undefined}>
          <Component {...props} theme={resolveTheme(product.theme, instance.props.theme)} durationInFrames={instance.timing.durationInFrames}/>
        </AbsoluteFill>
      </Sequence>;
    })}
  </AbsoluteFill>;
}
