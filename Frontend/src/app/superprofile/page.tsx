import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import DashboardLoading from '../../components/ui/DashboardLoading';
import { SocialIcon } from '../../lib/superProfileIcons';

interface PublicProfile {
  slug: string;
  buttons: Array<{ id?: string; title: string; url: string; icon?: string }>;
  username?: string;
  profile_picture_url?: string;
  name?: string;
}

const SuperProfilePublicPage: React.FC = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      } catch (e) {
        setError('Network error.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [slug]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!profile) return;
    const title = profile.username
      ? `@${profile.username} • Super Profile`
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

  if (loading) {
    return (
      <>
        <a href="/" className="fixed top-4 left-4 z-[210]" aria-label="DM Panda home">
          <img
            src="/images/logo.png"
            alt="DM Panda"
            className="h-10 w-auto sm:h-11"
          />
        </a>
        <DashboardLoading />
      </>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
        {motionStyles}
        <a href="/" className="fixed top-4 left-4 z-20" aria-label="DM Panda home">
          <img
            src="/images/logo.png"
            alt="DM Panda"
            className="h-10 w-auto sm:h-11"
          />
        </a>
        <div className="sp-blob absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
        <div className="sp-blob sp-blob-delayed absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-emerald-200/40 blur-3xl" />
        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
          <div className="sp-card w-full max-w-md rounded-[28px] border border-slate-200/70 bg-white/80 backdrop-blur-xl p-7 sm:p-9 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-center mb-5">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center text-sm font-black">
                404
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mb-2">Profile not found</div>
            <p className="text-sm text-slate-500">This Super Profile doesn’t exist or isn’t public.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {motionStyles}
      <a href="/" className="fixed top-4 left-4 z-20" aria-label="DM Panda home">
        <img
          src="/images/logo.png"
          alt="DM Panda"
          className="h-10 w-auto sm:h-11"
        />
      </a>

      <div className="sp-blob absolute -top-24 -right-24 h-64 w-64 rounded-full bg-amber-200/40 blur-3xl" />
      <div className="sp-blob sp-blob-delayed absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="sp-blob sp-blob-slow absolute top-1/3 -left-28 h-72 w-72 rounded-full bg-emerald-200/30 blur-3xl" />

      <div className="relative z-10 min-h-screen flex items-start justify-center px-4 pt-16 pb-12 sm:pt-20 sm:pb-16">
        <div className="w-full max-w-2xl">
          <div className="sp-card rounded-[28px] border border-slate-200/70 bg-white/80 backdrop-blur-xl p-6 sm:p-8 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.45)]">
            <div className="flex flex-col items-center text-center gap-4 sm:gap-5">
              <div className="relative">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-tr from-amber-200/60 via-sky-200/60 to-emerald-200/60 blur-xl" />
                <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full bg-white p-[3px] shadow-lg">
                  <img
                    src={profile.profile_picture_url || '/images/logo.png'}
                    alt={profile.username || profile.slug}
                    className="h-full w-full rounded-full object-cover"
                  />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Super profile</p>
                <h1 className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">
                  {profile.name || (profile.username ? `@${profile.username}` : 'Super Profile')}
                </h1>
                {profile.username && (
                  <p className="text-sm font-semibold text-slate-500 mt-1">@{profile.username}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-slate-500">Live</span>
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
                    className="group flex items-center gap-3 p-4 sm:p-4.5 rounded-2xl border border-slate-200/80 bg-white/70 hover:bg-white hover:border-slate-300 transition-all duration-300 shadow-sm hover:shadow-md w-full"
                  >
                    <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center group-hover:scale-105 transition-transform">
                      <SocialIcon id={button.icon || 'internet'} className="h-4 w-4 text-white" color="ffffff" />
                    </div>
                    <span className="flex-1 min-w-0 text-sm sm:text-[15px] font-semibold text-slate-900 break-words">
                      {button.title || 'Visit Link'}
                    </span>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
                  </a>
                ))
              ) : (
                <div className="text-center text-sm text-slate-500 py-6">
                  No links available.
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-center">
              <a href="/" className="text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors">
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
