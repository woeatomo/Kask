import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';

export default function Index() {
  const { session, recovering } = useAuth();
  const { current } = useCommunity();
  if (!session) return <Redirect href="/login" />;
  if (recovering) return <Redirect href="/set-password" />;
  if (!current) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
