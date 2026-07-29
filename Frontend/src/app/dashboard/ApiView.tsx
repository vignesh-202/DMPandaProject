import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  Code,
  Copy,
  Check,
  Key,
  ExternalLink,
  Shield,
  Plus,
  Trash2,
  RefreshCw,
  BookOpen,
  Zap
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

interface ApiKeyItem {
  id: string;
  name: string;
  maskedKey: string;
  createdAt: string;
  lastUsedAt: string | null;
  status: string;
}

const APIView: React.FC = () => {
  const { user, authenticatedFetch } = useAuth();

  // API Key management states
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [keyNameInput, setKeyNameInput] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Event Webhook states
  const [webhookUrlInput, setWebhookUrlInput] = useState('');
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookStatusMsg, setWebhookStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const accountId = user?.$id || '—';

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/v1/api-keys');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setApiKeys(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to load API keys:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhook = async () => {
    try {
      const res = await authenticatedFetch('/api/v1/webhooks');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.webhookUrl) {
          setWebhookUrlInput(json.data.webhookUrl);
        }
      }
    } catch (e) {
      console.error('Failed to load webhook configuration:', e);
    }
  };

  useEffect(() => {
    void fetchKeys();
    void fetchWebhook();
  }, []);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = webhookUrlInput.trim();
    if (!url) return;

    if (!url.startsWith('https://')) {
      setWebhookStatusMsg({ type: 'error', text: 'Webhook URL must start with https:// (HTTP and localhost are strictly prohibited).' });
      return;
    }

    setIsSavingWebhook(true);
    setWebhookStatusMsg(null);
    try {
      const res = await authenticatedFetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setWebhookStatusMsg({ type: 'success', text: json.message || 'Event Webhook URL verified & saved successfully!' });
      } else {
        setWebhookStatusMsg({ type: 'error', text: json.error || 'Failed to save Webhook URL.' });
      }
    } catch (e: any) {
      setWebhookStatusMsg({ type: 'error', text: e.message || 'Error saving Webhook URL.' });
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const handleTestWebhook = async () => {
    const url = webhookUrlInput.trim();
    if (!url) return;

    if (!url.startsWith('https://')) {
      setWebhookStatusMsg({ type: 'error', text: 'Webhook URL must start with https:// (HTTP and localhost are strictly prohibited).' });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookStatusMsg(null);
    try {
      const res = await authenticatedFetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: url }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setWebhookStatusMsg({ type: 'success', text: json.message || 'Test event delivered successfully!' });
      } else {
        setWebhookStatusMsg({ type: 'error', text: json.error || 'Test webhook delivery failed.' });
      }
    } catch (e: any) {
      setWebhookStatusMsg({ type: 'error', text: e.message || 'Error testing Webhook delivery.' });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyNameInput.trim()) return;

    setIsCreatingKey(true);
    try {
      const res = await authenticatedFetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyNameInput.trim() }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.key) {
          setNewlyCreatedKey(json.data.key);
          setKeyNameInput('');
          await fetchKeys();
        }
      }
    } catch (e) {
      console.error('Error creating key:', e);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;
    try {
      const res = await authenticatedFetch(`/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchKeys();
      }
    } catch (e) {
      console.error('Error revoking key:', e);
    }
  };

  const copyToClipboard = (value: string, label: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto select-text animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-ig-blue via-ig-purple to-ig-pink text-white shadow-lg">
              <Code className="h-6 w-6" />
            </span>
            API &amp; Integrations
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage your developer API keys and connect third-party automation tools.
          </p>
        </div>

        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] shrink-0 self-start md:self-auto"
        >
          <BookOpen className="h-4 w-4" />
          Open Public API &amp; n8n Docs
          <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </a>
      </div>

      {/* Newly Created Key Alert Banner */}
      {newlyCreatedKey && (
        <Card className="border-2 border-emerald-500/40 bg-emerald-500/10 p-5 rounded-2xl shadow-md">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm sm:text-base">
                <Check className="h-5 w-5" />
                API Key Generated Successfully!
              </div>
              <button
                type="button"
                onClick={() => setNewlyCreatedKey(null)}
                className="text-xs text-muted-foreground hover:text-foreground underline"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs sm:text-sm text-foreground">
              Copy this API Key now. For security reasons, <strong>it will not be shown again!</strong>
            </p>
            <div className="relative group">
              <Input
                value={newlyCreatedKey}
                readOnly
                className="h-12 rounded-xl pr-12 bg-background border-emerald-500/50 text-foreground font-mono text-sm font-bold"
              />
              <button
                type="button"
                onClick={() => copyToClipboard(newlyCreatedKey, 'newKey')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                title="Copy API Key"
              >
                {copied === 'newKey' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* API Key Management Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Account info & Key Creator */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border border-content shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Account Identifier</h3>
                <p className="text-xs text-muted-foreground">Your account ID for API requests</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Account ID
              </label>
              <div className="relative group">
                <Input
                  value={accountId}
                  readOnly
                  className="h-11 rounded-xl pr-12 bg-muted/50 border-border text-foreground font-mono text-xs sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(accountId, 'accountId')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                >
                  {copied === 'accountId' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </Card>

          <Card className="border border-content shadow-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Generate API Key</h3>
                <p className="text-xs text-muted-foreground">Create key for n8n or custom integrations</p>
              </div>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Key Description / Name
                </label>
                <Input
                  placeholder="e.g. n8n Production Node"
                  value={keyNameInput}
                  onChange={(e) => setKeyNameInput(e.target.value)}
                  required
                  className="h-11 rounded-xl bg-background border-border text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={isCreatingKey || !keyNameInput.trim()}
                className="w-full h-11 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {isCreatingKey ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" /> Generating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Key className="h-4 w-4" /> Generate API Key
                  </span>
                )}
              </Button>
            </form>
          </Card>

          {/* Quick Docs Redirect Banner */}
          <Card className="border border-content shadow-sm p-6 space-y-4 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent">
            <div className="flex items-center gap-3 text-primary">
              <Zap className="h-5 w-5" />
              <h3 className="font-bold text-foreground text-sm">Need Help Setting Up?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Explore endpoint schemas, cURL examples, and community node installation guides in our public documentation portal.
            </p>
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:underline"
            >
              Read Full API &amp; n8n Documentation <ExternalLink className="h-3 w-3" />
            </a>
          </Card>
        </div>

        {/* Right Column: Event Webhook Redirection & Active Keys List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event Webhook Configuration Card */}
          <Card className="border border-content shadow-sm p-6 space-y-5 bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-pink-500/10 text-pink-500">
                  <Code className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Event Webhook Redirection</h3>
                  <p className="text-xs text-muted-foreground">Automatically forward all Instagram &amp; automation events to your custom webhook</p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Ultra Feature
              </span>
            </div>

            <form onSubmit={handleSaveWebhook} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                  <span>Webhook Endpoint URL</span>
                  <span className="text-[11px] text-muted-foreground font-normal normal-case">e.g. n8n flow URL, Make.com, or custom server</span>
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://n8n.your-domain.com/webhook/ig-events"
                    value={webhookUrlInput}
                    onChange={(e) => setWebhookUrlInput(e.target.value)}
                    type="url"
                    required
                    className="h-11 rounded-xl bg-background border-border text-sm flex-1 font-mono"
                  />
                  <Button
                    type="submit"
                    disabled={isSavingWebhook || !webhookUrlInput.trim()}
                    className="h-11 px-5 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 shrink-0"
                  >
                    {isSavingWebhook ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Save Webhook'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleTestWebhook}
                    disabled={isTestingWebhook || !webhookUrlInput.trim()}
                    className="h-11 px-4 rounded-xl font-semibold border-border hover:bg-muted shrink-0"
                  >
                    {isTestingWebhook ? (
                      <span className="flex items-center gap-1.5 text-xs">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Testing...
                      </span>
                    ) : (
                      <span className="text-xs font-bold">Test Delivery</span>
                    )}
                  </Button>
                </div>
              </div>

              {webhookStatusMsg && (
                <div
                  className={cn(
                    "p-3 rounded-xl text-xs font-semibold flex items-center gap-2",
                    webhookStatusMsg.type === 'success'
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border border-destructive/20"
                  )}
                >
                  {webhookStatusMsg.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <Shield className="h-4 w-4 shrink-0" />}
                  <span>{webhookStatusMsg.text}</span>
                </div>
              )}
            </form>
          </Card>

          <Card className="border border-content shadow-sm p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Active API Keys</h3>
                  <p className="text-xs text-muted-foreground">Manage your developer credentials</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchKeys()}
                className="rounded-xl h-9 px-3 text-xs"
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} /> Refresh
              </Button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading API keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-border rounded-2xl space-y-2">
                <Key className="h-8 w-8 text-muted-foreground mx-auto" />
                <p className="text-sm font-semibold text-foreground">No API Keys Generated</p>
                <p className="text-xs text-muted-foreground">
                  Use the panel on the left to generate your first API key for n8n or custom integrations.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border border border-border rounded-2xl overflow-hidden">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-foreground">{k.name}</span>
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          Active
                        </span>
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">{k.maskedKey}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Created: {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt ? ` • Last used: ${new Date(k.lastUsedAt).toLocaleDateString()}` : ' • Never used'}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRevokeKey(k.id)}
                      className="rounded-xl h-9 px-3 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0 self-start sm:self-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default APIView;
