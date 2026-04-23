export interface NormalizedAutomationKeywords {
  keywords: string[];
  primaryKeyword: string;
}

export function normalizeAutomationKeywords(source: any): NormalizedAutomationKeywords {
  const candidates = [
    source?.keywords,
    source?.keyword,
    source?.trigger_keyword
  ];

  let values: unknown[] = [];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      values = candidate;
      break;
    }
    if (typeof candidate === 'string' && candidate.trim()) {
      values = candidate.split(',');
      break;
    }
  }

  const keywords = values
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  return {
    keywords,
    primaryKeyword: keywords[0] || ''
  };
}

export function getAutomationPreviewKeyword(source: any, fallback = 'Keyword'): string {
  const { keywords, primaryKeyword } = normalizeAutomationKeywords(source);
  return keywords[keywords.length - 1] || primaryKeyword || fallback;
}
