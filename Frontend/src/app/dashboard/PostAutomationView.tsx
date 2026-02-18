import React, { useState, useEffect, useCallback } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ChevronRight, AlertCircle, CheckCircle2, LayoutTemplate } from 'lucide-react';

interface ReplyTemplate {
  id: string;
  template_type: string;
  template_data?: any;
}

const PostAutomationView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, activeAccount, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [replyTemplatesList, setReplyTemplatesList] = useState<ReplyTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleTemplatesLoaded = useCallback((templates: ReplyTemplate[]) => {
    setReplyTemplatesList(templates);
  }, []);

  const handleCreateAutomation = (media: any) => {
    setSelectedMedia(media);
    setSelectedTemplateId('');
    setError(null);
    setSuccess(null);
  };

  const handleBack = () => {
    setSelectedMedia(null);
    setSelectedTemplateId('');
    setHasUnsavedChanges(false);
  };

  const handleEditorChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setSelectedMedia(null);
    setSelectedTemplateId('');
    setSuccess('Automation saved successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Track unsaved changes when automation editor is open
  useEffect(() => {
    if (selectedMedia) {
      setSaveUnsavedChanges(() => async () => {
        return true;
      });
      setDiscardUnsavedChanges(() => {
        handleBack();
      });
    } else {
      setHasUnsavedChanges(false);
    }
  }, [selectedMedia, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

  useEffect(() => {
    if (!activeAccountID) return;
    const targetId = sessionStorage.getItem('openAutomationId');
    const targetType = sessionStorage.getItem('openAutomationType');
    if (!targetId || !['comment', 'post'].includes((targetType || '').toLowerCase())) return;

    sessionStorage.removeItem('openAutomationId');
    sessionStorage.removeItem('openAutomationType');

    (async () => {
      try {
        const res = await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${targetId}?account_id=${activeAccountID}&type=comment`);
        if (res.ok) {
          const data = await res.json();
          const mediaId = data.media_id || data.mediaId || data.media?.id;
          if (!mediaId) {
            setError('Could not open automation: media not found.');
            return;
          }
          setSelectedMedia({
            id: mediaId,
            automation_id: targetId,
            caption: data.caption || data.media_caption || ''
          });
        } else {
          setError('Could not open automation.');
        }
      } catch (_) {
        setError('Could not open automation.');
      }
    })();
  }, [activeAccountID, authenticatedFetch]);

  if (selectedMedia && activeAccountID) {
    return (
      <div className="max-w-[1400px] mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-8 min-h-screen">
        <div className="flex items-center justify-between border-b border-content pb-6">
          <button onClick={handleBack} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors">
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Dashboard
          </button>
          <div className="flex items-center gap-3">
            {error && (
              <div className="flex items-center gap-2 px-3 py-1 bg-destructive-muted/40 text-destructive rounded-lg text-[10px] font-black border border-destructive/30 animate-in fade-in slide-in-from-right-2">
                <AlertCircle className="w-3 h-3" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 px-3 py-1 bg-success-muted/60 text-success rounded-lg text-[10px] font-black border border-success/30 animate-in fade-in slide-in-from-right-2">
                <CheckCircle2 className="w-3 h-3" /> {success}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 xl:h-[calc(100vh-11rem)] xl:min-h-0">
          {/* Left: Editor - scrollable on xl */}
          <div className="xl:col-span-8 space-y-8 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
            <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8">
              <AutomationEditor
                type="posts"
                variant="embedded"
                activeAccountID={activeAccountID}
                authenticatedFetch={authenticatedFetch}
                automationId={selectedMedia?.automation_id}
                mediaId={selectedMedia?.id}
                onClose={handleBack}
                onSave={handleSave}
                onDelete={selectedMedia?.automation_id ? async (id) => {
                  await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}&type=comment`, {
                    method: 'DELETE'
                  });
                  handleSave();
                } : undefined}
                onChange={handleEditorChange}
                onTemplateSelect={(templateId) => setSelectedTemplateId(templateId || '')}
                onTemplatesLoaded={handleTemplatesLoaded}
                titleOverride=""
              />
            </section>
          </div>

          {/* Right: Live Preview */}
          <div className="xl:col-span-4 order-1 xl:order-2">
            <div className="xl:sticky xl:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
              <div className="fixed top-4 right-4 z-[200] space-y-2 pointer-events-none">
                {success && (
                  <div className="bg-success text-success-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">{success}</span>
                  </div>
                )}
                {error && (
                  <div className="bg-destructive text-destructive-foreground px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-in slide-in-from-right fade-in duration-300 pointer-events-auto">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-bold text-sm">{error}</span>
                  </div>
                )}
              </div>

              {/* Live Preview */}
              <div className="space-y-4">
                {selectedTemplateId ? (
                  (() => {
                    const template = replyTemplatesList.find(t => t.id === selectedTemplateId);
                    if (template) {
                      const displayName = activeAccount?.username || 'your_account';
                      const profilePic = activeAccount?.profile_picture_url || null;

                      const previewAutomation = {
                        template_type: template.template_type as any,
                        template_content: template.template_type === 'template_text' ? template.template_data?.text :
                          template.template_type === 'template_media' ? template.template_data?.media_url :
                            template.template_type === 'template_quick_replies' ? template.template_data?.text : undefined,
                        template_elements: template.template_type === 'template_carousel' ? template.template_data?.elements : undefined,
                        replies: template.template_type === 'template_quick_replies' ? template.template_data?.replies : undefined,
                        buttons: template.template_type === 'template_buttons' ? template.template_data?.buttons : undefined,
                        media_id: template.template_type === 'template_share_post' ? template.template_data?.media_id : undefined,
                        media_url: template.template_type === 'template_share_post' ? template.template_data?.media_url : undefined,
                        use_latest_post: template.template_type === 'template_share_post' ? template.template_data?.use_latest_post : undefined,
                        latest_post_type: template.template_type === 'template_share_post' ? template.template_data?.latest_post_type : undefined,
                        keyword: selectedMedia?.caption || 'Post comment',
                        template_data: template.template_data
                      };

                      return (
                        <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                          <SharedMobilePreview
                            mode="automation"
                            automation={previewAutomation}
                            displayName={displayName}
                            profilePic={profilePic || undefined}
                          />
                        </div>
                      );
                    }
                    return null;
                  })()
                ) : (
                  <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                    <SharedMobilePreview
                      mode="automation"
                      automation={{ keyword: selectedMedia?.caption || 'Post comment' }}
                      displayName={activeAccount?.username || 'your_account'}
                      profilePic={activeAccount?.profile_picture_url || undefined}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <MediaSection
        title="Post Automation"
        type="post"
        onCreateAutomation={handleCreateAutomation}
      />
    </div>
  );
};

export default PostAutomationView;
