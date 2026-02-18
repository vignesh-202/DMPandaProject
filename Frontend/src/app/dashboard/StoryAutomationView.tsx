import React, { useState, useEffect, useCallback } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import SharedMobilePreview from '../../components/dashboard/SharedMobilePreview';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { ChevronRight, AlertCircle, CheckCircle2, LayoutTemplate, Info, Share2 } from 'lucide-react';
import Card from '../../components/ui/card';

interface ReplyTemplate {
  id: string;
  template_type: string;
  template_data?: any;
}

const StoryAutomationView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, activeAccount, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [notShownEditorOpen, setNotShownEditorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [replyTemplatesList, setReplyTemplatesList] = useState<ReplyTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditorOpen = (selectedMedia || notShownEditorOpen) && activeAccountID;
  const isForNotShown = notShownEditorOpen && !selectedMedia;

  const handleTemplatesLoaded = useCallback((templates: ReplyTemplate[]) => {
    setReplyTemplatesList(templates);
  }, []);

  const handleCreateAutomation = (media: any) => {
    setSelectedMedia(media);
    setNotShownEditorOpen(false);
    setSelectedTemplateId('');
    setError(null);
    setSuccess(null);
  };

  const openNotShownEditor = () => {
    setSelectedMedia(null);
    setNotShownEditorOpen(true);
    setError(null);
    setSuccess(null);
  };

  const handleBack = () => {
    setSelectedMedia(null);
    setNotShownEditorOpen(false);
    setSelectedTemplateId('');
    setHasUnsavedChanges(false);
  };

  const handleEditorChange = () => {
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    setSelectedMedia(null);
    setNotShownEditorOpen(false);
    setSelectedTemplateId('');
    setSuccess('Automation saved successfully!');
    setTimeout(() => setSuccess(null), 3000);
  };

  // Track unsaved changes
  useEffect(() => {
    if (isEditorOpen) {
      setSaveUnsavedChanges(() => async () => {
        return true;
      });
      setDiscardUnsavedChanges(() => {
        handleBack();
      });
    } else {
      setHasUnsavedChanges(false);
    }
  }, [isEditorOpen, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

  useEffect(() => {
    if (!activeAccountID) return;
    const targetId = sessionStorage.getItem('openAutomationId');
    const targetType = sessionStorage.getItem('openAutomationType');
    if (!targetId || (targetType || '').toLowerCase() !== 'story') return;

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
          setNotShownEditorOpen(false);
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

  if (isEditorOpen) {
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
          {/* Left: Editor */}
          <div className="xl:col-span-8 space-y-8 order-2 xl:order-1 xl:overflow-y-auto xl:overscroll-behavior-contain xl:min-h-0 xl:pr-2">
            <section className="bg-card p-8 rounded-[40px] border border-content shadow-sm space-y-8">
              <AutomationEditor
                type="story"
                variant="embedded"
                activeAccountID={activeAccountID}
                authenticatedFetch={authenticatedFetch}
                automationId={isForNotShown ? undefined : selectedMedia?.automation_id}
                mediaId={isForNotShown ? undefined : selectedMedia?.id}
                onClose={handleBack}
                onSave={handleSave}
                onDelete={async (id) => {
                  await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}&type=comment`, {
                    method: 'DELETE'
                  });
                  handleSave();
                }}
                titleOverride={isForNotShown ? 'Story replies (shared from others)' : undefined}
                onChange={handleEditorChange}
                onTemplateSelect={(templateId) => setSelectedTemplateId(templateId || '')}
                onTemplatesLoaded={handleTemplatesLoaded}
              />
            </section>
          </div>

          {/* Right: Live Preview */}
          <div className="xl:col-span-4 order-1 xl:order-2">
            <div className="xl:sticky xl:top-24 h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
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
                        keyword: selectedMedia?.caption || (isForNotShown ? 'Story Reply' : 'Story comment'),
                        template_data: template.template_data
                      };

                      return (
                        <SharedMobilePreview
                          mode="automation"
                          automation={previewAutomation}
                          displayName={displayName}
                          profilePic={profilePic || undefined}
                        />
                      );
                    }
                    return null;
                  })()
                ) : (
                  <div className="bg-muted/40 p-4 flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-border">
                    <SharedMobilePreview
                      mode="automation"
                      automation={{ keyword: selectedMedia?.caption || (isForNotShown ? 'Story Reply' : 'Story comment') }}
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
    <div className="relative h-full space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5 bg-primary/10 border border-primary/30 rounded-2xl">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Info className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-primary mb-1">What appears here</h3>
          <p className="text-sm text-primary/80 leading-relaxed">
            <strong>Shown:</strong> Stories that are your ownâ€”for example, when you share your own reels, your own posts from your Instagram profile, or your own images.
            <strong className="block mt-1">Not shown:</strong> If you share someone else&apos;s post or reel to your story, those stories will not appear here.
          </p>
        </div>
      </div>

      {/* Option 1: Setup automation for stories SHOWN here */}
      <section>
        <h2 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
          <span className="text-primary">1.</span> Setup automation for stories shown here
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Your own stories (reels, posts, or images) that we can fetch from Instagram.
        </p>
        <MediaSection
          title="Stories shown here"
          type="story"
          onCreateAutomation={handleCreateAutomation}
        />
      </section>

      {/* Option 2: Setup automation for stories NOT shown here */}
      <section>
        <h2 className="text-lg font-black text-foreground mb-1 flex items-center gap-2">
          <span className="text-primary">2.</span> Setup automation for stories not shown here
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          When you share someone else&apos;s post or reel to your story, Instagram does not make that story available to us, so it won&apos;t appear in the list above. You can set a default reply for those story replies here.
        </p>
        <div className="p-6 sm:p-8 bg-card border border-content rounded-2xl flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Share2 className="w-7 h-7 text-muted-foreground" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-foreground mb-1">Stories with shared posts or reels</h3>
            <p className="text-sm text-muted-foreground">
              Set up a default auto-reply when someone replies to a story where you shared another account&apos;s post or reel.
            </p>
          </div>
          {activeAccountID && (
            <button
              onClick={openNotShownEditor}
              className="flex-shrink-0 px-6 py-3 bg-foreground text-background rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              Setup automation
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default StoryAutomationView;

