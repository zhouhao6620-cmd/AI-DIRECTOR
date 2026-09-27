// 补建组件（来源不足）：枝鸥 / Overlay Studio 的 20 个效果里没有逻辑节点图，
// RemotionUI 的 Connector Lines 只核验过能力记录、未安装也未复制源码。因此本组件的
// 内容结构与图布局都是本项目自建：
//   - 内容结构：中心节点 + 2–6 个一级分支 + 每个分支 0–2 个可选二级节点；
//   - 布局：中心发散的等角椭圆环，一级环在内、二级环在外，画幅变化时椭圆自适应；
//   - 连线：自建 SVG 三次贝塞尔，描边与虚线绘制语言沿用本地 HUD 既有的
//     `.uc-line`（fill: none / stroke: var(--hud-acc) / stroke-width 2.5 /
//     stroke-linecap: round / stroke-dashoffset 绘制动画）。
// 依据：CMP-01_CONFIRMED_SCOPE_V1.0（第 13 项）与 CMP-04C 任务卡「布局与连线需自建」。

export const SOURCE_GEOMETRY = Object.freeze({
  stageWidth: 1920,
  stageHeight: 1080,
  safeMarginRatio: 0.075,
  radialGap: 150,
  connectorStrokeWidth: 2.5,
  connectorDotRadius: 3,
  minNodeGap: 24,
  center: {fontSize: 30, fontWeight: 800, paddingX: 34, paddingY: 20, radius: 18, borderWidth: 2},
  branch: {fontSize: 26, fontWeight: 700, paddingX: 24, paddingY: 16, radius: 14, borderWidth: 1.5},
  leaf: {fontSize: 22, fontWeight: 600, paddingX: 20, paddingY: 12, radius: 12, borderWidth: 1},
  nodeEnterMs: 360,
  lineDrawMs: 320,
  staggerMs: 320,
  // Single-line card width budget per node kind, as a share of the usable width.
  maxNodeWidthRatio: {CENTER: 0.5, BRANCH: 0.42, LEAF: 0.36},
});

export const FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif';
export const LEAF_ANGLE_OFFSET_DEG = 26;

export function equalAreaScale(width, height) {
  return Math.sqrt((width * height) / (SOURCE_GEOMETRY.stageWidth * SOURCE_GEOMETRY.stageHeight));
}

export function textWidth(measure, text, fontSize, fontWeight, letterSpacing = 0) {
  return measure(text, fontSize, fontWeight) + [...text].length * letterSpacing;
}

