import React from 'react';
import Card from '../../components/ui/card';
import { GitBranch, Sparkles, Clock } from 'lucide-react';

const FlowView: React.FC = () => {
  return (
    <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto select-text animate-fadeIn">
      <div className="space-y-1.5">
        <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-gradient-to-tr from-ig-purple via-ig-pink to-ig-orange text-white shadow-md">
            <GitBranch className="h-6 w-6" />
          </span>
          Flow
        </h2>
        <p className="text-sm text-muted-foreground">
          Build visual automation flows and connect triggers, replies, and follow-ups in one canvas.
        </p>
      </div>

      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Card className="w-full max-w-2xl overflow-hidden border border-content shadow-lg rounded-3xl bg-card/80 backdrop-blur-xl relative">
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />
          <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-6">
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 animate-pulse" />
              <div className="relative w-20 h-20 bg-card rounded-2xl flex items-center justify-center shadow-lg border border-content">
                <GitBranch className="w-10 h-10 text-primary" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                <Sparkles className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>

            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full border border-primary/20">
                <Clock className="w-3.5 h-3.5" />
                <span className="text-2xs font-bold uppercase tracking-widest">Coming Soon</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                Visual Flow Builder
              </h3>
              <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
                The visual flow builder is under development. You will soon be able to drag, drop, and connect automation steps into complete Instagram conversation journeys.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default FlowView;
