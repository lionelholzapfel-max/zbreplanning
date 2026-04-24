'use client';

import { createClient } from '@/lib/supabase/client';
import { useState, useEffect, useCallback } from 'react';
import { MEMBERS, Member } from '@/data/members';

// Types
export interface UserProfile {
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
  status: 'yes' | 'no' | 'maybe';
  created_at?: string;
  users?: {
    member_name: string;
    member_slug: string;
  };
}

export interface WatchLocation {
  id: string;
  match_id: number;
  location: string;
  proposed_by: string;
  votes: string[];
  created_at?: string;
  proposer?: {
    member_name: string;
    member_slug: string;
  };
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: string;
  created_by: string;
  created_at: string;
  creator?: {
    member_name: string;
    member_slug: string;
  };
}

export interface ActivityParticipation {
  id: string;
  activity_id: string;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  created_at?: string;
  users?: {
    member_name: string;
    member_slug: string;
  };
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'activity_created' | 'activity_response' | 'location_proposed' | 'location_vote' | 'match_response';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_by?: string;
  related_id?: string;
  created_at: string;
  creator?: {
    member_name: string;
    member_slug: string;
  };
}

export type PredictionType = 'best_player' | 'best_young' | 'surprise_team' | 'winner';

export interface Prediction {
  id: string;
  user_id: string;
  prediction_type: PredictionType;
  prediction_value: string;
  created_at: string;
  updated_at: string;
  user?: {
    member_name: string;
    member_slug: string;
  };
}

// Local storage for current user (simple auth without email)
const USER_STORAGE_KEY = 'zbre_current_user';

export function getCurrentUserLocal(): UserProfile | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(USER_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setCurrentUserLocal(user: UserProfile | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_STORAGE_KEY);
  }
}

export function loginAsMember(member: Member): UserProfile {
  const user: UserProfile = {
    id: member.id,
    email: `${member.slug}@zbre.team`,
    member_id: member.id,
    member_name: member.name,
    member_slug: member.slug,
  };
  setCurrentUserLocal(user);
  return user;
}

export function logout(): void {
  setCurrentUserLocal(null);
}

// Get member info from ID
export function getMemberFromId(userId: string): Member | undefined {
  return MEMBERS.find(m => m.id === userId);
}

