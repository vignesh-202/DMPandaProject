const RESTRICTED_PREVIEW_HOST_PATTERN = /(?:cdninstagram\.com|fbcdn\.net)/i;

type AuthenticatedFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const latestSharePostPreviewCache = new Map<string, Record<string, unknown> | null>();
const latestSharePostPreviewPromiseCache = new Map<string, Promise<Record<string, unknown> | null>>();
const selectedSharePostPreviewCache = new Map<string, Record<string, unknown> | null>();
const selectedSharePostPreviewPromiseCache = new Map<string, Promise<Record<string, unknown> | null>>();

const toPreviewString = (value: unknown) => String(value || '').trim();

export const parseTemplatePreviewData = (value: unknown) => {
  if (!value) return {};
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }
  return typeof value === 'object' ? value : {};
};

const collectPreviewCandidates = (...values: unknown[]) =>
  values
    .map((value) => toPreviewString(value))
    .filter(Boolean);

const getSharePostTemplateData = (source?: any) => parseTemplatePreviewData(source?.template_data);

export const isSharePostVideoSource = (source?: any) => {
  const templateData = getSharePostTemplateData(source);
  const mediaType = toPreviewString(source?.media_type || templateData?.media_type).toUpperCase();
  const latestPostType = toPreviewString(source?.latest_post_type || templateData?.latest_post_type).toLowerCase();
  return mediaType === 'VIDEO' || latestPostType === 'reel';
};

export const toBrowserPreviewUrl = (url: string) => {
  const normalizedUrl = toPreviewString(url);
  if (!normalizedUrl) return '';
  if (!isRestrictedPreviewMediaUrl(normalizedUrl)) return normalizedUrl;

  const apiBase = String(import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!apiBase) return normalizedUrl;

  return `${apiBase}/api/instagram/media-proxy?url=${encodeURIComponent(normalizedUrl)}`;
};

export const isRestrictedPreviewMediaUrl = (url?: string | null) =>
  !!toPreviewString(url) && RESTRICTED_PREVIEW_HOST_PATTERN.test(String(url));

export const canBrowserRenderPreviewUrl = (url?: string | null) =>
  !!toPreviewString(url) && !isRestrictedPreviewMediaUrl(url);

const selectSharePostCandidate = (candidates: string[]) => {
  const selectedUrl = candidates.find((url) => !isRestrictedPreviewMediaUrl(url)) || candidates[0] || '';
  return toBrowserPreviewUrl(selectedUrl);
};

export const getPreferredSharePostImageUrl = (source?: any) => {
  const templateData = getSharePostTemplateData(source);
  return selectSharePostCandidate(collectPreviewCandidates(
    source?.preview_media_url,
    templateData?.preview_media_url,
    source?.thumbnail_url,
    templateData?.thumbnail_url,
    source?.linked_media_url,
    templateData?.linked_media_url,
    source?.media_url,
    templateData?.media_url
  ));
};

export const getPreferredSharePostVideoUrl = (source?: any) => {
  const templateData = getSharePostTemplateData(source);
  return selectSharePostCandidate(collectPreviewCandidates(
    source?.linked_media_url,
    templateData?.linked_media_url,
    source?.media_url,
    templateData?.media_url,
    source?.preview_media_url,
    templateData?.preview_media_url,
    source?.thumbnail_url,
    templateData?.thumbnail_url
  ));
};

export const getPreferredSharePostPreviewUrl = (source?: any) =>
  isSharePostVideoSource(source)
    ? getPreferredSharePostVideoUrl(source) || getPreferredSharePostImageUrl(source)
    : getPreferredSharePostImageUrl(source);

export const resolveLatestSharePostPreview = async ({
  activeAccountID,
  authenticatedFetch,
  latestPostType = 'post'
}: {
  activeAccountID?: string | null;
  authenticatedFetch?: AuthenticatedFetch;
  latestPostType?: 'post' | 'reel';
}) => {
  if (!activeAccountID || !authenticatedFetch) return null;

  const normalizedType = latestPostType === 'reel' ? 'reel' : 'post';
  const cacheKey = `${activeAccountID}:${normalizedType}`;

  if (latestSharePostPreviewCache.has(cacheKey)) {
    return latestSharePostPreviewCache.get(cacheKey) || null;
  }

  if (latestSharePostPreviewPromiseCache.has(cacheKey)) {
    return latestSharePostPreviewPromiseCache.get(cacheKey) || null;
  }

  const requestPromise = (async () => {
    try {
      const mediaType = normalizedType === 'reel' ? 'reels' : 'posts';
      const url = `${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?account_id=${encodeURIComponent(activeAccountID)}&type=${mediaType}&limit=25`;
      const res = await authenticatedFetch(url);

      if (!res.ok) {
        latestSharePostPreviewCache.set(cacheKey, null);
        return null;
      }

      const payload = await res.json().catch(() => ({}));
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const latestItem = [...items]
        .sort((a, b) => new Date(b?.timestamp || 0).getTime() - new Date(a?.timestamp || 0).getTime())[0];

      if (!latestItem) {
        latestSharePostPreviewCache.set(cacheKey, null);
        return null;
      }

      const previewUrl = latestItem.thumbnail_url || latestItem.media_url || '';
      const normalized = {
        media_id: latestItem.id || '',
        media_url: latestItem.media_url || previewUrl || '',
        thumbnail_url: previewUrl || '',
        preview_media_url: previewUrl || '',
        linked_media_url: latestItem.media_url || '',
        caption: latestItem.caption || '',
        media_type: latestItem.media_type || '',
        permalink: latestItem.permalink || '',
        latest_post_type: normalizedType,
        use_latest_post: true
      };

      latestSharePostPreviewCache.set(cacheKey, normalized);
      return normalized;
    } catch (_) {
      latestSharePostPreviewCache.set(cacheKey, null);
      return null;
    } finally {
      latestSharePostPreviewPromiseCache.delete(cacheKey);
    }
  })();

  latestSharePostPreviewPromiseCache.set(cacheKey, requestPromise);
  return requestPromise;
};

