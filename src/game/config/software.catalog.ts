import { SoftwareCategory, LicenseType, SoftwareEffectType } from '../core/types';
import type { SoftwareProduct } from '../core/types';

// ─── Era 1: 2000–2004 ────────────────────────────────────────────────────────

const ERA1_OS: SoftwareProduct[] = [
  {
    id: 'RHEL_3',
    name: 'Red Hat Enterprise Linux 3',
    category: SoftwareCategory.OS,
    licenseType: LicenseType.AnnualSubscription,
    vendor: 'Red Hat',
    unlockYear: 2003,
    eosYear: 2010,
    annualCostNTD: 45_000,
    effects: [{ type: SoftwareEffectType.ComplianceScore, value: 5 }],
    isFreeOpenSource: false,
  },
  {
    id: 'CENTOS_3',
    name: 'CentOS 3',
    category: SoftwareCategory.OS,
    licenseType: LicenseType.OpenSource,
    vendor: 'CentOS',
    unlockYear: 2004,
    eosYear: 2010,
    annualCostNTD: 0,
    effects: [],
    isFreeOpenSource: true,
    notes: 'RHEL clone, zero licensing cost',
  },
  {
    id: 'WIN_SERVER_2003',
    name: 'Windows Server 2003',
    category: SoftwareCategory.OS,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Microsoft',
    unlockYear: 2003,
    eosYear: 2015,
    annualCostNTD: 60_000,
    effects: [{ type: SoftwareEffectType.ComplianceScore, value: 3 }],
    isFreeOpenSource: false,
  },
  {
    id: 'WIN_2000_SERVER',
    name: 'Windows 2000 Server',
    category: SoftwareCategory.OS,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Microsoft',
    unlockYear: 2000,
    eosYear: 2010,
    annualCostNTD: 48_000,
    effects: [],
    isFreeOpenSource: false,
    upgradePathFrom: [],
  },
];

const ERA1_VIRTUALIZATION: SoftwareProduct[] = [
  {
    id: 'VMWARE_ESX_2',
    name: 'VMware ESX Server 2',
    category: SoftwareCategory.Virtualization,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'VMware',
    unlockYear: 2003,
    eosYear: 2008,
    annualCostNTD: 75_000,
    effects: [{ type: SoftwareEffectType.VirtualizationDensity, value: 2.0 }],
    isFreeOpenSource: false,
    notes: 'Bare-metal hypervisor, 2x VPS density',
  },
  {
    id: 'VMWARE_GSX_3',
    name: 'VMware GSX Server 3',
    category: SoftwareCategory.Virtualization,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'VMware',
    unlockYear: 2003,
    eosYear: 2009,
    annualCostNTD: 44_970,
    effects: [{ type: SoftwareEffectType.VirtualizationDensity, value: 1.5 }],
    isFreeOpenSource: false,
    notes: 'Hosted virtualization, 1.5x density',
  },
  {
    id: 'MS_VIRTUAL_SERVER_2005',
    name: 'Microsoft Virtual Server 2005',
    category: SoftwareCategory.Virtualization,
    licenseType: LicenseType.OpenSource,
    vendor: 'Microsoft',
    unlockYear: 2004,
    eosYear: 2011,
    annualCostNTD: 0,
    effects: [{ type: SoftwareEffectType.VirtualizationDensity, value: 1.3 }],
    isFreeOpenSource: true,
    notes: 'Free, Windows guests only, 1.3x density',
  },
];

