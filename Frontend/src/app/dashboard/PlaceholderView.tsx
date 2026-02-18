import React from 'react';
import Card from '../../components/ui/card';
import { Rocket, Sparkles, Clock, ExternalLink } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  docHref?: string;
  docLabel?: string;
}

const PlaceholderView: React.FC<PlaceholderViewProps> = ({
  title,
  description = `Our team is engineering the next generation of ${title} intelligence. Advanced automation protocols and real-time syncing will be available in the upcoming update.`,
  icon = <Rocket className="w-12 h-12 text-primary" />,
  docHref,
  docLabel = 'Read the documentation',
}) => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 min-h-[600px] relative overflow-hidden animate-fadeIn">
      {/* Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 blur-[120px] rounded-full animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 blur-[120px] rounded-full animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <Card 
        className="w-full max-w-2xl overflow-hidden border border-content shadow-lg rounded-3xl bg-card/80 backdrop-blur-xl relative z-10"
        padding="none"
      >
        {/* Top Gradient Line */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/0 via-primary/50 to-primary/0" />

        <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-8">
          {/* Icon Section */}
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-125 animate-pulse" />
            <div className="relative w-24 h-24 bg-card rounded-2xl flex items-center justify-center shadow-lg border border-content group hover:scale-105 transition-transform duration-500">
              {icon}
            </div>
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
          </div>

          {/* Content Section */}
          <div className="space-y-4">
            {/* Status Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full border border-primary/20">
              <Clock className="w-4 h-4" />
              <span className="text-2xs font-bold uppercase tracking-widest">Engineering Protocol Active</span>
            </div>

            {/* Title */}
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {title}
            </h2>

            {/* Description */}
            <p className="text-muted-foreground text-base sm:text-lg leading-relaxed max-w-md mx-auto">
              {description}
            </p>
          </div>

          {/* Doc link (optional) */}
          {docHref && (
            <a
              href={docHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-medium text-sm transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {docLabel}
            </a>
          )}

          {/* Status Indicator */}
          <div className="pt-6">
            <div className="px-6 py-3 rounded-xl bg-muted border border-content flex items-center gap-3">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-primary animate-ping" />
              </div>
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-widest">Alpha Phase Testing</span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PlaceholderView;
