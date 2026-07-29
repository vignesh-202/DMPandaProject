import React, { useState, useEffect, useCallback } from 'react';
import {
  Lock,
  Unlock,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Layers,
  Crown,
  Instagram,
  ChevronRight,
  Info
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export type SubscriptionSlot = {
  id: string;
  planCode: string;
  billingCycle: string;
  status: string;
  expiresAt: string | null;
  pairedAccountId: string | null;
  pairedAt: string | null;
  transactionId: string | null;
  isLocked: boolean;
  remainingLockMs: number;
  remainingLockText: string | null;
  canChangeAt: string | null;
  createdAt: string;
};

export type IgAccountItem = {
  id: string;
  username: string;
  name?: string;
  profilePictureUrl?: string;
  isLinked?: boolean;
  status?: string;
};

interface SlotPairingManagerProps {
  igAccounts: IgAccountItem[];
  onSlotsUpdated?: () => void;
}

const PLAN_BADGES: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  basic: {
    label: 'Basic Slot',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    text: 'text-emerald-600 dark:text-emerald-400',
    border: 'border-emerald-500/30',
    icon: Zap
  },
  pro: {
    label: 'Pro Slot',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20',
    text: 'text-purple-600 dark:text-purple-400',
    border: 'border-purple-500/30',
    icon: Sparkles
  },
  ultra: {
    label: 'Ultra Slot (API Enabled)',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    icon: Crown
  }
};

