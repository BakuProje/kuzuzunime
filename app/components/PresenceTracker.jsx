'use client';
import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * PresenceTracker - Tracks user online/offline status in real-time
 * Uses Supabase Realtime Presence to broadcast when a user is active on the website.
 * The admin dashboard listens to the same channel to show green (online) or red (offline).
 */
export default function PresenceTracker() {
  const channelRef = useRef(null);
  const heartbeatRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function startTracking() {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          if (error.message.includes('Refresh Token') || error.message.includes('invalid')) {
            console.warn('Invalid local session detected. Clearing storage...');
            await supabase.auth.signOut();
          }
          return;
        }
        if (!user || !isMounted) return;

        const channel = supabase.channel('online-users', {
          config: { presence: { key: 'admin-tracker' } }
        });

        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isMounted) {
            // Track this user as online
            await channel.track({
              user_id: user.id,
              email: user.email,
              online_at: new Date().toISOString(),
            });

            // Heartbeat: re-track every 30 seconds to stay alive
            heartbeatRef.current = setInterval(async () => {
              if (isMounted) {
                await channel.track({
                  user_id: user.id,
                  email: user.email,
                  online_at: new Date().toISOString(),
                });
              }
            }, 30000);
          }
        });

        channelRef.current = channel;
      } catch (e) {
        console.error('PresenceTracker error:', e);
      }
    }

    startTracking();

    // Handle visibility change (tab hidden/visible)
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        try {
          // Re-track when tab becomes visible again
          const { data: { user }, error } = await supabase.auth.getUser();
          if (error) {
            if (error.message.includes('Refresh Token') || error.message.includes('invalid')) {
              await supabase.auth.signOut();
            }
            return;
          }
          if (user && channelRef.current) {
            await channelRef.current.track({
              user_id: user.id,
              email: user.email,
              online_at: new Date().toISOString(),
            });
          }
        } catch (err) {
          console.warn("Visibility re-track ignored due to lock contention:", err.message);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Handle before unload - user is leaving
    const handleBeforeUnload = () => {
      if (channelRef.current) {
        channelRef.current.untrack();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      if (channelRef.current) {
        channelRef.current.untrack();
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  // This component renders nothing - it's purely a side-effect tracker
  return null;
}
