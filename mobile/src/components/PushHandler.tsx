import * as Notifications from 'expo-notifications';

import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';
import { openNotificationTarget } from '@/lib/notificationNav';
import { registerForPush, type PushData } from '@/lib/push';

/** Mendaftarkan push token saat login & membuka layar terkait saat notifikasi diketuk */
export function PushHandler() {
  const { session } = useAuth();
  const community = useCommunity();
  const communityRef = useRef(community);
  communityRef.current = community;
  const lastResponse = Notifications.useLastNotificationResponse();
  const handled = useRef<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    if (userId) registerForPush();
  }, [userId]);

  useEffect(() => {
    if (Platform.OS === 'web' || !userId || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handled.current === id) return;
    handled.current = id;
    const data = lastResponse.notification.request.content.data as PushData;
    openNotificationTarget(communityRef.current, data.community_id ?? null, data.url ?? null);
  }, [lastResponse, userId]);

  return null;
}