export function rgbaFromHex(hex, alpha) {
  const value = hex.replace("#", "");
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function nodeSize({measure, label, fontSize, fontWeight, paddingX, paddingY, borderWidth, scale}) {
  return {
    width: textWidth(measure, label, fontSize * scale, fontWeight) + paddingX * scale * 2 + borderWidth * scale * 2,
    height: fontSize * scale * 1.2 + paddingY * scale * 2 + borderWidth * scale * 2,
    fontSize: fontSize * scale,
    paddingX: paddingX * scale,
    paddingY: paddingY * scale,
    radius: 0,
    borderWidth: borderWidth * scale,
  };
}

export function calculateLogicNodeGraphLayout({content, width, height, measure}) {
  const scale = equalAreaScale(width, height);
  const marginX = width * SOURCE_GEOMETRY.safeMarginRatio;
  const marginY = height * SOURCE_GEOMETRY.safeMarginRatio;
  const usableWidth = width - marginX * 2;
  const usableHeight = height - marginY * 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const overflow = [];
  const maxWidthFor = kind => usableWidth * SOURCE_GEOMETRY.maxNodeWidthRatio[kind];

  const center = nodeSize({measure, label: content.center.label, ...SOURCE_GEOMETRY.center, scale});
  if (center.width > maxWidthFor("CENTER")) overflow.push({type: "NODE_TOO_WIDE", nodeId: "center", label: content.center.label, required: center.width, available: maxWidthFor("CENTER")});

  const branchBoxes = content.branches.map(branch => {
    const box = nodeSize({measure, label: branch.label, ...SOURCE_GEOMETRY.branch, scale});
    if (box.width > maxWidthFor("BRANCH")) overflow.push({type: "NODE_TOO_WIDE", nodeId: branch.id, label: branch.label, required: box.width, available: maxWidthFor("BRANCH")});
    return box;
  });
  const leafBoxes = content.branches.flatMap(branch => branch.children.map(child => nodeSize({measure, label: child.label, ...SOURCE_GEOMETRY.leaf, scale})));
  for (const box of leafBoxes) if (box.width > maxWidthFor("LEAF")) overflow.push({type: "NODE_TOO_WIDE", required: box.width, available: maxWidthFor("LEAF")});

  const branchWidth = Math.max(...branchBoxes.map(box => box.width));
  const branchHeight = Math.max(...branchBoxes.map(box => box.height));
  const leafWidth = leafBoxes.length ? Math.max(...leafBoxes.map(box => box.width)) : 0;
  const leafHeight = leafBoxes.length ? Math.max(...leafBoxes.map(box => box.height)) : 0;
  const hasLeaves = leafBoxes.length > 0;
  const minNodeGap = SOURCE_GEOMETRY.minNodeGap * scale;
  // The outer ring keeps its node boxes inside the safe area; the inner ring is at
  // least one centre clearance away, and one radial gap inside the outer ring when
  // second-level nodes exist. The remaining collisions are reported by the pairwise
  // box check below instead of being estimated.
  const maxOuterX = usableWidth / 2 - (hasLeaves ? leafWidth / 2 : branchWidth / 2);
  const maxOuterY = usableHeight / 2 - (hasLeaves ? leafHeight / 2 : branchHeight / 2);
  const minInnerX = (center.width + branchWidth) / 2 + minNodeGap;
  const minInnerY = (center.height + branchHeight) / 2 + minNodeGap;
  // On a 9:16 canvas the safe area is far taller than it is wide; clamping the ring
  // height keeps the graph close to a circle instead of stretching it down the frame.
  const ring2X = maxOuterX;
  const ring2Y = Math.min(maxOuterY, maxOuterX * 1.25);
  const wantedGap = hasLeaves ? Math.max(SOURCE_GEOMETRY.radialGap * scale, (branchWidth + leafWidth) / 2 + minNodeGap) : 0;
  const radialGap = hasLeaves
    ? Math.min(wantedGap, Math.max(0, ring2X - minInnerX), Math.max(0, ring2Y - minInnerY))
    : 0;
  const ring1X = hasLeaves ? Math.max(minInnerX, ring2X - radialGap) : ring2X;
  const ring1Y = hasLeaves ? Math.max(minInnerY, ring2Y - radialGap) : ring2Y;

  const angleOf = index => (-90 + (360 / content.branches.length) * index) * (Math.PI / 180);
  const offset = LEAF_ANGLE_OFFSET_DEG * (Math.PI / 180);
  // Breadth-first build order: the inner ring completes before the outer ring, so the
  // reveal reads centre → every first-level branch → every second-level node.
  const branchOrders = new Map();
  content.branches.forEach((branch, index) => branchOrders.set(branch.id, index + 1));
  let leafOrder = 1 + content.branches.length;
  const nodes = [{id: "center", kind: "CENTER", label: content.center.label, x: centerX, y: centerY, ...center, radius: SOURCE_GEOMETRY.center.radius * scale, order: 0, enterAtMs: 0}];
  const links = [];

  content.branches.forEach((branch, index) => {
    const angle = angleOf(index);
    const box = branchBoxes[index];
    const branchNode = {
      id: branch.id, kind: "BRANCH", label: branch.label, index,
      x: centerX + Math.cos(angle) * ring1X, y: centerY + Math.sin(angle) * ring1Y,
      ...box, radius: SOURCE_GEOMETRY.branch.radius * scale,
      angle, order: branchOrders.get(branch.id), enterAtMs: branchOrders.get(branch.id) * SOURCE_GEOMETRY.staggerMs,
    };
    nodes.push(branchNode);
    links.push({id: `link-center-${branch.id}`, from: "center", to: branch.id, line: connectorPath({from: nodes[0], to: branchNode, fromCenter: true, toCenter: true, stroke: true})});

    branch.children.forEach((child, childIndex) => {
      const childAngle = angle + (branch.children.length === 1 ? 0 : childIndex === 0 ? -offset : offset);
      const childBox = nodeSize({measure, label: child.label, ...SOURCE_GEOMETRY.leaf, scale});
      const childNode = {
        id: child.id, kind: "LEAF", label: child.label, index: childIndex, parentId: branch.id,
        x: centerX + Math.cos(childAngle) * ring2X, y: centerY + Math.sin(childAngle) * ring2Y,
        ...childBox, radius: SOURCE_GEOMETRY.leaf.radius * scale,
        angle: childAngle, order: leafOrder, enterAtMs: leafOrder * SOURCE_GEOMETRY.staggerMs,
      };
      leafOrder += 1;
      nodes.push(childNode);
      links.push({id: `link-${branch.id}-${child.id}`, from: branch.id, to: child.id, line: connectorPath({from: branchNode, to: childNode, fromCenter: true, toCenter: true, stroke: true})});
    });
  });

  for (const node of nodes) {
    if (node.x - node.width / 2 < marginX - 0.5 || node.x + node.width / 2 > width - marginX + 0.5
      || node.y - node.height / 2 < marginY - 0.5 || node.y + node.height / 2 > height - marginY + 0.5) {
      overflow.push({type: "NODE_OUT_OF_SAFE_AREA", nodeId: node.id, x: node.x, y: node.y, width: node.width, height: node.height});
    }
  }
  if (nodes.length - 1 > 13) overflow.push({type: "TOO_MANY_NODES", nodes: nodes.length - 1});

  // Node boxes must not touch: the check runs on the real ellipse positions, so it
  // reports the pairs that actually collide instead of estimating a chord.
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      const dx = Math.abs(a.x - b.x);
      const dy = Math.abs(a.y - b.y);
      const clearX = (a.width + b.width) / 2 + minNodeGap;
      const clearY = (a.height + b.height) / 2 + minNodeGap;
      if (dx < clearX && dy < clearY) {
        overflow.push({type: "NODES_TOO_CLOSE", a: a.id, b: b.id, dx, dy, requiredX: clearX, requiredY: clearY});
      }
    }
  }

  return {
    scale, marginX, marginY, usableWidth, usableHeight, centerX, centerY,
    rings: {innerX: ring1X, innerY: ring1Y, outerX: ring2X, outerY: ring2Y, radialGap},
    nodes, links, nodeCount: nodes.length, overflow,
  };
}

