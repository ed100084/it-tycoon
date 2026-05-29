import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import { STAFF_ROLE_DEFS, type StaffEffectKind } from '../../../game/config/staff.config';
import {
  calcCoverageRatio,
  calcStaffCoverage,
  calcStaffHeadcount,
  calcStaffHireCost,
  calcStaffSalaryPerSecond,
  calcWorkload,
} from '../../../game/systems/staff';
import { formatNumber } from '../../../utils/format';

const EFFECT_LABEL: Record<StaffEffectKind, (perHead: number) => string> = {
  satisfactionRecovery: (p) => `+${Math.round(p * 100)}% satisfaction recovery / head`,
  procurementSpeed: (p) => `+${Math.round(p * 100)}% procurement speed / head`,
  auditCost: (p) => `-${Math.round(p * 100)}% audit cost / head`,
  contractIncome: (p) => `+${Math.round(p * 100)}% contract income / head`,
};

export const StaffSection: React.FC = () => {
  const { compute, staff, hardware, contracts, hireStaff, dismissStaff } = useGameStore();

  const headcount = calcStaffHeadcount(staff);
  const salary = calcStaffSalaryPerSecond(staff);
  const coverage = calcStaffCoverage(staff);
  const workload = calcWorkload(hardware, contracts);
  const coverageRatio = calcCoverageRatio(coverage, workload);
  const understaffed = coverageRatio < 1;
  const coveragePct = Math.min(100, coverageRatio * 100);

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── STAFF ───</div>

      <div className="staff-summary">
        <span>Headcount <span className="glow-blue">{headcount}</span></span>
        <span>Payroll <span className={salary > 0 ? 'glow-yellow' : 'glow-green-dim'}>-{formatNumber(salary)} CF/s</span></span>
      </div>
      <div className={`staff-coverage ${understaffed ? 'understaffed' : ''}`}>
        <div className="staff-coverage-row">
          <span>Coverage</span>
          <span className={understaffed ? 'glow-red' : 'glow-green'}>
            {coverage} / {Math.max(0, workload)} {understaffed ? '· UNDERSTAFFED' : '· OK'}
          </span>
        </div>
        <div className="staff-coverage-bar">
          <div
            className={`staff-coverage-fill ${understaffed ? 'low' : ''}`}
            style={{ width: `${coveragePct}%` }}
          />
        </div>
      </div>

      <div className="staff-list">
        {STAFF_ROLE_DEFS.map((def) => {
          const owned = staff[def.id] ?? 0;
          const cost = calcStaffHireCost(def.id, owned);
          const canHire = compute >= cost;

          return (
            <div key={def.id} className="staff-card">
              <div className="staff-card-top">
                <span className="staff-name">{def.nameZh}</span>
                <span className="staff-count glow-blue">×{owned}</span>
              </div>
              <div className="staff-role-effect">{EFFECT_LABEL[def.effectKind](def.effectPerHead)}</div>
              <div className="staff-meta">
                <span>Coverage {def.coverage}</span>
                <span>Salary -{formatNumber(def.salaryPerSecond)}/s</span>
              </div>
              <div className="staff-actions">
                <button
                  className={`crt-btn staff-btn hire ${canHire ? '' : 'disabled'}`}
                  onClick={() => hireStaff(def.id)}
                  disabled={!canHire}
                >
                  [ HIRE {formatNumber(cost)} CF ]
                </button>
                <button
                  className={`crt-btn staff-btn dismiss ${owned > 0 ? '' : 'disabled'}`}
                  onClick={() => dismissStaff(def.id)}
                  disabled={owned <= 0}
                >
                  [ − ]
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