const ERA1_BACKUP: SoftwareProduct[] = [
  {
    id: 'NETBACKUP_45',
    name: 'Veritas NetBackup 4.5',
    category: SoftwareCategory.Backup,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Veritas',
    unlockYear: 2001,
    eosYear: 2015,
    annualCostNTD: 150_000,
    effects: [{ type: SoftwareEffectType.BackupCoverage, value: 0.80 }],
    isFreeOpenSource: false,
  },
  {
    id: 'BACKUP_EXEC_8',
    name: 'Veritas Backup Exec 8',
    category: SoftwareCategory.Backup,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Veritas',
    unlockYear: 2001,
    eosYear: 2010,
    annualCostNTD: 30_000,
    effects: [{ type: SoftwareEffectType.BackupCoverage, value: 0.50 }],
    isFreeOpenSource: false,
    notes: 'Windows backup, entry-level',
  },
  {
    id: 'BACULA_OSS',
    name: 'Bacula (Open Source)',
    category: SoftwareCategory.Backup,
    licenseType: LicenseType.OpenSource,
    vendor: 'Bacula Systems',
    unlockYear: 2002,
    eosYear: 9999,
    annualCostNTD: 0,
    effects: [{ type: SoftwareEffectType.BackupCoverage, value: 0.40 }],
    isFreeOpenSource: true,
  },
];

const ERA1_SECURITY: SoftwareProduct[] = [
  {
    id: 'CHECKPOINT_FW1_R55',
    name: 'Check Point Firewall-1 NG AI R55',
    category: SoftwareCategory.Security,
    licenseType: LicenseType.AnnualSubscription,
    vendor: 'Check Point',
    unlockYear: 2003,
    eosYear: 2015,
    annualCostNTD: 240_000,
    effects: [
      { type: SoftwareEffectType.SecurityDetection, value: 0.15 },
      { type: SoftwareEffectType.ComplianceScore, value: 10 },
    ],
    isFreeOpenSource: false,
  },
];

const ERA1_MONITORING: SoftwareProduct[] = [
  {
    id: 'NAGIOS_OSS',
    name: 'Nagios (Open Source)',
    category: SoftwareCategory.Monitoring,
    licenseType: LicenseType.OpenSource,
    vendor: 'Nagios Enterprises',
    unlockYear: 2000,
    eosYear: 9999,
    annualCostNTD: 0,
    effects: [
      { type: SoftwareEffectType.IncidentResponseTime, value: 0.10 },
    ],
    isFreeOpenSource: true,
    notes: 'Free monitoring, reduces incident response time 10%',
  },
];

const ERA1_DATABASE: SoftwareProduct[] = [
  {
    id: 'MYSQL_4',
    name: 'MySQL 4.x',
    category: SoftwareCategory.Database,
    licenseType: LicenseType.OpenSource,
    vendor: 'MySQL AB',
    unlockYear: 2000,
    eosYear: 2009,
    annualCostNTD: 0,
    effects: [],
    isFreeOpenSource: true,
  },
  {
    id: 'MSSQL_2000',
    name: 'Microsoft SQL Server 2000',
    category: SoftwareCategory.Database,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Microsoft',
    unlockYear: 2000,
    eosYear: 2013,
    annualCostNTD: 90_000,
    effects: [{ type: SoftwareEffectType.ComplianceScore, value: 5 }],
    isFreeOpenSource: false,
  },
  {
    id: 'ORACLE_9I',
    name: 'Oracle Database 9i',
    category: SoftwareCategory.Database,
    licenseType: LicenseType.PerpetualWithSA,
    vendor: 'Oracle',
    unlockYear: 2001,
    eosYear: 2010,
    annualCostNTD: 360_000,
    effects: [
      { type: SoftwareEffectType.ComplianceScore, value: 10 },
      { type: SoftwareEffectType.StoragePerformance, value: 1.3 },
    ],
    isFreeOpenSource: false,
    notes: 'Enterprise RDBMS, high cost/compliance',
  },
];

export const SOFTWARE_CATALOG: SoftwareProduct[] = [
  ...ERA1_OS,
  ...ERA1_VIRTUALIZATION,
  ...ERA1_BACKUP,
  ...ERA1_SECURITY,
  ...ERA1_MONITORING,
  ...ERA1_DATABASE,
];

export const SOFTWARE_CATALOG_BY_ID = new Map<string, SoftwareProduct>(
  SOFTWARE_CATALOG.map(p => [p.id, p]),
);
