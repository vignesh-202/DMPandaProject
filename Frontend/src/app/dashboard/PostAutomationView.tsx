import React from 'react';
import MediaSection from '../../components/dashboard/MediaSection';

const PostAutomationView: React.FC = () => {
  const handleCreateAutomation = (media: any) => {
    console.log('Create automation for post:', media);
    // TODO: Implement automation creation logic or modal
    alert(`Create automation for Post ${media.id}`);
  };

  return (
    <MediaSection
      title="Post Automation"
      type="post"
      onCreateAutomation={handleCreateAutomation}
    />
  );
};

export default PostAutomationView;