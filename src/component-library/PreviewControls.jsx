// 组件库的临时试填宿主；业务字段由共享配置栏渲染。
import React, {useMemo, useState} from "react";
import {useAssetAvailability, useLocalAssetStatus} from "./asset-status.js";
import {localAssetCandidates, writePreviewPath} from "./preview-state.js";
import {ComponentConfigPanel, ItemPicker, dot} from "../shared/component-config/ComponentConfigPanel.jsx";

const ASSET_KIND_LABELS = {IMAGE: "图片", VIDEO: "视频", LOGO: "标识"};
export function PreviewControls({entry, plan, descriptor, state, props, setPath, mutate, onReset, preset, onPreset, catalogEntries, playbackRate, onPlaybackRate, safeArea, onSafeArea}) {
  return <div className="library-controls">
    <ComponentConfigPanel plan={plan} descriptor={descriptor} props={props} projectTheme={state.product.theme}
      validateContent={content => {const next = structuredClone(state);writePreviewPath(next, "content", content);entry.assertState?.(next);}}
      onPatch={setPath} onProjectThemeChange={theme => mutate(next => {next.product.theme = theme;})}
      assetSlot={plan.asset && <AssetFields plan={plan} props={props} setPath={setPath} catalogEntries={catalogEntries}/>}/>
  </div>;
}

// 素材替换：只用本机素材，路径写回内容树；缺失的候选探测后禁用，不假装可用。
function AssetFields({plan, props, setPath, catalogEntries}) {
  const carrier = plan.asset.carrier;
  const [itemIndex, setItemIndex] = useState(0);
  const listPath = carrier.listPath;
  const isItem = carrier.carrier === "CONTENT_ITEM";
  const items = isItem ? (props[listPath] ?? []) : [];
  const active = Math.min(itemIndex, Math.max(0, items.length - 1));
  // 落点由控制计划给出：整块素材用 carrier.path（如 content.media.src），
  // 自由媒体按每个媒体项取（items.<index>.src）。
  const path = isItem ? `${listPath}.${active}.${carrier.path}` : carrier.path;
  const kind = dot(props, isItem ? `${listPath}.${active}.kind` : "content.media.kind");
  const value = dot(props, path) ?? "";
  const candidates = useMemo(() => localAssetCandidates(catalogEntries, kind), [catalogEntries, kind]);
  const missing = useAssetAvailability(candidates);
  const status = useLocalAssetStatus(value);
  return <>
    {carrier.carrier === "CONTENT_ITEM" && <ItemPicker items={items} itemIndex={active} onItemChange={setItemIndex} field="asset.item"/>}
    <label>素材路径（相对 public/）<input aria-label="素材路径" data-library-field="asset.src" value={value}
      onChange={event => setPath(path, event.target.value)}/></label>
    <p className={`library-control-note ${status.ok ? "" : "is-warn"}`} data-library-asset-status={status.state}>{status.message}</p>
    <label>本机素材替换<select aria-label="本机素材替换" data-library-field="asset.pick" value=""
      onChange={event => { if (event.target.value) setPath(path, event.target.value); }}>
      <option value="">选择本机素材…</option>
      {candidates.map(candidate => <option key={candidate.src} value={candidate.src} disabled={missing.has(candidate.src)}>
        {candidate.label}{missing.has(candidate.src) ? "（未就位）" : ""}
      </option>)}
    </select></label>
    <p className="library-control-note">
      可用类型：{plan.asset.kinds.map(kindId => ASSET_KIND_LABELS[kindId] ?? kindId).join(" / ")}。{plan.asset.note}
    </p>
  </>;
}
