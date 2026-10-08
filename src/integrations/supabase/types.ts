export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      character_jobs: {
        Row: {
          character_id: string;
          created_at: string;
          hired_at: string;
          id: string;
          is_current: boolean;
          job_id: string;
          last_performed_at: string | null;
          times_performed: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          id?: string;
          user_id: string;
          job_id: string;
          is_current?: boolean;
          last_performed_at?: string | null;
          times_performed?: number;
          hired_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          hired_at?: string;
          id?: string;
          is_current?: boolean;
          job_id?: string;
          last_performed_at?: string | null;
          times_performed?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_jobs_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            metadata?: Json;
            foreignKeyName: "character_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "character_jobs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      characters: {
        Row: {
          age: number;
          appearance: Json;
          career: number;
          created_at: string;
          energy: number;
          energy_updated_at: string;
          game_day: number;
          game_time_hour: number;
          game_time_minute: number;
          game_weekday: number;
          gender: string;
          happiness: number;
          health: number;
          id: string;
          intelligence: number;
          level: number;
          name: string;
          occupation_preference: string | null;
          personality: string;
          reputation: number;
          social: number;
          current_location_id: string | null;
          hunger: number;
          stress: number;
          updated_at: string;
          user_id: string;
          wealth: number;
          xp: number;
        };
        Insert: {
          age: number;
          appearance?: Json;
          career?: number;
          created_at?: string;
          energy?: number;
          energy_updated_at?: string;
          game_day?: number;
          game_time_hour?: number;
          game_time_minute?: number;
          game_weekday?: number;
          gender: string;
          happiness?: number;
          health?: number;
          id?: string;
          intelligence?: number;
          level?: number;
          name: string;
          occupation_preference?: string | null;
          personality: string;
          reputation?: number;
          social?: number;
          current_location_id?: string | null;
          hunger?: number;
          stress?: number;
          updated_at?: string;
          user_id: string;
          wealth?: number;
          xp?: number;
        };
        Update: {
          age?: number;
          appearance?: Json;
          career?: number;
          created_at?: string;
          energy?: number;
          energy_updated_at?: string;
          game_day?: number;
          game_time_hour?: number;
          game_time_minute?: number;
          game_weekday?: number;
          gender?: string;
          happiness?: number;
          health?: number;
          id?: string;
          intelligence?: number;
          level?: number;
          name?: string;
          occupation_preference?: string | null;
          personality?: string;
          reputation?: number;
          social?: number;
          current_location_id?: string | null;
          hunger?: number;
          stress?: number;
          updated_at?: string;
          user_id?: string;
          wealth?: number;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "characters_occupation_preference_fkey";
            columns: ["occupation_preference"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "characters_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          icon: string;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          description: string;
          icon?: string;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          icon?: string;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          cooldown_minutes: number;
          created_at: string;
          description: string;
          energy_cost: number;
          icon: string;
          id: string;
          is_available: boolean;
          location_id: string | null;
          name: string;
          place_id: string | null;
          required_course_slug: string | null;
          required_level: number;
          salary: number;
          slug: string;
          sort_order: number;
          stat_bonus: string;
          xp_reward: number;
        };
        Insert: {
          cooldown_minutes?: number;
          created_at?: string;
          description: string;
          energy_cost: number;
          icon?: string;
          id?: string;
          is_available?: boolean;
          location_id?: string | null;
          name: string;
          place_id?: string | null;
          required_course_slug?: string | null;
          required_level?: number;
          salary: number;
          slug: string;
          sort_order?: number;
          stat_bonus?: string;
          xp_reward?: number;
        };
        Update: {
          cooldown_minutes?: number;
          created_at?: string;
          description?: string;
          energy_cost?: number;
          icon?: string;
          id?: string;
          is_available?: boolean;
          location_id?: string | null;
          name?: string;
          place_id?: string | null;
          required_course_slug?: string | null;
          required_level?: number;
          salary?: number;
          slug?: string;
          sort_order?: number;
          stat_bonus?: string;
          xp_reward?: number;
        };
        Relationships: [];
      };
      location_visits: {
        Row: {
          character_id: string;
          first_visited_at: string;
          id: string;
          last_visited_at: string;
          location_id: string;
          user_id: string;
          visit_count: number;
        };
        Insert: {
          character_id: string;
          first_visited_at?: string;
          id?: string;
          last_visited_at?: string;
          location_id: string;
          user_id: string;
          visit_count?: number;
        };
        Update: {
          character_id?: string;
          first_visited_at?: string;
          id?: string;
          last_visited_at?: string;
          location_id?: string;
          user_id?: string;
          visit_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "location_visits_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_visits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "location_visits_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      education_courses: {
        Row: {
          career_gain: number;
          description: string;
          energy_cost: number;
          id: string;
          intelligence_gain: number;
          name: string;
          provider: string;
          slug: string;
          sort_order: number;
          tuition: number;
        };
        Insert: {
          career_gain: number;
          description: string;
          energy_cost: number;
          id?: string;
          intelligence_gain: number;
          name: string;
          provider: string;
          slug: string;
          sort_order?: number;
          tuition: number;
        };
        Update: {
          career_gain?: number;
          description?: string;
          energy_cost?: number;
          id?: string;
          intelligence_gain?: number;
          name?: string;
          provider?: string;
          slug?: string;
          sort_order?: number;
          tuition?: number;
        };
        Relationships: [];
      };
      player_courses: {
        Row: {
          character_id: string;
          completed_at: string;
          course_id: string;
          id: string;
          tuition_paid: number;
          user_id: string;
        };
        Insert: {
          character_id: string;
          completed_at?: string;
          course_id: string;
          id?: string;
          tuition_paid: number;
          user_id: string;
        };
        Update: {
          character_id?: string;
          completed_at?: string;
          course_id?: string;
          id?: string;
          tuition_paid?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          color: string;
          created_at: string;
          description: string;
          district_type: string;
          id: string;
          icon: string;
          image_url: string | null;
          is_active: boolean;
          latitude: number | null;
          level_required: number;
          longitude: number | null;
          map_x: number;
          map_y: number;
          metadata: Json;
          name: string;
          planned_features: string[];
          slug: string;
          sort_order: number;
          tagline: string;
          travel_fare: number;
          travel_minutes: number;
          type: string;
          updated_at: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          description: string;
          district_type: string;
          id?: string;
          icon?: string;
          image_url?: string | null;
          is_active?: boolean;
          latitude?: number | null;
          level_required?: number;
          longitude?: number | null;
          map_x: number;
          map_y: number;
          metadata?: Json;
          name: string;
          planned_features?: string[];
          slug: string;
          sort_order?: number;
          tagline: string;
          travel_fare?: number;
          travel_minutes?: number;
          type?: string;
          updated_at?: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          description?: string;
          district_type?: string;
          id?: string;
          icon?: string;
          image_url?: string | null;
          is_active?: boolean;
          latitude?: number | null;
          level_required?: number;
          longitude?: number | null;
          map_x?: number;
          map_y?: number;
          metadata?: Json;
          name?: string;
          planned_features?: string[];
          slug?: string;
          sort_order?: number;
          tagline?: string;
          travel_fare?: number;
          travel_minutes?: number;
          type?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      game_places: {
        Row: {
          category: string;
          created_at: string;
          description: string;
          disclosure: string | null;
          happiness_gain: number;
          hunger_restore: number;
          id: string;
          location_id: string;
          meal_price: number | null;
          name: string;
          origin: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          description: string;
          disclosure?: string | null;
          happiness_gain?: number;
          hunger_restore?: number;
          id?: string;
          location_id: string;
          meal_price?: number | null;
          name: string;
          origin?: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          description?: string;
          disclosure?: string | null;
          happiness_gain?: number;
          hunger_restore?: number;
          id?: string;
          location_id?: string;
          meal_price?: number | null;
          name?: string;
          origin?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      advertisement_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      game_billboards: {
        Row: {
          billboard_type: string;
          created_at: string;
          id: string;
          location_id: string;
          name: string;
          placement: string;
          size_type: string;
          slug: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          billboard_type: string;
          created_at?: string;
          id?: string;
          location_id: string;
          name: string;
          placement: string;
          size_type: string;
          slug: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          billboard_type?: string;
          created_at?: string;
          id?: string;
          location_id?: string;
          name?: string;
          placement?: string;
          size_type?: string;
          slug?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_billboards_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      advertisements: {
        Row: {
          advertiser_name: string;
          billboard_id: string;
          call_to_action: string | null;
          created_at: string;
          creative_image_url: string | null;
          creative_theme: string;
          description: string;
          destination_action: string;
          destination_url: string | null;
          ends_at: string | null;
          id: string;
          slug: string;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          advertiser_name: string;
          billboard_id: string;
          call_to_action?: string | null;
          created_at?: string;
          creative_image_url?: string | null;
          creative_theme?: string;
          description: string;
          destination_action?: string;
          destination_url?: string | null;
          ends_at?: string | null;
          id?: string;
          slug: string;
          starts_at: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          advertiser_name?: string;
          billboard_id?: string;
          call_to_action?: string | null;
          created_at?: string;
          creative_image_url?: string | null;
          creative_theme?: string;
          description?: string;
          destination_action?: string;
          destination_url?: string | null;
          ends_at?: string | null;
          id?: string;
          slug?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advertisements_billboard_id_fkey";
            columns: ["billboard_id"];
            isOneToOne: false;
            referencedRelation: "game_billboards";
            referencedColumns: ["id"];
          },
        ];
      };
      missions: {
        Row: {
          created_at: string;
          description: string;
          id: string;
          reward_money: number;
          reward_xp: number;
          slug: string;
          sort_order: number;
          target: number;
          title: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          id?: string;
          reward_money?: number;
          reward_xp?: number;
          slug: string;
          sort_order?: number;
          target: number;
          title: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          id?: string;
          reward_money?: number;
          reward_xp?: number;
          slug?: string;
          sort_order?: number;
          target?: number;
          title?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          body: string;
          character_id: string | null;
          created_at: string;
          id: string;
          kind: string;
          read_at: string | null;
          title: string;
          user_id: string;
        };
        Insert: {
          body: string;
          character_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          title: string;
          user_id: string;
        };
        Update: {
          body?: string;
          character_id?: string | null;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_inventory: {
        Row: {
          acquired_at: string;
          character_id: string;
          created_at: string;
          id: string;
          item_id: string;
          quantity: number;
          user_id: string;
        };
        Insert: {
          acquired_at?: string;
          character_id: string;
          created_at?: string;
          id?: string;
          item_id: string;
          quantity?: number;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          character_id?: string;
          created_at?: string;
          id?: string;
          item_id?: string;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_inventory_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_inventory_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_inventory_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_missions: {
        Row: {
          character_id: string;
          claimed_at: string | null;
          completed_at: string | null;
          created_at: string;
          id: string;
          mission_id: string;
          progress: number;
          status: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          mission_id: string;
          progress?: number;
          status?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          claimed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          id?: string;
          mission_id?: string;
          progress?: number;
          status?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_missions_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_missions_mission_id_fkey";
            columns: ["mission_id"];
            isOneToOne: false;
            referencedRelation: "missions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_missions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string | null;
          id: string;
          reduced_motion: boolean;
          sound_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          display_name?: string | null;
          id: string;
          reduced_motion?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          display_name?: string | null;
          id?: string;
          reduced_motion?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          category: string;
          character_id: string;
          created_at: string;
          description: string;
          id: string;
          kind: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          amount: number;
          category: string;
          character_id: string;
          created_at?: string;
          description: string;
          id?: string;
          kind: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          amount?: number;
          category?: string;
          character_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          kind?: string;
          user_id?: string;
          wallet_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_wallet_id_fkey";
            columns: ["wallet_id"];
            isOneToOne: false;
            referencedRelation: "wallets";
            referencedColumns: ["id"];
          },
        ];
      };
      wallets: {
        Row: {
          balance: number;
          character_id: string;
          created_at: string;
          id: string;
          total_expenses: number;
          total_income: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          balance?: number;
          character_id: string;
          created_at?: string;
          id?: string;
          total_expenses?: number;
          total_income?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          balance?: number;
          character_id?: string;
          created_at?: string;
          id?: string;
          total_expenses?: number;
          total_income?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wallets_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wallets_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      _credit: {
        Args: {
          p_amount: number;
          p_category: string;
          p_char: string;
          p_desc: string;
        };
        Returns: undefined;
      };
      _grant_xp: { Args: { p_char: string; p_xp: number }; Returns: number };
      _my_character_id: { Args: never; Returns: string };
      _notify: {
        Args: {
          p_body: string;
          p_char: string;
          p_kind?: string;
          p_title: string;
        };
        Returns: undefined;
      };
      _recalc_missions: { Args: { p_char: string }; Returns: undefined };
      _refresh_energy: { Args: { p_char: string }; Returns: number };
      eat_at_place: { Args: { p_place_id: string }; Returns: Json };
      claim_mission: { Args: { p_player_mission_id: string }; Returns: Json };
      complete_education_course: { Args: { p_course_slug: string }; Returns: Json };
      create_character: {
        Args: {
          p_age: number;
          p_appearance: Json;
          p_gender: string;
          p_name: string;
          p_occupation: string;
          p_personality: string;
        };
        Returns: string;
      };
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined };
      perform_job: { Args: never; Returns: Json };
      refresh_my_energy: { Args: never; Returns: number };
      select_job: { Args: { p_job_id: string }; Returns: undefined };
      travel_to_location: { Args: { p_location_id: string }; Returns: Json };
      visit_location: { Args: { p_location_id: string }; Returns: Json };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
