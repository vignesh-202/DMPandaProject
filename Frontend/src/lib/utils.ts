import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { TemplateData, TemplateType } from "../components/dashboard/SharedTemplateEditor"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Get default template data based on template type.
 * Matches the defaults used in SuggestMoreView for consistency.
 */
export function getDefaultTemplateData(templateType: TemplateType): TemplateData {
  switch (templateType) {
    case 'template_text':
      return { text: '' };
    case 'template_carousel':
      return {
        elements: [{
          title: '',
          subtitle: '',
          image_url: '',
          buttons: [{ title: '', url: '', type: 'web_url' }]
        }]
      };
    case 'template_buttons':
      return {
        text: '',
        buttons: [{ title: '', url: '', type: 'web_url' }]
      };
    case 'template_media':
      return { media_url: '' };
    case 'template_share_post':
      return { media_id: '', media_url: '' };
    case 'template_quick_replies':
      return {
        text: '',
        replies: [{ title: '', payload: '', content_type: 'text' }]
      };
    default:
      return { text: '' };
  }
}