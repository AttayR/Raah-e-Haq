// Payment service for handling ride payments
// This is a mock implementation - in production, you would integrate with actual payment gateways

export interface PaymentMethod {
  id: string;
  type: 'cash' | 'card' | 'wallet' | 'bank_transfer';
  name: string;
  details: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface Payment {
  id: string;
  rideId: string;
  amount: number;
  currency: string;
  method: PaymentMethod['type'];
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  transactionId?: string;
  createdAt: Date;
  completedAt?: Date;
  failureReason?: string;
}

export interface Wallet {
  balance: number;
  currency: string;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  rideId?: string;
  createdAt: Date;
}

// Mock payment methods
const mockPaymentMethods: PaymentMethod[] = [
  {
    id: 'cash_1',
    type: 'cash',
    name: 'Cash Payment',
    details: 'Pay with cash to driver',
    isDefault: true,
    isActive: true,
  },
  {
    id: 'card_1',
    type: 'card',
    name: 'Credit/Debit Card',
    details: '**** **** **** 1234',
    isDefault: false,
    isActive: true,
  },
  {
    id: 'wallet_1',
    type: 'wallet',
    name: 'RaaHeHaq Wallet',
    details: 'PKR 1,250.00',
    isDefault: false,
    isActive: true,
  },
];

// Mock wallet
let mockWallet: Wallet = {
  balance: 1250.00,
  currency: 'PKR',
  transactions: [
    {
      id: 'tx_1',
      type: 'credit',
      amount: 500.00,
      description: 'Wallet Top-up',
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'tx_2',
      type: 'debit',
      amount: 150.00,
      description: 'Ride Payment',
      rideId: 'ride_123',
      createdAt: new Date('2024-01-16'),
    },
  ],
};

// Get payment methods
export const getPaymentMethods = async (userId: string): Promise<PaymentMethod[]> => {
  try {
    // In a real implementation, you would fetch from your backend
    return mockPaymentMethods.filter(method => method.isActive);
  } catch (error) {
    console.error('Error getting payment methods:', error);
    throw new Error('Failed to get payment methods');
  }
};

// Add payment method
export const addPaymentMethod = async (userId: string, method: Omit<PaymentMethod, 'id'>): Promise<PaymentMethod> => {
  try {
    const newMethod: PaymentMethod = {
      ...method,
      id: `method_${Date.now()}`,
    };
    
    // In a real implementation, you would save to your backend
    mockPaymentMethods.push(newMethod);
    
    return newMethod;
  } catch (error) {
    console.error('Error adding payment method:', error);
    throw new Error('Failed to add payment method');
  }
};

// Update payment method
export const updatePaymentMethod = async (methodId: string, updates: Partial<PaymentMethod>): Promise<void> => {
  try {
    const index = mockPaymentMethods.findIndex(method => method.id === methodId);
    if (index === -1) {
      throw new Error('Payment method not found');
    }
    
    mockPaymentMethods[index] = { ...mockPaymentMethods[index], ...updates };
  } catch (error) {
    console.error('Error updating payment method:', error);
    throw new Error('Failed to update payment method');
  }
};

// Delete payment method
export const deletePaymentMethod = async (methodId: string): Promise<void> => {
  try {
    const index = mockPaymentMethods.findIndex(method => method.id === methodId);
    if (index === -1) {
      throw new Error('Payment method not found');
    }
    
    mockPaymentMethods.splice(index, 1);
  } catch (error) {
    console.error('Error deleting payment method:', error);
    throw new Error('Failed to delete payment method');
  }
};

// Process payment
export const processPayment = async (
  rideId: string,
  amount: number,
  method: PaymentMethod['type'],
  paymentDetails?: any
): Promise<Payment> => {
  try {
    const payment: Payment = {
      id: `payment_${Date.now()}`,
      rideId,
      amount,
      currency: 'PKR',
      method,
      status: 'processing',
      createdAt: new Date(),
    };
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock payment success/failure
    const isSuccess = Math.random() > 0.1; // 90% success rate
    
    if (isSuccess) {
      payment.status = 'completed';
      payment.completedAt = new Date();
      payment.transactionId = `txn_${Date.now()}`;
      
      // If wallet payment, deduct from wallet
      if (method === 'wallet') {
        await deductFromWallet(amount, rideId);
      }
    } else {
      payment.status = 'failed';
      payment.failureReason = 'Payment gateway error';
    }
    
    return payment;
  } catch (error) {
    console.error('Error processing payment:', error);
    throw new Error('Failed to process payment');
  }
};

// Get wallet balance
export const getWalletBalance = async (userId: string): Promise<Wallet> => {
  try {
    // In a real implementation, you would fetch from your backend
    return mockWallet;
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    throw new Error('Failed to get wallet balance');
  }
};

// Add money to wallet
export const addToWallet = async (userId: string, amount: number, method: string): Promise<WalletTransaction> => {
  try {
    const transaction: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'credit',
      amount,
      description: `Wallet Top-up via ${method}`,
      createdAt: new Date(),
    };
    
    mockWallet.balance += amount;
    mockWallet.transactions.unshift(transaction);
    
    return transaction;
  } catch (error) {
    console.error('Error adding to wallet:', error);
    throw new Error('Failed to add money to wallet');
  }
};

