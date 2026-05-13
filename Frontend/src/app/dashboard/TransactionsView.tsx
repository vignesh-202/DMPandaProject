import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Download, Landmark, Loader2, Receipt, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatMoney } from '../../lib/pricing';
import { formatShortDate, getTodayDateInputValue } from '../../lib/date';
import ModernCalendar from '../../components/ui/ModernCalendar';
import LoadingOverlay from '../../components/ui/LoadingOverlay';

type Transaction = {
  document_id: string;
  id: string;
  created_at: string | null;
  status: string;
  plan_name: string;
  billing_cycle: 'monthly' | 'yearly';
  validity_days: number;
  currency: 'INR' | 'USD';
  base_amount: number;
  discount_amount: number;
  final_amount: number;
  coupon_code: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

type TransactionResponse = {
  transactions?: Transaction[];
  date_bounds?: {
    min_from: string | null;
    max_to: string | null;
  };
  selected_from?: string | null;
  selected_to?: string | null;
};

const TransactionsView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(getTodayDateInputValue());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeField, setActiveField] = useState<'from' | 'to'>('from');
  const [dateBounds, setDateBounds] = useState({
    min_from: '',
    max_to: getTodayDateInputValue()
  });
  const fromFieldRef = useRef<HTMLDivElement | null>(null);
  const toFieldRef = useRef<HTMLDivElement | null>(null);

  const fetchTransactions = useCallback(async (nextFrom?: string, nextTo?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (nextFrom) params.set('from', nextFrom);
      if (nextTo) params.set('to', nextTo);
      const queryString = params.toString();
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/transactions${queryString ? `?${queryString}` : ''}`);
      const data = await response.json().catch(() => ({} as TransactionResponse));
      const minFrom = typeof data?.date_bounds?.min_from === 'string' ? data.date_bounds.min_from : '';
      const maxTo = typeof data?.date_bounds?.max_to === 'string' && data.date_bounds.max_to
        ? data.date_bounds.max_to
        : getTodayDateInputValue();

      setTransactions(Array.isArray(data?.transactions) ? data.transactions : []);
      setDateBounds({ min_from: minFrom, max_to: maxTo });
      setFromDate(typeof data?.selected_from === 'string' && data.selected_from ? data.selected_from : minFrom);
      setToDate(typeof data?.selected_to === 'string' && data.selected_to ? data.selected_to : maxTo);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [authenticatedFetch]);

  const summary = useMemo(() => {
    const totalSpent = transactions.reduce((sum, item) => sum + Number(item.final_amount || 0), 0);
    const latestTransaction = transactions[0]?.created_at || null;

    return {
      count: transactions.length,
      totalSpent,
      latestTransaction
    };
  }, [transactions]);

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    if (!calendarOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const targetNode = event.target as Node;
      const activeContainer = activeField === 'from' ? fromFieldRef.current : toFieldRef.current;
      if (!activeContainer?.contains(targetNode)) {
        setCalendarOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeField, calendarOpen]);

  const handleOpenCalendar = (field: 'from' | 'to') => {
    setActiveField(field);
    setCalendarOpen((current) => (field === activeField ? !current : true));
  };

  const handleResetFilters = async () => {
    const resetFrom = dateBounds.min_from || '';
    const resetTo = dateBounds.max_to || getTodayDateInputValue();
    setCalendarOpen(false);
    await fetchTransactions(resetFrom, resetTo);
  };

  const handleApplyRange = async (start: string, end: string) => {
    const nextFrom = start || dateBounds.min_from || '';
    const nextTo = end || start || dateBounds.max_to || getTodayDateInputValue();
    setCalendarOpen(false);
    await fetchTransactions(nextFrom, nextTo);
  };

  const handleDownload = async (transactionId: string) => {
    setDownloadingId(transactionId);
    try {
      const response = await authenticatedFetch(`${((globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL)}/api/transactions/${transactionId}/pdf`);
      if (!response.ok) {
        throw new Error('Failed to generate receipt');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dmpanda-transaction-${transactionId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download transaction receipt:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading && transactions.length === 0) {
    return (
      <LoadingOverlay
        variant="fullscreen"
        message="Loading Transactions"
        subMessage="Fetching your payment history, receipts, and billing date range..."
      />
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
          <p className="text-muted-foreground">Subscription charges, discounts, and billing-cycle details from your verified payments.</p>
        </div>
      </div>

      {!loading && transactions.length > 0 && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-3xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-4 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Total Spent</p>
                <p className="mt-2 text-2xl font-black text-foreground">
                  {formatMoney(summary.totalSpent, transactions[0]?.currency || 'USD')}
                </p>
              </div>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.94))] p-4 shadow-sm dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_42%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Receipts</p>
                <p className="mt-2 text-2xl font-black text-foreground">{summary.count}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {summary.latestTransaction ? `Latest ${formatShortDate(summary.latestTransaction)}` : 'No payments yet'}
                </p>
              </div>
              <Receipt className="h-5 w-5 text-primary" />
            </div>
          </div>
        </div>
      )}

      <div className="relative rounded-3xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Filter by date</p>
              <p className="text-xs text-muted-foreground">Choose a date window between your first transaction and today, then apply it from the calendar.</p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[220px_220px_auto]">
              <div ref={fromFieldRef} className="relative">
                <button
                  type="button"
                  onClick={() => handleOpenCalendar('from')}
                  aria-expanded={calendarOpen && activeField === 'from'}
                  className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-background px-4 text-left transition ${
                    calendarOpen && activeField === 'from'
                      ? 'border-primary/60 shadow-sm shadow-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">From</span>
                    <span className="block text-sm font-semibold text-foreground">{fromDate ? formatShortDate(fromDate) : 'Select date'}</span>
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </button>

                {calendarOpen && activeField === 'from' && (
                  <div className="mt-3 w-full sm:absolute sm:left-0 sm:top-full sm:z-20 sm:mt-2 sm:w-[296px]">
                    <div className="rounded-[1.5rem] border border-border/70 bg-card/92 p-1.5 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur-md">
                      <ModernCalendar
                        startDate={fromDate || dateBounds.min_from}
                        endDate={toDate || dateBounds.max_to}
                        minDate={dateBounds.min_from || undefined}
                        maxDate={dateBounds.max_to || undefined}
                        compact
                        selectionTarget="from"
                        showCloseButton={false}
                        onSelect={(start, end) => void handleApplyRange(start, end)}
                        onClose={() => setCalendarOpen(false)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div ref={toFieldRef} className="relative">
                <button
                  type="button"
                  onClick={() => handleOpenCalendar('to')}
                  aria-expanded={calendarOpen && activeField === 'to'}
                  className={`flex h-12 w-full items-center justify-between rounded-2xl border bg-background px-4 text-left transition ${
                    calendarOpen && activeField === 'to'
                      ? 'border-primary/60 shadow-sm shadow-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className="space-y-1">
                    <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">To</span>
                    <span className="block text-sm font-semibold text-foreground">{toDate ? formatShortDate(toDate) : 'Select date'}</span>
                  </span>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </button>

                {calendarOpen && activeField === 'to' && (
                  <div className="mt-3 w-full sm:absolute sm:right-0 sm:top-full sm:z-20 sm:mt-2 sm:w-[296px]">
                    <div className="rounded-[1.5rem] border border-border/70 bg-card/92 p-1.5 shadow-[0_24px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur-md">
                      <ModernCalendar
                        startDate={fromDate || dateBounds.min_from}
                        endDate={toDate || dateBounds.max_to}
                        minDate={dateBounds.min_from || undefined}
                        maxDate={dateBounds.max_to || undefined}
                        compact
                        selectionTarget="to"
                        showCloseButton={false}
                        onSelect={(start, end) => void handleApplyRange(start, end)}
                        onClose={() => setCalendarOpen(false)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => void handleResetFilters()}
                disabled={loading}
                className="h-12 rounded-2xl border border-border bg-background px-5 text-sm font-black uppercase tracking-[0.16em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-border bg-card p-10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
          No successful subscription transactions have been recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <div key={transaction.document_id || transaction.id} className="rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-bold text-foreground">{transaction.plan_name}</h3>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-muted text-muted-foreground">
                      {transaction.billing_cycle}
                    </span>
                    <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-success-muted/60 text-success">
                      {transaction.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {formatShortDate(transaction.created_at)} | Validity {transaction.validity_days} days
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">Final charged</p>
                  <p className="text-2xl font-black text-foreground">{formatMoney(transaction.final_amount, transaction.currency)}</p>
                  <button
                    type="button"
                    onClick={() => handleDownload(transaction.document_id || transaction.id)}
                    disabled={downloadingId === (transaction.document_id || transaction.id)}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-foreground transition hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingId === (transaction.document_id || transaction.id) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    Download PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-6 text-sm">
                <div className="rounded-2xl bg-muted/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Base amount</p>
                  <p className="mt-1 font-semibold text-foreground">{formatMoney(transaction.base_amount, transaction.currency)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Discount</p>
                  <p className="mt-1 font-semibold text-foreground">{formatMoney(transaction.discount_amount, transaction.currency)}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Coupon</p>
                  <p className="mt-1 font-semibold text-foreground">{transaction.coupon_code || 'None'}</p>
                </div>
                <div className="rounded-2xl bg-muted/40 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Currency</p>
                  <p className="mt-1 font-semibold text-foreground">{transaction.currency}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 mt-4 text-xs text-muted-foreground md:grid-cols-2">
                <div className="break-all">Order ID: {transaction.razorpay_order_id || 'N/A'}</div>
                <div className="break-all">Payment ID: {transaction.razorpay_payment_id || 'N/A'}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransactionsView;

