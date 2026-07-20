import React, { useState } from 'react';
import Card from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Code, Copy, Check, Key, ExternalLink, Shield } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../contexts/AuthContext';

const APIView: React.FC = () => {
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (value: string, key: string) => {
    void navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 2000);
  };

  const accountId = user?.$id || '—';
  const apiKey = '••••••••••••••••••••••••••••••••';

  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto select-text animate-fadeIn">
      <div className="space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-gradient-to-tr from-ig-blue via-ig-purple to-ig-pink text-white shadow-md">
            <Code className="h-6 w-6" />
          </span>
          API
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your API credentials, account ID, and webhook integration details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-content shadow-sm">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Key className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">API Credentials</h3>
                <p className="text-xs text-muted-foreground">Use these values to authenticate API requests.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Account ID</label>
                <div className="relative group">
                  <Input
                    value={accountId}
                    readOnly
                    className="h-12 rounded-xl pr-12 bg-muted/50 border-border text-muted-foreground font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(accountId, 'accountId')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                    title="Copy Account ID"
                  >
                    {copied === 'accountId' ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">API Key</label>
                <div className="relative group">
                  <Input
                    type="password"
                    value={apiKey}
                    readOnly
                    className="h-12 rounded-xl pr-12 bg-muted/50 border-border text-muted-foreground font-mono text-sm tracking-widest"
                  />
                  <button
                    type="button"
                    disabled
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground/50 cursor-not-allowed"
                    title="API key generation is coming soon"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">API key generation will be available once the API gateway is live.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border border-content shadow-sm">
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Security Notes</h3>
                <p className="text-xs text-muted-foreground">Keep your credentials safe and rotate them regularly.</p>
              </div>
            </div>

            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                Do not share your API key in client-side code or public repositories.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                All API requests must be made over HTTPS and include your account identifier.
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                Webhook signatures will be verified using a secret key available here soon.
              </li>
            </ul>

            <Button
              variant="outline"
              disabled
              className={cn(
                "rounded-xl h-11 px-5 border-border text-muted-foreground cursor-not-allowed"
              )}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open API Docs
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default APIView;
