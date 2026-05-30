import React, { useState } from 'react';
import { TechNodeStatus, TechCategory } from '../../game/core/types';
import type { TechNode } from '../../game/core/types';

const CATEGORY_LABELS: Record<TechCategory, string> = {
  [TechCategory.Infrastructure]:  '基礎設施',
  [TechCategory.Performance]:     '效能優化',
  [TechCategory.CostControl]:     '成本控管',
  [TechCategory.SpaceInnovation]: '空間革新',
  [TechCategory.Management]:      '管理升級',
  [TechCategory.ScaleEconomy]:    '規模經濟',
  [TechCategory.HRManagement]:    '人力管理',
  [TechCategory.SecurityDefense]: '資安防禦',
  [TechCategory.SupplyChain]:     '供應鏈',
  [TechCategory.RiskControl]:     '風險管控',
  [TechCategory.CloudCompete]:    '雲端競爭',
  [TechCategory.AIInfra]:         'AI 基礎設施',
};

const STATUS_COLORS: Record<TechNodeStatus, string> = {
  [TechNodeStatus.Locked]:     '#444',
  [TechNodeStatus.Available]:  'var(--tm-cyan)',
  [TechNodeStatus.InProgress]: 'var(--tm-yellow)',
  [TechNodeStatus.Completed]:  'var(--tm-green)',
};

interface Props {
  techNodes: TechNode[];
  onStartResearch: (nodeId: string) => void;
  onCancelResearch: (nodeId: string) => void;
}

export const TechTreePanel: React.FC<Props> = ({ techNodes, onStartResearch, onCancelResearch }) => {
  const [selectedCategory, setSelectedCategory] = useState<TechCategory | null>(null);
  const [search, setSearch] = useState('');

  const categories = Array.from(new Set(techNodes.map(n => n.category)));
  const completed = techNodes.filter(n => n.status === TechNodeStatus.Completed).length;
  const inProgress = techNodes.filter(n => n.status === TechNodeStatus.InProgress).length;
  const available  = techNodes.filter(n => n.status === TechNodeStatus.Available).length;

  const filtered = techNodes.filter(n => {
    if (selectedCategory && n.category !== selectedCategory) return false;
    if (search && !n.name.includes(search) && !n.id.includes(search.toUpperCase())) return false;
    return true;
  });

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11 }}>
        <span style={{ color: 'var(--tm-green)' }}>完成：{completed}</span>
        <span style={{ color: 'var(--tm-yellow)' }}>進行中：{inProgress}</span>
        <span style={{ color: 'var(--tm-cyan)' }}>可研究：{available}</span>
        <span style={{ color: '#555' }}>共：{techNodes.length}</span>
      </div>

      <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="搜尋..."
          style={{
            padding: '2px 6px', fontSize: 11, background: '#111', border: '1px solid #334',
            borderRadius: 3, color: '#ccc', width: 100,
          }}
        />
        <button onClick={() => setSelectedCategory(null)} style={{
          padding: '1px 7px', fontSize: 10,
          background: selectedCategory === null ? '#1a2a1a' : '#111',
          border: `1px solid ${selectedCategory === null ? '#558855' : '#334'}`,
          borderRadius: 3, color: selectedCategory === null ? 'var(--tm-green)' : '#666', cursor: 'pointer',
        }}>全部</button>
        {categories.map(cat => (
          <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)} style={{
            padding: '1px 6px', fontSize: 10,
            background: selectedCategory === cat ? '#1a2a1a' : '#111',
            border: `1px solid ${selectedCategory === cat ? '#558855' : '#334'}`,
            borderRadius: 3, color: selectedCategory === cat ? 'var(--tm-green)' : '#666', cursor: 'pointer',
          }}>
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 400, overflowY: 'auto' }}>
        {filtered.map(node => (
          <div key={node.id} style={{
            padding: '6px 8px', borderRadius: 3,
            background: node.status === TechNodeStatus.Completed ? '#0d1a0d' :
                        node.status === TechNodeStatus.InProgress ? '#1a1a0d' :
                        node.status === TechNodeStatus.Available  ? '#0d0d1a' : '#0d0d0d',
            border: `1px solid ${STATUS_COLORS[node.status]}44`,
            opacity: node.status === TechNodeStatus.Locked ? 0.5 : 1,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: STATUS_COLORS[node.status], fontSize: 10, minWidth: 16 }}>
                {node.status === TechNodeStatus.Completed ? '✓' :
                 node.status === TechNodeStatus.InProgress ? '⟳' :
                 node.status === TechNodeStatus.Available  ? '○' : '✕'}
              </span>
              <span style={{ flex: 1, color: '#ccc' }}>{node.name}</span>
              <span style={{ color: '#888', fontSize: 10 }}>{CATEGORY_LABELS[node.category]}</span>
              <span style={{ color: '#88aaff', fontSize: 10 }}>
                NT${(node.investmentCostNTD / 10000).toFixed(0)}萬
              </span>
              <span style={{ color: '#666', fontSize: 10 }}>{node.implementationMonths}月</span>

              {node.status === TechNodeStatus.Available && (
                <button onClick={() => onStartResearch(node.id)} style={{
                  padding: '1px 6px', fontSize: 10,
                  background: '#0d1a0d', border: '1px solid #448844',
                  borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer',
                }}>研究</button>
              )}
              {node.status === TechNodeStatus.InProgress && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ color: 'var(--tm-yellow)', fontSize: 10 }}>
                    {node.progressMonths}/{node.implementationMonths}月
                  </span>
                  <button onClick={() => onCancelResearch(node.id)} style={{
                    padding: '1px 5px', fontSize: 10,
                    background: '#1a0d0d', border: '1px solid #553333',
                    borderRadius: 3, color: '#cc4444', cursor: 'pointer',
                  }}>取消</button>
                </div>
              )}
            </div>
            {node.effects.length > 0 && node.status !== TechNodeStatus.Locked && (
              <div style={{ marginTop: 3, fontSize: 10, color: '#666', paddingLeft: 24 }}>
                {node.effects.map((e, i) => <span key={i} style={{ marginRight: 8 }}>{e.description}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
