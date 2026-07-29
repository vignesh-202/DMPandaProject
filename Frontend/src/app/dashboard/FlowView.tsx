import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import {
  GitBranch,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Webhook,
  Send,
  RefreshCw,
  Shield,
  Layers,
  Sparkles,
  ArrowRight,
  Code
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

const FlowView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const [webhookUrl, setWebhookUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchWebhookConfig = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch('/api/v1/webhooks');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.webhookUrl) {
          setWebhookUrl(json.data.webhookUrl);
        }
      }
    } catch (e) {
      console.error('Failed to fetch webhook config:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchWebhookConfig();
  }, []);

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim()) return;

    setSaveStatus(null);
    try {
      const res = await authenticatedFetch('/api/v1/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      if (res.ok) {
        setSaveStatus('Webhook URL saved successfully!');
        window.setTimeout(() => setSaveStatus(null), 3000);
      } else {
        const json = await res.json();
        setSaveStatus(`Error: ${json.error || 'Failed to save webhook URL'}`);
      }
    } catch (e: any) {
      setSaveStatus(`Error: ${e?.message || 'Failed to save'}`);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl.trim()) {
      setTestStatus('Please enter a Webhook URL first.');
      return;
    }

    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await authenticatedFetch('/api/v1/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: webhookUrl.trim() }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setTestStatus('✅ Test payload delivered successfully to your webhook URL!');
      } else {
        setTestStatus(`❌ Failed: ${json.error || 'Webhook did not respond with 2xx status'}`);
      }
    } catch (e: any) {
      setTestStatus(`❌ Failed: ${e?.message || 'Network error'}`);
    } finally {
      setIsTesting(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const sampleN8nBlueprint = `{
  "name": "DM Panda — Instagram Event Listener",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "dm-panda-events"
      },
      "name": "DM Panda Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "resource": "automation",
        "operation": "trigger"
      },
      "name": "DM Panda Node",
      "type": "n8n-nodes-dmpanda.dmPanda",
      "typeVersion": 1,
      "position": [480, 300],
      "credentials": {
        "dmPandaApi": { "id": "1", "name": "DM Panda Key" }
      }
    }
  ]
}`;

  const sampleEventPayload = `{
  "event": "dm_message_received",
  "timestamp": "2026-07-26T17:35:00.000Z",
  "account_username": "mybrand_official",
  "sender": {
    "username": "john_doe",
    "name": "John Doe"
  },
  "message": {
    "text": "PRICE",
    "type": "text"
  }
}`;

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto select-text animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1.5">
          <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-gradient-to-tr from-ig-purple via-ig-pink to-ig-orange text-white shadow-lg">
              <GitBranch className="h-6 w-6" />
            </span>
            Automation Flows &amp; Webhooks
          </h2>
          <p className="text-sm text-muted-foreground">
            Create visual multi-step automation flows using n8n and set up real-time event webhooks.
          </p>
        </div>

        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-md hover:shadow-lg transition-all hover:scale-[1.02] shrink-0 self-start md:self-auto"
        >
          <Zap className="h-4 w-4" />
          View Public n8n Docs
          <ExternalLink className="h-3.5 w-3.5 ml-1" />
        </a>
      </div>

      {/* SECTION 1: VISUAL FLOWS VIA N8N ACCOUNT */}
      <Card className="border border-content shadow-sm p-6 sm:p-8 space-y-8 bg-card/80 backdrop-blur-xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FCAF45]" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Powered by n8n Community Node
            </div>
            <h3 className="text-2xl font-extrabold text-foreground tracking-tight">
              Create Visual Flows on Your n8n Account
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Design infinite visual automation workflows by connecting DM Panda with 400+ applications (CRM, Google Sheets, HubSpot, Slack, Telegram, OpenAI) directly inside your self-hosted or cloud n8n instance.
            </p>
          </div>

          <a
            href="/dashboard/api"
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-md shrink-0"
          >
            <Code className="h-4 w-4" />
            Get DM Panda API Key
            <ArrowRight className="h-4 w-4 ml-1" />
          </a>
        </div>

        {/* 4-Step Visual Flow Setup Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#405DE6] to-[#833AB4] text-white flex items-center justify-center font-black text-sm">
              1
            </div>
            <h4 className="font-bold text-foreground text-base">Install Community Node</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In your n8n workspace, navigate to <em>Settings &gt; Community Nodes</em>, click <em>Install</em>, and enter <code className="bg-background px-1.5 py-0.5 rounded font-mono text-primary font-bold">n8n-nodes-dmpanda</code>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#405DE6] to-[#833AB4] text-white flex items-center justify-center font-black text-sm">
              2
            </div>
            <h4 className="font-bold text-foreground text-base">Connect API Credential</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Under <em>Credentials &gt; New Credential</em>, choose <strong>DM Panda API Key</strong> and paste your API key starting with <code className="font-mono text-emerald-500 font-bold">dmp_live_...</code>.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#405DE6] to-[#833AB4] text-white flex items-center justify-center font-black text-sm">
              3
            </div>
            <h4 className="font-bold text-foreground text-base">Build Drag-and-Drop Canvas</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Add DM Panda nodes onto your n8n canvas to trigger DMs, query connected accounts, check performance stats, or fetch deliverability logs.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-muted/40 border border-border space-y-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#405DE6] to-[#833AB4] text-white flex items-center justify-center font-black text-sm">
              4
            </div>
            <h4 className="font-bold text-foreground text-base">Route Leads &amp; CRMs</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Automatically sync Instagram DM leads and keyword triggers to HubSpot, Google Sheets, Airtable, Notion, or custom Webhook receivers.
            </p>
          </div>
        </div>

        {/* Blueprint JSON Copy Box */}
        <div className="p-5 rounded-2xl bg-muted/30 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              Sample n8n Canvas Blueprint JSON
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(sampleN8nBlueprint, 'n8nBlueprint')}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-background border border-border text-xs font-bold text-foreground hover:bg-muted transition-colors"
            >
              {copied === 'n8nBlueprint' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              Copy Canvas Blueprint
            </button>
          </div>
          <pre className="p-3 rounded-xl bg-slate-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800 max-h-36">
            {sampleN8nBlueprint}
          </pre>
        </div>
      </Card>

      {/* SECTION 2: USER WEBHOOK SETUP FOR DM PANDA EVENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Webhook Configuration Form */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="border border-content shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Webhook className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-foreground">
                  Setup Real-Time Event Webhook
                </h3>
                <p className="text-xs text-muted-foreground">
                  Receive event payloads sent by DM Panda whenever DMs or comment triggers occur.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveWebhook} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Target Webhook URL
                </label>
                <Input
                  type="url"
                  placeholder="https://your-n8n-instance.com/webhook/ig-events"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  required
                  className="h-12 rounded-xl bg-background border-border text-sm font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter your n8n Webhook node URL, Make/Zapier webhook, or custom HTTPS endpoint.
                </p>
              </div>

              {saveStatus && (
                <div
                  className={cn(
                    "p-3 rounded-xl text-xs font-semibold",
                    saveStatus.startsWith('Error')
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  )}
                >
                  {saveStatus}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={loading || !webhookUrl.trim()}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Saving...
                    </span>
                  ) : (
                    'Save Webhook URL'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  disabled={isTesting || !webhookUrl.trim()}
                  onClick={handleTestWebhook}
                  className="w-full sm:w-auto h-11 px-6 rounded-xl font-bold border-border"
                >
                  {isTesting ? (
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" /> Sending Test...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="h-4 w-4 text-primary" /> Send Test Event Payload
                    </span>
                  )}
                </Button>
              </div>

              {testStatus && (
                <div className="p-3.5 rounded-xl bg-muted/60 border border-border text-xs font-semibold text-foreground">
                  {testStatus}
                </div>
              )}
            </form>
          </Card>
        </div>

        {/* Webhook Event Payload Sample */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border border-content shadow-sm p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Code className="h-4 w-4" />
                </div>
                <h4 className="font-bold text-foreground text-sm">
                  Sample Event Payload JSON
                </h4>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(sampleEventPayload, 'payloadJson')}
                className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Copy Payload JSON"
              >
                {copied === 'payloadJson' ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              When an Instagram DM or comment trigger fires, DM Panda dispatches an HTTP POST payload with this schema to your target webhook URL:
            </p>

            <pre className="p-4 rounded-xl bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-64">
              {sampleEventPayload}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default FlowView;
