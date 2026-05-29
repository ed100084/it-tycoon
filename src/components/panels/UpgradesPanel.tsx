import React from 'react';
import { PrestigeSection } from './upgrades/PrestigeSection';
import { AchievementsSection } from './upgrades/AchievementsSection';
import { TechTreeSection } from './upgrades/TechTreeSection';
import { FacilitySection } from './upgrades/FacilitySection';
import { ContractsSection } from './upgrades/ContractsSection';
import { AuditSection } from './upgrades/AuditSection';
import { ProcurementSection } from './upgrades/ProcurementSection';
import { PueSection } from './upgrades/PueSection';
import { HardwareUpgradeSection } from './upgrades/HardwareUpgradeSection';

export const UpgradesPanel: React.FC = () => (
  <div className="panel upgrades-panel">
    <div className="panel-header">⚙ UPGRADES</div>
    <PrestigeSection />
    <AchievementsSection />
    <TechTreeSection />
    <FacilitySection />
    <ContractsSection />
    <AuditSection />
    <ProcurementSection />
    <PueSection />
    <HardwareUpgradeSection />
  </div>
);
