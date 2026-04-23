import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { SocialIcon } from '../../lib/superProfileIcons';

interface PublicProfile {
  slug: string;
  buttons: Array<{ id?: string; title: string; url: string; icon?: string }>;
  username?: string;
  profile_picture_url?: string;
  name?: string;
}

const PUBLIC_PROFILE_MIN_LOADING_MS = 3000;

const PublicSuperProfileLoading = ({ isDark }: { isDark: boolean }) => (
  <div className={`min-h-screen relative overflow-hidden ${isDark ? 'bg-slate-950 text-white' : 'bg-slate-50 text-slate-950'}`}>
    <div
      className={`absolute inset-0 ${isDark
        ? 'bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.14),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.14),transparent_28%)]'
        : 'bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(251,191,36,0.18),transparent_30%)]'}`}
    />
    <a href="/" className="fixed top-4 left-4 z-20" aria-label="DM Panda home">
      <img
        src="/images/logo.png"
        alt="DM Panda"
        className="h-10 w-auto sm:h-11"
      />
    </a>
    <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="relative">
          <div className={`absolute inset-0 rounded-full blur-3xl ${isDark ? 'bg-sky-400/20' : 'bg-primary/15'}`} />
          <img
            src="/images/logo.png"
            alt="DM Panda"
            className="relative h-24 w-24 animate-pulse object-contain drop-shadow-[0_18px_36px_rgba(15,23,42,0.18)]"
          />
        </div>
        <div>
          <p className="text-xl font-black">DM Panda</p>
          <p className={`mt-1 text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Opening Super Profile...</p>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '0ms' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '150ms' }} />
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  </div>
);

const SuperProfilePublicPage: React.FC = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minimumDelayDone, setMinimumDelayDone] = useState(false);
  const [isDark, setIsDark] = useState(false);

  const motionStyles = (
    <style>{`
      @keyframes spFloat {
        0% { transform: translate3d(0, 0, 0); }
        50% { transform: translate3d(0, -10px, 0); }
        100% { transform: translate3d(0, 0, 0); }
      }
      @keyframes spFadeUp {
        0% { opacity: 0; transform: translate3d(0, 12px, 0); }
        100% { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      .sp-blob { animation: spFloat 10s ease-in-out infinite; }
      .sp-blob-delayed { animation-delay: 1.5s; }
      .sp-blob-slow { animation-duration: 14s; }
      .sp-card { animation: spFadeUp 600ms ease-out both; }
      @media (prefers-reduced-motion: reduce) {
        .sp-blob, .sp-card { animation: none; }
      }
    `}</style>
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = (matches: boolean) => setIsDark(matches);
    applyTheme(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => applyTheme(event.matches);
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const timerId = window.setTimeout(() => setMinimumDelayDone(true), PUBLIC_PROFILE_MIN_LOADING_MS);
    return () => window.clearTimeout(timerId);
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    return () => {
      document.documentElement.style.colorScheme = '';
    };
  }, [isDark]);

  useEffect(() => {
    const run = async () => {
      if (!slug) {
        setError('Profile not found.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/public/superprofile/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          setError('Profile not found.');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setProfile(data);
      } catch (_) {
        setError('Network error.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [slug]);

  useEffect(() => {
    if (typeof document === 'undefined' || !profile) return;

    const title = profile.username
      ? `@${profile.username} | Super Profile`
      : 'Super Profile';
    document.title = title;

    const descriptionContent = profile.name
      ? `${profile.name}'s Super Profile links.`
      : 'Super Profile links.';

    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute('name', 'description');
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', descriptionContent);
  }, [profile]);

  if (loading || !minimumDelayDone) {
    return <PublicSuperProfileLoading isDark={isDark} />;
  }

  if (error || !profile) {
    return (
      <div className={`min-h-screen relative overflow-hidden ${isDark ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950' : 'bg-gradient-to-b from-slate-50 via-white to-slate-50'}`}>
        {motionStyles}
        <a href="/" className="fixed top-4 left-4 z-20" aria-label="DM Panda home">
          <img
            src="/images/logo.png"
            alt="DM Panda"
            className="h-10 w-auto sm:h-11"
          />
        </a>
        <div className={`sp-blob absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${isDark ? 'bg-amber-300/12' : 'bg-amber-200/40'}`} />
        <div className={`sp-blob sp-blob-delayed absolute -bottom-24 -left-24 h-72 w-72 rounded-full blur-3xl ${isDark ? 'bg-emerald-300/12' : 'bg-emerald-200/40'}`} />
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
          <div className={`sp-card w-full max-w-md rounded-[28px] border backdrop-blur-xl p-7 sm:p-9 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)] ${isDark ? 'border-slate-700/70 bg-slate-900/80 text-white' : 'border-slate-200/70 bg-white/80 text-slate-900'}`}>
            <div className="flex items-center justify-center mb-5">
              <div className={`h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-black ${isDark ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}>
                404
              </div>
            </div>
            <div className="text-2xl font-black mb-2">Profile not found</div>
            <p className={`text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>This Super Profile does not exist or is not public.</p>
          </div>
        </div>
      </div>
    );
  }

  const iconColor = isDark ? '0f172a' : 'ffffff';

  return (
    <div className={`min-h-screen relative overflow-hidden ${isDark ? 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white' : 'bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-950'}`}>
      {motionStyles}
      <a href="/" className="fixed top-4 left-4 z-20" aria-label="DM Panda home">
        <img
          src="/images/logo.png"
          alt="DM Panda"
          className="h-10 w-auto sm:h-11"
        />
      </a>

      <div className={`sp-blob absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl ${isDark ? 'bg-amber-300/12' : 'bg-amber-200/40'}`} />
      <div className={`sp-blob sp-blob-delayed absolute -bottom-28 left-1/3 h-72 w-72 rounded-full blur-3xl ${isDark ? 'bg-sky-300/12' : 'bg-sky-200/40'}`} />
      <div className={`sp-blob sp-blob-slow absolute top-1/3 -left-28 h-72 w-72 rounded-full blur-3xl ${isDark ? 'bg-emerald-300/10' : 'bg-emerald-200/30'}`} />

      <div className="relative z-10 min-h-screen flex items-start justify-center px-4 pt-16 pb-12 sm:pt-20 sm:pb-16">
        <div className="w-full max-w-2xl">
          <div className={`sp-card rounded-[28px] border backdrop-blur-xl p-6 sm:p-8 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.45)] ${isDark ? 'border-slate-700/70 bg-slate-900/82' : 'border-slate-200/70 bg-white/80'}`}>
            <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
              <div className="relative">
                <div className={`absolute -inset-2 rounded-full blur-xl ${isDark ? 'bg-gradient-to-tr from-amber-300/25 via-sky-300/25 to-emerald-300/25' : 'bg-gradient-to-tr from-amber-200/60 via-sky-200/60 to-emerald-200/60'}`} />
                <div className={`relative h-24 w-24 sm:h-28 sm:w-28 rounded-full p-[3px] shadow-lg ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                  <img
                    src={profile.profile_picture_url || '/images/logo.png'}
                    alt={profile.username || profile.slug}
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Super profile</p>
                <h1 className="mt-2 text-2xl sm:text-3xl font-black">
                  {profile.name || (profile.username ? `@${profile.username}` : 'Super Profile')}
                </h1>
                {profile.username && (
                  <p className={`text-sm font-semibold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>@{profile.username}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>Live</span>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              {profile.buttons?.length ? (
                profile.buttons.map((button, idx) => (
                  <a
                    key={button.id || `${button.title}-${idx}`}
                    href={button.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`group flex items-center gap-3 p-4 sm:p-4.5 rounded-2xl border transition-all duration-300 shadow-sm hover:shadow-md w-full ${isDark ? 'border-slate-700/80 bg-slate-950/70 hover:bg-slate-950 hover:border-slate-500' : 'border-slate-200/80 bg-white/70 hover:bg-white hover:border-slate-300'}`}
                  >
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform ${isDark ? 'bg-white text-slate-950' : 'bg-slate-900 text-white'}`}>
                      <SocialIcon id={button.icon || 'internet'} className="h-4 w-4" color={iconColor} />
                    </div>
                    <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-semibold break-words">
                      {button.title || 'Visit Link'}
                    </span>
                    <ExternalLink className={`w-4 h-4 transition-colors ${isDark ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-700'}`} />
                  </a>
                ))
              ) : (
                <div className={`text-center text-sm py-6 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                  No links available.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center">
              <a href="/" className={`text-xs font-semibold transition-colors ${isDark ? 'text-slate-300 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                Powered by <span className="font-black">DM Panda</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperProfilePublicPage;
