import React, { useState } from 'react';
import { EconomicCycle } from '../../game/core/types';
import type { ActiveRandomEvent, HistoricalEvent, GlobalModifier, EventDecision, EconomicCycleState } from '../../game/core/types';

const CYCLE_COLORS: Record<EconomicCycle, string> = {
  [EconomicCycle.Boom]:       'var(--tm-green)',
  [EconomicCycle.Normal]:     'var(--tm-cyan)',
  [EconomicCycle.Recession]:  'var(--tm-yellow)',
  [EconomicCycle.Depression]: 'var(--tm-red)',
};

const CYCLE_LABELS: Record<EconomicCycle, string> = {
  [EconomicCycle.Boom]:       '景氣繁榮',
  [EconomicCycle.Normal]:     '景氣正常',
  [EconomicCycle.Recession]:  '景氣衰退',
  [EconomicCycle.Depression]: '經濟蕭條',
};

interface Props {
  triggeredEvents: HistoricalEvent[];
  activeModifiers: GlobalModifier[];
  pendingDecisions: EventDecision[];
  activeRandomEvents: ActiveRandomEvent[];
  economicCycle: EconomicCycleState | null;
  onMakeDecision: (decisionId: string, optionIndex: number) => void;
  onResolveRandomEvent: (instanceId: string, optionIndex: number) => void;
}

export const EventTimelinePanel: React.FC<Props> = ({
  triggeredEvents, activeModifiers, pendingDecisions, activeRandomEvents,
  economicCycle, onMakeDecision, onResolveRandomEvent,
}) => {
  const [tab, setTab] = useState<'events' | 'modifiers' | 'decisions'>('events');

  return (
    <div style={{ fontSize: 12, color: 'var(--tm-text)' }}>
      {economicCycle && (
        <div style={{
          marginBottom: 10, padding: '6px 10px', background: '#0d0d1a',
          borderRadius: 4, border: `1px solid ${CYCLE_COLORS[economicCycle.current]}44`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: CYCLE_COLORS[economicCycle.current], fontWeight: 'bold' }}>
            {CYCLE_LABELS[economicCycle.current]}
          </span>
          <span style={{ color: '#555', fontSize: 10 }}>
            已持續 {economicCycle.monthsInCurrentPhase}/{economicCycle.phaseDurationMonths} 個月
          </span>
        </div>
      )}

      {/* Pending historical event decisions */}
      {pendingDecisions.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px', background: '#1a0d0d', borderRadius: 4, border: '1px solid var(--tm-red)' }}>
          <div style={{ color: 'var(--tm-red)', marginBottom: 8, fontSize: 11 }}>⚡ 待決策事項（歷史事件）</div>
          {pendingDecisions.map(d => (
            <div key={d.id} style={{ marginBottom: 8 }}>
              <div style={{ marginBottom: 6, color: '#ddd' }}>{d.template.prompt}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {d.template.options.map((opt, i) => (
                  <button key={i} onClick={() => onMakeDecision(d.id, i)} style={{
                    padding: '3px 10px', fontSize: 11,
                    background: '#0d1a0d', border: '1px solid #448844',
                    borderRadius: 3, color: 'var(--tm-green)', cursor: 'pointer',
                  }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active random events */}
      {activeRandomEvents.length > 0 && (
        <div style={{ marginBottom: 12, padding: '8px', background: '#1a1a0d', borderRadius: 4, border: '1px solid #888800' }}>
          <div style={{ color: '#ffcc44', marginBottom: 8, fontSize: 11 }}>🎲 隨機事件 — 需要決策</div>
          {activeRandomEvents.map(ev => (
            <div key={ev.instanceId} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 16 }}>{ev.icon}</span>
                <span style={{ color: '#cccc88', fontWeight: 'bold', fontSize: 12 }}>{ev.name}</span>
                <span style={{ color: '#555', fontSize: 10, marginLeft: 'auto' }}>
                  到期：{ev.expiresAt.year}/{ev.expiresAt.month}
                </span>
              </div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 6 }}>{ev.description}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {ev.options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => onResolveRandomEvent(ev.instanceId, i)}
                    style={{
                      flex: 1,
                      padding: '4px 8px', fontSize: 11,
                      background: i === ev.defaultOptionIndex ? '#1a2a0d' : '#111',
                      border: `1px solid ${i === ev.defaultOptionIndex ? '#558844' : '#444'}`,
                      borderRadius: 3,
                      color: i === ev.defaultOptionIndex ? 'var(--tm-green)' : '#888',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                    title={opt.description}
                  >
                    {opt.label}
                    {i === ev.defaultOptionIndex && <span style={{ fontSize: 9, marginLeft: 4, color: '#557' }}>(預設)</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, borderBottom: '1px solid #334', paddingBottom: 6 }}>
        {(['events', 'modifiers', 'decisions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '2px 8px', fontSize: 10,
            background: tab === t ? '#1a3a1a' : '#111',
            border: `1px solid ${tab === t ? '#558855' : '#334'}`,
            borderRadius: 3, color: tab === t ? 'var(--tm-green)' : '#666', cursor: 'pointer',
          }}>
            {t === 'events' ? `歷史事件 (${triggeredEvents.length})` : t === 'modifiers' ? `修正 (${activeModifiers.length})` : '已決策'}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {triggeredEvents.length === 0 ? (
            <div style={{ color: '#444', textAlign: 'center', padding: '16px 0' }}>尚無觸發事件</div>
          ) : (
            [...triggeredEvents].reverse().map(ev => (
              <div key={ev.id} style={{
                padding: '4px 8px', background: '#0d0d1a', borderRadius: 3,
                border: '1px solid #223',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#ccc' }}>{ev.name}</span>
                  <span style={{ color: '#555', fontSize: 10 }}>
                    {ev.triggeredAt ? `${ev.triggeredAt.year}/${ev.triggeredAt.month}` : ''}
                  </span>
                </div>
                <div style={{ color: '#666', fontSize: 10, marginTop: 2 }}>{ev.description}</div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'modifiers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {activeModifiers.length === 0 ? (
            <div style={{ color: '#444', textAlign: 'center', padding: '16px 0' }}>無活躍修正係數</div>
          ) : (
            activeModifiers.map(m => (
              <div key={m.id} style={{
                padding: '4px 8px', background: '#0d1a0d', borderRadius: 3, border: '1px solid #223',
                display: 'flex', justifyContent: 'space-between',
              }}>
                <span style={{ color: '#aaa', fontSize: 11 }}>{m.description}</span>
                <span style={{
                  color: m.value > 1 ? 'var(--tm-yellow)' : 'var(--tm-green)',
                  fontSize: 10,
                }}>
                  {m.isMultiplier ? `×${m.value.toFixed(2)}` : `+${m.value}`}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'decisions' && (
        <div style={{ color: '#444', textAlign: 'center', padding: '16px 0', fontSize: 11 }}>
          決策紀錄將在此顯示
        </div>
      )}
    </div>
  );
};
