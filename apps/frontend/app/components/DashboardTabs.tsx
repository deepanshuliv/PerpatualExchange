'use client';

import { Info, LogOut, Plus, Wallet, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { balanceColorClass, formatUsd } from '../utils/format';
import ConfirmModal from './ConfirmModal';

type PendingAction = { type: 'deposit' } | { type: 'logout' } | { type: 'cancel'; orderId: string };

const DEFAULT_DEPOSIT_AMOUNT = '1000';

function parseDepositAmount(input: string): number {
  const parsed = parseFloat(input.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function DashboardTabs() {
  const { openPositions, openOrders, fills, deposit, balance, logout, user, cancelOrder, token, setAuthModalMode } =
    useTrading();

  const [activeTab, setActiveTab] = useState<'positions' | 'orders' | 'fills'>('positions');
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [depositInput, setDepositInput] = useState(DEFAULT_DEPOSIT_AMOUNT);
  const [depositError, setDepositError] = useState('');

  const depositAmount = parseDepositAmount(depositInput);
  const isDepositModalOpen = pendingAction?.type === 'deposit';

  const pendingOrder =
    pendingAction?.type === 'cancel'
      ? openOrders.find((ord) => ord.id === pendingAction.orderId)
      : undefined;

  const closeDepositModal = () => {
    setPendingAction((current) => (current?.type === 'deposit' ? null : current));
    setDepositInput(DEFAULT_DEPOSIT_AMOUNT);
    setDepositError('');
  };

  const handleConfirmAction = async () => {
    if (!pendingAction) return;

    setActionLoading(true);
    const action = pendingAction;
    try {
      if (action.type === 'deposit') {
        if (!token) {
          setDepositError('Please log in to deposit funds.');
          return;
        }
        if (depositAmount <= 0) {
          setDepositError('Enter a valid deposit amount.');
          return;
        }
        const result = await deposit(depositAmount);
        if (!result.ok) {
          setDepositError(result.msg || 'Deposit failed. Check that the backend is running and try again.');
          return;
        }
        closeDepositModal();
        return;
      } else if (action.type === 'logout') {
        logout();
      } else if (action.type === 'cancel') {
        setCancellingIds((prev) => new Set(prev).add(action.orderId));
        await cancelOrder(action.orderId);
      }
      setPendingAction(null);
    } catch (e) {
      console.log('[handleConfirmAction] error', e);
    } finally {
      setActionLoading(false);
      if (action.type === 'cancel') {
        setCancellingIds((prev) => {
          const next = new Set(prev);
          next.delete(action.orderId);
          return next;
        });
      }
    }
  };

  const getSideBadge = (qty: number | string, kind?: string) => {
    const isLong = typeof qty === 'number' ? qty > 0 : kind === 'LONG';
    return isLong ? (
      <span className="text-[#00c087] bg-[#00c087]/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
        LONG
      </span>
    ) : (
      <span className="text-[#ff3b30] bg-[#ff3b30]/10 px-1.5 py-0.5 rounded text-[10px] font-bold">
        SHORT
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0d10] text-[#f2f4f7] border-t border-[#171a1f] select-none font-sans">
      <div className="flex items-center justify-between border-b border-[#171a1f] bg-[#08090b] px-4 h-11 shrink-0">
        <div className="flex space-x-2">
          {[
            { id: 'positions', label: `Positions (${openPositions.length})` },
            { id: 'orders', label: `Open Orders (${openOrders.length})` },
            { id: 'fills', label: 'Trade History' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'positions' | 'orders' | 'fills')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${
                activeTab === tab.id ? 'bg-[#171a1f] text-white' : 'text-[#8491a5] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-4 text-xs">

          <div className="flex items-center space-x-2">
            <span className="text-[#8491a5]">Available Equity:</span>
            <span className={`font-mono font-bold ${balanceColorClass(balance)}`}>
              {formatUsd(balance)}
            </span>
            <button
              onClick={() => {
                if (!token) {
                  setAuthModalMode('login');
                  return;
                }
                setDepositInput(DEFAULT_DEPOSIT_AMOUNT);
                setDepositError('');
                setPendingAction({ type: 'deposit' });
              }}
              disabled={actionLoading && pendingAction?.type === 'deposit'}
              className="flex items-center space-x-1 px-2.5 py-1 bg-white hover:bg-zinc-200 text-black font-bold text-[10px] rounded transition-colors disabled:opacity-50"
            >
              <Plus className="h-3 w-3" />
              <span>Deposit</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar min-h-0 text-xs font-mono">
        {activeTab === 'positions' && (
          <div className="min-w-full">
            {openPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No open positions</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2 text-right">Size</th>
                    <th className="px-4 py-2 text-right">Entry Price</th>
                    <th className="px-4 py-2 text-right">Margin</th>
                    <th className="px-4 py-2 text-right">Unrealized PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {openPositions.map((pos, idx) => {
                    const pnlVal = pos.pnl || 0;
                    return (
                      <tr key={`pos-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                        <td className="px-4 py-2 text-white font-sans font-bold">{pos.market}</td>
                        <td className="px-4 py-2">{getSideBadge(pos.qty)}</td>
                        <td className="px-4 py-2 text-right text-white font-bold">
                          {Math.abs(pos.qty).toFixed(4)}
                        </td>
                        <td className="px-4 py-2 text-right text-[#b0bbcb]">
                          $
                          {pos.entryPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}
                        </td>
                        <td className="px-4 py-2 text-right text-[#b0bbcb]">
                          $
                          {pos.margin.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-bold ${pnlVal >= 0 ? 'text-[#00c087]' : 'text-[#ff3b30]'}`}
                        >
                          {pnlVal >= 0 ? '+' : ''}$
                          {pnlVal.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="min-w-full">
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No open orders</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Market</th>
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Filled / Total</th>
                    <th className="px-4 py-2 text-center">Status</th>
                    <th className="px-4 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {openOrders.map((ord, idx) => (
                    <tr key={`ord-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                      <td className="px-4 py-2 text-white font-sans font-bold">{ord.market}</td>
                      <td className="px-4 py-2">{getSideBadge(ord.totalQty, ord.kind)}</td>
                      <td className="px-4 py-2 text-[#b0bbcb] font-sans text-[10px]">{ord.type}</td>
                      <td className="px-4 py-2 text-right text-white font-bold">
                        $
                        {ord.price.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-[#b0bbcb]">
                        {ord.filledQty.toFixed(4)} / {ord.totalQty.toFixed(4)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <span className="bg-[#171a1f] text-white px-2 py-0.5 rounded text-[10px] font-sans">
                          {ord.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          onClick={() => setPendingAction({ type: 'cancel', orderId: ord.id })}
                          disabled={cancellingIds.has(ord.id)}
                          className="text-[#ff3b30] hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 px-2.5 py-1 rounded text-[10px] font-sans font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {cancellingIds.has(ord.id) ? 'Cancelling...' : 'Cancel'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {activeTab === 'fills' && (
          <div className="min-w-full">
            {fills.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-[#8491a5] font-sans">
                <Info className="h-5 w-5 mb-1.5 opacity-50" />
                <span>No trade executions found</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[#8491a5] border-b border-[#171a1f] bg-[#0c0d10] font-sans text-[10px] font-semibold sticky top-0">
                    <th className="px-4 py-2">Side</th>
                    <th className="px-4 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Execution Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#171a1f]">
                  {[...fills].reverse().map((fill, idx) => (
                    <tr key={`fill-${idx}`} className="hover:bg-[#12151c]/40 transition-colors">
                      <td className="px-4 py-2">{getSideBadge(fill.qty, fill.kind)}</td>
                      <td className="px-4 py-2 text-right text-white font-bold">
                        $
                        {fill.price.toLocaleString(undefined, {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </td>
                      <td className="px-4 py-2 text-right text-[#b0bbcb]">{fill.qty.toFixed(4)}</td>
                      <td className="px-4 py-2 text-right text-zinc-500 text-[10px]">
                        {new Date(fill.transactionTime).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <ConfirmModal
        open={isDepositModalOpen}
        onClose={closeDepositModal}
        onConfirm={handleConfirmAction}
        title="Deposit funds"
        description="You are about to add funds to your trading account. This will increase your available equity."
        confirmLabel={`Deposit ${formatUsd(depositAmount, depositAmount % 1 === 0 ? 0 : 2)}`}
        variant="success"
        loading={actionLoading}
        confirmDisabled={depositAmount <= 0}
        icon={<Wallet className="h-6 w-6 text-white" />}
        details={[
          {
            label: 'Amount',
            input: {
              value: depositInput,
              onChange: (value) => {
                setDepositInput(value.replace(/[^\d.]/g, ''));
                setDepositError('');
              },
              placeholder: '0.00',
              prefix: '$',
            },
          },
          { label: 'Current balance', value: formatUsd(balance) },
          { label: 'New balance', value: formatUsd(balance + depositAmount) },
          ...(depositError ? [{ label: 'Error', value: depositError }] : []),
        ]}
      />

      <ConfirmModal
        open={pendingAction?.type === 'logout'}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title="Log out"
        description="You are about to sign out of your account. You'll need to log in again to place trades or manage your portfolio."
        confirmLabel="Log out"
        variant="danger"
        loading={actionLoading}
        icon={<LogOut className="h-6 w-6 text-white" />}
        details={user ? [{ label: 'Account', value: user.username }] : undefined}
      />

      <ConfirmModal
        open={pendingAction?.type === 'cancel' && !!pendingOrder}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title="Cancel order"
        description="You are about to cancel this open order. It will be removed from the book and will not execute."
        confirmLabel="Cancel order"
        variant="danger"
        loading={actionLoading}
        icon={<XCircle className="h-6 w-6 text-white" />}
        details={
          pendingOrder
            ? [
                { label: 'Market', value: pendingOrder.market },
                { label: 'Side', value: pendingOrder.kind },
                { label: 'Type', value: pendingOrder.type },
                {
                  label: 'Price',
                  value: `$${pendingOrder.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`,
                },
                {
                  label: 'Quantity',
                  value: `${pendingOrder.filledQty.toFixed(4)} / ${pendingOrder.totalQty.toFixed(4)}`,
                },
              ]
            : undefined
        }
      />
    </div>
  );
}
