'use client';

import { LogOut, Plus, Wallet, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { balanceColorClass, formatUsd } from '../utils/format';
import ConfirmModal from './ConfirmModal';
import { EmptyState, Panel, PanelTabs, SideTag } from './ui';

type PendingAction = { type: 'deposit' } | { type: 'logout' } | { type: 'cancel'; orderId: string };

const DEFAULT_DEPOSIT_AMOUNT = '1000';

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return <span className="rounded-[4px] bg-raised px-1 font-mono text-[10px] text-muted">{n}</span>;
}

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

  const fmtPrice = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmtMoney = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const th = 'px-3 py-2 font-normal';
  const td = 'px-3 py-2';

  const tabs = [
    { id: 'positions' as const, label: <>Positions <Count n={openPositions.length} /></> },
    { id: 'orders' as const, label: <>Open orders <Count n={openOrders.length} /></> },
    { id: 'fills' as const, label: 'Trade history' },
  ];

  return (
    <Panel>
      <PanelTabs
        tabs={tabs}
        active={activeTab}
        onChange={setActiveTab}
        right={
          <>
            <span className="hidden text-xs text-muted sm:inline">Equity</span>
            <span className={`font-mono text-xs ${balanceColorClass(balance)}`}>{formatUsd(balance)}</span>
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
              className="ml-1 flex h-7 items-center gap-1 rounded-md bg-raised px-2.5 text-xs font-medium text-fg transition-colors hover:bg-hover disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Deposit
            </button>
          </>
        }
      />

      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto font-mono text-xs">
        {activeTab === 'positions' &&
          (openPositions.length === 0 ? (
            <EmptyState
              title="No open positions"
              hint={token ? 'Place an order to open a position.' : 'Log in to see your positions.'}
            />
          ) : (
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead className="sticky top-0 bg-surface font-sans text-[11px] text-subtle">
                <tr className="border-b border-line">
                  <th className={th}>Market</th>
                  <th className={th}>Side</th>
                  <th className={`${th} text-right`}>Size</th>
                  <th className={`${th} text-right`}>Entry price</th>
                  <th className={`${th} text-right`}>Margin</th>
                  <th className={`${th} text-right`}>Unrealized PnL</th>
                </tr>
              </thead>
              <tbody>
                {openPositions.map((pos, idx) => {
                  const pnlVal = pos.pnl || 0;
                  return (
                    <tr key={`pos-${idx}`} className="border-b border-line/60 transition-colors hover:bg-raised/60">
                      <td className={`${td} font-sans font-medium text-fg`}>{pos.market}</td>
                      <td className={td}>
                        <SideTag long={pos.qty > 0} />
                      </td>
                      <td className={`${td} text-right text-fg`}>{Math.abs(pos.qty).toFixed(4)}</td>
                      <td className={`${td} text-right text-muted`}>${fmtPrice(pos.entryPrice)}</td>
                      <td className={`${td} text-right text-muted`}>${fmtMoney(pos.margin)}</td>
                      <td className={`${td} text-right ${pnlVal >= 0 ? 'text-up' : 'text-down'}`}>
                        {pnlVal >= 0 ? '+' : '−'}${fmtMoney(Math.abs(pnlVal))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ))}

        {activeTab === 'orders' &&
          (openOrders.length === 0 ? (
            <EmptyState title="No open orders" hint="Resting limit orders show up here." />
          ) : (
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead className="sticky top-0 bg-surface font-sans text-[11px] text-subtle">
                <tr className="border-b border-line">
                  <th className={th}>Market</th>
                  <th className={th}>Side</th>
                  <th className={th}>Type</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={`${th} text-right`}>Filled / total</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {openOrders.map((ord, idx) => (
                  <tr key={`ord-${idx}`} className="border-b border-line/60 transition-colors hover:bg-raised/60">
                    <td className={`${td} font-sans font-medium text-fg`}>{ord.market}</td>
                    <td className={td}>
                      <SideTag long={ord.kind === 'LONG'} />
                    </td>
                    <td className={`${td} font-sans capitalize text-muted`}>{ord.type.toLowerCase()}</td>
                    <td className={`${td} text-right text-fg`}>${fmtPrice(ord.price)}</td>
                    <td className={`${td} text-right text-muted`}>
                      {ord.filledQty.toFixed(4)} / {ord.totalQty.toFixed(4)}
                    </td>
                    <td className={`${td} font-sans capitalize text-muted`}>
                      {ord.status.toLowerCase().replace(/_/g, ' ')}
                    </td>
                    <td className={`${td} text-right`}>
                      <button
                        onClick={() => setPendingAction({ type: 'cancel', orderId: ord.id })}
                        disabled={cancellingIds.has(ord.id)}
                        className="rounded-md px-2 py-1 font-sans text-xs text-muted transition-colors hover:bg-down/10 hover:text-down disabled:opacity-50"
                      >
                        {cancellingIds.has(ord.id) ? 'Cancelling…' : 'Cancel'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

        {activeTab === 'fills' &&
          (fills.length === 0 ? (
            <EmptyState title="No trades yet" hint="Your executed fills will be listed here." />
          ) : (
            <table className="w-full min-w-[420px] border-collapse text-left">
              <thead className="sticky top-0 bg-surface font-sans text-[11px] text-subtle">
                <tr className="border-b border-line">
                  <th className={th}>Side</th>
                  <th className={`${th} text-right`}>Price</th>
                  <th className={`${th} text-right`}>Size</th>
                  <th className={`${th} text-right`}>Time</th>
                </tr>
              </thead>
              <tbody>
                {[...fills].reverse().map((fill, idx) => (
                  <tr key={`fill-${idx}`} className="border-b border-line/60 transition-colors hover:bg-raised/60">
                    <td className={td}>
                      <SideTag long={fill.kind === 'LONG'} />
                    </td>
                    <td className={`${td} text-right text-fg`}>${fmtPrice(fill.price)}</td>
                    <td className={`${td} text-right text-muted`}>{fill.qty.toFixed(4)}</td>
                    <td className={`${td} text-right text-subtle`}>
                      {new Date(fill.transactionTime).toLocaleTimeString(undefined, { hour12: false })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
      </div>

      <ConfirmModal
        open={isDepositModalOpen}
        onClose={closeDepositModal}
        onConfirm={handleConfirmAction}
        title="Deposit funds"
        description="Funds are credited to your trading account immediately."
        confirmLabel={`Deposit ${formatUsd(depositAmount, depositAmount % 1 === 0 ? 0 : 2)}`}
        variant="success"
        loading={actionLoading}
        confirmDisabled={depositAmount <= 0}
        icon={<Wallet className="h-5 w-5" />}
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
        ]}
        error={depositError || undefined}
      />

      <ConfirmModal
        open={pendingAction?.type === 'logout'}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title="Log out"
        description="You'll need to log in again to place trades or manage positions."
        confirmLabel="Log out"
        variant="danger"
        loading={actionLoading}
        icon={<LogOut className="h-5 w-5" />}
        details={user ? [{ label: 'Account', value: user.email }] : undefined}
      />

      <ConfirmModal
        open={pendingAction?.type === 'cancel' && !!pendingOrder}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
        title="Cancel order"
        description="The order will be removed from the book and won't execute."
        confirmLabel="Cancel order"
        variant="danger"
        loading={actionLoading}
        icon={<XCircle className="h-5 w-5" />}
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
    </Panel>
  );
}
