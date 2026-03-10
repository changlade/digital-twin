import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from "@xyflow/react";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – CSS import resolved by Vite at runtime
import "@xyflow/react/dist/style.css";
import { useEffect, useState } from "react";
import { fetchGraph } from "../lib/api";
import type { GraphData, GraphNode, GraphNodeMetrics } from "../lib/types";
import { equipmentTypeColor, equipmentTypeIcon, fmt } from "../lib/utils";
import { X } from "lucide-react";

// ─── Status colours ───────────────────────────────────────────────────────────
const STATUS_COLORS = {
  ok:      { border: "#10B981", glow: "rgba(16,185,129,0.3)" },
  warning: { border: "#F59E0B", glow: "rgba(245,158,11,0.3)" },
  alarm:   { border: "#EF4444", glow: "rgba(239,68,68,0.3)" },
};

// ─── Equipment node ───────────────────────────────────────────────────────────
function EquipmentNode({ data }: NodeProps) {
  const gn = data as unknown as GraphNode & { onSelect: (n: GraphNode) => void };
  const colors = STATUS_COLORS[gn.status];
  const typeColor = equipmentTypeColor(gn.equipment_type ?? "");
  const icon = equipmentTypeIcon(gn.equipment_type ?? "");

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: colors.border, border: "none" }} />
      <div
        onClick={() => gn.onSelect(gn)}
        className="cursor-pointer rounded-xl px-3 py-2.5 min-w-[140px] transition-all hover:scale-105"
        style={{
          background: "#1E293B",
          border: `1.5px solid ${colors.border}`,
          boxShadow: `0 0 12px ${colors.glow}`,
        }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-xs shrink-0"
            style={{ background: `${typeColor}25`, color: typeColor }}
          >
            {icon}
          </div>
          <span className="text-white text-xs font-semibold truncate max-w-[100px]">{gn.label}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[10px]">
          <span className="text-danone-gray-500">Temp</span>
          <span className="text-white text-right">{fmt(gn.metrics?.avg_temperature_c)}°C</span>
          <span className="text-danone-gray-500">Energy</span>
          <span className="text-white text-right">{fmt(gn.metrics?.total_energy_kwh, 2)} kWh</span>
          <span className="text-danone-gray-500">Alarms</span>
          <span
            className="text-right font-bold"
            style={{ color: (gn.metrics?.alarm_count ?? 0) > 0 ? "#EF4444" : "#10B981" }}
          >
            {gn.metrics?.alarm_count ?? 0}
          </span>
        </div>
        <div
          className="text-[9px] font-mono mt-1.5 px-1.5 py-0.5 rounded text-center"
          style={{ background: `${typeColor}20`, color: typeColor }}
        >
          {gn.equipment_type}
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: colors.border, border: "none" }} />
    </>
  );
}

// ─── Batch node ───────────────────────────────────────────────────────────────
function BatchNode({ data }: NodeProps) {
  const gn = data as unknown as GraphNode & { onSelect: (n: GraphNode) => void };
  const colors = STATUS_COLORS[gn.status];

  return (
    <>
      <div
        onClick={() => gn.onSelect(gn)}
        className="cursor-pointer rounded-full px-4 py-3 text-center min-w-[110px] transition-all hover:scale-105"
        style={{
          background: "#0F172A",
          border: `2px solid ${colors.border}`,
          boxShadow: `0 0 16px ${colors.glow}`,
        }}
      >
        <div
          className="text-[9px] font-semibold tracking-widest uppercase mb-0.5"
          style={{ color: colors.border }}
        >
          BATCH
        </div>
        <div className="text-white text-xs font-bold">{gn.label}</div>
        <div className="text-[10px] text-danone-gray-400 mt-1">
          Fat {fmt(gn.metrics?.avg_fat_pct, 1)}% · Pro {fmt(gn.metrics?.avg_protein_pct, 1)}%
        </div>
        <div className="text-[10px] mt-0.5">
          <span
            style={{ color: (gn.metrics?.moisture_compliance_pct ?? 100) >= 90 ? "#10B981" : "#F59E0B" }}
          >
            {fmt(gn.metrics?.moisture_compliance_pct)}% compliance
          </span>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: colors.border, border: "none" }} />
    </>
  );
}

const NODE_TYPES = { equipment: EquipmentNode, batch: BatchNode };

