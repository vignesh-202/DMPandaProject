import React from 'react';
import { Globe, Link as LinkIcon } from 'lucide-react';

export type SocialIconId =
  | 'youtube'
  | 'facebook'
  | 'whatsapp'
  | 'instagram'
  | 'telegram'
  | 'discord'
  | 'tiktok'
  | 'x'
  | 'linkedin'
  | 'snapchat'
  | 'pinterest'
  | 'reddit'
  | 'spotify'
  | 'github'
  | 'internet'
  | 'link';

type SocialIconDef =
  | { id: SocialIconId; label: string; kind: 'simple'; slug: string }
  | { id: SocialIconId; label: string; kind: 'lucide'; icon: React.ElementType }
  | { id: SocialIconId; label: string; kind: 'svg'; viewBox: string; path: string };

const SIMPLE_ICON_COLOR = '0f172a';
const simpleIconUrl = (slug: string, color: string) => `https://cdn.simpleicons.org/${slug}/${color}`;

export const SOCIAL_ICONS: SocialIconDef[] = [
  { id: 'youtube', label: 'YouTube', kind: 'simple', slug: 'youtube' },
  { id: 'facebook', label: 'Facebook', kind: 'simple', slug: 'facebook' },
  { id: 'whatsapp', label: 'WhatsApp', kind: 'simple', slug: 'whatsapp' },
  { id: 'instagram', label: 'Instagram', kind: 'simple', slug: 'instagram' },
  { id: 'telegram', label: 'Telegram', kind: 'simple', slug: 'telegram' },
  { id: 'discord', label: 'Discord', kind: 'simple', slug: 'discord' },
  { id: 'tiktok', label: 'TikTok', kind: 'simple', slug: 'tiktok' },
  { id: 'x', label: 'X', kind: 'simple', slug: 'x' },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    kind: 'svg',
    viewBox: '0 0 24 24',
    path: 'M20.447 20.452h-3.554V14.85c0-1.337-.027-3.059-1.865-3.059-1.865 0-2.15 1.454-2.15 2.959v5.702H9.324V9h3.414v1.561h.046c.476-.9 1.637-1.85 3.37-1.85 3.6 0 4.264 2.368 4.264 5.455v6.286zM5.337 7.433c-1.144 0-2.07-.926-2.07-2.07 0-1.145.926-2.07 2.07-2.07 1.145 0 2.07.925 2.07 2.07 0 1.144-.925 2.07-2.07 2.07zM6.814 20.452H3.86V9h2.954v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.727v20.545C0 23.226.792 24 1.771 24h20.451C23.2 24 24 23.226 24 22.273V1.727C24 .774 23.2 0 22.222 0h.003z'
  },
  { id: 'snapchat', label: 'Snapchat', kind: 'simple', slug: 'snapchat' },
  { id: 'pinterest', label: 'Pinterest', kind: 'simple', slug: 'pinterest' },
  { id: 'reddit', label: 'Reddit', kind: 'simple', slug: 'reddit' },
  { id: 'spotify', label: 'Spotify', kind: 'simple', slug: 'spotify' },
  { id: 'github', label: 'GitHub', kind: 'simple', slug: 'github' },
  { id: 'internet', label: 'Internet', kind: 'lucide', icon: Globe },
  { id: 'link', label: 'Link', kind: 'lucide', icon: LinkIcon },
];

export const getSocialIcon = (id?: string) => SOCIAL_ICONS.find((icon) => icon.id === id);

export const SocialIcon: React.FC<{ id?: string; className?: string; color?: string }> = ({ id, className, color }) => {
  const icon = getSocialIcon(id);
  const resolvedColor = (color || SIMPLE_ICON_COLOR).replace('#', '');
  if (!icon) {
    const Fallback = LinkIcon;
    return <Fallback className={className} />;
  }
  if (icon.kind === 'simple') {
    return (
      <img
        src={simpleIconUrl(icon.slug, resolvedColor)}
        alt={icon.label}
        className={`${className || ''} dark:invert dark:brightness-200`}
        loading="lazy"
      />
    );
  }
  if (icon.kind === 'svg') {
    return (
      <svg viewBox={icon.viewBox} className={className} aria-label={icon.label}>
        <path d={icon.path} fill="currentColor" />
      </svg>
    );
  }
  const Icon = icon.icon;
  return <Icon className={className} />;
};
