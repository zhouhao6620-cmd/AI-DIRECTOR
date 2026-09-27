// 横版截图模式（LIB-01）
//
// 列表页的卡片用的是**静态截图**，不是前端代码渲染。这个模式只做一件事：
// 用真实 Remotion Player 把某个组件渲染成一块干净的深色画布，供截图脚本取图。
// 入口：`/?still=<componentId>`；截图脚本 tests/ui/capture-landscape-previews.mjs 驱动。
//
// 页面正常使用时不会进入这个模式：只有带 `?still=` 参数才渲染，且不写任何文件。
import React, {useEffect, useMemo, useState} from "react";
import {ComponentPreview} from "../shared/component-preview/index.js";
import {createPreviewState, withPreviewDefaults} from "./preview-state.js";

// 截图用固定帧：入场动画基本结束，画面处于完整状态。
export const STILL_FRAME = 110;

export function StillCapture({entry}) {
  const [ready, setReady] = useState(false);
  const state = useMemo(() => withPreviewDefaults(createPreviewState(entry)), [entry]);

  useEffect(() => {
    // 让截图脚本能等到真实渲染完成，而不是靠固定 sleep。
    window.__libraryStill = {componentId: entry.componentId, ready: false};
    const timer = window.setTimeout(() => {
      setReady(true);
      window.__libraryStill = {componentId: entry.componentId, ready: true};
    }, 600);
    return () => {
      window.clearTimeout(timer);
      delete window.__libraryStill;
    };
  }, [entry]);

  return <div className="still-stage" data-library-still={entry.componentId}>
    {/* 离屏模式：固定 1280×720 画布、不挂控件与 QA，其它一切走共享内核 */}
    <div className="still-canvas" data-library-still-canvas>
      <ComponentPreview state={state} surface="offscreen" background="dark" offscreen
        controls={false} loop={false} initialFrame={STILL_FRAME}
        placeholder={<div className="still-error" role="alert">这个组件在当前画幅下无法渲染。</div>}/>
    </div>
    {!ready && <span className="still-pending" aria-hidden="true" />}
  </div>;
}
