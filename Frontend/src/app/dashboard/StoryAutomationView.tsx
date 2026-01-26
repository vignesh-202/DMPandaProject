import React from 'react';
import MediaSection from '../../components/dashboard/MediaSection';

const StoryAutomationView: React.FC = () => {
  const handleCreateAutomation = (media: any) => {
    console.log('Create automation for story:', media);
    // TODO: Implement automation creation logic or modal
    alert(`Create automation for Story ${media.id}`);
  };

  return (
    <MediaSection
      title="Story Automation"
      type="story"
      onCreateAutomation={handleCreateAutomation}
    />
  );
};

export default StoryAutomationView;