export const resolveSelectedSharePostPreview = async ({
  activeAccountID,
  authenticatedFetch,
  mediaId
}: {
  activeAccountID?: string | null;
  authenticatedFetch?: AuthenticatedFetch;
  mediaId?: string | null;
}) => {
  const normalizedMediaId = toPreviewString(mediaId);
  if (!activeAccountID || !authenticatedFetch || !normalizedMediaId) return null;

  const cacheKey = `${activeAccountID}:${normalizedMediaId}`;

  if (selectedSharePostPreviewCache.has(cacheKey)) {
    return selectedSharePostPreviewCache.get(cacheKey) || null;
  }

  if (selectedSharePostPreviewPromiseCache.has(cacheKey)) {
    return selectedSharePostPreviewPromiseCache.get(cacheKey) || null;
  }

  const requestPromise = (async () => {
    try {
      const url = `${import.meta.env.VITE_API_BASE_URL}/api/instagram/media?account_id=${encodeURIComponent(activeAccountID)}&type=all&limit=100&sort=recent`;
      const res = await authenticatedFetch(url);

      if (!res.ok) {
        selectedSharePostPreviewCache.set(cacheKey, null);
        return null;
      }

      const payload = await res.json().catch(() => ({}));
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const matchedItem = items.find((item: any) => toPreviewString(item?.id) === normalizedMediaId);

      if (!matchedItem) {
        selectedSharePostPreviewCache.set(cacheKey, null);
        return null;
      }

      const previewUrl = matchedItem.thumbnail_url || matchedItem.media_url || '';
      const normalized = {
        media_id: matchedItem.id || normalizedMediaId,
        media_url: matchedItem.media_url || previewUrl || '',
        thumbnail_url: previewUrl || '',
        preview_media_url: previewUrl || '',
        linked_media_url: matchedItem.media_url || '',
        caption: matchedItem.caption || '',
        media_type: matchedItem.media_type || '',
        permalink: matchedItem.permalink || '',
        latest_post_type: matchedItem.media_type === 'VIDEO' ? 'reel' : 'post',
        use_latest_post: false
      };

      selectedSharePostPreviewCache.set(cacheKey, normalized);
      return normalized;
    } catch (_) {
      selectedSharePostPreviewCache.set(cacheKey, null);
      return null;
    } finally {
      selectedSharePostPreviewPromiseCache.delete(cacheKey);
    }
  })();

  selectedSharePostPreviewPromiseCache.set(cacheKey, requestPromise);
  return requestPromise;
};

export const buildPreviewAutomationFromTemplate = (
  template?: { template_type?: string | null; type?: string | null; template_data?: any } | null
) => {
  const templateType = String(template?.template_type || template?.type || '').trim();
  if (!templateType) return null;

  const data = parseTemplatePreviewData(template?.template_data);
  const preferredSharePostUrl = getPreferredSharePostPreviewUrl({ template_data: data });

  return {
    template_type: templateType as any,
    template_content:
      templateType === 'template_text'
        ? data.text
        : templateType === 'template_media'
          ? data.media_url
          : templateType === 'template_quick_replies'
            ? data.text
            : undefined,
    template_elements: templateType === 'template_carousel' ? data.elements : undefined,
    replies: templateType === 'template_quick_replies' ? data.replies : undefined,
    buttons:
      templateType === 'template_buttons' || templateType === 'template_media'
        ? data.buttons
        : undefined,
    media_id: templateType === 'template_share_post' ? data.media_id : undefined,
    media_url: templateType === 'template_share_post' ? preferredSharePostUrl : undefined,
    thumbnail_url: templateType === 'template_share_post' ? data.thumbnail_url : undefined,
    preview_media_url: templateType === 'template_share_post' ? data.preview_media_url : undefined,
    linked_media_url: templateType === 'template_share_post' ? data.linked_media_url : undefined,
    caption: templateType === 'template_share_post' ? data.caption : undefined,
    media_type: templateType === 'template_share_post' ? data.media_type : undefined,
    permalink: templateType === 'template_share_post' ? data.permalink : undefined,
    use_latest_post: templateType === 'template_share_post' ? data.use_latest_post : undefined,
    latest_post_type: templateType === 'template_share_post' ? data.latest_post_type : undefined,
    template_data: data
  };
};
