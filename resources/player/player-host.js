// 独立播放器页（HyperFrames 冒烟版）
//
// Role: Reference（冒烟测试件，不是基线）
// 本页只做页面级配置（合成来源、画幅、底色、初始时间），预览外壳本体在 preview-chrome.js，
// 与组件库内壳页（library/index.html）共用同一份实现。

import {createPreviewChrome} from "./preview-chrome.js";

const query = new URLSearchParams(window.location.search);

const chrome = createPreviewChrome({
  container: document.getElementById("playerHost"),
  composition: query.get("src") || "/project/index.html",
  layout: "fill",
  background: query.get("background") || undefined,
  rate: Number(query.get("rate")) || 1,
});

document.getElementById("coreBadge").textContent = `内核：HyperFrames ${query.get("core") || "0.8.46"}`;

chrome.ready.then(() => {
  const at = Number(query.get("t"));
  if (Number.isFinite(at) && at > 0) chrome.seek(Math.min(at, chrome.state().duration));
  if (query.get("play") === "1") chrome.play();
});
