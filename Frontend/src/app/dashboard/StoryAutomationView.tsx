import React, { useState, useEffect } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { Info, Share2 } from 'lucide-react';

const StoryAutomationView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [notShownEditorOpen, setNotShownEditorOpen] = useState(false);

  const handleCreateAutomation = (media: any) => {
    setSelectedMedia(media);
    setNotShownEditorOpen(false);
  };

  const openNotShownEditor = () => {
    setSelectedMedia(null);
    setNotShownEditorOpen(true);
  };

  const isEditorOpen = (selectedMedia || notShownEditorOpen) && activeAccountID;
  const isForNotShown = notShownEditorOpen && !selectedMedia;

  const handleEditorChange = () => {
    setHasUnsavedChanges(true);
  };

  // Track unsaved changes when automation editor is open
  useEffect(() => {
    if (isEditorOpen) {
      setSaveUnsavedChanges(() => async () => {
        // Since the AutomationEditor handles its own saving, we just need to wait for it to complete
        return true;
      });
      setDiscardUnsavedChanges(() => () => {
        setSelectedMedia(null);
        setNotShownEditorOpen(false);
      });
    } else {
      setHasUnsavedChanges(false);
    }
  }, [isEditorOpen, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

  return (
    <div className="relative h-full space-y-8">
      {/* Note: what is shown vs not shown */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-3 p-4 sm:p-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-2xl">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-1">What appears here</h3>
          <p className="text-sm text-blue-800 dark:text-blue-300/90 leading-relaxed">
            <strong>Shown:</strong> Stories that are your own—for example, when you share your own reels, your own posts from your Instagram profile, or your own images. 
            <strong className="block mt-1">Not shown:</strong> If you share someone else&apos;s post or reel to your story, those stories will not appear here.
          </p>
        </div>
      </div>

      {/* Option 1: Setup automation for stories SHOWN here */}
      <section>
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">1.</span> Setup automation for stories shown here
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
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
        <h2 className="text-lg font-black text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">2.</span> Setup automation for stories not shown here
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          When you share someone else&apos;s post or reel to your story, Instagram does not make that story available to us, so it won&apos;t appear in the list above. You can set a default reply for those story replies here.
        </p>
        <div className="p-6 sm:p-8 bg-white dark:bg-gray-950 border border-content rounded-2xl flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Share2 className="w-7 h-7 text-slate-500 dark:text-slate-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-900 dark:text-white mb-1">Stories with shared posts or reels</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Set up a default auto-reply when someone replies to a story where you shared another account&apos;s post or reel.
            </p>
          </div>
          {activeAccountID && (
            <button
              onClick={openNotShownEditor}
              className="flex-shrink-0 px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-xs uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
              Setup automation
            </button>
          )}
        </div>
      </section>

      {/* Automation editors: for shown (selected media) or for not-shown */}
      {isEditorOpen && activeAccountID && (
        <AutomationEditor
          type="story"
          isStandalone={true}
          activeAccountID={activeAccountID}
          authenticatedFetch={authenticatedFetch}
          automationId={isForNotShown ? undefined : selectedMedia?.automation_id}
          mediaId={isForNotShown ? undefined : selectedMedia?.id}
          onClose={() => {
            setSelectedMedia(null);
            setNotShownEditorOpen(false);
          }}
          onSave={() => {
            setSelectedMedia(null);
            setNotShownEditorOpen(false);
          }}
          onDelete={async (id) => {
            await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}&type=comment`, {
              method: 'DELETE'
            });
          }}
          titleOverride={isForNotShown ? 'Story replies (shared from others)' : undefined}
          onChange={handleEditorChange}
        />
      )}
    </div>
  );
};

export default StoryAutomationView;
