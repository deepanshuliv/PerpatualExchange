## Strategies for Enhancement

- **Lazy Deleting**: When a delete request comes, you store its `orderId` and status in a map. When we are handling the open orders in the order book, we check if the current order is not present in the map using `orderId` and `userId`. This can optimize cancel operations.
- **Fees**: Add trading fees based on maker and taker orders.
- **Insurance**: Add funding insurance and logic: before hitting ADL, consume money from the funding insurance.
- **Buffering**: Add a buffer to send updates at 200ms or 100ms intervals to prevent CPU, network, and browser rendering spikes on the user side.

---

## Current Behavior

- Orders can be stored in an array, a deque, or a doubly linked list (both have similar complexity profiles).
- From the frontend, the market order price comes along with the quantity. However, the price has a slippage calculated on the frontend, and it should come after applying this slippage.
- In the fills data structure (DS), we are storing a separate entry for `maker_order_id` and `seller_order_id`, but in a single fill entry, we store both `seller_user_id` and `buyer_user_id`.
- Currently, canceling an open order takes $O(n)$ time. With lazy deleting, it can become $O(1)$.
- Right now, any order remaining after a liquidation will stay in the order book forever.
- In order to close a position, you need to send `equity = 0`.
- `costBasis` is the total amount spent in the market to obtain the positions.
- There are no exchange fees (or trading fees) right now, which means there are no insurance funds (historically, half of the trading fees go to exchange profit and the other half to funding insurance).
- When a liquidation hits, if some quantity is not filled, the ADL (Auto-Deleveraging) logic runs immediately. This forcefully places a market order against the opposite side's most profitable positions to close out the losing user's positions.
- The database stores `transactionTime` (matching engine processed timestamp) and `createdAt` (database insertion timestamp), while the WebSocket server broadcasts both `transactionTime` and `executionTime` (live broadcast timestamp) to measure end-to-end latency.
- The backend exposes `GET /ticker/price/:marketId` to retrieve the current Last Traded Price from the database on initial client load (cold starts), while subsequent price ticks are streamed live via WebSockets.
- The Last Traded Price is dynamically calculated at the WebSocket server level from the last element of the fills array in `create_order` and `liquidation` events.

---

## Difficult Questions

- What happens if a liquidation order is placed and the opposite side offers a very poor price? Currently, the matching loop runs continuously, consuming all available orders until the complete quantity is filled.

---

## Concepts Learned While Building This Project

- We ensure that we provide pure inputs to functions to guarantee predictable and valid outputs.
- When writing functions, we must first perform validation (checking for invalid conditions) before executing any state mutations (modifying variable values).