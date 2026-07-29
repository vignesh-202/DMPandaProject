import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Code,
  BookOpen,
  Zap,
  Key,
  Shield,
  Copy,
  Check,
  Server,
  Layers,
  Terminal,
  ExternalLink,
  ChevronRight,
  Search,
  Cpu,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../lib/utils';

const DocsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'api' | 'n8n'>('api');
  const [selectedEndpointIndex, setSelectedEndpointIndex] = useState(0);
  const [codeLang, setCodeLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const copyToClipboard = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(id);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const apiEndpoints = [
    {
      id: 'get-me',
      title: 'Get Profile & Plan Quotas',
      method: 'GET',
      path: '/api/v1/me',
      desc: 'Retrieves current user details, active plan limits, and authentication mode.',
      curl: `curl -X GET "https://api.dmpanda.com/api/v1/me" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx"`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/me', {\n  headers: { 'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx' }\n});\nconst data = await res.json();\nconsole.log(data);`,
      python: `import requests\n\nheaders = {'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'}\nres = requests.get('https://api.dmpanda.com/api/v1/me', headers=headers)\nprint(res.json())`,
      response: `{
  "success": true,
  "data": {
    "id": "usr_99812",
    "name": "John Marketer",
    "email": "john@example.com",
    "emailVerified": true,
    "plan": {
      "plan_id": "pro",
      "plan_name": "Pro Automation Plan",
      "limits": {
        "monthly_action_limit": 50000,
        "max_ig_accounts": 10
      }
    },
    "authenticatedVia": "api_key"
  }
}`
    },
    {
      id: 'list-accounts',
      title: 'List Instagram Accounts',
      method: 'GET',
      path: '/api/v1/accounts',
      desc: 'Lists all connected Instagram Business / Creator accounts and usage statistics.',
      curl: `curl -X GET "https://api.dmpanda.com/api/v1/accounts" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx"`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/accounts', {\n  headers: { 'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx' }\n});\nconst accounts = await res.json();`,
      python: `import requests\nres = requests.get('https://api.dmpanda.com/api/v1/accounts', headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'})\nprint(res.json())`,
      response: `{
  "success": true,
  "data": [
    {
      "id": "acc_101",
      "igUserId": "17841400012345",
      "username": "mybrand_official",
      "name": "My Brand Official",
      "status": "connected",
      "monthlyActionsUsed": 1420,
      "dailyActionsUsed": 92
    }
  ]
}`
    },
    {
      id: 'list-automations',
      title: 'List Automations',
      method: 'GET',
      path: '/api/v1/automations',
      desc: 'Lists existing automation flows with optional query filtering by account_id, trigger_type, or is_active.',
      curl: `curl -X GET "https://api.dmpanda.com/api/v1/automations?trigger_type=post_comment" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx"`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/automations?trigger_type=post_comment', {\n  headers: { 'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx' }\n});\nconst automations = await res.json();`,
      python: `import requests\nres = requests.get('https://api.dmpanda.com/api/v1/automations', headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'})\nprint(res.json())`,
      response: `{
  "success": true,
  "data": [
    {
      "id": "auto_302",
      "title": "Ebook Lead Magnet",
      "triggerType": "post_comment",
      "keywords": ["INFO", "PDF", "LINK"],
      "matchRule": "contains",
      "isActive": true,
      "replyText": "Here is your download link: https://example.com/ebook.pdf 📚",
      "stats": { "dmsSent": 450, "commentRepliesCount": 420 }
    }
  ]
}`
    },
    {
      id: 'create-automation',
      title: 'Create Automation Flow',
      method: 'POST',
      path: '/api/v1/automations',
      desc: 'Creates a new keyword-triggered Instagram DM or comment automation.',
      curl: `curl -X POST "https://api.dmpanda.com/api/v1/automations" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "title": "New Product Promo",\n    "triggerType": "post_comment",\n    "keywords": ["PROMO", "DISCOUNT"],\n    "matchRule": "contains",\n    "replyText": "Use code SAVE20 at checkout! 🏷️"\n  }'`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/automations', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    title: 'New Product Promo',\n    triggerType: 'post_comment',\n    keywords: ['PROMO', 'DISCOUNT'],\n    replyText: 'Use code SAVE20 at checkout! 🏷️'\n  })\n});`,
      python: `import requests\npayload = {\n    "title": "New Product Promo",\n    "triggerType": "post_comment",\n    "keywords": ["PROMO"],\n    "replyText": "Use code SAVE20 at checkout! 🏷️"\n}\nres = requests.post('https://api.dmpanda.com/api/v1/automations', json=payload, headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'})`,
      response: `{
  "success": true,
  "data": {
    "id": "auto_501",
    "title": "New Product Promo",
    "triggerType": "post_comment",
    "keywords": ["PROMO", "DISCOUNT"],
    "isActive": true,
    "createdAt": "2026-07-26T17:15:00.000Z"
  }
}`
    },
    {
      id: 'trigger-automation',
      title: 'Trigger DM Payload',
      method: 'POST',
      path: '/api/v1/automations/:id/trigger',
      desc: 'Dispatches a DM automation message directly to a target Instagram user.',
      curl: `curl -X POST "https://api.dmpanda.com/api/v1/automations/auto_302/trigger" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx" \\\n  -H "Content-Type: application/json" \\\n  -d '{"recipientUsername": "alex_growth", "customMessage": "Special invitation inside!"}'`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/automations/auto_302/trigger', {\n  method: 'POST',\n  headers: {\n    'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx',\n    'Content-Type': 'application/json'\n  },\n  body: JSON.stringify({\n    recipientUsername: 'alex_growth',\n    customMessage: 'Special invitation inside!'\n  })\n});`,
      python: `import requests\nres = requests.post(\n    'https://api.dmpanda.com/api/v1/automations/auto_302/trigger',\n    json={'recipientUsername': 'alex_growth', 'customMessage': 'Special invitation inside!'},\n    headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'}\n)`,
      response: `{
  "success": true,
  "message": "Automation triggered successfully for recipient: alex_growth",
  "logId": "log_7712"
}`
    },
    {
      id: 'get-analytics',
      title: 'Get Performance Analytics',
      method: 'GET',
      path: '/api/v1/analytics',
      desc: 'Retrieves aggregate 24h and 30d DM send statistics and success rates.',
      curl: `curl -X GET "https://api.dmpanda.com/api/v1/analytics" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx"`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/analytics', {\n  headers: { 'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx' }\n});`,
      python: `import requests\nres = requests.get('https://api.dmpanda.com/api/v1/analytics', headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'})`,
      response: `{
  "success": true,
  "data": {
    "totalAccounts": 2,
    "totalAutomations": 8,
    "activeAutomations": 7,
    "dmsSent24h": 380,
    "dmsSent30d": 11400,
    "successRate": "99%"
  }
}`
    },
    {
      id: 'get-logs',
      title: 'Execution Logs',
      method: 'GET',
      path: '/api/v1/logs',
      desc: 'Lists execution logs for automated DM sends and comment replies with pagination.',
      curl: `curl -X GET "https://api.dmpanda.com/api/v1/logs?limit=50" \\\n  -H "X-API-Key: dmp_live_xxxxxxxxxxxxxxxx"`,
      js: `const res = await fetch('https://api.dmpanda.com/api/v1/logs?limit=50', {\n  headers: { 'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx' }\n});`,
      python: `import requests\nres = requests.get('https://api.dmpanda.com/api/v1/logs?limit=50', headers={'X-API-Key': 'dmp_live_xxxxxxxxxxxxxxxx'})`,
      response: `{
  "success": true,
  "total": 11400,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": "log_001",
      "automationId": "auto_302",
      "recipientName": "jane_smith",
      "status": "success",
      "messageSent": "Here is your download link...",
      "sentAt": "2026-07-26T17:00:00.000Z"
    }
  ]
}`
    }
  ];

  const filteredEndpoints = apiEndpoints.filter(ep =>
    ep.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ep.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sampleN8nWorkflowJson = `{
  "name": "DM Panda Lead Collection Workflow",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [{ "field": "hours", "hoursInterval": 24 }]
        }
      },
      "name": "Daily Trigger",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1,
      "position": [240, 300]
    },
    {
      "parameters": {
        "resource": "analytics",
        "operation": "get"
      },
      "name": "DM Panda Analytics",
      "type": "n8n-nodes-dmpanda.dmPanda",
      "typeVersion": 1,
      "position": [460, 300],
      "credentials": {
        "dmPandaApi": {
          "id": "1",
          "name": "DM Panda Production Key"
        }
      }
    }
  ]
}`;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-gray-100 transition-colors duration-500 pt-20 pb-16">
      {/* Hero Header */}
      <section className="border-b border-gray-200 dark:border-white/[0.08] bg-white dark:bg-neutral-900/60 backdrop-blur-xl py-12 sm:py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="max-w-3xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#405DE6]/10 via-[#833AB4]/10 to-[#FCAF45]/10 border border-[#833AB4]/20 text-[#833AB4] dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" />
              Developer Documentation
            </div>

            <h1 className="text-3xl sm:text-5xl font-black text-gray-900 dark:text-white tracking-tight">
              DM Panda <span className="bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] bg-clip-text text-transparent">API &amp; n8n</span> Docs
            </h1>

            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 leading-relaxed">
              Build custom integrations, automate direct messaging workflows, connect n8n community nodes, and leverage Instagram automation programmatically.
            </p>

            {/* Quick Links / Navigation tabs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActiveTab('api')}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300",
                  activeTab === 'api'
                    ? "bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-lg shadow-[#833AB4]/20 scale-[1.02]"
                    : "bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                )}
              >
                <Code className="h-4 w-4" /> REST API v1 Reference
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('n8n')}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all duration-300",
                  activeTab === 'n8n'
                    ? "bg-gradient-to-r from-[#405DE6] via-[#833AB4] to-[#FD1D1D] text-white shadow-lg shadow-[#833AB4]/20 scale-[1.02]"
                    : "bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/10"
                )}
              >
                <Zap className="h-4 w-4 text-amber-400" /> n8n Community Node Guide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Documentation Container */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl mt-8">
        {activeTab === 'api' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sidebar Overview & Endpoint Navigation */}
            <aside className="lg:col-span-4 space-y-6">
              {/* Search Box */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#833AB4] transition-all"
                />
              </div>

              {/* Authentication Info Box */}
              <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-3 shadow-xs">
                <div className="flex items-center gap-2.5 text-sm font-bold text-gray-900 dark:text-white">
                  <Shield className="h-4 w-4 text-[#833AB4]" />
                  Authentication Header
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Include your API key in all HTTP request headers:
                </p>
                <div className="p-2.5 rounded-lg bg-gray-900 dark:bg-black font-mono text-[11px] text-emerald-400 overflow-x-auto border border-gray-800">
                  X-API-Key: dmp_live_xxxxxxxx
                </div>
                <p className="text-[11px] text-gray-500">
                  Manage keys in <Link to="/dashboard" className="text-[#833AB4] hover:underline font-semibold">Dashboard &gt; API</Link>
                </p>
              </div>

              {/* Endpoints List */}
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-2 shadow-xs">
                <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
                  Endpoints Catalog ({filteredEndpoints.length})
                </h3>
                <div className="space-y-1">
                  {filteredEndpoints.map((ep) => {
                    const originalIdx = apiEndpoints.findIndex(e => e.id === ep.id);
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => setSelectedEndpointIndex(originalIdx)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl transition-all flex items-start justify-between gap-2 text-xs font-semibold",
                          selectedEndpointIndex === originalIdx
                            ? "bg-[#833AB4]/10 text-[#833AB4] dark:text-purple-300 border border-[#833AB4]/30 shadow-xs"
                            : "hover:bg-gray-100 dark:hover:bg-white/[0.04] text-gray-700 dark:text-gray-300"
                        )}
                      >
                        <div className="space-y-1">
                          <span className="block font-bold">{ep.title}</span>
                          <span className="block font-mono text-[11px] text-gray-500 dark:text-gray-400">{ep.path}</span>
                        </div>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 text-[10px] font-mono font-bold rounded uppercase shrink-0",
                            ep.method === 'GET' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                            ep.method === 'POST' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            ep.method === 'PATCH' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                            ep.method === 'DELETE' && "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                          )}
                        >
                          {ep.method}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Main Endpoint Content Viewer */}
            <main className="lg:col-span-8 space-y-6">
              {apiEndpoints[selectedEndpointIndex] && (
                <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-6 shadow-sm">
                  {/* Title & Desc */}
                  <div className="space-y-2 border-b border-gray-100 dark:border-white/[0.06] pb-4">
                    <div className="flex items-center gap-3">
                      <span className={cn(
                        "px-2.5 py-1 text-xs font-mono font-bold rounded-lg uppercase",
                        apiEndpoints[selectedEndpointIndex].method === 'GET' && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
                        apiEndpoints[selectedEndpointIndex].method === 'POST' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                        apiEndpoints[selectedEndpointIndex].method === 'PATCH' && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                        apiEndpoints[selectedEndpointIndex].method === 'DELETE' && "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      )}>
                        {apiEndpoints[selectedEndpointIndex].method}
                      </span>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                        {apiEndpoints[selectedEndpointIndex].title}
                      </h2>
                    </div>
                    <p className="font-mono text-sm text-[#833AB4] dark:text-purple-400">
                      {apiEndpoints[selectedEndpointIndex].path}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {apiEndpoints[selectedEndpointIndex].desc}
                    </p>
                  </div>

                  {/* Code Example Selector */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Request Example</h3>
                      <div className="flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-white/[0.06]">
                        {(['curl', 'js', 'python'] as const).map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => setCodeLang(lang)}
                            className={cn(
                              "px-3 py-1 text-xs font-mono font-bold rounded transition-colors",
                              codeLang === lang
                                ? "bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-xs"
                                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                            )}
                          >
                            {lang === 'curl' ? 'cURL' : lang === 'js' ? 'JavaScript' : 'Python'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative group">
                      <pre className="p-4 rounded-xl bg-neutral-950 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800">
                        {apiEndpoints[selectedEndpointIndex][codeLang]}
                      </pre>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(apiEndpoints[selectedEndpointIndex][codeLang], 'reqCode')}
                        className="absolute right-3 top-3 p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                      >
                        {copiedKey === 'reqCode' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expected Response JSON */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">Response Payload (200 OK)</h3>
                    <div className="relative group">
                      <pre className="p-4 rounded-xl bg-neutral-950 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-neutral-800 max-h-64">
                        {apiEndpoints[selectedEndpointIndex].response}
                      </pre>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(apiEndpoints[selectedEndpointIndex].response, 'resCode')}
                        className="absolute right-3 top-3 p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors"
                      >
                        {copiedKey === 'resCode' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </main>
          </div>
        ) : (
          /* TAB: n8n Community Node Guide */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                      n8n Community Node Installation
                    </h2>
                    <p className="text-xs text-gray-500">
                      Package Name: <code className="font-mono text-[#833AB4] font-bold">n8n-nodes-dmpanda</code>
                    </p>
                  </div>
                </div>

                <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-[#405DE6] to-[#833AB4] text-white text-xs font-black">1</span>
                      Install via n8n Settings
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 pl-8">
                      In your n8n workspace, navigate to <strong>Settings &gt; Community Nodes</strong>. Click <strong>Install</strong>, enter <code className="bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-mono text-purple-600 dark:text-purple-300 font-bold">n8n-nodes-dmpanda</code>, and accept the community node notice.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-[#405DE6] to-[#833AB4] text-white text-xs font-black">2</span>
                      Configure Credential
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 pl-8">
                      Under <em>Credentials &gt; New Credential</em>, select <strong>DM Panda API Key</strong>. Input your API key starting with <code className="font-mono text-emerald-500 font-bold">dmp_live_...</code> (generated in Dashboard &gt; API).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-r from-[#405DE6] to-[#833AB4] text-white text-xs font-black">3</span>
                      Add DM Panda Node to Canvas
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 pl-8">
                      Add the <strong>DM Panda</strong> node into any workflow to automate DM sends, list connected accounts, check analytics, or inspect logs.
                    </p>
                  </div>
                </div>
              </div>

              {/* Supported Actions Table */}
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-sm">
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Supported Node Operations
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-white/10 text-gray-500">
                        <th className="py-2.5 px-3 font-semibold">Resource</th>
                        <th className="py-2.5 px-3 font-semibold">Operation</th>
                        <th className="py-2.5 px-3 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/[0.06]">
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-[#833AB4]">Account</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">Get Many</td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Fetch list of connected IG accounts</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-[#833AB4]">Automation</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">Get / Create / Toggle / Trigger</td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Manage DM flows &amp; dispatch messages</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-[#833AB4]">Analytics</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">Get Overview</td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Retrieve 24h &amp; 30d DM stats</td>
                      </tr>
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-[#833AB4]">Execution Log</td>
                        <td className="py-2.5 px-3 font-mono font-semibold">Get Many</td>
                        <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">Audit deliverability &amp; logs</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Importable Workflow Blueprint */}
            <div className="lg:col-span-5 space-y-6">
              <div className="p-6 rounded-2xl bg-white dark:bg-neutral-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-[#833AB4]/10 text-[#833AB4]">
                    <Layers className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Sample n8n Workflow Blueprint</h3>
                    <p className="text-xs text-gray-500">Copy &amp; import directly into n8n canvas</p>
                  </div>
                </div>

                <div className="relative group">
                  <pre className="p-4 rounded-xl bg-neutral-950 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed border border-neutral-800 max-h-80">
                    {sampleN8nWorkflowJson}
                  </pre>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(sampleN8nWorkflowJson, 'blueprint')}
                    className="absolute right-3 top-3 p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white hover:bg-neutral-700 transition-colors flex items-center gap-1 text-xs font-bold"
                  >
                    {copiedKey === 'blueprint' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocsPage;
