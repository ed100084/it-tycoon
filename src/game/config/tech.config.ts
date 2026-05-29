export type TechEffectKey =
  | 'cpsMultiplier'
  | 'clickMultiplier'
  | 'powerCostMultiplier'
  | 'procurementSpeedMultiplier'
  | 'auditCostMultiplier'
  | 'satisfactionRecoveryMultiplier'
  | 'rackCapacityMultiplier'
  | 'prestigeReputationMultiplier';

export interface TechNodeDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  cost: number;
  requires: string[];
  effect: Partial<Record<TechEffectKey, number>>;
}

export const TECH_NODE_DEFS: TechNodeDefinition[] = [
  {
    id: 'VIRTUALIZATION',
    name: 'Virtualization',
    category: 'Infrastructure',
    description: 'Improve compute density with better scheduling.',
    cost: 1,
    requires: [],
    effect: { cpsMultiplier: 0.1 },
  },
  {
    id: 'PROCESS_AUTOMATION',
    name: 'Process Automation',
    category: 'Management',
    description: 'Reduce approval friction and routine toil.',
    cost: 1,
    requires: [],
    effect: { procurementSpeedMultiplier: 0.12, satisfactionRecoveryMultiplier: 0.1 },
  },
  {
    id: 'SEC_AWARENESS',
    name: 'Security Awareness',
    category: 'Security',
    description: 'Make audit evidence easier to prepare.',
    cost: 1,
    requires: [],
    effect: { auditCostMultiplier: -0.08 },
  },
  {
    id: 'POWER_FUTURES',
    name: 'Power Futures',
    category: 'Cost Control',
    description: 'Hedge electricity costs before they eat the budget.',
    cost: 1,
    requires: [],
    effect: { powerCostMultiplier: -0.08 },
  },
  {
    id: 'HIGH_DENSITY_RACK',
    name: 'High Density Rack',
    category: 'Facility',
    description: 'Increase practical rack capacity through better layout.',
    cost: 2,
    requires: [],
    effect: { rackCapacityMultiplier: 0.1 },
  },
  {
    id: 'BULK_PURCHASE',
    name: 'Bulk Purchase Agreement',
    category: 'Supply Chain',
    description: 'Standardize vendors and speed repeated purchase requests.',
    cost: 2,
    requires: ['PROCESS_AUTOMATION'],
    effect: { procurementSpeedMultiplier: 0.18 },
  },
  {
    id: 'AUDIT_READINESS',
    name: 'Audit Readiness',
    category: 'Management',
    description: 'Keep evidence continuously ready instead of scrambling.',
    cost: 2,
    requires: ['PROCESS_AUTOMATION', 'SEC_AWARENESS'],
    effect: { auditCostMultiplier: -0.14, satisfactionRecoveryMultiplier: 0.08 },
  },
  {
    id: 'NVME_CACHE',
    name: 'NVMe Cache',
    category: 'Performance',
    description: 'Accelerate hot workloads and improve perceived service quality.',
    cost: 2,
    requires: ['VIRTUALIZATION'],
    effect: { cpsMultiplier: 0.18 },
  },
  {
    id: 'ENERGY_CERT',
    name: 'Energy Certification',
    category: 'Cost Control',
    description: 'Operational discipline reduces cooling and power waste.',
    cost: 2,
    requires: ['POWER_FUTURES'],
    effect: { powerCostMultiplier: -0.12 },
  },
  {
    id: 'BACKUP_ARCH',
    name: 'Backup Architecture',
    category: 'Risk',
    description: 'Recovery drills become smoother and customers trust you more.',
    cost: 2,
    requires: ['SEC_AWARENESS'],
    effect: { satisfactionRecoveryMultiplier: 0.12, auditCostMultiplier: -0.08 },
  },
  {
    id: 'ITSM_PLATFORM',
    name: 'ITSM Platform',
    category: 'Management',
    description: 'Formal change and incident workflows reduce operational drag.',
    cost: 3,
    requires: ['AUDIT_READINESS'],
    effect: { procurementSpeedMultiplier: 0.12, auditCostMultiplier: -0.12 },
  },
  {
    id: 'MODULAR_EXPANSION',
    name: 'Modular Expansion',
    category: 'Facility',
    description: 'Prefabricated capacity modules make expansion less disruptive.',
    cost: 3,
    requires: ['HIGH_DENSITY_RACK'],
    effect: { rackCapacityMultiplier: 0.15, procurementSpeedMultiplier: 0.08 },
  },
  {
    id: 'AUTOMATION_OPS',
    name: 'Automation Ops',
    category: 'Operations',
    description: 'Automated runbooks improve throughput and incident response.',
    cost: 3,
    requires: ['PROCESS_AUTOMATION', 'VIRTUALIZATION'],
    effect: { cpsMultiplier: 0.12, satisfactionRecoveryMultiplier: 0.15 },
  },
  {
    id: 'SOC_CENTER',
    name: 'SOC Center',
    category: 'Security',
    description: 'Security monitoring makes audits and surprise reviews cheaper.',
    cost: 3,
    requires: ['SEC_AWARENESS', 'AUDIT_READINESS'],
    effect: { auditCostMultiplier: -0.18 },
  },
  {
    id: 'HYBRID_CLOUD',
    name: 'Hybrid Cloud',
    category: 'Cloud',
    description: 'Blend internal capacity with elastic overflow.',
    cost: 4,
    requires: ['VIRTUALIZATION', 'ITSM_PLATFORM'],
    effect: { cpsMultiplier: 0.2, rackCapacityMultiplier: 0.08 },
  },
  {
    id: 'GPU_ACCELERATION',
    name: 'GPU Acceleration',
    category: 'Performance',
    description: 'Prepare the platform for AI-era workloads.',
    cost: 4,
    requires: ['NVME_CACHE'],
    effect: { cpsMultiplier: 0.3 },
  },
  {
    id: 'GREEN_ENERGY',
    name: 'Green Energy',
    category: 'Cost Control',
    description: 'Long-term power sourcing makes large clusters viable.',
    cost: 4,
    requires: ['ENERGY_CERT'],
    effect: { powerCostMultiplier: -0.18 },
  },
  {
    id: 'ISO27001',
    name: 'ISO 27001 Certification',
    category: 'Compliance',
    description: 'Formal certification improves trust and audit outcomes.',
    cost: 5,
    requires: ['ITSM_PLATFORM', 'SOC_CENTER'],
    effect: { auditCostMultiplier: -0.22, prestigeReputationMultiplier: 0.1 },
  },
  {
    id: 'AIOPS_MONITORING',
    name: 'AIOps Monitoring',
    category: 'Operations',
    description: 'Machine-assisted operations improve performance and recovery.',
    cost: 5,
    requires: ['AUTOMATION_OPS'],
    effect: { cpsMultiplier: 0.2, satisfactionRecoveryMultiplier: 0.2 },
  },
  {
    id: 'PRIVATE_CLOUD',
    name: 'Private Cloud Platform',
    category: 'Cloud',
    description: 'Turn the datacenter into a mature internal cloud platform.',
    cost: 6,
    requires: ['HYBRID_CLOUD', 'MODULAR_EXPANSION'],
    effect: { cpsMultiplier: 0.35, prestigeReputationMultiplier: 0.15 },
  },
];
