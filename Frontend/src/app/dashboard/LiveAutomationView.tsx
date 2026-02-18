import React, { useState, useEffect } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';

const LiveAutomationView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateAutomation = (media: any) => {
    setSelectedMedia(media);
    setError(null);
  };

  const handleEditorChange = () => {
    setHasUnsavedChanges(true);
  };

  // Track unsaved changes when automation editor is open
  useEffect(() => {
    if (selectedMedia) {
      setSaveUnsavedChanges(() => async () => {
        // Since the AutomationEditor handles its own saving, we just need to wait for it to complete
        return true;
      });
      setDiscardUnsavedChanges(() => () => {
        setSelectedMedia(null);
      });
    } else {
      setHasUnsavedChanges(false);
    }
  }, [selectedMedia, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges]);

  useEffect(() => {
    if (!activeAccountID) return;
    const targetId = sessionStorage.getItem('openAutomationId');
    const targetType = sessionStorage.getItem('openAutomationType');
    if (!targetId || (targetType || '').toLowerCase() !== 'live') return;

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
          setError(null);
        } else {
          setError('Could not open automation.');
        }
      } catch (_) {
        setError('Could not open automation.');
      }
    })();
  }, [activeAccountID, authenticatedFetch]);

  return (
    <div className="relative h-full">
      {error && (
        <div className="mx-auto max-w-5xl p-3 sm:p-4 md:p-6">
          <div className="p-4 rounded-2xl bg-destructive-muted/40 border border-destructive/30 text-destructive text-sm font-bold">
            {error}
          </div>
        </div>
      )}
      <MediaSection
        title="Live Automation"
        type="live"
        onCreateAutomation={handleCreateAutomation}
      />

      {selectedMedia && activeAccountID && (
        <AutomationEditor
          type="live" // Specific type for live
          isStandalone={true}
          activeAccountID={activeAccountID}
          authenticatedFetch={authenticatedFetch}
          automationId={selectedMedia?.automation_id}
          onClose={() => setSelectedMedia(null)}
          onSave={() => {
            setSelectedMedia(null);
          }}
          onDelete={async (id) => {
            await authenticatedFetch(`${import.meta.env.VITE_API_BASE_URL}/api/instagram/automations/${id}?account_id=${activeAccountID}&type=comment`, {
              method: 'DELETE'
            });
          }}
          onChange={handleEditorChange}
        />
      )}
    </div>
  );
};

export default LiveAutomationView;
