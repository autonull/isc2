/**
 * Lightning Network Adapter
 * 
 * Interface for Lightning Network payments.
 * Supports multiple implementations (LND, CLN, LDK).
 */

export interface LightningInvoice {
  bolt11: string;
  paymentHash: string;
  amountSats: number;
  expiry: number;
  memo?: string;
}

export interface LightningPayment {
  paymentHash: string;
  amountSats: number;
  feeSats: number;
  success: boolean;
  preimage?: string;
  error?: string;
}

export interface CreateInvoiceParams {
  amountSats: number;
  memo?: string;
  expirySeconds?: number;
}

export interface SendPaymentParams {
  invoice: string;
  amountSats?: number;
}

export interface LightningBalance {
  totalSats: number;
  availableSats: number;
  pendingSats: number;
}

/**
 * Lightning Network adapter interface
 */
export interface LightningAdapter {
  /**
   * Create a BOLT11 invoice
   */
  createInvoice(params: CreateInvoiceParams): Promise<LightningInvoice>;

  /**
   * Send payment to an invoice
   */
  sendPayment(params: SendPaymentParams): Promise<LightningPayment>;

  /**
   * Verify if a payment was received
   */
  verifyPayment(paymentHash: string): Promise<boolean>;

  /**
   * Get wallet balance
   */
  getBalance(): Promise<LightningBalance>;

  /**
   * Check if adapter is connected
   */
  isConnected(): boolean;
}

/**
 * Mock Lightning adapter for testing/development
 */
export class MockLightningAdapter implements LightningAdapter {
  private invoices: Map<string, LightningInvoice> = new Map();
  private payments: Map<string, LightningPayment> = new Map();
  private connectedFlag = true;

  isConnected(): boolean {
    return this.connectedFlag;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<LightningInvoice> {
    const paymentHash = crypto.randomUUID().replace(/-/g, '');
    const bolt11 = `lnbc${params.amountSats}1p${paymentHash}mock`;

    const invoice: LightningInvoice = {
      bolt11,
      paymentHash,
      amountSats: params.amountSats,
      expiry: Date.now() + (params.expirySeconds || 3600) * 1000,
      memo: params.memo,
    };

    this.invoices.set(paymentHash, invoice);
    return invoice;
  }

  async sendPayment(params: SendPaymentParams): Promise<LightningPayment> {
    // Find invoice by payment hash or simulate
    const paymentHash = crypto.randomUUID().replace(/-/g, '');
    const preimage = crypto.randomUUID().replace(/-/g, '');

    const payment: LightningPayment = {
      paymentHash,
      amountSats: params.amountSats || 0,
      feeSats: Math.floor((params.amountSats || 0) * 0.001), // 0.1% fee
      success: true,
      preimage,
    };

    this.payments.set(paymentHash, payment);
    return payment;
  }

  async verifyPayment(paymentHash: string): Promise<boolean> {
    // In mock, verify if we created the invoice
    return this.invoices.has(paymentHash);
  }

  async getBalance(): Promise<LightningBalance> {
    return {
      totalSats: 1000000, // 1M sats mock balance
      availableSats: 900000,
      pendingSats: 100000,
    };
  }

  /**
   * Simulate payment receipt for testing
   */
  simulatePaymentReceived(paymentHash: string): void {
    const invoice = this.invoices.get(paymentHash);
    if (invoice) {
      this.payments.set(paymentHash, {
        paymentHash,
        amountSats: invoice.amountSats,
        feeSats: 0,
        success: true,
        preimage: crypto.randomUUID().replace(/-/g, ''),
      });
    }
  }

  /**
   * Clear mock state
   */
  clear(): void {
    this.invoices.clear();
    this.payments.clear();
  }

  /**
   * Set connection state
   */
  setConnected(connected: boolean): void {
    this.connectedFlag = connected;
  }
}

/**
 * LND (Lightning Network Daemon) adapter
 * 
 * Production adapter for LND nodes.
 * Requires LND gRPC or REST connection.
 */
export class LNDAdapter implements LightningAdapter {
  private baseUrl: string;
  private macaroon: string;

  constructor(config: { baseUrl: string; macaroon: string }) {
    this.baseUrl = config.baseUrl;
    this.macaroon = config.macaroon;
  }

  isConnected(): boolean {
    // Would check actual LND connection
    return true;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<LightningInvoice> {
    // LND REST API call
    const response = await fetch(`${this.baseUrl}/v1/invoices`, {
      method: 'POST',
      headers: {
        'Grpc-Metadata-macaroon': this.macaroon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value: params.amountSats,
        memo: params.memo,
        expiry: params.expirySeconds || 3600,
      }),
    });

    if (!response.ok) {
      throw new Error(`LND error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      bolt11: data.payment_request,
      paymentHash: Buffer.from(data.r_hash, 'base64').toString('hex'),
      amountSats: parseInt(data.value),
      expiry: Date.now() + (params.expirySeconds || 3600) * 1000,
      memo: params.memo,
    };
  }

  async sendPayment(params: SendPaymentParams): Promise<LightningPayment> {
    // LND REST API call for sending payment
    const response = await fetch(`${this.baseUrl}/v1/channels/transactions`, {
      method: 'POST',
      headers: {
        'Grpc-Metadata-macaroon': this.macaroon,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        payment_request: params.invoice,
        amt: params.amountSats,
      }),
    });

    if (!response.ok) {
      throw new Error(`LND error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      paymentHash: Buffer.from(data.payment_hash, 'base64').toString('hex'),
      amountSats: parseInt(data.payment_amt),
      feeSats: parseInt(data.fee_sat),
      success: data.payment_error === '',
      preimage: Buffer.from(data.payment_preimage, 'base64').toString('hex'),
    };
  }

  async verifyPayment(paymentHash: string): Promise<boolean> {
    // LND lookup invoice
    const hashBuffer = Buffer.from(paymentHash, 'hex');
    const response = await fetch(
      `${this.baseUrl}/v1/invoice/${hashBuffer.toString('base64')}`,
      {
        headers: {
          'Grpc-Metadata-macaroon': this.macaroon,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.state === 'SETTLED';
  }

  async getBalance(): Promise<LightningBalance> {
    const response = await fetch(`${this.baseUrl}/v1/balance/blockchain`, {
      headers: {
        'Grpc-Metadata-macaroon': this.macaroon,
      },
    });

    if (!response.ok) {
      throw new Error(`LND error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      totalSats: parseInt(data.total_balance),
      availableSats: parseInt(data.confirmed_balance),
      pendingSats: parseInt(data.unconfirmed_balance),
    };
  }
}

/**
 * Factory function to create Lightning adapter
 */
export function createLightningAdapter(
  type: 'mock' | 'lnd' | 'cln',
  config?: Record<string, string>
): LightningAdapter {
  switch (type) {
    case 'mock':
      return new MockLightningAdapter();
    case 'lnd':
      if (!config?.baseUrl || !config?.macaroon) {
        throw new Error('LND adapter requires baseUrl and macaroon');
      }
      return new LNDAdapter({
        baseUrl: config.baseUrl,
        macaroon: config.macaroon,
      });
    case 'cln':
      // CLN adapter would be implemented similarly
      throw new Error('CLN adapter not yet implemented');
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}
