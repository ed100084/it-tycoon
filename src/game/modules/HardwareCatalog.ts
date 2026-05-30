import { addMonths, monthsBetween } from '../../utils/gameDate';
import {
  AssetStatus,
  MaintenanceType,
  PurchasePaymentMethod,
  ExpenseCategory,
  HardwareCategory,
  FacilityRegion,
} from '../core/types';
import type {
  DepreciationSummary,
  DisposalResult,
  EntityId,
  GameConfig,
  GameDate,
  HardwareAsset,
  HardwareModel,
  HardwareModuleConfig,
  IEventBus,
  IGameModule,
  Money,
  PurchaseOrder,
} from '../core/types';
import { HARDWARE_CATALOG, HARDWARE_CATALOG_BY_ID } from '../config/hardware.catalog';

// ─── Default config fallback ──────────────────────────────────────────────────

const DEFAULT_HW_CONFIG: HardwareModuleConfig = {
  eolWarningMonthsBefore: 3,
  installationMonthsPerUnit: 0,
  largePurchaseThreshold: 5_000_000,
  requisitionDeliveryDelay: 1,
  requisitionDiscount: 0.75,
  installmentMonths: 24,
  eolFailureMultipliers: [1.0, 1.5, 2.0, 3.0],
  salvageValueRate: 0.10,
};

// ─── Internal state ───────────────────────────────────────────────────────────

interface HardwareCatalogState {
  assets: HardwareAsset[];
  pendingOrders: PurchaseOrder[];
  econHardwareMod: number;
  exchangeRateMod: number;
  batchPurchaseDiscount: number;
  chipShortageDelay: number;
  supplyChainDelay: number;
}

// ─── HardwareCatalog ──────────────────────────────────────────────────────────

export class HardwareCatalog implements IGameModule {
  readonly moduleId = 'HardwareCatalog';

  private bus!: IEventBus;
  private cfg!: HardwareModuleConfig;
  private currentDate!: GameDate;
  private financeCfg!: GameConfig['finance'];

  private state: HardwareCatalogState = {
    assets: [],
    pendingOrders: [],
    econHardwareMod: 1.0,
    exchangeRateMod: 1.0,
    batchPurchaseDiscount: 1.0,
    chipShortageDelay: 0,
    supplyChainDelay: 0,
  };

  init(bus: IEventBus, config: GameConfig): void {
    this.bus = bus;
    this.cfg = config.hardware ?? DEFAULT_HW_CONFIG;
    this.financeCfg = config.finance;
    this.currentDate = { ...config.time.startDate };

    bus.subscribe('time.month_end', (e) => {
      const p = e.payload as { newDate: GameDate };
      this.currentDate = p.newDate;
      this.onMonthEnd();
    }, this.moduleId);
  }

  tick(_deltaMs: number): void {}

  // ── Private helpers ───────────────────────────────────────────────

  private onMonthEnd(): void {
    this.processDeliveries();
    this.updateEOLStatus();
    this.emitEOLWarnings();
    this.emitDepreciation();
    this.emitMaintenanceFees();
  }

