import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Trash2,
  Users
} from 'lucide-react';
import httpClient from '../lib/httpClient';
import AdminLoadingState from '../components/AdminLoadingState';
import { cn } from '../lib/utils';
import ConfirmDialog from '../components/ConfirmDialog';
import { SelectField } from '../components/ui/SelectField';

type Segment = 'all' | 'current_paid' | 'current_free' | 'active' | 'expired' | 'never_paid';
type CampaignView = 'list' | 'create';
type CampaignStep = 'segment' | 'compose';

interface CampaignFilters {
  search: string;
  segment: Segment;
  plan_codes: string[];
  signup_from: string;
  signup_to: string;
  subscription_from: string;
  subscription_to: string;
  linked_instagram: 'any' | 'none' | 'connected' | 'multi';
  has_transactions: 'any' | 'yes' | 'no';
  subscription_status: '' | 'active' | 'inactive' | 'expired';
  ban_mode: '' | 'none' | 'soft' | 'hard';
  sort_by: 'newest' | 'oldest' | 'recent_subscription' | 'expiring_soon' | 'most_connected';
}

interface CampaignLedgerRow {
  id: string;
  subject: string;
  status: string;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  target_total: number;
  queued_total: number;
  delivered_total: number;
  failed_total: number;
  appwrite_message_id?: string | null;
}

interface CampaignPagePayload {
  summary: Record<string, number>;
  matching_summary: Record<string, number>;
  filter_options: {
    plans: { value: string; label: string }[];
    segments: { value: Segment; label: string }[];
  };
  audience_preview: Array<{
    id: string;
    name: string;
    email: string;
    created_at: string | null;
    current_plan: string;
    current_status: string;
    linked_instagram_accounts: number;
    last_subscription_at: string | null;
  }>;
  campaigns: CampaignLedgerRow[];
  campaigns_pagination: {
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

const surfaceClass = 'glass-card rounded-[32px] border border-border/70 bg-card/95 shadow-sm';

const defaultFilters: CampaignFilters = {
  search: '',
  segment: 'all',
  plan_codes: [],
  signup_from: '',
  signup_to: '',
  subscription_from: '',
  subscription_to: '',
  linked_instagram: 'any',
  has_transactions: 'any',
  subscription_status: '',
  ban_mode: '',
  sort_by: 'newest'
};

const formatDateTime = (value: string | null) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString();
};

const toDateTimeLocal = (value: string) => {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const buildParams = (filters: CampaignFilters, page: number, pageSize = 10) => {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize)
  });

  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(','));
      return;
    }
    if (value) params.set(key, String(value));
  });

  return params.toString();
};

