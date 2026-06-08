import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightRail from './RightRail';
import BottomNav from './BottomNav';
import PostComposerModal from '@/components/post/PostComposerModal';
import StoryComposer from '@/components/story/StoryComposer';
import StoryViewer from '@/components/story/StoryViewer';

export default function AppLayout() {
  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar />
      {/* pb-16 keeps content clear of the fixed BottomNav on mobile. */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>
      <RightRail />
      <BottomNav />
      {/* Global post composer — opened from Sidebar / BottomNav / Profile. */}
      <PostComposerModal />
      {/* Global story composer + viewer — opened from the StoryBar. */}
      <StoryComposer />
      <StoryViewer />
    </div>
  );
}