// Deduct from wallet
export const deductFromWallet = async (amount: number, rideId: string): Promise<WalletTransaction> => {
  try {
    if (mockWallet.balance < amount) {
      throw new Error('Insufficient wallet balance');
    }
    
    const transaction: WalletTransaction = {
      id: `tx_${Date.now()}`,
      type: 'debit',
      amount,
      description: 'Ride Payment',
      rideId,
      createdAt: new Date(),
    };
    
    mockWallet.balance -= amount;
    mockWallet.transactions.unshift(transaction);
    
    return transaction;
  } catch (error) {
    console.error('Error deducting from wallet:', error);
    throw new Error('Failed to deduct from wallet');
  }
};

// Get payment history
export const getPaymentHistory = async (userId: string, limit: number = 50): Promise<Payment[]> => {
  try {
    // In a real implementation, you would fetch from your backend
    const mockPayments: Payment[] = [
      {
        id: 'payment_1',
        rideId: 'ride_123',
        amount: 150.00,
        currency: 'PKR',
        method: 'wallet',
        status: 'completed',
        transactionId: 'txn_123',
        createdAt: new Date('2024-01-16'),
        completedAt: new Date('2024-01-16'),
      },
      {
        id: 'payment_2',
        rideId: 'ride_124',
        amount: 200.00,
        currency: 'PKR',
        method: 'cash',
        status: 'completed',
        createdAt: new Date('2024-01-15'),
        completedAt: new Date('2024-01-15'),
      },
    ];
    
    return mockPayments.slice(0, limit);
  } catch (error) {
    console.error('Error getting payment history:', error);
    throw new Error('Failed to get payment history');
  }
};

// Refund payment
export const refundPayment = async (paymentId: string, reason: string): Promise<Payment> => {
  try {
    // In a real implementation, you would process the refund through your payment gateway
    const refundedPayment: Payment = {
      id: paymentId,
      rideId: 'ride_123',
      amount: 150.00,
      currency: 'PKR',
      method: 'wallet',
      status: 'refunded',
      transactionId: `refund_${Date.now()}`,
      createdAt: new Date(),
      completedAt: new Date(),
    };
    
    return refundedPayment;
  } catch (error) {
    console.error('Error refunding payment:', error);
    throw new Error('Failed to refund payment');
  }
};

// Calculate fare with surge pricing
export const calculateFareWithSurge = (
  baseFare: number,
  distance: number,
  timeOfDay: Date,
  weatherCondition?: string
): number => {
  let surgeMultiplier = 1.0;
  
  // Peak hours (7-9 AM, 5-7 PM)
  const hour = timeOfDay.getHours();
  if ((hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19)) {
    surgeMultiplier *= 1.5;
  }
  
  // Weekend surge
  const dayOfWeek = timeOfDay.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    surgeMultiplier *= 1.2;
  }
  
  // Weather conditions
  if (weatherCondition === 'rain' || weatherCondition === 'storm') {
    surgeMultiplier *= 1.3;
  }
  
  // Distance-based surge for very long rides
  if (distance > 20) {
    surgeMultiplier *= 1.1;
  }
  
  return Math.round(baseFare * surgeMultiplier);
};

// Validate payment method
export const validatePaymentMethod = (method: PaymentMethod): { isValid: boolean; error?: string } => {
  if (!method.isActive) {
    return { isValid: false, error: 'Payment method is not active' };
  }
  
  if (method.type === 'wallet') {
    // Check if wallet has sufficient balance
    if (mockWallet.balance <= 0) {
      return { isValid: false, error: 'Insufficient wallet balance' };
    }
  }
  
  if (method.type === 'card') {
    // In a real implementation, you would validate card details
    if (!method.details || method.details.length < 4) {
      return { isValid: false, error: 'Invalid card details' };
    }
  }
  
  return { isValid: true };
};