  private processDeliveries(): void {
    // Deliver when currentDate is strictly PAST deliveryDate (monthsBetween > 0)
    // so a delay=1 purchase from month 1 delivers at month 3 (not month 2)
    const delivered = this.state.pendingOrders.filter(
      o => o.status === 'pending' && monthsBetween(o.deliveryDate, this.currentDate) > 0,
    );
    for (const order of delivered) {
      order.status = 'delivered';
      const assetIds = this.state.assets
        .filter(a => a.purchaseOrderId === order.id && a.status === AssetStatus.InTransit)
        .map(a => {
          a.status = AssetStatus.Active;
          a.isInstalled = true;
          a.installationCompleteDate = this.currentDate;
          const model = HARDWARE_CATALOG_BY_ID.get(a.modelId);
          if (model) {
            this.bus.publish({
              type: 'hardware.installed',
              payload: {
                assetId: a.id,
                region: a.region,
                watts: model.specs.powerWatts,
                units: model.specs.rackUnits,
              },
              gameDate: this.currentDate,
              source: this.moduleId,
            });
          }
          return a.id;
        });
      this.bus.publish({
        type: 'hardware.delivered',
        payload: { orderId: order.id, assetIds },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }
  }

  private updateEOLStatus(): void {
    for (const asset of this.state.assets) {
      if (asset.status === AssetStatus.Disposed) continue;
      const eolPassed = monthsBetween(asset.eolDate, this.currentDate) >= 0;
      if (eolPassed) {
        asset.isEOL = true;
        asset.monthsSinceEOL = monthsBetween(asset.eolDate, this.currentDate);
        if (asset.status === AssetStatus.Active) {
          asset.status = AssetStatus.EOL;
        }
        this.bus.publish({
          type: 'hardware.eol_expired',
          payload: { assetId: asset.id },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private emitEOLWarnings(): void {
    const warnBeforeMonths = this.cfg.eolWarningMonthsBefore;
    for (const asset of this.state.assets) {
      if (asset.eolWarningShown || asset.isEOL) continue;
      if (asset.status === AssetStatus.Disposed) continue;
      const monthsUntilEOL = monthsBetween(this.currentDate, asset.eolDate);
      if (monthsUntilEOL <= warnBeforeMonths && monthsUntilEOL >= 0) {
        asset.eolWarningShown = true;
        this.bus.publish({
          type: 'hardware.eol_warning',
          payload: { assetId: asset.id, monthsUntilEOL },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private emitDepreciation(): void {
    const summary = this.calculateMonthlyDepreciation();
    if (summary.totalMonthlyDepreciation <= 0) return;
    for (const { assetId, amount } of summary.byAsset) {
      const asset = this.state.assets.find(a => a.id === assetId);
      if (!asset) continue;
      asset.accumulatedDepreciation += amount;
      asset.bookValue = Math.max(0, asset.bookValue - amount);
    }
    this.bus.publish({
      type: 'hardware.monthly_depreciation',
      payload: summary,
      gameDate: this.currentDate,
      source: this.moduleId,
    });
    this.bus.publish({
      type: 'finance.expense_requested',
      payload: {
        category: ExpenseCategory.HardwareDepreciation,
        amount: summary.totalMonthlyDepreciation,
        date: this.currentDate,
        description: 'Monthly hardware depreciation',
        isCashExpense: false,
      },
      gameDate: this.currentDate,
      source: this.moduleId,
    });
  }

  private emitMaintenanceFees(): void {
    for (const asset of this.state.assets) {
      if (asset.status === AssetStatus.Disposed || asset.status === AssetStatus.InTransit) continue;
      const model = HARDWARE_CATALOG_BY_ID.get(asset.modelId);
      if (!model) continue;
      let monthlyFee = 0;
      if (asset.maintenanceType === MaintenanceType.Warranty) {
        monthlyFee = 0; // covered by warranty
      } else if (asset.maintenanceType !== MaintenanceType.None) {
        const rates = {
          [MaintenanceType.NBD]: 0.08,
          [MaintenanceType.FourHour]: 0.12,
          [MaintenanceType.ThirdParty]: 0.20,
          [MaintenanceType.None]: 0,
          [MaintenanceType.Warranty]: 0,
        };
        const annualRate = rates[asset.maintenanceType] ?? 0;
        monthlyFee = Math.round((asset.purchasePrice * annualRate) / 12);
        if (asset.isEOL) monthlyFee *= 2; // EOL hardware demands double maintenance effort
      }
      if (monthlyFee > 0) {
        this.bus.publish({
          type: 'hardware.maintenance_due',
          payload: { assetId: asset.id, amount: monthlyFee },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
        this.bus.publish({
          type: 'finance.expense_requested',
          payload: {
            category: ExpenseCategory.Maintenance,
            amount: monthlyFee,
            date: this.currentDate,
            description: `Maintenance — ${model.name}`,
            isCashExpense: true,
          },
          gameDate: this.currentDate,
          source: this.moduleId,
        });
      }
    }
  }

  private getDepreciationMonths(model: HardwareModel): number {
    const map: Partial<Record<HardwareCategory, number>> = {
      [HardwareCategory.Server]: this.financeCfg.depreciation.server,
      [HardwareCategory.Storage]: this.financeCfg.depreciation.storage,
      [HardwareCategory.Networking]: this.financeCfg.depreciation.networking,
      [HardwareCategory.UPS]: this.financeCfg.depreciation.ups,
    };
    return map[model.category] ?? this.financeCfg.depreciation.facility;
  }

  private calcPurchasePrice(model: HardwareModel, method: PurchasePaymentMethod): Money {
    let price = model.pricing.basePriceNTD;
    if (model.isODM) price *= 0.75;
    else if (model.isPremium) price *= 1.25;
    price *= this.state.econHardwareMod;
    price *= this.state.exchangeRateMod;
    price *= this.state.batchPurchaseDiscount;
    if (method === PurchasePaymentMethod.RequisitionForm) {
      price *= this.cfg.requisitionDiscount;
    }
    return Math.round(price);
  }

  private generateId(): EntityId {
    return crypto.randomUUID();
  }

  // ── Public API ────────────────────────────────────────────────────

  getAvailableModels(date: GameDate): HardwareModel[] {
    return HARDWARE_CATALOG.filter(m => m.unlockYear <= date.year);
  }

  getModel(modelId: string): HardwareModel | null {
    return HARDWARE_CATALOG_BY_ID.get(modelId) ?? null;
  }

  getAssets(): HardwareAsset[] {
    return this.state.assets.filter(a => a.status !== AssetStatus.Disposed);
  }

  getAssetsByRegion(region: FacilityRegion): HardwareAsset[] {
    return this.state.assets.filter(
      a => a.region === region && a.status !== AssetStatus.Disposed,
    );
  }

  getAsset(assetId: EntityId): HardwareAsset | null {
    return this.state.assets.find(a => a.id === assetId) ?? null;
  }

  purchase(
    modelId: string,
    quantity: number,
    region: FacilityRegion,
    paymentMethod: PurchasePaymentMethod,
  ): PurchaseOrder {
    const model = HARDWARE_CATALOG_BY_ID.get(modelId);
    if (!model) throw new Error(`Unknown model: ${modelId}`);

    const unitPrice = this.calcPurchasePrice(model, paymentMethod);
    const totalPrice = unitPrice * quantity;
    const delay = paymentMethod === PurchasePaymentMethod.RequisitionForm
      ? this.cfg.requisitionDeliveryDelay
      : 0;
    const deliveryDate = addMonths(
      this.currentDate,
      delay + this.state.chipShortageDelay + this.state.supplyChainDelay,
    );

    const order: PurchaseOrder = {
      id: this.generateId(),
      modelId,
      quantity,
      unitPrice,
      totalPrice,
      paymentMethod,
      deliveryDate,
      status: 'pending',
      installationEngineerRequired: quantity >= 5,
    };
    this.state.pendingOrders.push(order);

    const warrantyExpiry = addMonths(deliveryDate, model.pricing.warrantyYears * 12);
    const eolDate: GameDate = { year: model.eolYear, month: 12 };

    for (let i = 0; i < quantity; i++) {
      const asset: HardwareAsset = {
        id: this.generateId(),
        modelId,
        region,
        purchaseDate: this.currentDate,
        purchasePrice: unitPrice,
        bookValue: unitPrice,
        accumulatedDepreciation: 0,
        status: AssetStatus.InTransit,
        warrantyExpiry,
        eolDate,
        eolWarningShown: false,
        monthsSinceEOL: 0,
        maintenanceType: MaintenanceType.Warranty,
        isEOL: false,
        isInstalled: false,
        installationCompleteDate: null,
        purchaseOrderId: order.id,
      };
      this.state.assets.push(asset);
    }

    this.bus.publish({
      type: 'hardware.purchased',
      payload: order,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    const cashAmount = paymentMethod === PurchasePaymentMethod.Cash ||
      paymentMethod === PurchasePaymentMethod.RequisitionForm
      ? totalPrice
      : 0;

    if (cashAmount > 0) {
      this.bus.publish({
        type: 'finance.expense_requested',
        payload: {
          category: ExpenseCategory.HardwarePurchase,
          amount: cashAmount,
          date: this.currentDate,
          description: `Purchase ${quantity}x ${model.name}`,
          isCashExpense: true,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    return order;
  }

  dispose(assetId: EntityId): DisposalResult {
    const asset = this.state.assets.find(a => a.id === assetId);
    if (!asset) throw new Error(`Asset not found: ${assetId}`);

    const salvageValue = Math.round(asset.bookValue * this.cfg.salvageValueRate);
    const model = HARDWARE_CATALOG_BY_ID.get(asset.modelId);
    const wasActive = asset.isInstalled;

    if (wasActive && model) {
      asset.isInstalled = false;
      this.bus.publish({
        type: 'hardware.removed',
        payload: {
          assetId: asset.id,
          region: asset.region,
          watts: model.specs.powerWatts,
          units: model.specs.rackUnits,
        },
        gameDate: this.currentDate,
        source: this.moduleId,
      });
    }

    asset.status = AssetStatus.Disposed;
    const result: DisposalResult = { assetId, salvageValue, date: this.currentDate };

    this.bus.publish({
      type: 'hardware.disposed',
      payload: result,
      gameDate: this.currentDate,
      source: this.moduleId,
    });

    return result;
  }

  calculateMonthlyDepreciation(): DepreciationSummary {
    const byAsset: Array<{ assetId: EntityId; amount: Money }> = [];
    let total = 0;
    for (const asset of this.state.assets) {
      if (!asset.isInstalled || asset.status === AssetStatus.Disposed) continue;
      const model = HARDWARE_CATALOG_BY_ID.get(asset.modelId);
      if (!model) continue;
      const months = this.getDepreciationMonths(model);
      const residual = asset.purchasePrice * this.financeCfg.depreciation.residualRate;
      const depreciable = asset.purchasePrice - residual;
      const monthly = Math.round(depreciable / months);
      if (monthly > 0 && asset.bookValue > residual) {
        const actualAmount = Math.min(monthly, Math.max(0, asset.bookValue - residual));
        byAsset.push({ assetId: asset.id, amount: actualAmount });
        total += actualAmount;
      }
    }
    return { totalMonthlyDepreciation: total, byAsset };
  }

  getFailureRate(assetId: EntityId): number {
    const asset = this.state.assets.find(a => a.id === assetId);
    if (!asset) return 0;
    const model = HARDWARE_CATALOG_BY_ID.get(asset.modelId);
    if (!model) return 0;

    const [m0, m1_12, m13_24, m25plus] = this.cfg.eolFailureMultipliers;
    let eolMult = m0;
    const months = asset.monthsSinceEOL;
    if (months > 24) eolMult = m25plus;
    else if (months > 12) eolMult = m13_24;
    else if (months > 0) eolMult = m1_12;

    const maintenanceMult = asset.maintenanceType === MaintenanceType.ThirdParty
      ? 1.2
      : asset.maintenanceType === MaintenanceType.None
        ? 1.5
        : 1.0;

    return model.failureRateBase * eolMult * maintenanceMult;
  }

  getTotalUsedUnits(region: FacilityRegion): number {
    return this.state.assets
      .filter(a => a.region === region && a.isInstalled)
      .reduce((sum, a) => {
        const model = HARDWARE_CATALOG_BY_ID.get(a.modelId);
        return sum + (model?.specs.rackUnits ?? 0);
      }, 0);
  }

  getTotalWatts(region: FacilityRegion): number {
    return this.state.assets
      .filter(a => a.region === region && a.isInstalled)
      .reduce((sum, a) => {
        const model = HARDWARE_CATALOG_BY_ID.get(a.modelId);
        return sum + (model?.specs.powerWatts ?? 0);
      }, 0);
  }

  getEolWarningAssets(): HardwareAsset[] {
    return this.state.assets.filter(a => a.eolWarningShown && !a.isEOL);
  }

  getEolExpiredAssets(): HardwareAsset[] {
    return this.state.assets.filter(a => a.isEOL);
  }

  // ── IGameModule ───────────────────────────────────────────────────

  serialize(): Record<string, unknown> {
    return {
      assets: this.state.assets,
      pendingOrders: this.state.pendingOrders,
      econHardwareMod: this.state.econHardwareMod,
      exchangeRateMod: this.state.exchangeRateMod,
      batchPurchaseDiscount: this.state.batchPurchaseDiscount,
      chipShortageDelay: this.state.chipShortageDelay,
      supplyChainDelay: this.state.supplyChainDelay,
      currentDate: this.currentDate,
    };
  }

  deserialize(raw: Record<string, unknown>): void {
    const s = raw as unknown as HardwareCatalogState & { currentDate: GameDate };
    this.state = {
      assets: s.assets,
      pendingOrders: s.pendingOrders,
      econHardwareMod: s.econHardwareMod,
      exchangeRateMod: s.exchangeRateMod,
      batchPurchaseDiscount: s.batchPurchaseDiscount,
      chipShortageDelay: s.chipShortageDelay,
      supplyChainDelay: s.supplyChainDelay,
    };
    if (s.currentDate) this.currentDate = s.currentDate;
  }

  getState(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this.state });
  }

  destroy(): void {
    this.bus.unsubscribeAll(this.moduleId);
  }
}