export const SlotPairingManager: React.FC<SlotPairingManagerProps> = ({ igAccounts, onSlotsUpdated }) => {
  const { authenticatedFetch } = useAuth();
  const [slots, setSlots] = useState<SubscriptionSlot[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [draggedAccountId, setDraggedAccountId] = useState<string | null>(null);
  const [dragOverSlotId, setDragOverSlotId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const fetchSlots = useCallback(async () => {
    try {
      setLoading(true);
      const apiBase = (globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || '';
      const response = await authenticatedFetch(`${apiBase}/api/subscription-slots`);
      if (response.ok) {
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setSlots(result.data);
        }
      }
    } catch (err: any) {
      console.error('Error fetching subscription slots:', err?.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePair = async (slotId: string, accountId: string) => {
    try {
      setActionLoading(slotId);
      const apiBase = (globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || '';
      const response = await authenticatedFetch(`${apiBase}/api/subscription-slots/${slotId}/pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ igAccountId: accountId })
      });
      const result = await response.json();
      if (result.success) {
        showToast(result.message || 'Slot paired successfully!', 'success');
        await fetchSlots();
        if (onSlotsUpdated) onSlotsUpdated();
      } else {
        showToast(result.error || 'Failed to pair slot', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error while pairing slot', 'error');
    } finally {
      setActionLoading(null);
      setDraggedAccountId(null);
      setDragOverSlotId(null);
    }
  };

  const handleUnpair = async (slotId: string) => {
    try {
      setActionLoading(slotId);
      const apiBase = (globalThis as any).__DM_PANDA_API_BASE_URL__ || import.meta.env.VITE_API_BASE_URL || '';
      const response = await authenticatedFetch(`${apiBase}/api/subscription-slots/${slotId}/unpair`, {
        method: 'POST'
      });
      const result = await response.json();
      if (result.success) {
        showToast(result.message || 'Slot unpaired successfully!', 'success');
        await fetchSlots();
        if (onSlotsUpdated) onSlotsUpdated();
      } else {
        showToast(result.error || 'Failed to unpair slot', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Network error while unpairing slot', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Maps account ID to paired slot
  const accountToSlotMap = new Map<string, SubscriptionSlot>();
  slots.forEach((s) => {
    if (s.pairedAccountId) {
      accountToSlotMap.set(s.pairedAccountId, s);
    }
  });

  return (
    <div className="space-y-8 py-4">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl backdrop-blur-xl border transition-all duration-300 ${
          toast.type === 'success' 
            ? 'bg-emerald-500/90 text-white border-emerald-400/30 dark:bg-emerald-950/90 dark:text-emerald-200' 
            : 'bg-rose-500/90 text-white border-rose-400/30 dark:bg-rose-950/90 dark:text-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
          <p className="text-xs font-bold">{toast.message}</p>
        </div>
      )}

      {/* Header Info Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/10 via-purple-500/5 to-primary/5 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-primary/20 text-primary">
                <Layers className="h-4 w-4" />
              </span>
              <h3 className="text-lg font-black tracking-tight text-foreground">Subscription Slot Pairing</h3>
            </div>
            <p className="text-xs font-medium text-muted-foreground max-w-xl">
              Each subscription slot empowers an Instagram account with paid features. <strong className="text-foreground font-semibold">Drag any Instagram account onto a slot</strong> to pair it. Once paired, slots remain locked for <span className="text-primary font-bold">3 days</span> before reassigning.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchSlots}
            disabled={loading}
            className="self-start md:self-auto inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-card px-4 py-2 text-xs font-extrabold text-foreground hover:bg-accent hover:border-primary/30 transition shadow-sm"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Slots
          </button>
        </div>
      </div>

      {/* Main Grid: Slots Container vs IG Accounts Pool */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Paid Subscription Slots */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span>Purchased Slots</span>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary font-bold">
                {slots.length} Total
              </span>
            </h4>
            <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
              <Info className="h-3 w-3" /> Lock period: 3 days after pairing
            </span>
          </div>

          {slots.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-card border shadow-sm">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <h5 className="mt-3 text-sm font-black text-foreground">No Paid Slots Purchased Yet</h5>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto">
                All your linked Instagram accounts operate on the <strong className="text-foreground">Free Tier</strong>. Upgrade or purchase plan slots to unlock automation features!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {slots.map((slot) => {
                const badge = PLAN_BADGES[slot.planCode.toLowerCase()] || {
                  label: `${slot.planCode} Slot`,
                  bg: 'bg-primary/10',
                  text: 'text-primary',
                  border: 'border-primary/20',
                  icon: Zap
                };
                const BadgeIcon = badge.icon;
                const pairedAccount = igAccounts.find((a) => a.id === slot.pairedAccountId);
                const isOver = dragOverSlotId === slot.id;

                return (
                  <div
                    key={slot.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!slot.isLocked && draggedAccountId) {
                        setDragOverSlotId(slot.id);
                      }
                    }}
                    onDragLeave={() => setDragOverSlotId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedAccountId && !slot.isLocked) {
                        handlePair(slot.id, draggedAccountId);
                      }
                    }}
                    className={`relative overflow-hidden rounded-3xl border transition-all duration-300 p-5 ${
                      isOver
                        ? 'border-primary bg-primary/10 ring-4 ring-primary/20 scale-[1.01]'
                        : pairedAccount
                        ? 'border-border/80 bg-card shadow-sm'
                        : 'border-dashed border-border bg-card/60 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      
                      {/* Slot info */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${badge.bg} ${badge.text} ${badge.border}`}>
                            <BadgeIcon className="h-3.5 w-3.5" />
                            {badge.label}
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            {slot.billingCycle}
                          </span>
                          {slot.expiresAt && (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Expires: {new Date(slot.expiresAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Current Paired Status */}
                        {pairedAccount ? (
                          <div className="flex items-center gap-3 pt-2">
                            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-500 to-pink-500 p-0.5 shadow-md">
                              {pairedAccount.profilePictureUrl ? (
                                <img
                                  src={pairedAccount.profilePictureUrl}
                                  alt={pairedAccount.username}
                                  className="h-full w-full rounded-[14px] object-cover"
                                />
                              ) : (
                                <Instagram className="h-5 w-5 text-white" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-black text-foreground">@{pairedAccount.username}</p>
                              <p className="text-[11px] font-semibold text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" /> Active Paired Account
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="pt-2">
                            <p className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                              Unassigned Slot — Drag an account here to pair
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Right Action & Lock Indicator */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {slot.isLocked ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-amber-600 dark:text-amber-400">
                            <Lock className="h-4 w-4 shrink-0" />
                            <div className="text-right">
                              <p className="text-[10px] font-black uppercase tracking-wider">Pairing Locked</p>
                              <p className="text-xs font-extrabold">{slot.remainingLockText}</p>
                            </div>
                          </div>
                        ) : pairedAccount ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-500">
                              <Unlock className="h-3.5 w-3.5" /> Ready to reassign
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUnpair(slot.id)}
                              disabled={actionLoading === slot.id}
                              className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition"
                            >
                              Unpair
                            </button>
                          </div>
                        ) : (
                          <span className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-extrabold text-primary">
                            Drop IG Account Here
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Linked Instagram Accounts Pool */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h4 className="text-sm font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <span>Linked Accounts</span>
              <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2.5 py-0.5 text-xs font-bold">
                Unlimited Linkable
              </span>
            </h4>
          </div>

          {igAccounts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
              <Instagram className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-xs font-bold text-foreground">No Instagram Accounts Linked</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Connect your Instagram accounts first to assign them to slots.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {igAccounts.map((account) => {
                const pairedSlot = accountToSlotMap.get(account.id);
                const isDragging = draggedAccountId === account.id;

                return (
                  <div
                    key={account.id}
                    draggable
                    onDragStart={() => setDraggedAccountId(account.id)}
                    onDragEnd={() => setDraggedAccountId(null)}
                    className={`group relative overflow-hidden rounded-2xl border p-4 transition-all duration-200 cursor-grab active:cursor-grabbing ${
                      isDragging
                        ? 'opacity-40 border-primary bg-primary/5 scale-95'
                        : pairedSlot
                        ? 'border-border/80 bg-card shadow-sm hover:border-primary/30'
                        : 'border-border bg-card/80 hover:border-primary/40 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 p-0.5 shadow-sm">
                          {account.profilePictureUrl ? (
                            <img
                              src={account.profilePictureUrl}
                              alt={account.username}
                              className="h-full w-full rounded-[10px] object-cover"
                            />
                          ) : (
                            <Instagram className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-foreground truncate">@{account.username}</p>
                          <p className="text-[10px] font-medium text-muted-foreground truncate">
                            {account.name || 'Instagram Business'}
                          </p>
                        </div>
                      </div>

                      {/* Tier Badge */}
                      <div className="shrink-0 text-right">
                        {pairedSlot ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 border border-purple-500/20">
                            {pairedSlot.planCode} Tier
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-[10px] font-black uppercase text-muted-foreground border border-slate-500/20">
                            Free Tier
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default SlotPairingManager;
