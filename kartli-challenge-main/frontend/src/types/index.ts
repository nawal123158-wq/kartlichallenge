// Types for the Challenge Card Game
export interface User {
  user_id: string;
  email: string;
  name: string;
  picture?: string;
  player_id: string;
  created_at: string;
  weekly_score: number;
  total_score: number;
}

export interface Card {
  card_id: string;
  deck_type: 'komik' | 'sosyal' | 'beceri' | 'cevre' | 'ceza';
  title: string;
  description: string;
  difficulty: number;
  points: number;
  time_limit?: number;
}

export interface HandCard {
  hand_card_id: string;
  card: Card;
}

export interface Game {
  game_id: string;
  group_id: string;
  status: 'waiting' | 'ready' | 'started' | 'active' | 'finished';
  current_hand: number;
  created_by: string;
  created_at: string;
  finished_at?: string;
  players?: GamePlayer[];
  turn_order?: string[];
  current_turn_index?: number;
}

export interface GamePlayer {
  player_entry_id: string;
  game_id: string;
  user_id: string;
  pass_used: boolean;
  swap_used: boolean;
  score: number;
  joined_at: string;
  name?: string;
  picture?: string;
  player_id?: string;
}

export interface Group {
  group_id: string;
  name: string;
  invite_code: string;
  created_by: string;
  created_at: string;
  member_count?: number;
  is_admin?: boolean;
  members?: GroupMember[];
}

export interface GroupMember {
  user_id: string;
  name: string;
  player_id: string;
  picture?: string;
  is_admin: boolean;
  weekly_score: number;
}

export interface Friend {
  user_id: string;
  name: string;
  player_id: string;
  picture?: string;
  weekly_score: number;
}

export interface FriendRequest {
  request_id: string;
  from_user_id: string;
  to_user_id: string;
  status: string;
  created_at: string;
  from_user?: {
    name: string;
    player_id: string;
    picture?: string;
  };
}

export interface Submission {
  submission_id: string;
  game_id: string;
  hand_number: number;
  user_id: string;
  card_id: string;
  photo_base64?: string;
  note?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  votes_approve: number;
  votes_reject: number;
  user?: { name: string; picture?: string };
  card?: Card;
  my_vote?: string;
}

export interface ChatMessage {
  message_id: string;
  game_id: string;
  user_id: string;
  content: string;
  message_type: 'text' | 'submission' | 'system';
  submission_id?: string;
  created_at: string;
  user?: { name: string; picture?: string };
  submission?: Submission;
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  read: boolean;
  created_at: string;
}

export interface Penalty {
  penalty_id: string;
  game_id: string;
  user_id: string;
  card_id: string;
  reason: string;
  created_at: string;
  user?: { name: string };
  card?: Card;
}
