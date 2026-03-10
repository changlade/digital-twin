import KnowledgeGraph from "../components/KnowledgeGraph";
import { GitFork, Info } from "lucide-react";

export default function GraphPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <GitFork size={20} className="text-danone-lightblue" />
            Bio-Mechanical Knowledge Graph
          </h2>
          <p className="text-xs text-danone-gray-500 mt-1">
            Live RDF-style graph linking raw milk batches (biological twin) to factory equipment
            (mechanical twin). Edges represent <span className="font-mono text-danone-gray-400">processed_by</span> relationships
            derived from <span className="font-mono text-danone-gray-400">silver_twin_events</span>.
          </p>
        </div>
      </div>

      {/* Info callout */}
      <div className="flex items-start gap-3 px-4 py-3 bg-danone-blue/10 border border-danone-blue/20 rounded-lg text-xs text-danone-gray-300">
        <Info size={14} className="text-danone-lightblue mt-0.5 shrink-0" />
        <div>
          <span className="font-semibold text-white">How to read this graph: </span>
          Round nodes (left) are milk batches with biological properties (fat %, protein %).
          Square nodes (right) are plant equipment coloured by type. Edges show which equipment
          processed each batch. Node borders indicate status: <span className="text-emerald-400">green = OK</span>,{" "}
          <span className="text-yellow-400">yellow = warning</span>,{" "}
          <span className="text-red-400">red = active alarm</span>. Click any node for details.
        </div>
      </div>

      {/* Graph canvas */}
      <div data-tour="knowledge-graph">
        <KnowledgeGraph />
      </div>

      {/* Legend: equipment types */}
      <div className="card">
        <p className="section-title">Equipment Type Legend</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { type: "Centrifuge",  color: "#6366F1", icon: "⚙", desc: "Separates cream from milk at high RPM" },
            { type: "Pasteurizer", color: "#F97316", icon: "🔥", desc: "HTST heat treatment (72°C, 15s)" },
            { type: "SprayDryer",  color: "#06B6D4", icon: "💨", desc: "Converts liquid to powder; highest energy consumer" },
            { type: "MixingTank", color: "#8B5CF6", icon: "🌀", desc: "Blends ingredients, monitors viscosity" },
            { type: "CIPUnit",    color: "#3B82F6", icon: "💧", desc: "Clean-in-place; primary water consumer" },
          ].map(({ type, color, icon, desc }) => (
            <div key={type} className="card-sm">
              <div className="flex items-center gap-2 mb-1.5">
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
                  style={{ background: `${color}20`, color }}
                >
                  {icon}
                </div>
                <span className="text-xs font-semibold text-white">{type}</span>
              </div>
              <p className="text-[10px] text-danone-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
