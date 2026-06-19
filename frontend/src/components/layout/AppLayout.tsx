import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import RightRail from './RightRail';
import BottomNav from './BottomNav';
import PostComposerModal from '@/components/post/PostComposerModal';
import StoryComposer from '@/components/story/StoryComposer';
import StoryViewer from '@/components/story/StoryViewer';
import MediaLightbox from '@/components/messaging/MediaLightbox';
import IncomingCallDialog from '@/components/calls/IncomingCallDialog';
import InCallView from '@/components/calls/InCallView';
import JoinCallDialog from '@/components/calls/JoinCallDialog';
import { useSocketConnection } from '@/features/messaging/hooks/useSocketConnection';
import { useGlobalSocketEvents } from '@/features/messaging/hooks/useGlobalSocketEvents';
import { useIncomingCallListener } from '@/features/calls/hooks/useIncomingCallListener';

export default function AppLayout() {
  // Phase 5.2 — open the realtime socket for authenticated users + bind app-wide listeners
  // (presence, message:new). Lives here (the authed shell) so it connects on login and
  // disconnects when this layout unmounts on logout.
  useSocketConnection();
  useGlobalSocketEvents();
  // Phase 6 — bind call:incoming / call:declined / call:ended (call message rides message:new).
  useIncomingCallListener();

  // Messaging routes use the collapsed (hover-expand overlay) sidebar to give the thread
  // more room; every other route keeps the full sidebar.
  const { pathname } = useLocation();
  const sidebarVariant = pathname.startsWith('/messages') ? 'collapsed' : 'default';

  return (
    <div className="flex h-screen bg-background text-foreground">
      <Sidebar variant={sidebarVariant} />
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
      {/* Global message-media lightbox — opened from a media bubble (Phase 5.4a). */}
      <MediaLightbox />
      {/* Phase 6 — global incoming-call dialog + fullscreen in-call view + "join active call" prompt. */}
      <IncomingCallDialog />
      <InCallView />
      <JoinCallDialog />
    </div>
  );
}
