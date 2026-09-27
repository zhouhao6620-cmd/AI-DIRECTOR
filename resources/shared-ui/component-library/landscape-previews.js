// 卡片用的横版截图清单（GENERATED — 由 tests/ui/capture-landscape-previews.mjs 生成）
//
// 为什么要有这张清单：卡片必须用**静态截图**，不能靠前端代码渲染；而"这张组件有没有
// 横版截图"不能在页面里靠探测文件来判断（会打出 404、也会在控制台留错误）。
// 所以由截图脚本在产出 PNG 的同时写这份清单：有清单才用横版截图，没有就回退竖版海报。
// 组件定义里声明了 identity.previewLandscapeRef 的，以定义为准（那条路径优先）。
export const LANDSCAPE_PREVIEWS = {
  "CMP-NAV-004": "component-previews/CMP-NAV-004/poster-16x9.png",
  "CMP-CHP-001": "component-previews/CMP-CHP-001/poster-16x9.png",
  "CMP-SUB-001": "component-previews/CMP-SUB-001/poster-16x9.png",
  "CMP-CHK-001": "component-previews/CMP-CHK-001/poster-16x9.png",
  "CMP-DATA-001": "component-previews/CMP-DATA-001/poster-16x9.png",
  "CMP-DATA-002": "component-previews/CMP-DATA-002/poster-16x9.png",
  "CMP-DATA-003": "component-previews/CMP-DATA-003/poster-16x9.png",
  "CMP-DATA-004": "component-previews/CMP-DATA-004/poster-16x9.png",
  "CMP-DATA-005": "component-previews/CMP-DATA-005/poster-16x9.png",
  "CMP-DATA-006": "component-previews/CMP-DATA-006/poster-16x9.png",
  "CMP-ENT-001": "component-previews/CMP-ENT-001/poster-16x9.png",
  "CMP-EVD-001": "component-previews/CMP-EVD-001/poster-16x9.png",
  "CMP-LNG-001": "component-previews/CMP-LNG-001/poster-16x9.png",
  "CMP-MED-001": "component-previews/CMP-MED-001/poster-16x9.png",
  "CMP-PUN-001": "component-previews/CMP-PUN-001/poster-16x9.png",
  "CMP-QTE-001": "component-previews/CMP-QTE-001/poster-16x9.png",
  "CMP-SKL-001": "component-previews/CMP-SKL-001/poster-16x9.png",
  "CMP-STG-001": "component-previews/CMP-STG-001/poster-16x9.png",
  "CMP-STP-001": "component-previews/CMP-STP-001/poster-16x9.png",
  "CMP-TRM-001": "component-previews/CMP-TRM-001/poster-16x9.png",
  "CMP-TYP-001": "component-previews/CMP-TYP-001/poster-16x9.png",
  "CMP-UIC-001": "component-previews/CMP-UIC-001/poster-16x9.png",
  "CMP-VRS-001": "component-previews/CMP-VRS-001/poster-16x9.png",
};

export function landscapePreviewOf(componentId) {
  return LANDSCAPE_PREVIEWS[componentId] ?? null;
}