// Cubic bezier between two node boxes, exiting from the edge that faces the target.
export function connectorPath({from, to, stroke}) {
  const start = edgePoint(from, to);
  const end = edgePoint(to, from);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  // A purely radial link stays straight; a diagonal one bows gently. The bow never
  // grows with the link length, so long spokes keep the same visual weight.
  const curve = Math.min(Math.min(Math.abs(dx), Math.abs(dy)) * 0.25, 48);
  const normal = {x: -dy / (length || 1), y: dx / (length || 1)};
  void stroke;
  return {
    d: `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} C ${(start.x + dx * 0.35 + normal.x * curve).toFixed(2)} ${(start.y + dy * 0.35 + normal.y * curve).toFixed(2)}, ${(start.x + dx * 0.65 + normal.x * curve).toFixed(2)} ${(start.y + dy * 0.65 + normal.y * curve).toFixed(2)}, ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
    start, end, length,
  };
}

// Intersection of the line between two node centres with the source node's box edge.
function edgePoint(box, target) {
  const dx = target.x - box.x;
  const dy = target.y - box.y;
  const halfWidth = box.width / 2;
  const halfHeight = box.height / 2;
  if (dx === 0 && dy === 0) return {x: box.x, y: box.y};
  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const factor = Math.min(scaleX, scaleY);
  return {x: box.x + dx * factor, y: box.y + dy * factor};
}

export function resolveEntrance({nodes, stepMs}) {
  const last = nodes.reduce((max, node) => Math.max(max, node.order), 0) * stepMs;
  return {
    lastEnterAtMs: last,
    settledAtMs: last + SOURCE_GEOMETRY.nodeEnterMs,
    enteredCountAt: timeMs => nodes.filter(node => timeMs >= node.order * stepMs).length,
  };
}

// Full-width characters a node label can hold on its single line.
export function nodeCapacityFor({kind = "BRANCH", width, height, measure, probe = "字"}) {
  const scale = equalAreaScale(width, height);
  const style = SOURCE_GEOMETRY[kind === "CENTER" ? "center" : kind === "LEAF" ? "leaf" : "branch"];
  const available = (width - width * SOURCE_GEOMETRY.safeMarginRatio * 2) * SOURCE_GEOMETRY.maxNodeWidthRatio[kind];
  const inner = available - (style.paddingX + style.borderWidth) * 2 * scale;
  const charWidth = textWidth(measure, probe, style.fontSize * scale, style.fontWeight);
  return Math.max(1, Math.floor(inner / charWidth));
}
