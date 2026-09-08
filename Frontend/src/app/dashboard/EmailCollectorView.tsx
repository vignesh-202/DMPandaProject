import React from 'react';
import { MailPlus, CheckCircle2, Clock } from 'lucide-react';

const EmailCollectorView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">Email Collector</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
          Prompt viewers for their email inside direct message flows and automatically sync them to your newsletter.
        </p>
      </div>

      {/* Modern Minimalist Preview Card */}
      <div className="flex items-center justify-center py-8">
        <div className="w-full max-w-xl rounded-2xl border border-border/80 bg-card p-6 sm:p-10 text-center space-y-6 shadow-xs">
          <div className="w-12 h-12 rounded-xl border border-border/80 bg-muted/40 flex items-center justify-center mx-auto text-foreground">
            <MailPlus className="w-5 h-5" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border/60">
              <Clock className="w-3 h-3" />
              <span>In Development</span>
            </div>
            <h2 className="text-lg sm:text-xl font-semibold text-foreground tracking-tight">
              Direct-to-Inbox Lead Capture
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
              Collect verified email addresses directly inside the conversation and export leads to webhooks, spreadsheets, or your ESP.
            </p>
          </div>

          <div className="pt-2 border-t border-border/60 text-left space-y-2.5 max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-foreground shrink-0" />
              <span>Inline email validation and retry prompts</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-foreground shrink-0" />
              <span>Webhook integration with Zapier, Make, and ESPs</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="w-3.5 h-3.5 text-foreground shrink-0" />
              <span>Optional Gmail-only filter for cleaner leads</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailCollectorView;
