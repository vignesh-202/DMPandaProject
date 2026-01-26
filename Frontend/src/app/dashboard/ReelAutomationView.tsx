import React from 'react';
import MediaSection from '../../components/dashboard/MediaSection';

const ReelAutomationView: React.FC = () => {
  const handleCreateAutomation = (media: any) => {
    console.log('Create automation for reel:', media);
    // TODO: Implement automation creation logic or modal
    alert(`Create automation for Reel ${media.id}`);
  };

  return (
    <MediaSection
      title="Reels Automation"
      type="reel"
      onCreateAutomation={handleCreateAutomation}
    />
  );
};

export default ReelAutomationView;