// ─── Side panel ───────────────────────────────────────────────────────────────
function NodePanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const isBatch = node.type === "batch";
  const metrics: GraphNodeMetrics = node.metrics ?? {};

  return (
    <div className="absolute top-4 right-4 w-64 card z-10 animate-slide-in">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-white truncate">{node.label}</p>
        <button onClick={onClose} className="text-danone-gray-500 hover:text-white transition-colors">
          <X size={14} />
        </button>
      </div>
      <div className="space-y-1.5 text-xs">
        <Row label="Type" value={isBatch ? "Milk Batch" : node.equipment_type ?? "—"} />
        <Row label="Plant" value={`P${node.plant_id}`} />
        <Row label="Line" value={`L${node.line_id}`} />
        {isBatch ? (
          <>
            <Row label="Moisture" value={`${fmt(metrics.avg_moisture_pct, 2)}%`} />
            <Row label="Protein" value={`${fmt(metrics.avg_protein_pct, 2)}%`} />
            <Row label="Fat" value={`${fmt(metrics.avg_fat_pct, 2)}%`} />
            <Row label="FTR Rate" value={`${fmt(metrics.ftr_rate_pct)}%`} />
            <Row label="Compliance" value={`${fmt(metrics.moisture_compliance_pct)}%`} />
          </>
        ) : (
          <>
            <Row label="Avg Temp" value={`${fmt(metrics.avg_temperature_c)}°C`} />
            <Row label="Energy" value={`${fmt(metrics.total_energy_kwh, 2)} kWh`} />
            <Row label="Alarms" value={String(metrics.alarm_count ?? 0)} />
          </>
        )}
        <Row label="Status" value={node.status.toUpperCase()} highlight={node.status} />
      </div>
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: string }) {
  const color =
    highlight === "alarm" ? "#EF4444" :
    highlight === "warning" ? "#F59E0B" :
    highlight === "ok" ? "#10B981" :
    "#E2E8F0";

  return (
    <div className="flex justify-between items-center py-0.5 border-b border-danone-gray-700/50 last:border-0">
      <span className="text-danone-gray-500">{label}</span>
      <span className="font-medium" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Layout algorithm: left (batches) → right (equipment by type) ─────────────
function buildLayoutNodes(graphData: GraphData, onSelect: (n: GraphNode) => void): Node[] {
  const batches = graphData.nodes.filter((n) => n.type === "batch");
  const equip = graphData.nodes.filter((n) => n.type === "equipment");

  // Group equipment by type for vertical layout
  const typeGroups = new Map<string, GraphNode[]>();
  for (const e of equip) {
    const t = e.equipment_type ?? "Other";
    if (!typeGroups.has(t)) typeGroups.set(t, []);
    typeGroups.get(t)!.push(e);
  }

  const nodes: Node[] = [];

  // Batch nodes — column 0
  batches.forEach((b, i) => {
    nodes.push({
      id: b.id,
      type: "batch",
      position: { x: 0, y: i * 130 },
      data: { ...b, onSelect } as unknown as Record<string, unknown>,
    });
  });

  // Equipment nodes — columns 1..N (per type)
  let typeCol = 0;
  for (const [, items] of typeGroups) {
    items.forEach((e, row) => {
      nodes.push({
        id: e.id,
        type: "equipment",
        position: { x: 280 + typeCol * 200, y: row * 140 },
        data: { ...e, onSelect } as unknown as Record<string, unknown>,
      });
    });
    typeCol++;
  }

  return nodes;
}

function buildLayoutEdges(graphData: GraphData): Edge[] {
  return graphData.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: true,
    style: { stroke: "#334155", strokeWidth: 1.5 },
    labelStyle: { fontSize: 9, fill: "#64748B" },
    labelBgStyle: { fill: "#0F172A", fillOpacity: 0.8 },
  }));
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KnowledgeGraph() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, batches: 0, equipment: 0 });

  useEffect(() => {
    fetchGraph()
      .then((data) => {
        const layoutNodes = buildLayoutNodes(data, setSelected);
        const layoutEdges = buildLayoutEdges(data);
        setNodes(layoutNodes);
        setEdges(layoutEdges);
        setStats({
          nodes: data.nodes.length,
          edges: data.edges.length,
          batches: data.nodes.filter((n) => n.type === "batch").length,
          equipment: data.nodes.filter((n) => n.type === "equipment").length,
        });
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="card h-[500px] flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-danone-lightblue border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-danone-gray-400 text-sm">Building knowledge graph…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card h-[200px] flex items-center justify-center">
        <p className="text-red-400 text-sm">Failed to load graph: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-400px)] min-h-[380px] card overflow-hidden p-0">
      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 flex-wrap">
        {[
          { color: "#10B981", label: "Normal" },
          { color: "#F59E0B", label: "Warning" },
          { color: "#EF4444", label: "Alarm" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 bg-danone-gray-900/80 px-2 py-1 rounded-md text-[10px]">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-danone-gray-300">{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 bg-danone-gray-900/80 px-2 py-1 rounded-md text-[10px] text-danone-gray-400">
          {stats.batches} batches · {stats.equipment} equipment · {stats.edges} edges
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1E293B" variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls />
        <MiniMap
          style={{ background: "#1E293B", border: "1px solid #334155" }}
          nodeColor={(n) => {
            const status = (n.data as { status?: string })?.status;
            return status === "alarm" ? "#EF4444" : status === "warning" ? "#F59E0B" : "#10B981";
          }}
          maskColor="rgba(15,23,42,0.7)"
        />
      </ReactFlow>

      {selected && <NodePanel node={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
