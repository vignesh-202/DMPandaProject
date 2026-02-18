import React from 'react';
import { MailPlus, Sparkles, Clock } from 'lucide-react';
import Card from '../../components/ui/card';

const EmailCollectorView: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 pb-8">
        <div className="flex items-center gap-2 text-primary mb-2">
          <MailPlus className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-widest">Email Collector</span>
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Email Collection in DMs</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
          Ask users for their email within the DM conversation and automatically add it to your mailing list
        </p>
      </div>

      {/* Content Card */}
      <div className="flex flex-col items-center justify-center p-4 sm:p-8 min-h-[400px] relative overflow-hidden animate-fadeIn">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[120px] rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

        <Card
          className="w-full max-w-2xl overflow-hidden border border-content shadow-lg rounded-3xl bg-card/80 backdrop-blur-xl relative z-10"
          padding="none"
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />

          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 animate-pulse" />
              <div className="relative w-24 h-24 bg-card rounded-2xl flex items-center justify-center shadow-lg border border-content group hover:scale-105 transition-transform duration-500">
                <MailPlus className="w-12 h-12 text-primary" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                <Sparkles className="w-5 h-5 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full border border-primary/20">
                <Clock className="w-4 h-4" />
                <span className="text-2xs font-bold uppercase tracking-widest">Coming Soon</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Build your email list from Instagram DMs
              </h2>

              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
                Seamlessly collect emails within the DM conversation and automatically add contacts to your mailing list. Turn Instagram followers into valuable, long-term business leads.
              </p>
            </div>

            <div className="pt-6">
              <div className="px-6 py-3 rounded-xl bg-muted border border-content flex items-center gap-3">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping" />
                </div>
                <span className="text-2xs font-bold text-muted-foreground uppercase tracking-widest">In development</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default EmailCollectorView;
