import React from 'react';
import { useGameStore } from '../../../store/gameStore';
import {
  calcContractIncomePerSecond,
  calcContractReservedUnits,
  getContractRemainingSeconds,
  getOfferRemainingSeconds,
} from '../../../game/systems/contracts';
import { calcUsedRackUnits } from '../../../game/systems/facility';
import { calcProcurementRackUnits } from '../../../game/systems/procurement';
import {
  CONTRACT_BREACH_TERMINATION_SECONDS,
  CONTRACT_SERVICE_LABELS,
  MAX_ACTIVE_CONTRACTS,
} from '../../../game/config/contract.config';
import { formatDuration, formatNumber } from '../../../utils/format';

export const ContractsSection: React.FC = () => {
  const {
    hardware,
    rackCapacity,
    procurementRequests,
    contracts,
    contractOffers,
    completedContracts,
    breachedContracts,
    isShutdown,
    gameTime,
    acceptContract,
    declineContract,
  } = useGameStore();

  const reservedByContracts = calcContractReservedUnits(contracts);
  const freeUnits = Math.max(
    0,
    rackCapacity - calcUsedRackUnits(hardware) - calcProcurementRackUnits(procurementRequests) - reservedByContracts
  );
  const incomePerSecond = calcContractIncomePerSecond(contracts);

  return (
    <div className="upgrade-section">
      <div className="upgrade-section-title">─── CONTRACTS ───</div>

      <div className="contract-summary">
        <span>Active <span className="glow-blue">{contracts.length}/{MAX_ACTIVE_CONTRACTS}</span></span>
        <span>Income <span className={incomePerSecond > 0 ? 'glow-green' : 'glow-green-dim'}>+{formatNumber(incomePerSecond)} CF/s</span></span>
      </div>
      <div className="contract-summary">
        <span>Completed <span className="glow-green">{completedContracts}</span></span>
        <span>Breached <span className={breachedContracts > 0 ? 'glow-red' : 'glow-green-dim'}>{breachedContracts}</span></span>
      </div>

      {/* Pending offers */}
      {contractOffers.length === 0 ? (
        <div className="contract-empty glow-green-dim">No incoming RFPs</div>
      ) : (
        <div className="contract-offer-list">
          {contractOffers.map((offer) => {
            const remaining = getOfferRemainingSeconds(offer, gameTime);
            const fits = offer.reservedUnits <= freeUnits;
            const urgencyClass = remaining < 15 ? 'glow-red' : remaining < 35 ? 'glow-yellow' : 'glow-blue';

            return (
              <div key={offer.id} className={`contract-card offer ${fits ? '' : 'no-space'}`}>
                <div className="contract-card-top">
                  <span className="contract-client">{offer.clientName}</span>
                  <span className={urgencyClass}>{formatDuration(remaining)}</span>
                </div>
                <div className="contract-service">
                  {CONTRACT_SERVICE_LABELS[offer.serviceType]} · {offer.reservedUnits}U · {formatDuration(offer.durationSeconds)}
                </div>
                <div className="contract-meta">
                  <span className="glow-green">+{formatNumber(offer.payoutPerSecond)} CF/s</span>
                  <span>Bonus {formatNumber(offer.signingBonus)} CF</span>
                </div>
                <div className="contract-meta">
                  <span className={fits ? 'glow-blue' : 'glow-red'}>Need {offer.reservedUnits}U · Free {freeUnits}U</span>
                  <span className="glow-yellow">SLA -{offer.slaPenaltyPerSecond}/s down</span>
                </div>
                <div className="contract-actions">
                  <button
                    className={`crt-btn contract-btn accept ${fits ? '' : 'disabled'}`}
                    onClick={() => acceptContract(offer.id)}
                    disabled={!fits}
                  >
                    {fits ? '[ SIGN ]' : '[ NO SPACE ]'}
                  </button>
                  <button
                    className="crt-btn contract-btn decline"
                    onClick={() => declineContract(offer.id)}
                  >
                    [ DECLINE ]
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active contracts */}
      {contracts.length > 0 && (
        <div className="contract-active-list">
          {contracts.map((contract) => {
            const remaining = getContractRemainingSeconds(contract, gameTime);
            const breaching = isShutdown && contract.breachSeconds > 0;
            const breachLeft = Math.max(0, CONTRACT_BREACH_TERMINATION_SECONDS - contract.breachSeconds);

            return (
              <div key={contract.id} className={`contract-card active ${breaching ? 'breaching' : ''}`}>
                <div className="contract-card-top">
                  <span className="contract-client">{contract.clientName}</span>
                  <span className={breaching ? 'glow-red' : 'glow-green'}>
                    {breaching ? `BREACH ${breachLeft.toFixed(0)}s` : formatDuration(remaining)}
                  </span>
                </div>
                <div className="contract-service">
                  {CONTRACT_SERVICE_LABELS[contract.serviceType]} · {contract.reservedUnits}U
                </div>
                <div className="contract-meta">
                  <span className="glow-green">+{formatNumber(contract.payoutPerSecond)} CF/s</span>
                  <span>Paid {formatNumber(contract.totalPaid)} CF</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