// Main hook
export function useSupabase() {
  const supabase = createClient();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const user = getCurrentUserLocal();
    setCurrentUser(user);
    setLoading(false);
  }, []);

  // Ensure user exists in database
  const ensureUserInDb = useCallback(async (user: UserProfile) => {
    const { data: existing, error: selectError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[Supabase] Error checking user:', selectError);
    }

    if (!existing) {
      const { error: insertError } = await supabase.from('users').insert({
        id: user.id,
        email: user.email,
        member_id: user.member_id,
        member_name: user.member_name,
        member_slug: user.member_slug,
      });

      if (insertError) {
        console.error('[Supabase] Error creating user:', insertError);
      }
    }
  }, [supabase]);

  // Create notification for all other users
  const notifyAllUsers = useCallback(async (
    type: Notification['type'],
    title: string,
    message: string,
    link?: string,
    relatedId?: string
  ) => {
    if (!currentUser) return;

    // Get all member IDs except current user
    const otherUserIds = MEMBERS.filter(m => m.id !== currentUser.id).map(m => m.id);

    // Create notifications for all other users
    const notifications = otherUserIds.map(userId => ({
      user_id: userId,
      type,
      title,
      message,
      link,
      created_by: currentUser.id,
      related_id: relatedId,
    }));

    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      console.error('[Supabase] Error creating notifications:', error);
    }
  }, [supabase, currentUser]);

  // Get notifications for current user
  const getNotifications = useCallback(async (): Promise<Notification[]> => {
    if (!currentUser) return [];

    const { data, error } = await supabase
      .from('notifications')
      .select('*, creator:users!created_by(member_name, member_slug)')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[Supabase] Error getting notifications:', error);
      return [];
    }

    const notifs = data || [];
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
    return notifs;
  }, [supabase, currentUser]);

  // Mark notification as read
  const markNotificationRead = useCallback(async (notificationId: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (!error) {
      setNotifications(prev => prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  }, [supabase]);

  // Mark all as read
  const markAllNotificationsRead = useCallback(async () => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', currentUser.id)
      .eq('read', false);

    if (!error) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  }, [supabase, currentUser]);

  // Login
  const login = useCallback(async (member: Member) => {
    const user = loginAsMember(member);
    setCurrentUser(user);
    await ensureUserInDb(user);
    return user;
  }, [ensureUserInDb]);

  // Match Participations
  const getMatchParticipations = useCallback(async (matchId: number): Promise<MatchParticipation[]> => {
    const { data, error } = await supabase
      .from('match_participations')
      .select('*, users(member_name, member_slug)')
      .eq('match_id', matchId);

    if (error) {
      console.error('[Supabase] Error getting participations:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  const setMatchParticipation = useCallback(async (matchId: number, status: 'yes' | 'no' | 'maybe') => {
    if (!currentUser) {
      console.error('[Supabase] setMatchParticipation: No current user');
      return;
    }

    console.log('[Supabase] setMatchParticipation:', { matchId, status, userId: currentUser.id });
    await ensureUserInDb(currentUser);

    // Use maybeSingle() instead of single() to avoid 406 errors
    const { data: existingList, error: selectError } = await supabase
      .from('match_participations')
      .select('id, status')
      .eq('match_id', matchId)
      .eq('user_id', currentUser.id);

    if (selectError) {
      console.error('[Supabase] Error checking participation:', selectError);
      return;
    }

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;
    console.log('[Supabase] Existing participation:', existing);

    if (existing) {
      // If clicking the same status, DELETE (deselect)
      if (existing.status === status) {
        console.log('[Supabase] Same status clicked, deleting participation:', existing.id);
        const { error: deleteError } = await supabase
          .from('match_participations')
          .delete()
          .eq('id', existing.id);

        if (deleteError) {
          console.error('[Supabase] Error deleting participation:', deleteError);
        } else {
          console.log('[Supabase] Participation deleted successfully (deselected)');
        }
        return;
      }

      // Otherwise update to new status
      console.log('[Supabase] Updating participation:', existing.id);
      const { error: updateError } = await supabase
        .from('match_participations')
        .update({ status })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Supabase] Error updating participation:', updateError);
      } else {
        console.log('[Supabase] Participation updated successfully');
      }
    } else {
      console.log('[Supabase] Creating new participation');
      const { error: insertError } = await supabase.from('match_participations').insert({
        match_id: matchId,
        user_id: currentUser.id,
        status,
      });

      if (insertError) {
        console.error('[Supabase] Error creating participation:', insertError);
      } else {
        console.log('[Supabase] Participation created successfully');

        // Notify others only for new participations with 'yes' status
        if (status === 'yes') {
          await notifyAllUsers(
            'match_response',
            'Nouveau spectateur !',
            `${currentUser.member_name} va regarder le match #${matchId}`,
            '/world-cup',
            matchId.toString()
          );
        }
      }
    }
  }, [supabase, currentUser, ensureUserInDb, notifyAllUsers]);

  // Watch Locations - with proposer info
  const getWatchLocations = useCallback(async (matchId: number): Promise<WatchLocation[]> => {
    const { data, error } = await supabase
      .from('watch_locations')
      .select('*, proposer:users!proposed_by(member_name, member_slug)')
      .eq('match_id', matchId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting watch locations:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  const addWatchLocation = useCallback(async (matchId: number, location: string) => {
    if (!currentUser) return;

    await ensureUserInDb(currentUser);

    const { error } = await supabase.from('watch_locations').insert({
      match_id: matchId,
      location,
      proposed_by: currentUser.id,
      votes: [currentUser.id],
    });

    if (!error) {
      // Notify others
      await notifyAllUsers(
        'location_proposed',
        'Nouveau lieu proposé !',
        `${currentUser.member_name} propose "${location}" pour le match #${matchId}`,
        '/world-cup',
        matchId.toString()
      );
    }
  }, [supabase, currentUser, ensureUserInDb, notifyAllUsers]);

  const toggleVoteLocation = useCallback(async (locationId: string, currentVotes: string[], matchId: number) => {
    if (!currentUser) return;

    const hasVoted = currentVotes.includes(currentUser.id);
    const newVotes = hasVoted
      ? currentVotes.filter(v => v !== currentUser.id)
      : [...currentVotes, currentUser.id];

    const { error } = await supabase
      .from('watch_locations')
      .update({ votes: newVotes })
      .eq('id', locationId);

    if (!error && !hasVoted) {
      // Notify when adding a vote (not removing)
      await notifyAllUsers(
        'location_vote',
        'Nouveau vote !',
        `${currentUser.member_name} a voté pour un lieu`,
        '/world-cup',
        matchId.toString()
      );
    }
  }, [supabase, currentUser, notifyAllUsers]);

  // Delete watch location
  const deleteWatchLocation = useCallback(async (locationId: string) => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('watch_locations')
      .delete()
      .eq('id', locationId)
      .eq('proposed_by', currentUser.id); // Only allow deleting own locations

    if (error) {
      console.error('[Supabase] Error deleting location:', error);
    }
  }, [supabase, currentUser]);

  // Activities
  const getActivities = useCallback(async (): Promise<Activity[]> => {
    const { data, error } = await supabase
      .from('activities')
      .select('*, creator:users!created_by(member_name, member_slug)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting activities:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  const createActivity = useCallback(async (activity: {
    title: string;
    description: string;
    date: string;
    time: string;
    location: string;
  }): Promise<string | null> => {
    if (!currentUser) return null;

    await ensureUserInDb(currentUser);

    const { data, error } = await supabase.from('activities').insert({
      ...activity,
      type: 'event',
      created_by: currentUser.id,
    }).select('id').single();

    if (error) {
      console.error('[Supabase] Error creating activity:', error);
      return null;
    }

    // Notify all other users
    await notifyAllUsers(
      'activity_created',
      'Nouvelle activité !',
      `${currentUser.member_name} propose: ${activity.title}`,
      '/activities',
      data.id
    );

    return data.id;
  }, [supabase, currentUser, ensureUserInDb, notifyAllUsers]);

  // Delete activity
  const deleteActivity = useCallback(async (activityId: string) => {
    if (!currentUser) return;

    const { error } = await supabase
      .from('activities')
      .delete()
      .eq('id', activityId)
      .eq('created_by', currentUser.id);

    if (error) {
      console.error('[Supabase] Error deleting activity:', error);
    }
  }, [supabase, currentUser]);

  // Activity Participations
  const getActivityParticipations = useCallback(async (activityId: string): Promise<ActivityParticipation[]> => {
    const { data, error } = await supabase
      .from('activity_participations')
      .select('*, users(member_name, member_slug)')
      .eq('activity_id', activityId);

    if (error) {
      console.error('[Supabase] Error getting activity participations:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  const setActivityParticipation = useCallback(async (
    activityId: string,
    status: 'yes' | 'no' | 'maybe',
    activityTitle?: string,
    creatorId?: string
  ) => {
    if (!currentUser) {
      console.error('[Supabase] setActivityParticipation: No current user');
      return;
    }

    console.log('[Supabase] setActivityParticipation:', { activityId, status, userId: currentUser.id });
    await ensureUserInDb(currentUser);

    // Use array query instead of single() to avoid 406 errors
    const { data: existingList, error: selectError } = await supabase
      .from('activity_participations')
      .select('id, status')
      .eq('activity_id', activityId)
      .eq('user_id', currentUser.id);

    if (selectError) {
      console.error('[Supabase] Error checking activity participation:', selectError);
      return;
    }

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;
    const oldStatus = existing?.status;
    console.log('[Supabase] Existing activity participation:', existing);

    if (existing) {
      // If clicking the same status, DELETE (deselect)
      if (existing.status === status) {
        console.log('[Supabase] Same status clicked, deleting activity participation:', existing.id);
        const { error: deleteError } = await supabase
          .from('activity_participations')
          .delete()
          .eq('id', existing.id);

        if (deleteError) {
          console.error('[Supabase] Error deleting activity participation:', deleteError);
        } else {
          console.log('[Supabase] Activity participation deleted (deselected)');
        }
        return;
      }

      // Otherwise update to new status
      console.log('[Supabase] Updating activity participation');
      const { error: updateError } = await supabase
        .from('activity_participations')
        .update({ status })
        .eq('id', existing.id);

      if (updateError) {
        console.error('[Supabase] Error updating activity participation:', updateError);
      } else {
        console.log('[Supabase] Activity participation updated');
      }
    } else {
      console.log('[Supabase] Creating new activity participation');
      const { error: insertError } = await supabase.from('activity_participations').insert({
        activity_id: activityId,
        user_id: currentUser.id,
        status,
      });

      if (insertError) {
        console.error('[Supabase] Error creating activity participation:', insertError);
      } else {
        console.log('[Supabase] Activity participation created');
      }
    }

    // Notify the activity creator if someone responds (and it's not the creator themselves)
    if (creatorId && creatorId !== currentUser.id && oldStatus !== status) {
      const statusText = status === 'yes' ? 'vient' : status === 'maybe' ? 'hésite' : 'ne vient pas';
      console.log('[Supabase] Notifying activity creator:', creatorId);

      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: creatorId,
        type: 'activity_response',
        title: 'Réponse à ton activité',
        message: `${currentUser.member_name} ${statusText} à "${activityTitle || 'ton activité'}"`,
        link: '/activities',
        created_by: currentUser.id,
        related_id: activityId,
      });

      if (notifError) {
        console.error('[Supabase] Error creating notification:', notifError);
      }
    }
  }, [supabase, currentUser, ensureUserInDb]);

  // User stats
  const getUserStats = useCallback(async () => {
    if (!currentUser) return { matchesJoined: 0, activitiesCreated: 0 };

    const [{ count: matchesJoined }, { count: activitiesCreated }] = await Promise.all([
      supabase
        .from('match_participations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id)
        .eq('status', 'yes'),
      supabase
        .from('activities')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', currentUser.id),
    ]);

    return {
      matchesJoined: matchesJoined || 0,
      activitiesCreated: activitiesCreated || 0,
    };
  }, [supabase, currentUser]);

  // Get upcoming activities with participation stats
  const getUpcomingActivities = useCallback(async (): Promise<(Activity & {
    participations: ActivityParticipation[];
    yesCount: number;
    totalResponses: number;
    isConfirmed: boolean;
    myStatus: 'yes' | 'no' | 'maybe' | null;
  })[]> => {
    const today = new Date().toISOString().split('T')[0];

    const { data: activities, error } = await supabase
      .from('activities')
      .select('*, creator:users!created_by(member_name, member_slug)')
      .gte('date', today)
      .order('date', { ascending: true })
      .limit(5);

    if (error || !activities) return [];

    // Get participations for each activity
    const results = await Promise.all(activities.map(async (activity) => {
      const { data: participations } = await supabase
        .from('activity_participations')
        .select('*, users(member_name, member_slug)')
        .eq('activity_id', activity.id);

      const parts = participations || [];
      const yesCount = parts.filter(p => p.status === 'yes').length;
      const myStatus = currentUser
        ? (parts.find(p => p.user_id === currentUser.id)?.status as 'yes' | 'no' | 'maybe' | null) || null
        : null;

      return {
        ...activity,
        participations: parts,
        yesCount,
        totalResponses: parts.length,
        isConfirmed: yesCount >= 5,
        myStatus,
      };
    }));

    return results;
  }, [supabase, currentUser]);

  // Get upcoming matches user is attending
  const getMyUpcomingMatches = useCallback(async (): Promise<{
    matchId: number;
    status: 'yes' | 'maybe';
    yesCount: number;
    totalResponses: number;
    isConfirmed: boolean;
  }[]> => {
    if (!currentUser) return [];

    // Get matches user said yes or maybe to
    const { data: myParticipations } = await supabase
      .from('match_participations')
      .select('match_id, status')
      .eq('user_id', currentUser.id)
      .in('status', ['yes', 'maybe']);

    if (!myParticipations || myParticipations.length === 0) return [];

    // Get all participations for these matches
    const matchIds = myParticipations.map(p => p.match_id);
    const { data: allParticipations } = await supabase
      .from('match_participations')
      .select('match_id, status')
      .in('match_id', matchIds);

    const parts = allParticipations || [];

    return myParticipations.map(mp => {
      const matchParts = parts.filter(p => p.match_id === mp.match_id);
      const yesCount = matchParts.filter(p => p.status === 'yes').length;
      return {
        matchId: mp.match_id,
        status: mp.status as 'yes' | 'maybe',
        yesCount,
        totalResponses: matchParts.length,
        isConfirmed: yesCount >= 5,
      };
    });
  }, [supabase, currentUser]);

  // Get response stats for a match
  const getMatchStats = useCallback(async (matchId: number): Promise<{
    yesCount: number;
    maybeCount: number;
    noCount: number;
    totalResponses: number;
    isConfirmed: boolean;
  }> => {
    const { data: participations } = await supabase
      .from('match_participations')
      .select('status')
      .eq('match_id', matchId);

    const parts = participations || [];
    const yesCount = parts.filter(p => p.status === 'yes').length;
    const maybeCount = parts.filter(p => p.status === 'maybe').length;
    const noCount = parts.filter(p => p.status === 'no').length;

    return {
      yesCount,
      maybeCount,
      noCount,
      totalResponses: parts.length,
      isConfirmed: yesCount >= 5,
    };
  }, [supabase]);

  // Predictions / Pronostics
  const getAllPredictions = useCallback(async (): Promise<Prediction[]> => {
    const { data, error } = await supabase
      .from('predictions')
      .select('*, user:users!user_id(member_name, member_slug)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Supabase] Error getting predictions:', error);
      return [];
    }

    return data || [];
  }, [supabase]);

  const getMyPredictions = useCallback(async (): Promise<Record<PredictionType, string | null>> => {
    if (!currentUser) return { best_player: null, best_young: null, surprise_team: null, winner: null };

    const { data, error } = await supabase
      .from('predictions')
      .select('prediction_type, prediction_value')
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('[Supabase] Error getting my predictions:', error);
      return { best_player: null, best_young: null, surprise_team: null, winner: null };
    }

    const result: Record<PredictionType, string | null> = {
      best_player: null,
      best_young: null,
      surprise_team: null,
      winner: null,
    };

    (data || []).forEach(p => {
      result[p.prediction_type as PredictionType] = p.prediction_value;
    });

    return result;
  }, [supabase, currentUser]);

  const setPrediction = useCallback(async (type: PredictionType, value: string) => {
    if (!currentUser) return;

    await ensureUserInDb(currentUser);

    // Check if prediction exists
    const { data: existingList } = await supabase
      .from('predictions')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('prediction_type', type);

    const existing = existingList && existingList.length > 0 ? existingList[0] : null;

    if (existing) {
      const { error } = await supabase
        .from('predictions')
        .update({ prediction_value: value })
        .eq('id', existing.id);

      if (error) {
        console.error('[Supabase] Error updating prediction:', error);
      }
    } else {
      const { error } = await supabase.from('predictions').insert({
        user_id: currentUser.id,
        prediction_type: type,
        prediction_value: value,
      });

      if (error) {
        console.error('[Supabase] Error creating prediction:', error);
      }
    }
  }, [supabase, currentUser, ensureUserInDb]);

  // Load notifications on mount
  useEffect(() => {
    if (currentUser) {
      getNotifications();
    }
  }, [currentUser, getNotifications]);

  return {
    supabase,
    currentUser,
    loading,
    login,
    logout: () => {
      logout();
      setCurrentUser(null);
    },
    // Match
    getMatchParticipations,
    setMatchParticipation,
    // Locations
    getWatchLocations,
    addWatchLocation,
    toggleVoteLocation,
    deleteWatchLocation,
    // Activities
    getActivities,
    createActivity,
    deleteActivity,
    getActivityParticipations,
    setActivityParticipation,
    // Stats
    getUserStats,
    getUpcomingActivities,
    getMyUpcomingMatches,
    getMatchStats,
    // Predictions
    getAllPredictions,
    getMyPredictions,
    setPrediction,
    // Notifications
    notifications,
    unreadCount,
    getNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    // Helpers
    getMemberFromId,
  };
}
