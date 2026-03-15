/**
 * Unit Tests for Stake System
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StakeManager } from '../src/stake/manager.js';
import { createLightningAdapter, LightningAdapter, LightningInvoice, LightningPayment, CreateInvoiceParams, SendPaymentParams, LightningBalance } from '../src/stake/lightning.js';
import { SlashingConditions, AutomatedSlashingDetector } from '../src/stake/slashing.js';
import { getFeatureFlags, FeatureFlagBuilder, validateConfiguration } from '../src/config/features.js';

class FakeLightningAdapter implements LightningAdapter {
  invoices = new Map<string, LightningInvoice>();
  payments = new Map<string, LightningPayment>();

  isConnected() { return true; }

  async createInvoice(params: CreateInvoiceParams) {
    const paymentHash = crypto.randomUUID().replace(/-/g, '');
    const invoice = { bolt11: `lnbc${params.amountSats}mock`, paymentHash, amountSats: params.amountSats, expiry: Date.now() + 3600000 };
    this.invoices.set(paymentHash, invoice);
    return invoice;
  }

  async sendPayment(params: SendPaymentParams) {
    const paymentHash = crypto.randomUUID().replace(/-/g, '');
    const payment = { paymentHash, amountSats: params.amountSats || 0, feeSats: 0, success: true, preimage: 'pre' };
    this.payments.set(paymentHash, payment);
    return payment;
  }

  async verifyPayment(paymentHash: string) { return this.invoices.has(paymentHash); }
  
  async getBalance() { return { totalSats: 1000000, availableSats: 900000, pendingSats: 100000 }; }

  simulatePaymentReceived(paymentHash: string) {
    const invoice = this.invoices.get(paymentHash);
    if (invoice) {
        this.payments.set(paymentHash, { paymentHash, amountSats: invoice.amountSats, feeSats: 0, success: true, preimage: 'pre' });
    }
  }
}

describe('Stake System', () => {
  describe('StakeManager', () => {
    let manager: StakeManager;
    let lightning: FakeLightningAdapter;

    beforeEach(() => {
      lightning = new FakeLightningAdapter();
      manager = new StakeManager({ minStakeSats: 10000 }, lightning);
    });

    describe('generateStakeInvoice', () => {
      it('should generate invoice for stake', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 50000);
        expect(invoice.amountSats).toBe(50000);
        expect(invoice.invoice).toContain('lnbc');
        expect(invoice.expiry).toBeGreaterThan(Date.now());
      });

      it('should enforce minimum stake', async () => {
        await expect(manager.generateStakeInvoice('peer1', 5000))
          .rejects.toThrow('Minimum stake');
      });
    });

    describe('lockStake', () => {
      it('should lock stake for a peer', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 50000);
        lightning.simulatePaymentReceived(invoice.paymentHash);

        const result = await manager.lockStake('peer1', 50000, invoice.paymentHash);
        expect(result.success).toBe(true);
        expect(result.bond?.status).toBe('active');
      });

      it('should reject stake below minimum', async () => {
        const result = await manager.lockStake('peer1', 5000, 'hash');
        expect(result.success).toBe(false);
        expect(result.error).toContain('Minimum stake');
      });

      it('should prevent duplicate bonds', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 50000);
        await manager.lockStake('peer1', 50000, invoice.paymentHash);

        const invoice2 = await manager.generateStakeInvoice('peer1', 50000);
        const result = await manager.lockStake('peer1', 50000, invoice2.paymentHash);
        expect(result.success).toBe(false);
      });
    });

    describe('withdrawal', () => {
      it('should allow withdrawal after lock period', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 50000);
        await manager.lockStake('peer1', 50000, invoice.paymentHash);

        // Advance time past lock period
        const bond = manager['stakeService'].getBond('peer1');
        if (bond) {
          bond.unlockableAt = Date.now() - 1000;
        }

        const result = await manager.requestWithdrawal('peer1', 'lnbc1...');
        expect(result.success).toBe(true);
      });

      it('should reject early withdrawal', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 50000);
        await manager.lockStake('peer1', 50000, invoice.paymentHash);

        const result = await manager.requestWithdrawal('peer1', 'lnbc1...');
        expect(result.success).toBe(false);
        expect(result.error).toContain('locked');
      });
    });

    describe('slashing', () => {
      it('should slash stake for valid reason', async () => {
        const invoice = await lightning.createInvoice({ amountSats: 50000 });
        await manager.lockStake('peer1', 50000, invoice.paymentHash);

        const signature = new Uint8Array(64);
        const result = manager.slashStake(
          'peer1',
          'spam',
          10000,
          ['evidence1', 'evidence2'],
          ['judge1'],
          signature
        );

        expect(result.success).toBe(true);
        expect(result.bond?.slashedAmount).toBe(10000);
      });

      it('should reject slashing without enabled config', () => {
        const managerNoSlash = new StakeManager({ slashingEnabled: false }, lightning);
        const signature = new Uint8Array(64);
        
        const result = managerNoSlash.slashStake(
          'peer1',
          'spam',
          10000,
          [],
          [],
          signature
        );

        expect(result.success).toBe(false);
      });

      it('should respect max slashing percent', async () => {
        const invoice = await lightning.createInvoice({ amountSats: 50000 });
        await manager.lockStake('peer1', 50000, invoice.paymentHash);

        const signature = new Uint8Array(64);
        const result = manager.slashStake(
          'peer1',
          'sybil_attack',
          100000, // Try to slash more than stake
          [],
          [],
          signature
        );

        expect(result.success).toBe(true);
        expect(result.bond?.slashedAmount).toBeLessThanOrEqual(50000);
      });
    });

    describe('stake trust bonus', () => {
      it('should return bonus for active stake', async () => {
        const invoice = await manager.generateStakeInvoice('peer1', 500000);
        await manager.lockStake('peer1', 500000, invoice.paymentHash);

        const bonus = manager.getStakeTrustBonus('peer1');
        expect(bonus).toBeGreaterThan(0);
        expect(bonus).toBeLessThanOrEqual(0.2);
      });

      it('should return 0 for no stake', () => {
        const bonus = manager.getStakeTrustBonus('peer1');
        expect(bonus).toBe(0);
      });
    });

    describe('statistics', () => {
      it('should return stake stats', async () => {
        const invoice1 = await manager.generateStakeInvoice('peer1', 50000);
        const invoice2 = await manager.generateStakeInvoice('peer2', 100000);
        await manager.lockStake('peer1', 50000, invoice1.paymentHash);
        await manager.lockStake('peer2', 100000, invoice2.paymentHash);

        const stats = manager.getStats();
        expect(stats.activeBonds).toBe(2);
        expect(stats.totalStakedSats).toBe(150000);
      });

      it('should return ranking', async () => {
        const invoice1 = await manager.generateStakeInvoice('peer1', 50000);
        const invoice2 = await manager.generateStakeInvoice('peer2', 100000);
        await manager.lockStake('peer1', 50000, invoice1.paymentHash);
        await manager.lockStake('peer2', 100000, invoice2.paymentHash);

        const ranking = manager.getRanking(10);
        expect(ranking.length).toBe(2);
        expect(ranking[0].stakeSats).toBe(100000); // Higher stake ranks first
      });
    });
  });

  describe('SlashingConditions', () => {
    let conditions: SlashingConditions;

    beforeEach(() => {
      conditions = new SlashingConditions({
        minStakeSats: 10000,
        lockPeriodDays: 30,
        slashingEnabled: true,
        maxSlashingPercent: 100,
        gracePeriodDays: 7,
      });
    });

    describe('validateReason', () => {
      it('should validate known reasons', () => {
        expect(conditions.validateReason('spam')).toBe(true);
        expect(conditions.validateReason('harassment')).toBe(true);
        expect(conditions.validateReason('sybil_attack')).toBe(true);
      });

      it('should reject unknown reasons', () => {
        expect(conditions.validateReason('unknown' as any)).toBe(false);
      });
    });

    describe('calculateSlashAmount', () => {
      it('should calculate based on severity', () => {
        const lowAmount = conditions.calculateSlashAmount('spam', 0.2, 100000);
        const highAmount = conditions.calculateSlashAmount('spam', 0.9, 100000);
        
        expect(highAmount).toBeGreaterThan(lowAmount);
      });

      it('should respect max slashing percent', () => {
        const amount = conditions.calculateSlashAmount('spam', 1.0, 100000);
        expect(amount).toBeLessThanOrEqual(100000);
      });
    });

    describe('severity guidelines', () => {
      it('should provide guidelines for each severity', () => {
        const guidelines = conditions.getSeverityGuidelines('spam');
        
        expect(guidelines.low.severity).toBe(0.2);
        expect(guidelines.medium.severity).toBe(0.5);
        expect(guidelines.high.severity).toBe(0.9);
        expect(guidelines.high.slashPercent).toBeGreaterThan(guidelines.low.slashPercent);
      });
    });
  });

  describe('AutomatedSlashingDetector', () => {
    let detector: AutomatedSlashingDetector;

    beforeEach(() => {
      detector = new AutomatedSlashingDetector(5, 5); // 5 messages in 5 minutes
    });

    it('should detect spam', () => {
      for (let i = 0; i < 5; i++) {
        detector.recordMessage('peer1');
      }

      const result = detector.detectSpam('peer1');
      expect(result.detected).toBe(true);
      expect(result.count).toBe(5);
    });

    it('should not detect normal activity', () => {
      for (let i = 0; i < 3; i++) {
        detector.recordMessage('peer1');
      }

      const result = detector.detectSpam('peer1');
      expect(result.detected).toBe(false);
    });

    it('should get violations', () => {
      detector.recordMessage('spammer');
      detector.recordMessage('spammer');
      detector.recordMessage('spammer');
      detector.recordMessage('spammer');
      detector.recordMessage('spammer');

      const violations = detector.getViolations();
      expect(violations.length).toBe(1);
      expect(violations[0].peerID).toBe('spammer');
    });
  });

  describe('Feature Flags', () => {
    describe('getFeatureFlags', () => {
      it('should return private mode flags', () => {
        const flags = getFeatureFlags('private');
        expect(flags.reputationSystem).toBe(false);
        expect(flags.stakeBonding).toBe(false);
        expect(flags.inviteOnly).toBe(true);
      });

      it('should return federated mode flags', () => {
        const flags = getFeatureFlags('federated');
        expect(flags.reputationSystem).toBe(true);
        expect(flags.communityCourts).toBe(true);
        expect(flags.stakeBonding).toBe(false);
      });

      it('should return public mode flags', () => {
        const flags = getFeatureFlags('public');
        expect(flags.reputationSystem).toBe(true);
        expect(flags.stakeBonding).toBe(true);
        expect(flags.slashing).toBe(true);
        expect(flags.inviteOnly).toBe(false);
      });
    });

    describe('FeatureFlagBuilder', () => {
      it('should customize flags', () => {
        const flags = new FeatureFlagBuilder('private')
          .enable('reputationSystem')
          .enable('stakeBonding')
          .build();

        expect(flags.reputationSystem).toBe(true);
        expect(flags.stakeBonding).toBe(true);
        expect(flags.inviteOnly).toBe(true); // From private base
      });
    });

    describe('validateConfiguration', () => {
      it('should validate compatible flags', () => {
        const flags = getFeatureFlags('public');
        const result = validateConfiguration(flags);
        expect(result.valid).toBe(true);
      });

      it('should detect incompatible flags', () => {
        const flags = {
          ...getFeatureFlags('private'),
          stakeBonding: true,
          reputationSystem: false, // Incompatible
        };
        const result = validateConfiguration(flags as any);
        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Lightning Adapter', () => {
    describe('createLightningAdapter', () => {
      it('should throw for missing LND config', () => {
        expect(() => createLightningAdapter('lnd')).toThrow();
      });
    });
  });
});
