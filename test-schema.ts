
const { z } = require('zod');
const { CREATE_ORDER_RESPONSE_SCHEMA } = require('./packages/shared-types/engine-types/engine-response.ts');

const payload = {
  type: 'create_order',
  payload: {
    kind: 'LONG',
    market: 'BTCUSD',
    orderId: '1',
    filledQty: 0,
    totalQty: 10,
    totalSpent: 0,
    fills: [],
    userId: 'user1',
    price: 2231,
    type: 'LIMIT',
    margin: 10000,
    status: 'OPEN',
    transactionTime: 1234567890
  }
};

const result = CREATE_ORDER_RESPONSE_SCHEMA.safeParse(payload);
console.log(result.success ? 'SUCCESS' : JSON.stringify(result.error.format(), null, 2));

