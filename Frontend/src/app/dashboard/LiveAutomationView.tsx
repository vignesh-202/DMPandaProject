import React, { useState, useEffect } from 'react';
import MediaSection from '../../components/dashboard/MediaSection';
import AutomationEditor from '../../components/dashboard/AutomationEditor';
import { useAuth } from '../../contexts/AuthContext';
import { useDashboard } from '../../contexts/DashboardContext';

const LiveAutomationView: React.FC = () => {
  const { authenticatedFetch } = useAuth();
  const { activeAccountID, setHasUnsavedChanges, setSaveUnsavedChanges, setDiscardUnsavedChanges } = useDashboard();
  const [selectedMedia, setSelectedMedia] = useState<any>(null);

  const handleCreateAutomation = (media: any) => {
    setSelectedMedia(media);
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

  return (
    <div className="relative h-full">
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