export const EmailCampaignsPage: React.FC = () => {
  const [view, setView] = useState<CampaignView>('list');
  const [step, setStep] = useState<CampaignStep>('segment');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const [data, setData] = useState<CampaignPagePayload | null>(null);
  const [filters, setFilters] = useState<CampaignFilters>(defaultFilters);
  const [campaignPage, setCampaignPage] = useState(1);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('<p>Hello from your workspace.</p>');
  const [format, setFormat] = useState<'html' | 'text'>('html');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [campaignPendingDelete, setCampaignPendingDelete] = useState<CampaignLedgerRow | null>(null);

  const fetchAudienceAndCampaigns = async (
    nextFilters: CampaignFilters,
    nextPage: number,
    mode: 'initial' | 'refresh' = 'refresh'
  ) => {
    try {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      const response = await httpClient.get(`/api/admin/email-campaigns?${buildParams(nextFilters, nextPage)}`);
      setData(response.data);
      setError(null);
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.error || 'Failed to load email campaigns.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchAudienceAndCampaigns(filters, 1, 'initial');
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (view !== 'create') return;
      setCampaignPage(1);
      void fetchAudienceAndCampaigns(filters, 1);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [filters, view]);

  useEffect(() => {
    if (!loading) {
      void fetchAudienceAndCampaigns(filters, campaignPage);
    }
  }, [campaignPage]);

  const togglePlan = (planCode: string) => {
    setFilters((current) => ({
      ...current,
      plan_codes: current.plan_codes.includes(planCode)
        ? current.plan_codes.filter((entry) => entry !== planCode)
        : [...current.plan_codes, planCode]
    }));
  };

  const resetComposer = () => {
    setSubject('');
    setContent('<p>Hello from your workspace.</p>');
    setFormat('html');
    setScheduledAt('');
    setStep('segment');
  };

  const startCreateFlow = () => {
    setView('create');
    setStep('segment');
    setNotice(null);
    setError(null);
  };

  const returnToList = async (targetPage = campaignPage) => {
    setView('list');
    setStep('segment');
    setCampaignPage(targetPage);
    await fetchAudienceAndCampaigns(filters, targetPage);
  };

  const sendCampaign = async () => {
    try {
      setSending(true);
      setNotice(null);
      setError(null);
      const response = await httpClient.post('/api/admin/email-campaigns/send', {
        subject,
        content,
        format,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        filters
      });
      setNotice(`Campaign queued for ${response.data?.matching_summary?.recipients || 0} recipients.`);
      resetComposer();
      await returnToList(1);
    } catch (sendError: any) {
      setError(sendError?.response?.data?.error || 'Failed to queue email campaign.');
    } finally {
      setSending(false);
    }
  };

  const deleteCampaign = async (campaign: CampaignLedgerRow) => {
    try {
      setDeletingCampaignId(campaign.id);
      setNotice(null);
      setError(null);
      await httpClient.delete(`/api/admin/email-campaigns/${campaign.id}`);
      setNotice(`Campaign "${campaign.subject}" deleted.`);
      await fetchAudienceAndCampaigns(filters, campaignPage);
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.error || 'Failed to delete email campaign.');
    } finally {
      setDeletingCampaignId(null);
      setCampaignPendingDelete(null);
    }
  };

  const topMetrics = useMemo(() => {
    if (!data) return [];
    return [
      ['Reachable', data.summary.emailable_users || 0],
      ['Paid Now', data.summary.current_paid_users || 0],
      ['Free Now', data.summary.current_free_users || 0],
      ['Active Subs', data.summary.active_subscribers || 0]
    ];
  }, [data]);

  if (loading && !data) {
    return <AdminLoadingState title="Loading email campaigns" description="Preparing sent campaigns, delivery history, and targeting tools." />;
  }

  const campaigns = Array.isArray(data?.campaigns) ? data?.campaigns : [];
  const campaignsPagination = data?.campaigns_pagination;
  const matchingRecipients = Number(data?.matching_summary?.recipients || 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 xl:-mx-2 2xl:-mx-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[10px] font-black text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Email Campaigns
          </div>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {view === 'list' ? 'Sent campaign activity.' : 'Create a new email campaign.'}
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
              {view === 'list'
                ? 'Review delivery activity, sent counts, and recent audience coverage without mixing the list with the create workflow.'
                : 'Choose the exact segment first, confirm the live recipient count, then compose and send.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void fetchAudienceAndCampaigns(filters, campaignPage)}
            disabled={refreshing}
            className="btn-secondary px-4 py-3 text-[10px] disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Refresh
          </button>
          {view === 'list' ? (
            <button type="button" onClick={startCreateFlow} className="btn-primary px-4 py-3 text-[10px]">
              <Send className="h-4 w-4" />
              Create Campaign
            </button>
          ) : null}
        </div>
      </div>

      {(notice || error) && (
        <div className={cn(
          'rounded-[28px] border px-5 py-4 text-sm font-medium shadow-sm animate-in fade-in slide-in-from-top-2 duration-300',
          notice
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
        )}>
          {notice || error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {topMetrics.map(([label, value]) => (
          <div key={String(label)} className={`${surfaceClass} p-5`}>
            <p className="text-[10px] font-black text-muted-foreground">{label}</p>
            <p className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {view === 'list' ? (
        <section className={surfaceClass}>
          <div className="flex flex-col gap-4 border-b border-border/70 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[10px] font-black text-muted-foreground">Sent campaigns</p>
              <h2 className="mt-2 text-2xl font-extrabold text-foreground">Delivery activity</h2>
              <p className="mt-1 text-sm text-muted-foreground">Only already-sent campaigns are shown here.</p>
            </div>
            <div className="status-pill border border-border bg-background/70 text-foreground">
              {campaignsPagination?.total || 0} campaigns
            </div>
          </div>

          <div className="divide-y divide-border/70">
            {campaigns.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <div className="mx-auto w-full max-w-xl rounded-[28px] border border-dashed border-border bg-background/55 px-6 py-10">
                  <p className="text-lg font-extrabold text-foreground">No campaigns yet</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Start a campaign to create the first delivery record and send history entry.
                  </p>
                  <button type="button" onClick={startCreateFlow} className="btn-primary mt-5 px-4 py-3 text-[10px]">
                    <Send className="h-4 w-4" />
                    Create Campaign
                  </button>
                </div>
              </div>
            ) : campaigns.map((campaign) => (
              <div key={campaign.id} className="px-6 py-5">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(250px,0.7fr)] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="truncate text-lg font-extrabold text-foreground">{campaign.subject}</p>
                      <span className="rounded-full border border-border px-2.5 py-1 text-[10px] font-black text-muted-foreground">
                        {campaign.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Sent {formatDateTime(campaign.sent_at || campaign.created_at)} | Scheduled {formatDateTime(campaign.scheduled_at)}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {[
                        ['Targeted', campaign.target_total || 0],
                        ['Queued', campaign.queued_total || 0],
                        ['Delivered', campaign.delivered_total || 0],
                        ['Failed', campaign.failed_total || 0]
                      ].map(([label, value]) => (
                        <div key={String(label)} className="rounded-[22px] border border-border/70 bg-background/55 px-4 py-4">
                          <p className="text-[10px] font-black text-muted-foreground">{label}</p>
                          <p className="mt-2 text-2xl font-extrabold text-foreground">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-border/70 bg-background/55 px-4 py-4 text-xs text-muted-foreground">
                    <p className="font-black text-foreground">Message ID</p>
                    <p className="mt-2 break-all">{campaign.appwrite_message_id || 'Not available'}</p>
                    <button
                      type="button"
                      onClick={() => setCampaignPendingDelete(campaign)}
                      disabled={deletingCampaignId === campaign.id}
                      className="btn-secondary mt-4 w-full px-4 py-2 text-[10px] disabled:opacity-60"
                    >
                      {deletingCampaignId === campaign.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {campaignsPagination && campaignsPagination.total_pages > 1 ? (
            <div className="flex flex-col gap-4 border-t border-border/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Page {campaignsPagination.page} of {campaignsPagination.total_pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCampaignPage(Math.max(1, campaignsPagination.page - 1))}
                  disabled={!campaignsPagination.has_previous || refreshing}
                  className="btn-secondary px-4 py-2 text-[10px] disabled:opacity-60"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setCampaignPage(campaignsPagination.page + 1)}
                  disabled={!campaignsPagination.has_next || refreshing}
                  className="btn-secondary px-4 py-2 text-[10px] disabled:opacity-60"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => void returnToList()}
              className="inline-flex items-center gap-2 text-xs font-black text-muted-foreground transition hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to list
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.9fr)] 2xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
            <section className={`${surfaceClass} p-6 sm:p-7`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black text-muted-foreground">Campaign setup</p>
                  <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">
                    {step === 'segment' ? 'Choose the exact segment.' : 'Write the email content.'}
                  </h2>
                </div>
                <div className="status-pill border border-border bg-background/70 text-foreground">
                  Step {step === 'segment' ? '1' : '2'} of 2
                </div>
              </div>

              {step === 'segment' ? (
                <div className="mt-6 space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-background/55 px-4 py-4">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground">Live audience</p>
                      <p className="mt-2 text-2xl font-extrabold text-foreground">{matchingRecipients}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilters(defaultFilters)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-primary"
                    >
                      <Filter className="h-4 w-4" />
                      Reset
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {(data?.filter_options?.segments || []).map((segment) => (
                      <button
                        key={segment.value}
                        type="button"
                        onClick={() => setFilters((current) => ({ ...current, segment: segment.value }))}
                        className={cn(
                          'rounded-[24px] border px-4 py-4 text-left text-sm font-bold transition-all',
                          filters.segment === segment.value
                            ? 'border-transparent bg-foreground text-background shadow-lg'
                            : 'border-border bg-background text-foreground hover:border-primary/30 hover:text-primary'
                        )}
                      >
                        {segment.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <input
                      value={filters.search}
                      onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                      placeholder="Search name, email, or plan"
                      className="input-base"
                    />
                    <SelectField label="Sort By" value={filters.sort_by} onChange={(val) => setFilters((current) => ({ ...current, sort_by: val as CampaignFilters['sort_by'] }))}>
                      <option value="newest">Newest signup</option>
                      <option value="oldest">Oldest signup</option>
                      <option value="recent_subscription">Recent subscription</option>
                      <option value="expiring_soon">Expiring soon</option>
                      <option value="most_connected">Most connected</option>
                    </SelectField>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {(data?.filter_options?.plans || []).map((plan) => (
                      <button
                        key={plan.value}
                        type="button"
                        onClick={() => togglePlan(plan.value)}
                        className={cn(
                          'rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                          filters.plan_codes.includes(plan.value)
                            ? 'border-transparent bg-foreground text-background'
                            : 'border-border bg-background text-foreground hover:border-primary/30 hover:text-primary'
                        )}
                      >
                        {plan.label}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <input type="date" value={filters.signup_from} onChange={(event) => setFilters((current) => ({ ...current, signup_from: event.target.value }))} className="input-base" />
                    <input type="date" value={filters.signup_to} onChange={(event) => setFilters((current) => ({ ...current, signup_to: event.target.value }))} className="input-base" />
                    <input type="date" value={filters.subscription_from} onChange={(event) => setFilters((current) => ({ ...current, subscription_from: event.target.value }))} className="input-base" />
                    <input type="date" value={filters.subscription_to} onChange={(event) => setFilters((current) => ({ ...current, subscription_to: event.target.value }))} className="input-base" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
                    <SelectField label="Instagram Link" value={filters.linked_instagram} onChange={(val) => setFilters((current) => ({ ...current, linked_instagram: val as CampaignFilters['linked_instagram'] }))}>
                      <option value="any">Any IG depth</option>
                      <option value="none">No linked IG</option>
                      <option value="connected">At least one IG</option>
                      <option value="multi">Two or more IG</option>
                    </SelectField>
                    <SelectField label="Transaction Status" value={filters.has_transactions} onChange={(val) => setFilters((current) => ({ ...current, has_transactions: val as CampaignFilters['has_transactions'] }))}>
                      <option value="any">Any payment history</option>
                      <option value="yes">Has payments</option>
                      <option value="no">No payments</option>
                    </SelectField>
                    <SelectField label="Subscription Status" value={filters.subscription_status} onChange={(val) => setFilters((current) => ({ ...current, subscription_status: val as CampaignFilters['subscription_status'] }))}>
                      <option value="">Any status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="expired">Expired</option>
                    </SelectField>
                    <SelectField label="Ban Mode" value={filters.ban_mode} onChange={(val) => setFilters((current) => ({ ...current, ban_mode: val as CampaignFilters['ban_mode'] }))}>
                      <option value="">Any moderation state</option>
                      <option value="none">Clear</option>
                      <option value="soft">Soft ban</option>
                      <option value="hard">Hard ban</option>
                    </SelectField>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep('compose')}
                      disabled={matchingRecipients === 0}
                      className="btn-primary px-5 py-3 text-[10px] disabled:opacity-60"
                    >
                      Proceed To Email
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <div className="rounded-[24px] border border-border/70 bg-background/55 px-4 py-4">
                    <p className="text-[10px] font-black text-muted-foreground">Selected audience</p>
                    <p className="mt-2 text-2xl font-extrabold text-foreground">{matchingRecipients}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Recipients will be resolved from the current segment filters at send time.</p>
                  </div>

                  <input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Campaign subject" className="input-base" />
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SelectField label="Email Format" value={format} onChange={(val) => setFormat(val as 'html' | 'text')}>
                      <option value="html">Rich HTML</option>
                      <option value="text">Plain text</option>
                    </SelectField>
                    <input type="datetime-local" value={toDateTimeLocal(scheduledAt)} onChange={(event) => setScheduledAt(event.target.value)} className="input-base" />
                  </div>
                  <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} className="input-base min-h-[18rem] resize-y py-4" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                    <button type="button" onClick={() => setStep('segment')} className="btn-secondary px-4 py-3 text-[10px]">
                      <ArrowLeft className="h-4 w-4" />
                      Back To Segment
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendCampaign()}
                      disabled={sending || !subject.trim() || !content.trim() || matchingRecipients === 0}
                      className="btn-primary px-5 py-3.5 text-[10px] disabled:opacity-60"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {scheduledAt ? 'Schedule Campaign' : 'Send Campaign'}
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className={`${surfaceClass} p-6 sm:p-7`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground">Match Snapshot</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Current audience</h2>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    ['Recipients', data?.matching_summary?.recipients || 0],
                    ['Paid now', data?.matching_summary?.current_paid_users || 0],
                    ['Free now', data?.matching_summary?.current_free_users || 0],
                    ['Connected IG', data?.matching_summary?.connected_instagram_users || 0]
                  ].map(([label, value]) => (
                    <div key={String(label)} className="rounded-[24px] border border-border bg-background px-4 py-4">
                      <p className="text-[10px] font-black text-muted-foreground">{label}</p>
                      <p className="mt-3 text-2xl font-extrabold tracking-tight text-foreground">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${surfaceClass} p-6 sm:p-7`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground">Recipient Preview</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Sample recipients</h2>
                  </div>
                  <CalendarRange className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-5 space-y-3">
                  {(data?.audience_preview || []).map((item) => (
                    <div key={item.id} className="rounded-[24px] border border-border bg-background px-4 py-4">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-foreground">{item.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                        </div>
                        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{item.current_plan || 'free'}</span>
                          <span>{item.current_status || 'inactive'}</span>
                          <span>{item.linked_instagram_accounts} IG</span>
                          <span>{item.last_subscription_at ? new Date(item.last_subscription_at).toLocaleDateString() : 'No payment yet'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {data?.audience_preview?.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                      No recipients match the current filters.
                    </div>
                  )}
                </div>
              </div>

              <div className={`${surfaceClass} p-6 sm:p-7`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground">Last delivery</p>
                    <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-foreground">Most recent campaign</h2>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-5 space-y-3">
                  {campaigns.slice(0, 1).map((campaign) => (
                    <div key={campaign.id} className="rounded-[24px] border border-border bg-background px-4 py-4">
                      <p className="text-sm font-bold text-foreground">{campaign.subject}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Delivered {campaign.delivered_total || 0} of {campaign.target_total || 0}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        Sent {formatDateTime(campaign.sent_at || campaign.created_at)}
                      </p>
                    </div>
                  ))}
                  {campaigns.length === 0 && (
                    <div className="rounded-[24px] border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                      No sent campaigns yet.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(campaignPendingDelete)}
        title="Delete campaign record?"
        description={campaignPendingDelete ? `This will permanently remove "${campaignPendingDelete.subject}" from the campaign ledger. Delivery counts and the linked Appwrite message reference for this record will no longer be shown in the admin panel.` : ''}
        confirmLabel="Delete Campaign"
        cancelLabel="Keep Record"
        tone="danger"
        loading={Boolean(campaignPendingDelete && deletingCampaignId === campaignPendingDelete.id)}
        onCancel={() => {
          if (!deletingCampaignId) {
            setCampaignPendingDelete(null);
          }
        }}
        onConfirm={() => {
          if (campaignPendingDelete) {
            void deleteCampaign(campaignPendingDelete);
          }
        }}
      />
    </div>
  );
};

export default EmailCampaignsPage;
