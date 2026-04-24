// Demo storage using localStorage
// This allows testing without Supabase

import { MEMBERS, Member } from '@/data/members';

export interface DemoUser {
  id: string;
  email: string;
  member_id: string;
  member_name: string;
  member_slug: string;
}

export interface MatchParticipation {
  id: string;
  match_id: number;
  user_id: string;
  member_name: string;
  member_slug: string;
  status: 'yes' | 'no' | 'maybe';
}

export interface WatchLocation {
  id: string;
  match_id: number;
  location: string;
  proposed_by: string;
  votes: string[];
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: 'event' | 'world_cup_match';
  created_by: string;
  creator_name: string;
  created_at: string;
}

export interface ActivityParticipation {
  id: string;
  activity_id: string;
  user_id: string;
  member_name: string;
  status: 'yes' | 'no' | 'maybe';
}

const STORAGE_KEYS = {
  currentUser: 'zbre_current_user',
  matchParticipations: 'zbre_match_participations',
  watchLocations: 'zbre_watch_locations',
  activities: 'zbre_activities',
  activityParticipations: 'zbre_activity_participations',
};

function getStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) return defaultValue;
  try {
    return JSON.parse(stored);
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// User management
export function getCurrentUser(): DemoUser | null {
  return getStorage<DemoUser | null>(STORAGE_KEYS.currentUser, null);
}

export function setCurrentUser(user: DemoUser | null): void {
  setStorage(STORAGE_KEYS.currentUser, user);
}

export function loginAsMember(member: Member): DemoUser {
  const user: DemoUser = {
    id: `user_${member.id}`,
    email: `${member.slug}@zbre.team`,
    member_id: member.id,
    member_name: member.name,
    member_slug: member.slug,
  };
  setCurrentUser(user);
  return user;
}

export function logout(): void {
  setCurrentUser(null);
}

// Match participations
export function getMatchParticipations(): MatchParticipation[] {
  return getStorage<MatchParticipation[]>(STORAGE_KEYS.matchParticipations, []);
}

export function setMatchParticipation(matchId: number, userId: string, status: 'yes' | 'no' | 'maybe'): void {
  const participations = getMatchParticipations();
  const user = getCurrentUser();

  const existingIndex = participations.findIndex(p => p.match_id === matchId && p.user_id === userId);

  if (existingIndex >= 0) {
    participations[existingIndex].status = status;
  } else {
    participations.push({
      id: `mp_${Date.now()}`,
      match_id: matchId,
      user_id: userId,
      member_name: user?.member_name || '',
      member_slug: user?.member_slug || '',
      status,
    });
  }

  setStorage(STORAGE_KEYS.matchParticipations, participations);
}

export function getMatchParticipationsForMatch(matchId: number): MatchParticipation[] {
  return getMatchParticipations().filter(p => p.match_id === matchId);
}

// Watch locations
export function getWatchLocations(): WatchLocation[] {
  return getStorage<WatchLocation[]>(STORAGE_KEYS.watchLocations, []);
}

export function addWatchLocation(matchId: number, location: string, proposedBy: string): void {
  const locations = getWatchLocations();
  locations.push({
    id: `wl_${Date.now()}`,
    match_id: matchId,
    location,
    proposed_by: proposedBy,
    votes: [proposedBy],
  });
  setStorage(STORAGE_KEYS.watchLocations, locations);
}

export function toggleVoteLocation(locationId: string, userId: string): void {
  const locations = getWatchLocations();
  const location = locations.find(l => l.id === locationId);
  if (location) {
    if (location.votes.includes(userId)) {
      location.votes = location.votes.filter(v => v !== userId);
    } else {
      location.votes.push(userId);
    }
    setStorage(STORAGE_KEYS.watchLocations, locations);
  }
}

export function getWatchLocationsForMatch(matchId: number): WatchLocation[] {
  return getWatchLocations().filter(l => l.match_id === matchId);
}

// Activities
export function getActivities(): Activity[] {
  return getStorage<Activity[]>(STORAGE_KEYS.activities, []);
}

export function addActivity(activity: Omit<Activity, 'id' | 'created_at'>): void {
  const activities = getActivities();
  activities.push({
    ...activity,
    id: `act_${Date.now()}`,
    created_at: new Date().toISOString(),
  });
  setStorage(STORAGE_KEYS.activities, activities);
}

// Activity participations
export function getActivityParticipations(): ActivityParticipation[] {
  return getStorage<ActivityParticipation[]>(STORAGE_KEYS.activityParticipations, []);
}

export function setActivityParticipation(activityId: string, userId: string, status: 'yes' | 'no' | 'maybe'): void {
  const participations = getActivityParticipations();
  const user = getCurrentUser();

  const existingIndex = participations.findIndex(p => p.activity_id === activityId && p.user_id === userId);

  if (existingIndex >= 0) {
    participations[existingIndex].status = status;
  } else {
    participations.push({
      id: `ap_${Date.now()}`,
      activity_id: activityId,
      user_id: userId,
      member_name: user?.member_name || '',
      status,
    });
  }

  setStorage(STORAGE_KEYS.activityParticipations, participations);
}

export function getActivityParticipationsForActivity(activityId: string): ActivityParticipation[] {
  return getActivityParticipations().filter(p => p.activity_id === activityId);
}
