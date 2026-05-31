import type {
  GameConfig, GameDate, IEventBus, IGameModule, Money,
  VendorConfig, VendorId, VendorLevel, VendorRelationship,
} from '../core/types';

const DEFAULT_VENDOR_CONFIG: VendorConfig = {
  purchasePerPoint: 1_000_000,
  silverThreshold: 30,
  goldThreshold: 60,
  platinumThreshold: 85,
  goldDiscount: 0.10,
  platinumDiscount: 0.15,
  concentrationRiskThreshold: 0.60,
  deliverySpeedupMonths: 1,
};

const INITIAL_VENDORS: Array<Pick<VendorRelationship, 'vendorId' | 'name'>> = [
  { vendorId: 'DELL',      name: 'Dell Technologies' },
  { vendorId: 'HPE',       name: 'HPE (Hewlett Packard Enterprise)' },
  { vendorId: 'CISCO',     name: 'Cisco Systems' },
  { vendorId: 'FORTINET',  name: 'Fortinet' },
  { vendorId: 'MICROSOFT', name: 'Microsoft' },
  { vendorId: 'VMWARE',    name: 'VMware / Broadcom' },
];

interface VendorEngineState {
  vendors: VendorRelationship[];
  lastNotifiedPlatinum: VendorId[];
}

function getLevel(score: number, cfg: VendorConfig): VendorLevel {
  if (score >= cfg.platinumThreshold) return 'Platinum';
  if (score >= cfg.goldThreshold) return 'Gold';
  if (score >= cfg.silverThreshold) return 'Silver';
  return 'Bronze';
}

function getDiscount(level: VendorLevel, cfg: VendorConfig): number {
  if (level === 'Platinum') return cfg.platinumDiscount;
  if (level === 'Gold') return cfg.goldDiscount;
  return 0;
}

export class VendorEngine implements IGameModule {
  readonly moduleId = 'VendorEngine';

  private bus!: IEventBus;
  private cfg!: VendorConfig;
  private currentDate: GameDate = { year: 2000, month: 1 };

  private state: VendorEngineState = {
    vendors: [],
    lastNotifiedPlatinum: [],
  };

  // ── Public API ───────────────────────────────────────────────────────────

  getVendors(): VendorRelationship[] {
    return [...this.state.vendors];
  }

  getVendor(vendorId: VendorId): VendorRelationship | null {
    return this.state.vendors.find(v => v.vendorId === vendorId) ?? null;
  }

  getDiscount(vendorId: VendorId): number {
    const v = this.getVendor(vendorId);
    if (!v) return 0;
    return getDiscount(v.level, this.cfg);
  }

  hasPriorityDelivery(vendorId: VendorId): boolean {
    return this.getVendor(vendorId)?.priorityDelivery ?? false;
  }

  getConcentrationRisk(): { vendorId: VendorId; share: number } | null {
    const total = this.state.vendors.reduce((s, v) => s + v.totalPurchases, 0);
    if (total === 0) return null;
    for (const v of this.state.vendors) {
      if (v.totalPurchases / total > this.cfg.concentrationRiskThreshold) {
        return { vendorId: v.vendorId, share: v.totalPurchases / total };
      }
    }
    return null;
  }

  // Called when a hardware purchase is made for a specific vendor brand
  recordPurchase(vendorId: VendorId, amount: Money): void {
    const v = this.state.vendors.find(v => v.vendorId === vendorId);
    if (!v) return;

    v.totalPurchases += amount;
    const pointsEarned = Math.floor(amount / this.cfg.purchasePerPoint);
    const prevLevel = v.level;
    v.relationshipLevel = Math.min(100, v.relationshipLevel + pointsEarned);
    v.level = getLevel(v.relationshipLevel, this.cfg);
    v.discountRate = getDiscount(v.level, this.cfg);
    v.priorityDelivery = v.level === 'Gold' || v.level === 'Platinum';

    if (v.level !== prevLevel) {
      this.bus.publish({
        type: 'vendor.level_up',
        payload: {
          vendorId: v.vendorId,
          vendorName: v.name,
          fromLevel: prevLevel,
          toLevel: v.level,
          discount: v.discountRate,
        },
        source: this.moduleId,
        gameDate: this.currentDate,
      });

      // Platinum notification for exclusive products
      if (v.level === 'Platinum' && !this.state.lastNotifiedPlatinum.includes(v.vendorId)) {
        this.state.lastNotifiedPlatinum.push(v.vendorId);
        this.bus.publish({
          type: 'vendor.platinum_unlocked',
          payload: {
            vendorId: v.vendorId,
            vendorName: v.name,
            discount: this.cfg.platinumDiscount,
            message: `${v.name} 業務主動推薦新產品！享有 ${Math.round(this.cfg.platinumDiscount * 100)}% 折扣與獨家商品`,
          },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }
  }

  // ── IGameModule ──────────────────────────────────────────────────────────

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.vendor ?? DEFAULT_VENDOR_CONFIG;
    this.currentDate = { ...config.time.startDate };

    // Seed vendors if empty
    if (this.state.vendors.length === 0) {
      for (const v of INITIAL_VENDORS) {
        this.state.vendors.push({
          vendorId: v.vendorId,
          name: v.name,
          relationshipLevel: 0,
          discountRate: 0,
          priorityDelivery: false,
          totalPurchases: 0,
          level: 'Bronze',
        });
      }
    }

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
    }, this.moduleId);

    // Intercept hardware purchases to track vendor
    bus.subscribe('hardware.purchased', (e) => {
      const p = e.payload as { brand?: string; totalPrice?: Money };
      if (!p.brand || !p.totalPrice) return;
      const vendorId = this.brandToVendorId(p.brand);
      if (vendorId) this.recordPurchase(vendorId, p.totalPrice);
    }, this.moduleId);

    // Concentration risk check on month end
    bus.subscribe('time.month_end', () => {
      const risk = this.getConcentrationRisk();
      if (risk) {
        this.bus.publish({
          type: 'vendor.concentration_risk',
          payload: { vendorId: risk.vendorId, share: risk.share },
          source: this.moduleId,
          gameDate: this.currentDate,
        });
      }
    }, this.moduleId);
  }

  tick(_deltaMs: number): void { /* no continuous logic */ }

  serialize(): Record<string, unknown> {
    return {
      vendors: this.state.vendors,
      lastNotifiedPlatinum: this.state.lastNotifiedPlatinum,
    };
  }

  deserialize(saved: Record<string, unknown>): void {
    if (saved.vendors) this.state.vendors = saved.vendors as VendorRelationship[];
    if (saved.lastNotifiedPlatinum) this.state.lastNotifiedPlatinum = saved.lastNotifiedPlatinum as VendorId[];
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({
      vendors: this.state.vendors,
      concentrationRisk: this.getConcentrationRisk(),
    });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private brandToVendorId(brand: string): VendorId | null {
    const b = brand.toUpperCase();
    if (b.includes('DELL')) return 'DELL';
    if (b.includes('HP') || b.includes('HPE')) return 'HPE';
    if (b.includes('CISCO')) return 'CISCO';
    if (b.includes('FORTINET')) return 'FORTINET';
    if (b.includes('MICROSOFT')) return 'MICROSOFT';
    if (b.includes('VMWARE')) return 'VMWARE';
    return null;
  }
}
