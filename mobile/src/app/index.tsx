import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';

export default function Index() {
  const { session } = useAuth();
  const { current } = useCommunity();
  if (!session) return <Redirect href="/login" />;
  if (!current) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
