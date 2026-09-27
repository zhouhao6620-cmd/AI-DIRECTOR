// 本机素材可达性探测（LIB-01 阶段 3）
//
// 素材替换只用本机素材、不联网：候选逐个探测本机请求，读不到的标成「未就位」并禁用，
// 不假装可用。组件实验页有一份等价实现；这里独立成模块，避免改共享的 src/component-lab/**。
import {useEffect, useState} from "react";
import {assetUrlOf} from "./preview-state.js";

const probeCache = new Map();

function probeAsset(src) {
  const url = assetUrlOf(src);
  if (!probeCache.has(url)) {
    probeCache.set(url, fetch(url, {method: "HEAD"})
      .then(response => response.ok || response.status === 405)
      .catch(() => false));
  }
  return probeCache.get(url);
}

export function useAssetAvailability(candidates) {
  const [missing, setMissing] = useState(() => new Set());
  useEffect(() => {
    let cancelled = false;
    Promise.all(candidates.map(candidate => probeAsset(candidate.src).then(ok => [candidate.src, ok])))
      .then(results => {
        if (cancelled) return;
        setMissing(new Set(results.filter(([, ok]) => !ok).map(([src]) => src)));
      });
    return () => { cancelled = true; };
  }, [candidates]);
  return missing;
}

export function useLocalAssetStatus(src) {
  const [status, setStatus] = useState({state: "CHECKING", ok: false, message: "正在检查素材…"});
  useEffect(() => {
    if (!src) {
      setStatus({state: "EMPTY", ok: false, message: "这个组件定义没有声明素材路径，或当前条目还没有素材。"});
      return undefined;
    }
    let cancelled = false;
    const url = assetUrlOf(src);
    const done = result => { if (!cancelled) setStatus(result); };
    if (/\.(mp4|mov|webm|m4v)$/i.test(src)) {
      fetch(url, {method: "HEAD"})
        .then(response => done(response.ok
          ? {state: "OK", ok: true, message: `素材可达 · ${src}`}
          : {state: "MISSING", ok: false, message: `本页读不到该视频（${response.status}）· ${src}`}))
        .catch(() => done({state: "MISSING", ok: false, message: `本页读不到该视频 · ${src}`}));
    } else {
      const image = new Image();
      image.onload = () => done({state: "OK", ok: true, message: `素材可达 · ${src}（${image.naturalWidth} × ${image.naturalHeight}）`});
      image.onerror = () => done({state: "MISSING", ok: false, message: `本页读不到该图片 · ${src}`});
      image.src = url;
    }
    return () => { cancelled = true; };
  }, [src]);
  return status;
}
