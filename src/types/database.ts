export interface User {
  id: string;
  email: string;
  member_id: string;
  member_name: string;
  member_slug: string;
  created_at: string;
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: 'event' | 'world_cup_match';
  match_id?: number;
  created_by: string;
  created_at: string;
}

export interface ActivityParticipation {
  id: string;
  activity_id: string;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  created_at: string;
  updated_at: string;
}

export interface WorldCupMatch {
  id: number;
  date: string;
  dateDisplay: string;
  time: string;
  match: string;
  stadium: string;
  city: string;
  phase: string;
  group: string;
}

export interface MatchParticipation {
  id: string;
  match_id: number;
  user_id: string;
  status: 'yes' | 'no' | 'maybe';
  created_at: string;
  updated_at: string;
}

export interface WatchLocation {
  id: string;
  match_id: number;
  location: string;
  proposed_by: string;
  votes: number;
  created_at: string;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at'>;
        Update: Partial<Omit<User, 'id'>>;
      };
      activities: {
        Row: Activity;
        Insert: Omit<Activity, 'id' | 'created_at'>;
        Update: Partial<Omit<Activity, 'id'>>;
      };
      activity_participations: {
        Row: ActivityParticipation;
        Insert: Omit<ActivityParticipation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ActivityParticipation, 'id'>>;
      };
      match_participations: {
        Row: MatchParticipation;
        Insert: Omit<MatchParticipation, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MatchParticipation, 'id'>>;
      };
      watch_locations: {
        Row: WatchLocation;
        Insert: Omit<WatchLocation, 'id' | 'created_at' | 'votes'>;
        Update: Partial<Omit<WatchLocation, 'id'>>;
      };
    };
  };
};
