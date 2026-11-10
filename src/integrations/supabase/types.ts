export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          category: string;
          cooldown_minutes: number;
          created_at: string;
          description: string;
          duration_minutes: number;
          energy_delta: number;
          hunger_delta: number;
          id: string;
          is_available: boolean;
          location_id: string | null;
          metadata: Json;
          name: string;
          requirements: Json;
          rewards: Json;
          slug: string;
          thirst_delta: number;
          updated_at: string;
          xp_reward: number;
        };
        Insert: {
          category: string;
          cooldown_minutes?: number;
          created_at?: string;
          description: string;
          duration_minutes: number;
          energy_delta?: number;
          hunger_delta?: number;
          id?: string;
          is_available?: boolean;
          location_id?: string | null;
          metadata?: Json;
          name: string;
          requirements?: Json;
          rewards?: Json;
          slug: string;
          thirst_delta?: number;
          updated_at?: string;
          xp_reward?: number;
        };
        Update: {
          category?: string;
          cooldown_minutes?: number;
          created_at?: string;
          description?: string;
          duration_minutes?: number;
          energy_delta?: number;
          hunger_delta?: number;
          id?: string;
          is_available?: boolean;
          location_id?: string | null;
          metadata?: Json;
          name?: string;
          requirements?: Json;
          rewards?: Json;
          slug?: string;
          thirst_delta?: number;
          updated_at?: string;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "activities_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_completions: {
        Row: {
          activity_id: string;
          activity_name: string;
          activity_slug: string;
          category: string;
          character_id: string;
          completed_at: string;
          configured_rewards: Json;
          cooldown_minutes: number;
          duration_minutes: number;
          energy_delta: number;
          hunger_delta: number;
          id: string;
          request_id: string;
          thirst_delta: number;
          user_id: string;
          xp_reward: number;
        };
        Insert: {
          activity_id: string;
          activity_name: string;
          activity_slug: string;
          category: string;
          character_id: string;
          completed_at?: string;
          configured_rewards?: Json;
          cooldown_minutes: number;
          duration_minutes: number;
          energy_delta: number;
          hunger_delta: number;
          id?: string;
          request_id: string;
          thirst_delta: number;
          user_id: string;
          xp_reward: number;
        };
        Update: {
          activity_id?: string;
          activity_name?: string;
          activity_slug?: string;
          category?: string;
          character_id?: string;
          completed_at?: string;
          configured_rewards?: Json;
          cooldown_minutes?: number;
          duration_minutes?: number;
          energy_delta?: number;
          hunger_delta?: number;
          id?: string;
          request_id?: string;
          thirst_delta?: number;
          user_id?: string;
          xp_reward?: number;
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
      bank_accounts: {
        Row: {
          account_number: string;
          branch_location_id: string;
          character_id: string;
          id: string;
          opened_at: string;
        };
        Insert: {
          account_number: string;
          branch_location_id: string;
          character_id: string;
          id?: string;
          opened_at?: string;
        };
        Update: {
          account_number?: string;
          branch_location_id?: string;
          character_id?: string;
          id?: string;
          opened_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bank_accounts_branch_location_id_fkey";
            columns: ["branch_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bank_accounts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      business_catalog: {
        Row: {
          active: boolean;
          daily_customers: number;
          description: string;
          id: string;
          location_slug: string;
          name: string;
          purchase_price: number;
          service_catalog: Json;
          slug: string;
        };
        Insert: {
          active?: boolean;
          daily_customers: number;
          description: string;
          id?: string;
          location_slug: string;
          name: string;
          purchase_price: number;
          service_catalog: Json;
          slug: string;
        };
        Update: {
          active?: boolean;
          daily_customers?: number;
          description?: string;
          id?: string;
          location_slug?: string;
          name?: string;
          purchase_price?: number;
          service_catalog?: Json;
          slug?: string;
        };
        Relationships: [];
      };
      career_paths: {
        Row: {
          description: string;
          mood_reward: number;
          name: string;
          slug: string;
        };
        Insert: {
          description: string;
          mood_reward: number;
          name: string;
          slug: string;
        };
        Update: {
          description?: string;
          mood_reward?: number;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      career_ranks: {
        Row: {
          level: number;
          path_slug: string;
          required_shifts: number;
          required_skill_level: number;
          salary: number;
          steps: string[];
          title: string;
        };
        Insert: {
          level: number;
          path_slug: string;
          required_shifts: number;
          required_skill_level: number;
          salary: number;
          steps: string[];
          title: string;
        };
        Update: {
          level?: number;
          path_slug?: string;
          required_shifts?: number;
          required_skill_level?: number;
          salary?: number;
          steps?: string[];
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_ranks_path_slug_fkey";
            columns: ["path_slug"];
            isOneToOne: false;
            referencedRelation: "career_paths";
            referencedColumns: ["slug"];
          },
        ];
      };
      career_shifts: {
        Row: {
          character_id: string;
          character_job_id: string;
          completed_at: string | null;
          id: string;
          location_id: string;
          next_step_at: string;
          paid_amount: number;
          path_slug: string;
          rank_level: number;
          started_at: string;
          status: string;
          step_count: number;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          character_id: string;
          character_job_id: string;
          completed_at?: string | null;
          id?: string;
          location_id: string;
          next_step_at?: string;
          paid_amount?: number;
          path_slug: string;
          rank_level: number;
          started_at?: string;
          status?: string;
          step_count?: number;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          character_id?: string;
          character_job_id?: string;
          completed_at?: string | null;
          id?: string;
          location_id?: string;
          next_step_at?: string;
          paid_amount?: number;
          path_slug?: string;
          rank_level?: number;
          started_at?: string;
          status?: string;
          step_count?: number;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "career_shifts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_shifts_character_job_id_fkey";
            columns: ["character_job_id"];
            isOneToOne: false;
            referencedRelation: "character_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_shifts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_shifts_path_slug_fkey";
            columns: ["path_slug"];
            isOneToOne: false;
            referencedRelation: "career_paths";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "career_shifts_path_slug_rank_level_fkey";
            columns: ["path_slug", "rank_level"];
            isOneToOne: false;
            referencedRelation: "career_ranks";
            referencedColumns: ["path_slug", "level"];
          },
          {
            foreignKeyName: "career_shifts_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: true;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "career_shifts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      character_home_furniture: {
        Row: {
          character_id: string;
          created_at: string;
          item_id: string;
          quantity: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          item_id: string;
          quantity: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          item_id?: string;
          quantity?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_home_furniture_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      character_home_saves: {
        Row: {
          allow_friend_visits: boolean;
          character_id: string;
          payload: Json;
          revision: number;
          schema_version: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allow_friend_visits?: boolean;
          character_id: string;
          payload: Json;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allow_friend_visits?: boolean;
          character_id?: string;
          payload?: Json;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_home_saves_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      character_jobs: {
        Row: {
          career_level: number;
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
          career_level?: number;
          character_id: string;
          created_at?: string;
          hired_at?: string;
          id?: string;
          is_current?: boolean;
          job_id: string;
          last_performed_at?: string | null;
          times_performed?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          career_level?: number;
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
      character_npc_relationships: {
        Row: {
          character_id: string;
          conflict: number;
          daily_points: number;
          daily_points_day: number | null;
          friendship: number;
          id: string;
          last_interaction_day: number | null;
          last_interaction_text: string | null;
          meetings: number;
          npc_id: string;
          romance: number;
          trust: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          conflict?: number;
          daily_points?: number;
          daily_points_day?: number | null;
          friendship?: number;
          id?: string;
          last_interaction_day?: number | null;
          last_interaction_text?: string | null;
          meetings?: number;
          npc_id: string;
          romance?: number;
          trust?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          conflict?: number;
          daily_points?: number;
          daily_points_day?: number | null;
          friendship?: number;
          id?: string;
          last_interaction_day?: number | null;
          last_interaction_text?: string | null;
          meetings?: number;
          npc_id?: string;
          romance?: number;
          trust?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_npc_relationships_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "character_npc_relationships_npc_id_fkey";
            columns: ["npc_id"];
            isOneToOne: false;
            referencedRelation: "npc_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      character_simulations: {
        Row: {
          action_location: string | null;
          active_action: string | null;
          active_request: string | null;
          character_id: string;
          character_snapshot: Json;
          character_time: Json;
          heartbeat_at: string;
          home_action_duration_seconds: number;
          home_action_elapsed_seconds: number;
          minute_remainder: number;
          needs: Json;
          paused: boolean;
          personal_time: Json;
          queued_actions: Json;
          revision: number;
          session_id: string | null;
          skills: Json;
          sleep_elapsed_seconds: number;
          speed: number;
          user_id: string;
        };
        Insert: {
          action_location?: string | null;
          active_action?: string | null;
          active_request?: string | null;
          character_id: string;
          character_snapshot: Json;
          character_time: Json;
          heartbeat_at?: string;
          home_action_duration_seconds?: number;
          home_action_elapsed_seconds?: number;
          minute_remainder?: number;
          needs: Json;
          paused?: boolean;
          personal_time: Json;
          queued_actions?: Json;
          revision?: number;
          session_id?: string | null;
          skills?: Json;
          sleep_elapsed_seconds?: number;
          speed?: number;
          user_id: string;
        };
        Update: {
          action_location?: string | null;
          active_action?: string | null;
          active_request?: string | null;
          character_id?: string;
          character_snapshot?: Json;
          character_time?: Json;
          heartbeat_at?: string;
          home_action_duration_seconds?: number;
          home_action_elapsed_seconds?: number;
          minute_remainder?: number;
          needs?: Json;
          paused?: boolean;
          personal_time?: Json;
          queued_actions?: Json;
          revision?: number;
          session_id?: string | null;
          skills?: Json;
          sleep_elapsed_seconds?: number;
          speed?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "character_simulations_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      character_world_operations: {
        Row: {
          character_id: string;
          created_at: string;
          operation_id: string;
          operation_type: string;
          result: Json;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          operation_id: string;
          operation_type: string;
          result: Json;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          operation_id?: string;
          operation_type?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "character_world_operations_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
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
          current_location_id: string | null;
          current_town_id: string;
          energy: number;
          energy_updated_at: string;
          game_day: number;
          game_time_hour: number;
          game_time_minute: number;
          game_weekday: number;
          gender: string;
          happiness: number;
          health: number;
          hunger: number;
          id: string;
          inside_home_property_id: string | null;
          intelligence: number;
          is_adult: boolean | null;
          level: number;
          map_district_id: string;
          movement_state: string;
          name: string;
          occupation_preference: string | null;
          onboarding_step: string;
          personality: string;
          reputation: number;
          social: number;
          stress: number;
          thirst: number;
          updated_at: string;
          user_id: string;
          virtual_latitude: number;
          virtual_longitude: number;
          wanted_level: number;
          wealth: number;
          world_building_slug: string | null;
          world_position_revision: number;
          world_x: number;
          world_y: number;
          xp: number;
        };
        Insert: {
          age: number;
          appearance?: Json;
          career?: number;
          created_at?: string;
          current_location_id?: string | null;
          current_town_id?: string;
          energy?: number;
          energy_updated_at?: string;
          game_day?: number;
          game_time_hour?: number;
          game_time_minute?: number;
          game_weekday?: number;
          gender: string;
          happiness?: number;
          health?: number;
          hunger?: number;
          id?: string;
          inside_home_property_id?: string | null;
          intelligence?: number;
          is_adult?: boolean | null;
          level?: number;
          map_district_id?: string;
          movement_state?: string;
          name: string;
          occupation_preference?: string | null;
          onboarding_step?: string;
          personality: string;
          reputation?: number;
          social?: number;
          stress?: number;
          thirst?: number;
          updated_at?: string;
          user_id: string;
          virtual_latitude?: number;
          virtual_longitude?: number;
          wanted_level?: number;
          wealth?: number;
          world_building_slug?: string | null;
          world_position_revision?: number;
          world_x?: number;
          world_y?: number;
          xp?: number;
        };
        Update: {
          age?: number;
          appearance?: Json;
          career?: number;
          created_at?: string;
          current_location_id?: string | null;
          current_town_id?: string;
          energy?: number;
          energy_updated_at?: string;
          game_day?: number;
          game_time_hour?: number;
          game_time_minute?: number;
          game_weekday?: number;
          gender?: string;
          happiness?: number;
          health?: number;
          hunger?: number;
          id?: string;
          inside_home_property_id?: string | null;
          intelligence?: number;
          is_adult?: boolean | null;
          level?: number;
          map_district_id?: string;
          movement_state?: string;
          name?: string;
          occupation_preference?: string | null;
          onboarding_step?: string;
          personality?: string;
          reputation?: number;
          social?: number;
          stress?: number;
          thirst?: number;
          updated_at?: string;
          user_id?: string;
          virtual_latitude?: number;
          virtual_longitude?: number;
          wanted_level?: number;
          wealth?: number;
          world_building_slug?: string | null;
          world_position_revision?: number;
          world_x?: number;
          world_y?: number;
          xp?: number;
        };
        Relationships: [
          {
            foreignKeyName: "characters_current_location_id_fkey";
            columns: ["current_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "characters_current_town_id_fkey";
            columns: ["current_town_id"];
            isOneToOne: false;
            referencedRelation: "osun_towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "characters_inside_home_property_id_fkey";
            columns: ["inside_home_property_id"];
            isOneToOne: false;
            referencedRelation: "player_properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "characters_map_district_id_fkey";
            columns: ["map_district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
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
      city_civic_cases: {
        Row: {
          claimant_character_id: string;
          created_at: string;
          filed_game_day: number;
          id: string;
          location_id: string;
          respondent_character_id: string;
          status: string;
          summary: string;
        };
        Insert: {
          claimant_character_id: string;
          created_at?: string;
          filed_game_day: number;
          id?: string;
          location_id: string;
          respondent_character_id: string;
          status?: string;
          summary: string;
        };
        Update: {
          claimant_character_id?: string;
          created_at?: string;
          filed_game_day?: number;
          id?: string;
          location_id?: string;
          respondent_character_id?: string;
          status?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "city_civic_cases_claimant_character_id_fkey";
            columns: ["claimant_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_civic_cases_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_civic_cases_respondent_character_id_fkey";
            columns: ["respondent_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      city_event_catalog: {
        Row: {
          description: string;
          enabled: boolean;
          end_hour: number;
          id: string;
          landmark_id: string;
          outdoors: boolean;
          start_hour: number;
          title: string;
          weekday: number;
        };
        Insert: {
          description: string;
          enabled?: boolean;
          end_hour: number;
          id: string;
          landmark_id: string;
          outdoors: boolean;
          start_hour: number;
          title: string;
          weekday: number;
        };
        Update: {
          description?: string;
          enabled?: boolean;
          end_hour?: number;
          id?: string;
          landmark_id?: string;
          outdoors?: boolean;
          start_hour?: number;
          title?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "city_event_catalog_landmark_id_fkey";
            columns: ["landmark_id"];
            isOneToOne: false;
            referencedRelation: "map_landmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      city_event_occurrences: {
        Row: {
          description: string;
          district_id: string;
          ends_at: string;
          event_id: string;
          id: string;
          landmark_id: string;
          location_id: string;
          outdoors: boolean;
          starts_at: string;
          title: string;
          week_start: string;
          world_day: number;
        };
        Insert: {
          description: string;
          district_id: string;
          ends_at: string;
          event_id: string;
          id?: string;
          landmark_id: string;
          location_id: string;
          outdoors: boolean;
          starts_at: string;
          title: string;
          week_start: string;
          world_day: number;
        };
        Update: {
          description?: string;
          district_id?: string;
          ends_at?: string;
          event_id?: string;
          id?: string;
          landmark_id?: string;
          location_id?: string;
          outdoors?: boolean;
          starts_at?: string;
          title?: string;
          week_start?: string;
          world_day?: number;
        };
        Relationships: [
          {
            foreignKeyName: "city_event_occurrences_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_event_occurrences_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "city_event_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_event_occurrences_landmark_id_fkey";
            columns: ["landmark_id"];
            isOneToOne: false;
            referencedRelation: "map_landmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "city_event_occurrences_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      city_event_participation: {
        Row: {
          character_id: string;
          event_id: string;
          joined_at: string;
          world_day: number;
        };
        Insert: {
          character_id: string;
          event_id: string;
          joined_at?: string;
          world_day: number;
        };
        Update: {
          character_id?: string;
          event_id?: string;
          joined_at?: string;
          world_day?: number;
        };
        Relationships: [
          {
            foreignKeyName: "city_event_participation_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      club_visits: {
        Row: {
          character_id: string;
          end_reason: string | null;
          ended_at: string | null;
          expires_at: string;
          id: string;
          location_id: string;
          started_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          end_reason?: string | null;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          location_id: string;
          started_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          end_reason?: string | null;
          ended_at?: string | null;
          expires_at?: string;
          id?: string;
          location_id?: string;
          started_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "club_visits_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "club_visits_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      community_contributions: {
        Row: {
          amount_minor: number;
          character_id: string;
          created_at: string;
          fund_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          amount_minor: number;
          character_id: string;
          created_at?: string;
          fund_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          amount_minor?: number;
          character_id?: string;
          created_at?: string;
          fund_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "community_contributions_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_contributions_fund_id_fkey";
            columns: ["fund_id"];
            isOneToOne: false;
            referencedRelation: "community_funds";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "community_contributions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      community_funds: {
        Row: {
          active: boolean;
          goal_minor: number;
          id: string;
          slug: string;
          title: string;
        };
        Insert: {
          active?: boolean;
          goal_minor: number;
          id?: string;
          slug: string;
          title: string;
        };
        Update: {
          active?: boolean;
          goal_minor?: number;
          id?: string;
          slug?: string;
          title?: string;
        };
        Relationships: [];
      };
      content_items: {
        Row: {
          art_key: string;
          category: string;
          id: string;
          is_active: boolean;
          price_minor: number;
          slot_type: string;
          stackable: boolean;
          verify: boolean;
        };
        Insert: {
          art_key: string;
          category: string;
          id: string;
          is_active?: boolean;
          price_minor?: number;
          slot_type: string;
          stackable?: boolean;
          verify?: boolean;
        };
        Update: {
          art_key?: string;
          category?: string;
          id?: string;
          is_active?: boolean;
          price_minor?: number;
          slot_type?: string;
          stackable?: boolean;
          verify?: boolean;
        };
        Relationships: [];
      };
      daily_task_catalog: {
        Row: {
          action_id: string;
          enabled: boolean;
          reward_xp: number;
          sort_order: number;
          task_key: string;
          title: string;
        };
        Insert: {
          action_id: string;
          enabled?: boolean;
          reward_xp?: number;
          sort_order: number;
          task_key: string;
          title: string;
        };
        Update: {
          action_id?: string;
          enabled?: boolean;
          reward_xp?: number;
          sort_order?: number;
          task_key?: string;
          title?: string;
        };
        Relationships: [];
      };
      daily_task_claims: {
        Row: {
          character_id: string | null;
          claimed_at: string;
          lagos_date: string;
          reward_xp: number;
          task_key: string;
          user_id: string;
        };
        Insert: {
          character_id?: string | null;
          claimed_at?: string;
          lagos_date: string;
          reward_xp: number;
          task_key: string;
          user_id: string;
        };
        Update: {
          character_id?: string | null;
          claimed_at?: string;
          lagos_date?: string;
          reward_xp?: number;
          task_key?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "daily_task_claims_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "daily_task_claims_task_key_fkey";
            columns: ["task_key"];
            isOneToOne: false;
            referencedRelation: "daily_task_catalog";
            referencedColumns: ["task_key"];
          },
          {
            foreignKeyName: "daily_task_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      economy_request_results: {
        Row: {
          character_id: string;
          created_at: string;
          operation: string;
          request_id: string;
          result: Json;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          operation: string;
          request_id: string;
          result: Json;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          operation?: string;
          request_id?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "economy_request_results_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
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
      external_news_items: {
        Row: {
          created_at: string;
          expires_at: string;
          fetched_at: string;
          id: string;
          provider: string;
          published_at: string | null;
          region: string;
          source_name: string;
          source_url: string;
          title: string;
        };
        Insert: {
          created_at?: string;
          expires_at: string;
          fetched_at?: string;
          id?: string;
          provider: string;
          published_at?: string | null;
          region: string;
          source_name: string;
          source_url: string;
          title: string;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          fetched_at?: string;
          id?: string;
          provider?: string;
          published_at?: string | null;
          region?: string;
          source_name?: string;
          source_url?: string;
          title?: string;
        };
        Relationships: [];
      };
      external_news_refreshes: {
        Row: {
          failed_at: string | null;
          failure_message: string | null;
          provider: string;
          refreshed_at: string | null;
          region: string;
          updated_at: string;
        };
        Insert: {
          failed_at?: string | null;
          failure_message?: string | null;
          provider: string;
          refreshed_at?: string | null;
          region: string;
          updated_at?: string;
        };
        Update: {
          failed_at?: string | null;
          failure_message?: string | null;
          provider?: string;
          refreshed_at?: string | null;
          region?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      fixed_investment_products: {
        Row: {
          active: boolean;
          description: string;
          id: string;
          maximum_amount: number;
          minimum_amount: number;
          name: string;
          slug: string;
          term_days: number;
          yield_bps: number;
        };
        Insert: {
          active?: boolean;
          description: string;
          id?: string;
          maximum_amount: number;
          minimum_amount: number;
          name: string;
          slug: string;
          term_days: number;
          yield_bps: number;
        };
        Update: {
          active?: boolean;
          description?: string;
          id?: string;
          maximum_amount?: number;
          minimum_amount?: number;
          name?: string;
          slug?: string;
          term_days?: number;
          yield_bps?: number;
        };
        Relationships: [];
      };
      food_menu_items: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          price_minor: number;
          vendor_id: string;
        };
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          price_minor: number;
          vendor_id: string;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          price_minor?: number;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_menu_items_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "food_vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      food_order_items: {
        Row: {
          menu_item_id: string;
          order_id: string;
          quantity: number;
          unit_price_minor: number;
        };
        Insert: {
          menu_item_id: string;
          order_id: string;
          quantity: number;
          unit_price_minor: number;
        };
        Update: {
          menu_item_id?: string;
          order_id?: string;
          quantity?: number;
          unit_price_minor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "food_order_items_menu_item_id_fkey";
            columns: ["menu_item_id"];
            isOneToOne: false;
            referencedRelation: "food_menu_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "food_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      food_orders: {
        Row: {
          character_id: string;
          created_at: string;
          delivery_arrived_at: string | null;
          delivery_choice: string | null;
          delivery_eta_at: string;
          delivery_state: string;
          handoff_completed_at: string | null;
          handoff_due_at: string | null;
          id: string;
          package_collected_at: string | null;
          status: string;
          total_minor: number;
          user_id: string;
          vendor_id: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          delivery_arrived_at?: string | null;
          delivery_choice?: string | null;
          delivery_eta_at?: string;
          delivery_state?: string;
          handoff_completed_at?: string | null;
          handoff_due_at?: string | null;
          id?: string;
          package_collected_at?: string | null;
          status: string;
          total_minor: number;
          user_id: string;
          vendor_id: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          delivery_arrived_at?: string | null;
          delivery_choice?: string | null;
          delivery_eta_at?: string;
          delivery_state?: string;
          handoff_completed_at?: string | null;
          handoff_due_at?: string | null;
          id?: string;
          package_collected_at?: string | null;
          status?: string;
          total_minor?: number;
          user_id?: string;
          vendor_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "food_orders_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_orders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "food_orders_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "food_vendors";
            referencedColumns: ["id"];
          },
        ];
      };
      food_vendors: {
        Row: {
          active: boolean;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          active?: boolean;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          active?: boolean;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      game_action_audit: {
        Row: {
          action: string;
          created_at: string;
          error_code: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: Json;
          outcome: string;
          player_id: string;
          target_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          outcome: string;
          player_id: string;
          target_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: Json;
          outcome?: string;
          player_id?: string;
          target_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "game_action_audit_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "game_places_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      game_properties: {
        Row: {
          created_at: string;
          description: string;
          house_type_id: string | null;
          id: string;
          image_url: string | null;
          is_active: boolean;
          level_required: number;
          location_id: string;
          metadata: Json;
          name: string;
          property_type: string;
          purchase_price: number | null;
          rent_period_days: number;
          rent_price: number | null;
          slug: string;
          svg_x: number | null;
          svg_y: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description: string;
          house_type_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          level_required?: number;
          location_id: string;
          metadata?: Json;
          name: string;
          property_type: string;
          purchase_price?: number | null;
          rent_period_days?: number;
          rent_price?: number | null;
          slug: string;
          svg_x?: number | null;
          svg_y?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string;
          house_type_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          level_required?: number;
          location_id?: string;
          metadata?: Json;
          name?: string;
          property_type?: string;
          purchase_price?: number | null;
          rent_period_days?: number;
          rent_price?: number | null;
          slug?: string;
          svg_x?: number | null;
          svg_y?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "game_properties_house_type_id_fkey";
            columns: ["house_type_id"];
            isOneToOne: false;
            referencedRelation: "house_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "game_properties_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      home_item_idempotency: {
        Row: {
          created_at: string;
          idempotency_key: string;
          request_hash: string;
          response: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          idempotency_key: string;
          request_hash: string;
          response: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          request_hash?: string;
          response?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "home_item_idempotency_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      home_items: {
        Row: {
          character_id: string;
          equipped: boolean;
          id: string;
          item_id: string;
          placed: boolean;
          slot_id: string | null;
          slot_type: string;
          updated_at: string;
          user_id: string;
          x: number;
          y: number;
          z: number;
        };
        Insert: {
          character_id: string;
          equipped?: boolean;
          id?: string;
          item_id: string;
          placed?: boolean;
          slot_id?: string | null;
          slot_type: string;
          updated_at?: string;
          user_id: string;
          x?: number;
          y?: number;
          z?: number;
        };
        Update: {
          character_id?: string;
          equipped?: boolean;
          id?: string;
          item_id?: string;
          placed?: boolean;
          slot_id?: string | null;
          slot_type?: string;
          updated_at?: string;
          user_id?: string;
          x?: number;
          y?: number;
          z?: number;
        };
        Relationships: [
          {
            foreignKeyName: "home_items_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "home_items_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      house_action_idempotency: {
        Row: {
          action: string;
          created_at: string;
          idempotency_key: string;
          player_id: string;
          request_hash: string;
          response: Json;
        };
        Insert: {
          action: string;
          created_at?: string;
          idempotency_key: string;
          player_id: string;
          request_hash: string;
          response: Json;
        };
        Update: {
          action?: string;
          created_at?: string;
          idempotency_key?: string;
          player_id?: string;
          request_hash?: string;
          response?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "house_action_idempotency_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      house_placements: {
        Row: {
          id: string;
          item_id: string;
          placed_at: string;
          player_house_id: string;
          slot: string;
          x: number;
          y: number;
        };
        Insert: {
          id?: string;
          item_id: string;
          placed_at?: string;
          player_house_id: string;
          slot: string;
          x?: number;
          y?: number;
        };
        Update: {
          id?: string;
          item_id?: string;
          placed_at?: string;
          player_house_id?: string;
          slot?: string;
          x?: number;
          y?: number;
        };
        Relationships: [
          {
            foreignKeyName: "house_placements_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "house_placements_player_house_id_fkey";
            columns: ["player_house_id"];
            isOneToOne: false;
            referencedRelation: "player_houses";
            referencedColumns: ["id"];
          },
        ];
      };
      house_types: {
        Row: {
          asset_key: string;
          bathroom_access: string;
          bedrooms: number;
          deposit: number;
          deposit_weeks: number;
          description: string;
          extra_requirements: Json;
          floors: number;
          id: string;
          is_active: boolean;
          kitchen_access: string;
          label: string;
          min_weekly_income_minor: number;
          monthly_rent: number;
          placeholder: boolean;
          preference_tags: string[];
          shared_facilities: boolean;
          slots: Json;
          sort_order: number;
          starter_accessories: Json;
          verify: boolean;
          weekly_rent_minor: number;
        };
        Insert: {
          asset_key: string;
          bathroom_access: string;
          bedrooms: number;
          deposit: number;
          deposit_weeks?: number;
          description?: string;
          extra_requirements?: Json;
          floors?: number;
          id: string;
          is_active?: boolean;
          kitchen_access: string;
          label: string;
          min_weekly_income_minor?: number;
          monthly_rent: number;
          placeholder?: boolean;
          preference_tags?: string[];
          shared_facilities?: boolean;
          slots?: Json;
          sort_order?: number;
          starter_accessories?: Json;
          verify?: boolean;
          weekly_rent_minor?: number;
        };
        Update: {
          asset_key?: string;
          bathroom_access?: string;
          bedrooms?: number;
          deposit?: number;
          deposit_weeks?: number;
          description?: string;
          extra_requirements?: Json;
          floors?: number;
          id?: string;
          is_active?: boolean;
          kitchen_access?: string;
          label?: string;
          min_weekly_income_minor?: number;
          monthly_rent?: number;
          placeholder?: boolean;
          preference_tags?: string[];
          shared_facilities?: boolean;
          slots?: Json;
          sort_order?: number;
          starter_accessories?: Json;
          verify?: boolean;
          weekly_rent_minor?: number;
        };
        Relationships: [];
      };
      housing_choice_idempotency: {
        Row: {
          created_at: string;
          idempotency_key: string;
          request_hash: string;
          response: Json;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          idempotency_key: string;
          request_hash: string;
          response: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          request_hash?: string;
          response?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "housing_choice_idempotency_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          buy_price: number;
          category: string;
          created_at: string;
          description: string;
          effects: Json;
          equipment_slot: string | null;
          equippable: boolean;
          icon: string;
          id: string;
          max_stack: number;
          name: string;
          sell_price: number;
          sellable: boolean;
          slug: string;
          stackable: boolean;
          usable: boolean;
          value: number;
        };
        Insert: {
          buy_price?: number;
          category?: string;
          created_at?: string;
          description: string;
          effects?: Json;
          equipment_slot?: string | null;
          equippable?: boolean;
          icon?: string;
          id?: string;
          max_stack?: number;
          name: string;
          sell_price?: number;
          sellable?: boolean;
          slug: string;
          stackable?: boolean;
          usable?: boolean;
          value?: number;
        };
        Update: {
          buy_price?: number;
          category?: string;
          created_at?: string;
          description?: string;
          effects?: Json;
          equipment_slot?: string | null;
          equippable?: boolean;
          icon?: string;
          id?: string;
          max_stack?: number;
          name?: string;
          sell_price?: number;
          sellable?: boolean;
          slug?: string;
          stackable?: boolean;
          usable?: boolean;
          value?: number;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          career_path_slug: string | null;
          category: string;
          cooldown_minutes: number;
          created_at: string;
          description: string;
          duration_minutes: number;
          energy_cost: number;
          hunger_cost: number;
          icon: string;
          id: string;
          income_band: string;
          is_available: boolean;
          location_id: string | null;
          metadata: Json;
          name: string;
          place_id: string | null;
          reputation_reward: number;
          required_course_slug: string | null;
          required_level: number;
          requirements: Json;
          salary: number;
          shift_end_hour: number;
          shift_start_hour: number;
          skill_reward_slug: string;
          skill_reward_xp: number;
          slug: string;
          sort_order: number;
          stat_bonus: string;
          thirst_cost: number;
          xp_reward: number;
        };
        Insert: {
          career_path_slug?: string | null;
          category?: string;
          cooldown_minutes?: number;
          created_at?: string;
          description: string;
          duration_minutes?: number;
          energy_cost: number;
          hunger_cost?: number;
          icon?: string;
          id?: string;
          income_band?: string;
          is_available?: boolean;
          location_id?: string | null;
          metadata?: Json;
          name: string;
          place_id?: string | null;
          reputation_reward?: number;
          required_course_slug?: string | null;
          required_level?: number;
          requirements?: Json;
          salary: number;
          shift_end_hour?: number;
          shift_start_hour?: number;
          skill_reward_slug?: string;
          skill_reward_xp?: number;
          slug: string;
          sort_order?: number;
          stat_bonus?: string;
          thirst_cost?: number;
          xp_reward?: number;
        };
        Update: {
          career_path_slug?: string | null;
          category?: string;
          cooldown_minutes?: number;
          created_at?: string;
          description?: string;
          duration_minutes?: number;
          energy_cost?: number;
          hunger_cost?: number;
          icon?: string;
          id?: string;
          income_band?: string;
          is_available?: boolean;
          location_id?: string | null;
          metadata?: Json;
          name?: string;
          place_id?: string | null;
          reputation_reward?: number;
          required_course_slug?: string | null;
          required_level?: number;
          requirements?: Json;
          salary?: number;
          shift_end_hour?: number;
          shift_start_hour?: number;
          skill_reward_slug?: string;
          skill_reward_xp?: number;
          slug?: string;
          sort_order?: number;
          stat_bonus?: string;
          thirst_cost?: number;
          xp_reward?: number;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_career_path_slug_fkey";
            columns: ["career_path_slug"];
            isOneToOne: false;
            referencedRelation: "career_paths";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "jobs_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_place_id_fkey";
            columns: ["place_id"];
            isOneToOne: false;
            referencedRelation: "game_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_place_location_fkey";
            columns: ["place_id", "location_id"];
            isOneToOne: false;
            referencedRelation: "game_places";
            referencedColumns: ["id", "location_id"];
          },
          {
            foreignKeyName: "jobs_required_course_slug_fkey";
            columns: ["required_course_slug"];
            isOneToOne: false;
            referencedRelation: "education_courses";
            referencedColumns: ["slug"];
          },
        ];
      };
      location_activity_cooldowns: {
        Row: {
          action: string;
          character_id: string;
          last_game_day: number;
        };
        Insert: {
          action: string;
          character_id: string;
          last_game_day: number;
        };
        Update: {
          action?: string;
          character_id?: string;
          last_game_day?: number;
        };
        Relationships: [
          {
            foreignKeyName: "location_activity_cooldowns_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      location_activity_requests: {
        Row: {
          character_id: string;
          created_at: string;
          request_id: string;
          response: Json | null;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          request_id: string;
          response?: Json | null;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          request_id?: string;
          response?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "location_activity_requests_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
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
      locations: {
        Row: {
          canvas_x: number;
          canvas_y: number;
          color: string;
          created_at: string;
          description: string;
          district_type: string;
          entry_loops: string[];
          icon: string;
          id: string;
          image_url: string | null;
          interaction_radius_m: number;
          is_active: boolean;
          job_contract_slugs: string[];
          latitude: number | null;
          level_required: number;
          longitude: number | null;
          map_category: string;
          map_coordinate_mode: string;
          map_x: number;
          map_y: number;
          metadata: Json;
          name: string;
          neighbor_slugs: string[];
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
          canvas_x: number;
          canvas_y: number;
          color?: string;
          created_at?: string;
          description?: string;
          district_type?: string;
          entry_loops?: string[];
          icon?: string;
          id?: string;
          image_url?: string | null;
          interaction_radius_m?: number;
          is_active?: boolean;
          job_contract_slugs?: string[];
          latitude?: number | null;
          level_required?: number;
          longitude?: number | null;
          map_category?: string;
          map_coordinate_mode?: string;
          map_x?: number;
          map_y?: number;
          metadata?: Json;
          name: string;
          neighbor_slugs?: string[];
          planned_features?: string[];
          slug: string;
          sort_order?: number;
          tagline?: string;
          travel_fare?: number;
          travel_minutes?: number;
          type?: string;
          updated_at?: string;
        };
        Update: {
          canvas_x?: number;
          canvas_y?: number;
          color?: string;
          created_at?: string;
          description?: string;
          district_type?: string;
          entry_loops?: string[];
          icon?: string;
          id?: string;
          image_url?: string | null;
          interaction_radius_m?: number;
          is_active?: boolean;
          job_contract_slugs?: string[];
          latitude?: number | null;
          level_required?: number;
          longitude?: number | null;
          map_category?: string;
          map_coordinate_mode?: string;
          map_x?: number;
          map_y?: number;
          metadata?: Json;
          name?: string;
          neighbor_slugs?: string[];
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
      login_streak_claims: {
        Row: {
          character_id: string | null;
          claimed_at: string;
          lagos_date: string;
          reward_xp: number;
          streak: number;
          user_id: string;
        };
        Insert: {
          character_id?: string | null;
          claimed_at: string;
          lagos_date: string;
          reward_xp: number;
          streak: number;
          user_id: string;
        };
        Update: {
          character_id?: string | null;
          claimed_at?: string;
          lagos_date?: string;
          reward_xp?: number;
          streak?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "login_streak_claims_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "login_streak_claims_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      login_streak_settings: {
        Row: {
          reward_xp: number;
          singleton: boolean;
        };
        Insert: {
          reward_xp?: number;
          singleton?: boolean;
        };
        Update: {
          reward_xp?: number;
          singleton?: boolean;
        };
        Relationships: [];
      };
      login_streak_state: {
        Row: {
          last_check_in: string;
          streak: number;
          user_id: string;
        };
        Insert: {
          last_check_in: string;
          streak: number;
          user_id: string;
        };
        Update: {
          last_check_in?: string;
          streak?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "login_streak_state_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      map_age_check_logs: {
        Row: {
          checked_at: string;
          id: number;
          landmark_id: string;
          player_id: string;
        };
        Insert: {
          checked_at?: string;
          id?: never;
          landmark_id: string;
          player_id: string;
        };
        Update: {
          checked_at?: string;
          id?: never;
          landmark_id?: string;
          player_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_age_check_logs_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      map_district_distances: {
        Row: {
          distance_m: number;
          from_district_id: string;
          to_district_id: string;
        };
        Insert: {
          distance_m: number;
          from_district_id: string;
          to_district_id: string;
        };
        Update: {
          distance_m?: number;
          from_district_id?: string;
          to_district_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_district_distances_from_district_id_fkey";
            columns: ["from_district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_district_distances_to_district_id_fkey";
            columns: ["to_district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
        ];
      };
      map_districts: {
        Row: {
          id: string;
          layout_x: number;
          layout_y: number;
          name: string;
        };
        Insert: {
          id: string;
          layout_x: number;
          layout_y: number;
          name: string;
        };
        Update: {
          id?: string;
          layout_x?: number;
          layout_y?: number;
          name?: string;
        };
        Relationships: [];
      };
      map_landmark_actions: {
        Row: {
          definition: Json;
          id: string;
          is_active: boolean;
          landmark_id: string;
          sort_order: number;
        };
        Insert: {
          definition: Json;
          id: string;
          is_active?: boolean;
          landmark_id: string;
          sort_order?: number;
        };
        Update: {
          definition?: Json;
          id?: string;
          is_active?: boolean;
          landmark_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "map_landmark_actions_landmark_id_fkey";
            columns: ["landmark_id"];
            isOneToOne: false;
            referencedRelation: "map_landmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      map_landmarks: {
        Row: {
          created_at: string;
          district_id: string;
          id: string;
          is_available: boolean;
          location_id: string | null;
          min_age: number;
        };
        Insert: {
          created_at?: string;
          district_id: string;
          id: string;
          is_available?: boolean;
          location_id?: string | null;
          min_age?: number;
        };
        Update: {
          created_at?: string;
          district_id?: string;
          id?: string;
          is_available?: boolean;
          location_id?: string | null;
          min_age?: number;
        };
        Relationships: [
          {
            foreignKeyName: "map_landmarks_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_landmarks_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      map_location_districts: {
        Row: {
          district_id: string;
          location_id: string;
        };
        Insert: {
          district_id: string;
          location_id: string;
        };
        Update: {
          district_id?: string;
          location_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_location_districts_district_id_fkey";
            columns: ["district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_location_districts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: true;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      map_place_action_receipts: {
        Row: {
          action_id: string;
          character_id: string;
          created_at: string;
          landmark_id: string;
          request_id: string;
          response: Json | null;
        };
        Insert: {
          action_id: string;
          character_id: string;
          created_at?: string;
          landmark_id: string;
          request_id: string;
          response?: Json | null;
        };
        Update: {
          action_id?: string;
          character_id?: string;
          created_at?: string;
          landmark_id?: string;
          request_id?: string;
          response?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "map_place_action_receipts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_place_action_receipts_landmark_id_fkey";
            columns: ["landmark_id"];
            isOneToOne: false;
            referencedRelation: "map_landmarks";
            referencedColumns: ["id"];
          },
        ];
      };
      map_travels: {
        Row: {
          arrival_at: string;
          character_id: string;
          departed_at: string;
          distance_m: number;
          fare: number;
          from_district_id: string;
          id: string;
          idempotency_key: string;
          landmark_id: string;
          response: Json;
          status: string;
          to_district_id: string;
          travel_minutes: number;
          user_id: string;
        };
        Insert: {
          arrival_at: string;
          character_id: string;
          departed_at?: string;
          distance_m: number;
          fare: number;
          from_district_id: string;
          id?: string;
          idempotency_key: string;
          landmark_id: string;
          response: Json;
          status?: string;
          to_district_id: string;
          travel_minutes: number;
          user_id: string;
        };
        Update: {
          arrival_at?: string;
          character_id?: string;
          departed_at?: string;
          distance_m?: number;
          fare?: number;
          from_district_id?: string;
          id?: string;
          idempotency_key?: string;
          landmark_id?: string;
          response?: Json;
          status?: string;
          to_district_id?: string;
          travel_minutes?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "map_travels_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_travels_from_district_id_fkey";
            columns: ["from_district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_travels_landmark_id_fkey";
            columns: ["landmark_id"];
            isOneToOne: false;
            referencedRelation: "map_landmarks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_travels_to_district_id_fkey";
            columns: ["to_district_id"];
            isOneToOne: false;
            referencedRelation: "map_districts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "map_travels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      npc_definitions: {
        Row: {
          created_at: string;
          home_location_id: string | null;
          id: string;
          interests: string[];
          name: string;
          personality: string;
          role: string;
          routine: Json;
          topics: string[];
          work_location_id: string | null;
        };
        Insert: {
          created_at?: string;
          home_location_id?: string | null;
          id: string;
          interests?: string[];
          name: string;
          personality: string;
          role: string;
          routine?: Json;
          topics?: string[];
          work_location_id?: string | null;
        };
        Update: {
          created_at?: string;
          home_location_id?: string | null;
          id?: string;
          interests?: string[];
          name?: string;
          personality?: string;
          role?: string;
          routine?: Json;
          topics?: string[];
          work_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "npc_definitions_home_location_id_fkey";
            columns: ["home_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "npc_definitions_work_location_id_fkey";
            columns: ["work_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      npc_interaction_events: {
        Row: {
          accepted: boolean;
          action: string;
          character_id: string;
          created_at: string;
          game_day: number;
          id: string;
          message: string;
          npc_id: string;
          request_id: string;
          user_id: string;
        };
        Insert: {
          accepted: boolean;
          action: string;
          character_id: string;
          created_at?: string;
          game_day: number;
          id?: string;
          message: string;
          npc_id: string;
          request_id: string;
          user_id: string;
        };
        Update: {
          accepted?: boolean;
          action?: string;
          character_id?: string;
          created_at?: string;
          game_day?: number;
          id?: string;
          message?: string;
          npc_id?: string;
          request_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "npc_interaction_events_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "npc_interaction_events_npc_id_fkey";
            columns: ["npc_id"];
            isOneToOne: false;
            referencedRelation: "npc_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      npc_market_stalls: {
        Row: {
          goods: string;
          id: string;
          name: string;
          slug: string;
          status: string;
          visitor_count: number;
        };
        Insert: {
          goods: string;
          id?: string;
          name: string;
          slug: string;
          status: string;
          visitor_count?: number;
        };
        Update: {
          goods?: string;
          id?: string;
          name?: string;
          slug?: string;
          status?: string;
          visitor_count?: number;
        };
        Relationships: [];
      };
      npc_public_encounters: {
        Row: {
          action: string;
          character_id: string;
          created_at: string;
          id: string;
          location_id: string;
          npc_id: string;
          player_id: string;
          player_name: string;
        };
        Insert: {
          action: string;
          character_id: string;
          created_at?: string;
          id?: string;
          location_id: string;
          npc_id: string;
          player_id: string;
          player_name: string;
        };
        Update: {
          action?: string;
          character_id?: string;
          created_at?: string;
          id?: string;
          location_id?: string;
          npc_id?: string;
          player_id?: string;
          player_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "npc_public_encounters_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "npc_public_encounters_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "npc_public_encounters_npc_id_fkey";
            columns: ["npc_id"];
            isOneToOne: false;
            referencedRelation: "npc_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "npc_public_encounters_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      mini_game_boards: {
        Row: {
          cells: string;
          table_id: string;
          turn: number;
          updated_at: string;
          version: number;
        };
        Insert: {
          cells?: string;
          table_id: string;
          turn?: number;
          updated_at?: string;
          version?: number;
        };
        Update: {
          cells?: string;
          table_id?: string;
          turn?: number;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      mini_game_seats: {
        Row: {
          character_id: string;
          last_active_at: string;
          paid: number;
          seat: number;
          table_id: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          last_active_at?: string;
          paid: number;
          seat: number;
          table_id: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          last_active_at?: string;
          paid?: number;
          seat?: number;
          table_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      mini_game_tables: {
        Row: {
          created_at: string;
          fee_percent: number;
          finished_at: string | null;
          game: string;
          host_character_id: string;
          id: string;
          pot: number;
          result: string | null;
          stake: number;
          started_at: string | null;
          status: string;
          winner_character_id: string | null;
        };
        Insert: {
          created_at?: string;
          fee_percent?: number;
          finished_at?: string | null;
          game: string;
          host_character_id: string;
          id?: string;
          pot?: number;
          result?: string | null;
          stake: number;
          started_at?: string | null;
          status?: string;
          winner_character_id?: string | null;
        };
        Update: {
          created_at?: string;
          fee_percent?: number;
          finished_at?: string | null;
          game?: string;
          host_character_id?: string;
          id?: string;
          pot?: number;
          result?: string | null;
          stake?: number;
          started_at?: string | null;
          status?: string;
          winner_character_id?: string | null;
        };
        Relationships: [];
      };
      okada_ride_requests: {
        Row: {
          assigned_at: string | null;
          character_id: string;
          completed_at: string | null;
          created_at: string;
          destination: string;
          fare_minor: number;
          id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string | null;
          character_id: string;
          completed_at?: string | null;
          created_at?: string;
          destination: string;
          fare_minor: number;
          id?: string;
          status: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string | null;
          character_id?: string;
          completed_at?: string | null;
          created_at?: string;
          destination?: string;
          fare_minor?: number;
          id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "okada_ride_requests_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "okada_ride_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      osun_town_routes: {
        Row: {
          distance_units: number;
          fare_minor: number;
          from_town_id: string;
          to_town_id: string;
          travel_minutes: number;
        };
        Insert: {
          distance_units: number;
          fare_minor: number;
          from_town_id: string;
          to_town_id: string;
          travel_minutes: number;
        };
        Update: {
          distance_units?: number;
          fare_minor?: number;
          from_town_id?: string;
          to_town_id?: string;
          travel_minutes?: number;
        };
        Relationships: [
          {
            foreignKeyName: "osun_town_routes_from_town_id_fkey";
            columns: ["from_town_id"];
            isOneToOne: false;
            referencedRelation: "osun_towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osun_town_routes_to_town_id_fkey";
            columns: ["to_town_id"];
            isOneToOne: false;
            referencedRelation: "osun_towns";
            referencedColumns: ["id"];
          },
        ];
      };
      osun_town_travels: {
        Row: {
          arrival_at: string;
          character_id: string;
          departed_at: string;
          fare_minor: number;
          from_town_id: string;
          id: string;
          idempotency_key: string;
          response: Json;
          status: string;
          to_town_id: string;
          travel_minutes: number;
          user_id: string;
        };
        Insert: {
          arrival_at: string;
          character_id: string;
          departed_at?: string;
          fare_minor: number;
          from_town_id: string;
          id?: string;
          idempotency_key: string;
          response: Json;
          status?: string;
          to_town_id: string;
          travel_minutes: number;
          user_id: string;
        };
        Update: {
          arrival_at?: string;
          character_id?: string;
          departed_at?: string;
          fare_minor?: number;
          from_town_id?: string;
          id?: string;
          idempotency_key?: string;
          response?: Json;
          status?: string;
          to_town_id?: string;
          travel_minutes?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "osun_town_travels_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osun_town_travels_from_town_id_fkey";
            columns: ["from_town_id"];
            isOneToOne: false;
            referencedRelation: "osun_towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osun_town_travels_to_town_id_fkey";
            columns: ["to_town_id"];
            isOneToOne: false;
            referencedRelation: "osun_towns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "osun_town_travels_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      osun_towns: {
        Row: {
          id: string;
          is_detailed: boolean;
          name: string;
          travel_enabled: boolean;
        };
        Insert: {
          id: string;
          is_detailed?: boolean;
          name: string;
          travel_enabled?: boolean;
        };
        Update: {
          id?: string;
          is_detailed?: boolean;
          name?: string;
          travel_enabled?: boolean;
        };
        Relationships: [];
      };
      party_club_activities: {
        Row: {
          description: string;
          is_active: boolean;
          kind: string;
          mood_effect: number;
          name: string;
          price: number;
          slug: string;
        };
        Insert: {
          description: string;
          is_active?: boolean;
          kind: string;
          mood_effect: number;
          name: string;
          price: number;
          slug: string;
        };
        Update: {
          description?: string;
          is_active?: boolean;
          kind?: string;
          mood_effect?: number;
          name?: string;
          price?: number;
          slug?: string;
        };
        Relationships: [];
      };
      party_dance_cooldowns: {
        Row: {
          character_id: string;
          last_dance_at: string;
        };
        Insert: {
          character_id: string;
          last_dance_at?: string;
        };
        Update: {
          character_id?: string;
          last_dance_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_dance_cooldowns_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      party_drink_purchases: {
        Row: {
          amount: number;
          character_id: string;
          created_at: string;
          drink_slug: string;
          id: string;
          location_id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          character_id: string;
          created_at?: string;
          drink_slug: string;
          id?: string;
          location_id: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          character_id?: string;
          created_at?: string;
          drink_slug?: string;
          id?: string;
          location_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_drink_purchases_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "party_drink_purchases_drink_slug_fkey";
            columns: ["drink_slug"];
            isOneToOne: false;
            referencedRelation: "party_drinks";
            referencedColumns: ["slug"];
          },
          {
            foreignKeyName: "party_drink_purchases_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      party_drinks: {
        Row: {
          club_price: number;
          icon: string;
          is_active: boolean;
          mood_effect: number;
          name: string;
          price: number;
          slug: string;
        };
        Insert: {
          club_price: number;
          icon?: string;
          is_active?: boolean;
          mood_effect: number;
          name: string;
          price: number;
          slug: string;
        };
        Update: {
          club_price?: number;
          icon?: string;
          is_active?: boolean;
          mood_effect?: number;
          name?: string;
          price?: number;
          slug?: string;
        };
        Relationships: [];
      };
      party_event_fulfilments: {
        Row: {
          character_id: string;
          created_at: string;
          requirement_id: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          requirement_id: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          requirement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_event_fulfilments_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "party_event_fulfilments_requirement_id_fkey";
            columns: ["requirement_id"];
            isOneToOne: false;
            referencedRelation: "party_event_requirements";
            referencedColumns: ["id"];
          },
        ];
      };
      party_event_guests: {
        Row: {
          accepted_at: string;
          character_id: string | null;
          event_id: string;
          guest_user_id: string;
        };
        Insert: {
          accepted_at: string;
          character_id?: string | null;
          event_id: string;
          guest_user_id: string;
        };
        Update: {
          accepted_at?: string;
          character_id?: string | null;
          event_id?: string;
          guest_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_event_guests_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "party_event_guests_event_id_guest_user_id_fkey";
            columns: ["event_id", "guest_user_id"];
            isOneToOne: true;
            referencedRelation: "party_invitations";
            referencedColumns: ["event_id", "recipient_user_id"];
          },
        ];
      };
      party_event_requirements: {
        Row: {
          event_id: string;
          fulfilled_count: number;
          id: string;
          item_or_role: string;
          kind: string;
          quantity: number;
        };
        Insert: {
          event_id: string;
          fulfilled_count?: number;
          id?: string;
          item_or_role: string;
          kind: string;
          quantity: number;
        };
        Update: {
          event_id?: string;
          fulfilled_count?: number;
          id?: string;
          item_or_role?: string;
          kind?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: "party_event_requirements_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "party_events";
            referencedColumns: ["id"];
          },
        ];
      };
      party_events: {
        Row: {
          created_at: string;
          ends_at: string;
          host_character_id: string;
          id: string;
          location_id: string;
          starts_at: string;
          status: string;
          title: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          host_character_id: string;
          id?: string;
          location_id: string;
          starts_at: string;
          status?: string;
          title: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          host_character_id?: string;
          id?: string;
          location_id?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_events_host_character_id_fkey";
            columns: ["host_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "party_events_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      party_host_reward_receipts: {
        Row: {
          awarded_at: string;
          character_id: string | null;
          claim_date: string;
          event_id: string;
          result: Json;
          user_id: string;
        };
        Insert: {
          awarded_at: string;
          character_id?: string | null;
          claim_date: string;
          event_id: string;
          result: Json;
          user_id: string;
        };
        Update: {
          awarded_at?: string;
          character_id?: string | null;
          claim_date?: string;
          event_id?: string;
          result?: Json;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_host_reward_receipts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      party_host_reward_settings: {
        Row: {
          activated_at: string;
          reputation_reward: number;
          singleton: boolean;
        };
        Insert: {
          activated_at?: string;
          reputation_reward?: number;
          singleton?: boolean;
        };
        Update: {
          activated_at?: string;
          reputation_reward?: number;
          singleton?: boolean;
        };
        Relationships: [];
      };
      party_invitation_receipts: {
        Row: {
          created_at: string;
          created_invitation: boolean;
          payload: Json;
          request_id: string;
          result: Json;
          user_id: string;
        };
        Insert: {
          created_at: string;
          created_invitation: boolean;
          payload: Json;
          request_id: string;
          result: Json;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_invitation?: boolean;
          payload?: Json;
          request_id?: string;
          result?: Json;
          user_id?: string;
        };
        Relationships: [];
      };
      party_invitations: {
        Row: {
          created_at: string;
          event_id: string;
          host_user_id: string;
          id: string;
          recipient_user_id: string;
          responded_at: string | null;
          status: string;
        };
        Insert: {
          created_at: string;
          event_id: string;
          host_user_id: string;
          id?: string;
          recipient_user_id: string;
          responded_at?: string | null;
          status?: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          host_user_id?: string;
          id?: string;
          recipient_user_id?: string;
          responded_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_invitations_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "party_events";
            referencedColumns: ["id"];
          },
        ];
      };
      party_mood: {
        Row: {
          character_id: string;
          score: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          score?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          score?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_mood_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      party_venues: {
        Row: {
          created_at: string;
          is_active: boolean;
          location_id: string;
          venue_kind: string;
        };
        Insert: {
          created_at?: string;
          is_active?: boolean;
          location_id: string;
          venue_kind: string;
        };
        Update: {
          created_at?: string;
          is_active?: boolean;
          location_id?: string;
          venue_kind?: string;
        };
        Relationships: [
          {
            foreignKeyName: "party_venues_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: true;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      support_feedback: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          kind: string;
          message: string;
          status: string;
          subject: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          kind: string;
          message: string;
          status?: string;
          subject: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          message?: string;
          status?: string;
          subject?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      player_advertisements: {
        Row: {
          advertiser_name: string;
          amount_paid: number;
          billboard_id: string;
          created_at: string;
          creative_theme: string;
          description: string;
          duration_days: number;
          ends_at: string;
          id: string;
          owner_character_id: string;
          owner_user_id: string;
          request_id: string;
          starts_at: string;
          status: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          advertiser_name: string;
          amount_paid: number;
          billboard_id: string;
          created_at?: string;
          creative_theme: string;
          description: string;
          duration_days: number;
          ends_at: string;
          id?: string;
          owner_character_id: string;
          owner_user_id: string;
          request_id: string;
          starts_at?: string;
          status?: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          advertiser_name?: string;
          amount_paid?: number;
          billboard_id?: string;
          created_at?: string;
          creative_theme?: string;
          description?: string;
          duration_days?: number;
          ends_at?: string;
          id?: string;
          owner_character_id?: string;
          owner_user_id?: string;
          request_id?: string;
          starts_at?: string;
          status?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_advertisements_billboard_id_fkey";
            columns: ["billboard_id"];
            isOneToOne: false;
            referencedRelation: "game_billboards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_advertisements_owner_character_id_fkey";
            columns: ["owner_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_advertisements_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_blocks: {
        Row: {
          blocked_character_id: string;
          blocker_character_id: string;
          created_at: string;
        };
        Insert: {
          blocked_character_id: string;
          blocker_character_id: string;
          created_at?: string;
        };
        Update: {
          blocked_character_id?: string;
          blocker_character_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_blocks_blocked_character_id_fkey";
            columns: ["blocked_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_blocks_blocker_character_id_fkey";
            columns: ["blocker_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      player_career_events: {
        Row: {
          career_level: number;
          character_id: string;
          character_job_id: string;
          event: string;
          id: number;
          job_name: string;
          occurred_at: string;
          user_id: string;
        };
        Insert: {
          career_level: number;
          character_id: string;
          character_job_id: string;
          event: string;
          id?: never;
          job_name: string;
          occurred_at?: string;
          user_id: string;
        };
        Update: {
          career_level?: number;
          character_id?: string;
          character_job_id?: string;
          event?: string;
          id?: never;
          job_name?: string;
          occurred_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_career_events_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_career_events_character_job_id_fkey";
            columns: ["character_job_id"];
            isOneToOne: false;
            referencedRelation: "character_jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_career_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_companies: {
        Row: {
          accrued_at: string;
          business_id: string;
          id: string;
          owner_character_id: string;
          owner_user_id: string;
          service_prices: Json;
          shares_for_sale: number;
          updated_at: string;
        };
        Insert: {
          accrued_at?: string;
          business_id: string;
          id?: string;
          owner_character_id: string;
          owner_user_id: string;
          service_prices?: Json;
          shares_for_sale?: number;
          updated_at?: string;
        };
        Update: {
          accrued_at?: string;
          business_id?: string;
          id?: string;
          owner_character_id?: string;
          owner_user_id?: string;
          service_prices?: Json;
          shares_for_sale?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_companies_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "business_catalog";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_companies_owner_character_id_fkey";
            columns: ["owner_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_companies_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_company_shares: {
        Row: {
          character_id: string;
          company_id: string;
          created_at: string;
          shares: number;
          user_id: string;
        };
        Insert: {
          character_id: string;
          company_id: string;
          created_at?: string;
          shares: number;
          user_id: string;
        };
        Update: {
          character_id?: string;
          company_id?: string;
          created_at?: string;
          shares?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_company_shares_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_company_shares_company_id_fkey";
            columns: ["company_id"];
            isOneToOne: false;
            referencedRelation: "player_companies";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_company_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_course_plans: {
        Row: {
          character_id: string;
          course_id: string;
          planned_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          course_id: string;
          planned_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          course_id?: string;
          planned_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_course_plans_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_course_plans_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "education_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_course_plans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "player_courses_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_courses_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "education_courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_courses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_equipment: {
        Row: {
          character_id: string;
          durability: number | null;
          equipped_at: string;
          id: string;
          item_id: string;
          metadata: Json;
          slot: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          durability?: number | null;
          equipped_at?: string;
          id?: string;
          item_id: string;
          metadata?: Json;
          slot: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          durability?: number | null;
          equipped_at?: string;
          id?: string;
          item_id?: string;
          metadata?: Json;
          slot?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_equipment_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_equipment_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_equipment_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_event_reminders: {
        Row: {
          created_at: string;
          event_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          event_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          event_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_event_reminders_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "town_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_event_reminders_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_fixed_investments: {
        Row: {
          cancelled_at: string | null;
          character_id: string;
          claimed_at: string | null;
          created_at: string;
          id: string;
          matures_at: string;
          opened_at: string;
          principal: number;
          product_id: string;
          term_days: number;
          user_id: string;
          yield_bps: number;
        };
        Insert: {
          cancelled_at?: string | null;
          character_id: string;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          matures_at: string;
          opened_at?: string;
          principal: number;
          product_id: string;
          term_days: number;
          user_id: string;
          yield_bps: number;
        };
        Update: {
          cancelled_at?: string | null;
          character_id?: string;
          claimed_at?: string | null;
          created_at?: string;
          id?: string;
          matures_at?: string;
          opened_at?: string;
          principal?: number;
          product_id?: string;
          term_days?: number;
          user_id?: string;
          yield_bps?: number;
        };
        Relationships: [
          {
            foreignKeyName: "player_fixed_investments_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_fixed_investments_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "fixed_investment_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_fixed_investments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_friend_requests: {
        Row: {
          created_at: string;
          id: string;
          recipient_character_id: string;
          request_id: string;
          responded_at: string | null;
          sender_character_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          recipient_character_id: string;
          request_id: string;
          responded_at?: string | null;
          sender_character_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          recipient_character_id?: string;
          request_id?: string;
          responded_at?: string | null;
          sender_character_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_friend_requests_recipient_character_id_fkey";
            columns: ["recipient_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_friend_requests_sender_character_id_fkey";
            columns: ["sender_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      player_friendships: {
        Row: {
          created_at: string;
          first_character_id: string;
          second_character_id: string;
        };
        Insert: {
          created_at?: string;
          first_character_id: string;
          second_character_id: string;
        };
        Update: {
          created_at?: string;
          first_character_id?: string;
          second_character_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_friendships_first_character_id_fkey";
            columns: ["first_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_friendships_second_character_id_fkey";
            columns: ["second_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      player_home_accessory_sets: {
        Row: {
          band: string;
          budget_minor: number;
          character_id: string;
          created_at: string;
          id: string;
          items: Json;
          player_property_id: string;
        };
        Insert: {
          band: string;
          budget_minor: number;
          character_id: string;
          created_at?: string;
          id?: string;
          items: Json;
          player_property_id: string;
        };
        Update: {
          band?: string;
          budget_minor?: number;
          character_id?: string;
          created_at?: string;
          id?: string;
          items?: Json;
          player_property_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_home_accessory_sets_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_home_accessory_sets_player_property_id_fkey";
            columns: ["player_property_id"];
            isOneToOne: true;
            referencedRelation: "player_properties";
            referencedColumns: ["id"];
          },
        ];
      };
      player_homes: {
        Row: {
          character_id: string;
          house_type_id: string;
          id: string;
          moved_in_at: string;
          next_rent_at: string | null;
          user_id: string;
        };
        Insert: {
          character_id: string;
          house_type_id: string;
          id?: string;
          moved_in_at?: string;
          next_rent_at?: string | null;
          user_id: string;
        };
        Update: {
          character_id?: string;
          house_type_id?: string;
          id?: string;
          moved_in_at?: string;
          next_rent_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_homes_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_homes_house_type_id_fkey";
            columns: ["house_type_id"];
            isOneToOne: false;
            referencedRelation: "house_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_homes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_houses: {
        Row: {
          created_at: string;
          house_type_id: string;
          id: string;
          next_rent_due_at: string;
          player_id: string;
          player_property_id: string | null;
          rented_at: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          house_type_id: string;
          id?: string;
          next_rent_due_at: string;
          player_id: string;
          player_property_id?: string | null;
          rented_at?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          house_type_id?: string;
          id?: string;
          next_rent_due_at?: string;
          player_id?: string;
          player_property_id?: string | null;
          rented_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_houses_house_type_id_fkey";
            columns: ["house_type_id"];
            isOneToOne: false;
            referencedRelation: "house_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_houses_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_houses_player_property_id_fkey";
            columns: ["player_property_id"];
            isOneToOne: false;
            referencedRelation: "player_properties";
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
      player_items: {
        Row: {
          acquired_at: string;
          id: string;
          is_stackable: boolean;
          item_id: string;
          player_id: string;
          quantity: number;
          source: string;
        };
        Insert: {
          acquired_at?: string;
          id?: string;
          is_stackable?: boolean;
          item_id: string;
          player_id: string;
          quantity?: number;
          source: string;
        };
        Update: {
          acquired_at?: string;
          id?: string;
          is_stackable?: boolean;
          item_id?: string;
          player_id?: string;
          quantity?: number;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "content_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_items_player_id_fkey";
            columns: ["player_id"];
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
      player_online_presence: {
        Row: {
          character_id: string;
          seen_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          seen_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          seen_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_online_presence_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      player_outfit: {
        Row: {
          player_id: string;
          slots: Json;
          updated_at: string;
        };
        Insert: {
          player_id: string;
          slots?: Json;
          updated_at?: string;
        };
        Update: {
          player_id?: string;
          slots?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_outfit_player_id_fkey";
            columns: ["player_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_properties: {
        Row: {
          acquired_at: string;
          character_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          is_home: boolean;
          lease_ends_at: string | null;
          next_rent_due_at: string | null;
          property_id: string;
          rent_amount: number | null;
          rent_period_days: number | null;
          tenure: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          acquired_at?: string;
          character_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_home?: boolean;
          lease_ends_at?: string | null;
          next_rent_due_at?: string | null;
          property_id: string;
          rent_amount?: number | null;
          rent_period_days?: number | null;
          tenure: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          acquired_at?: string;
          character_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_home?: boolean;
          lease_ends_at?: string | null;
          next_rent_due_at?: string | null;
          property_id?: string;
          rent_amount?: number | null;
          rent_period_days?: number | null;
          tenure?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_properties_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_properties_property_id_fkey";
            columns: ["property_id"];
            isOneToOne: false;
            referencedRelation: "game_properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_properties_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_reports: {
        Row: {
          category: string;
          created_at: string;
          details: string;
          id: string;
          reported_message_id: string | null;
          reporter_character_id: string;
          reviewed_at: string | null;
          status: string;
          target_character_id: string | null;
          target_name_snapshot: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          details?: string;
          id?: string;
          reported_message_id?: string | null;
          reporter_character_id: string;
          reviewed_at?: string | null;
          status?: string;
          target_character_id?: string | null;
          target_name_snapshot: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          details?: string;
          id?: string;
          reported_message_id?: string | null;
          reporter_character_id?: string;
          reviewed_at?: string | null;
          status?: string;
          target_character_id?: string | null;
          target_name_snapshot?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_reports_reported_message_id_fkey";
            columns: ["reported_message_id"];
            isOneToOne: false;
            referencedRelation: "social_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_reports_reporter_character_id_fkey";
            columns: ["reporter_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_reports_target_character_id_fkey";
            columns: ["target_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      player_side_hustles: {
        Row: {
          character_id: string;
          created_at: string;
          dropped_at: string | null;
          id: string;
          keep_confirmed_at: string | null;
          next_shift_at: string;
          rent_cycle_id: string;
          shift_pay_minor: number;
          shifts_completed: number;
          shifts_total: number;
          status: string;
          title: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          dropped_at?: string | null;
          id?: string;
          keep_confirmed_at?: string | null;
          next_shift_at?: string;
          rent_cycle_id: string;
          shift_pay_minor: number;
          shifts_completed?: number;
          shifts_total?: number;
          status?: string;
          title?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          dropped_at?: string | null;
          id?: string;
          keep_confirmed_at?: string | null;
          next_shift_at?: string;
          rent_cycle_id?: string;
          shift_pay_minor?: number;
          shifts_completed?: number;
          shifts_total?: number;
          status?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_side_hustles_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_side_hustles_rent_cycle_id_fkey";
            columns: ["rent_cycle_id"];
            isOneToOne: false;
            referencedRelation: "property_rent_cycles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_skills: {
        Row: {
          character_id: string;
          created_at: string;
          experience: number;
          id: string;
          level: number;
          skill_slug: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          experience?: number;
          id?: string;
          level?: number;
          skill_slug: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          experience?: number;
          id?: string;
          level?: number;
          skill_slug?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_skills_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_skills_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_stalls: {
        Row: {
          character_id: string;
          goods: string;
          id: string;
          is_open: boolean;
          name: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          character_id: string;
          goods: string;
          id?: string;
          is_open?: boolean;
          name: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          goods?: string;
          id?: string;
          is_open?: boolean;
          name?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_stalls_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_stalls_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      player_status_posts: {
        Row: {
          body: string;
          created_at: string;
          expires_at: string;
          id: string;
          owner_character_id: string;
          owner_user_id: string;
          theme: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          owner_character_id: string;
          owner_user_id: string;
          theme: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          expires_at?: string;
          id?: string;
          owner_character_id?: string;
          owner_user_id?: string;
          theme?: string;
        };
        Relationships: [
          {
            foreignKeyName: "player_status_posts_owner_character_id_fkey";
            columns: ["owner_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "player_status_posts_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          app_tile_style: string;
          created_at: string;
          dashboard_pins: Json;
          display_name: string | null;
          effects_enabled: boolean;
          id: string;
          music_enabled: boolean;
          reduced_motion: boolean;
          sound_enabled: boolean;
          updated_at: string;
          username: string | null;
        };
        Insert: {
          app_tile_style?: string;
          created_at?: string;
          dashboard_pins?: Json;
          display_name?: string | null;
          effects_enabled?: boolean;
          id: string;
          music_enabled?: boolean;
          reduced_motion?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          app_tile_style?: string;
          created_at?: string;
          dashboard_pins?: Json;
          display_name?: string | null;
          effects_enabled?: boolean;
          id?: string;
          music_enabled?: boolean;
          reduced_motion?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          username?: string | null;
        };
        Relationships: [];
      };
      property_rent_cycles: {
        Row: {
          amount_minor: number;
          character_id: string;
          created_at: string;
          due_at: string;
          grace_ends_at: string;
          id: string;
          notice_acknowledged_at: string | null;
          paid_at: string | null;
          period_start_at: string;
          player_property_id: string;
          repossessed_at: string | null;
          rescue_ends_at: string;
          status: string;
        };
        Insert: {
          amount_minor: number;
          character_id: string;
          created_at?: string;
          due_at: string;
          grace_ends_at: string;
          id?: string;
          notice_acknowledged_at?: string | null;
          paid_at?: string | null;
          period_start_at: string;
          player_property_id: string;
          repossessed_at?: string | null;
          rescue_ends_at: string;
          status: string;
        };
        Update: {
          amount_minor?: number;
          character_id?: string;
          created_at?: string;
          due_at?: string;
          grace_ends_at?: string;
          id?: string;
          notice_acknowledged_at?: string | null;
          paid_at?: string | null;
          period_start_at?: string;
          player_property_id?: string;
          repossessed_at?: string | null;
          rescue_ends_at?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_rent_cycles_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_rent_cycles_player_property_id_fkey";
            columns: ["player_property_id"];
            isOneToOne: false;
            referencedRelation: "player_properties";
            referencedColumns: ["id"];
          },
        ];
      };
      property_rent_ledger: {
        Row: {
          amount: number;
          character_id: string;
          due_at: string;
          id: string;
          paid_at: string | null;
          player_property_id: string;
          status: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          character_id: string;
          due_at: string;
          id?: string;
          paid_at?: string | null;
          player_property_id: string;
          status?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          character_id?: string;
          due_at?: string;
          id?: string;
          paid_at?: string | null;
          player_property_id?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_rent_ledger_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_rent_ledger_player_property_id_fkey";
            columns: ["player_property_id"];
            isOneToOne: false;
            referencedRelation: "player_properties";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_rent_ledger_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      property_rent_rescue_loans: {
        Row: {
          character_id: string;
          created_at: string;
          id: string;
          instalment_minor: number;
          instalments_paid: number;
          instalments_total: number;
          principal_minor: number;
          rent_cycle_id: string;
          status: string;
        };
        Insert: {
          character_id: string;
          created_at?: string;
          id?: string;
          instalment_minor: number;
          instalments_paid?: number;
          instalments_total?: number;
          principal_minor: number;
          rent_cycle_id: string;
          status?: string;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          id?: string;
          instalment_minor?: number;
          instalments_paid?: number;
          instalments_total?: number;
          principal_minor?: number;
          rent_cycle_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "property_rent_rescue_loans_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_rent_rescue_loans_rent_cycle_id_fkey";
            columns: ["rent_cycle_id"];
            isOneToOne: true;
            referencedRelation: "property_rent_cycles";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_items: {
        Row: {
          buy_price: number | null;
          created_at: string;
          id: string;
          is_available: boolean;
          item_id: string;
          minimum_quantity: number;
          sell_price: number | null;
          shop_id: string;
          stock: number | null;
          updated_at: string;
        };
        Insert: {
          buy_price?: number | null;
          created_at?: string;
          id?: string;
          is_available?: boolean;
          item_id: string;
          minimum_quantity?: number;
          sell_price?: number | null;
          shop_id: string;
          stock?: number | null;
          updated_at?: string;
        };
        Update: {
          buy_price?: number | null;
          created_at?: string;
          id?: string;
          is_available?: boolean;
          item_id?: string;
          minimum_quantity?: number;
          sell_price?: number | null;
          shop_id?: string;
          stock?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_items_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          category: string;
          closing_hour: number;
          created_at: string;
          game_place_id: string | null;
          id: string;
          is_open: boolean;
          location_id: string;
          name: string;
          opening_hour: number;
          slug: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          closing_hour?: number;
          created_at?: string;
          game_place_id?: string | null;
          id?: string;
          is_open?: boolean;
          location_id: string;
          name: string;
          opening_hour?: number;
          slug: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          closing_hour?: number;
          created_at?: string;
          game_place_id?: string | null;
          id?: string;
          is_open?: boolean;
          location_id?: string;
          name?: string;
          opening_hour?: number;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shops_game_place_id_fkey";
            columns: ["game_place_id"];
            isOneToOne: true;
            referencedRelation: "game_places";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_action_receipts: {
        Row: {
          action_id: string;
          character_id: string;
          completed_at: string;
          request_id: string;
        };
        Insert: {
          action_id: string;
          character_id: string;
          completed_at?: string;
          request_id: string;
        };
        Update: {
          action_id?: string;
          character_id?: string;
          completed_at?: string;
          request_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulation_action_receipts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      social_conversations: {
        Row: {
          created_at: string;
          first_character_id: string;
          id: string;
          second_character_id: string;
        };
        Insert: {
          created_at?: string;
          first_character_id: string;
          id?: string;
          second_character_id: string;
        };
        Update: {
          created_at?: string;
          first_character_id?: string;
          id?: string;
          second_character_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_conversations_first_character_id_fkey";
            columns: ["first_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_conversations_second_character_id_fkey";
            columns: ["second_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      social_inbox_events: {
        Row: {
          account_id: string;
          id: number;
          last_activity: string;
          thread_id: string;
          unread_delta: number;
        };
        Insert: {
          account_id: string;
          id?: never;
          last_activity?: string;
          thread_id: string;
          unread_delta?: number;
        };
        Update: {
          account_id?: string;
          id?: never;
          last_activity?: string;
          thread_id?: string;
          unread_delta?: number;
        };
        Relationships: [
          {
            foreignKeyName: "social_inbox_events_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "social_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      social_media_uploads: {
        Row: {
          completed: boolean;
          conversation_id: string | null;
          created_at: string;
          digest: string;
          filename: string;
          id: string;
          message_id: string | null;
          mime_type: string;
          owner_character_id: string;
          purpose: string;
          request_id: string;
          size_bytes: number;
          storage_path: string;
        };
        Insert: {
          completed?: boolean;
          conversation_id?: string | null;
          created_at?: string;
          digest: string;
          filename: string;
          id?: string;
          message_id?: string | null;
          mime_type: string;
          owner_character_id: string;
          purpose: string;
          request_id: string;
          size_bytes: number;
          storage_path: string;
        };
        Update: {
          completed?: boolean;
          conversation_id?: string | null;
          created_at?: string;
          digest?: string;
          filename?: string;
          id?: string;
          message_id?: string | null;
          mime_type?: string;
          owner_character_id?: string;
          purpose?: string;
          request_id?: string;
          size_bytes?: number;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_media_uploads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "social_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_media_uploads_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: true;
            referencedRelation: "social_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_media_uploads_owner_character_id_fkey";
            columns: ["owner_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      social_message_stars: {
        Row: {
          account_id: string;
          message_id: string;
          starred_at: string;
        };
        Insert: {
          account_id: string;
          message_id: string;
          starred_at?: string;
        };
        Update: {
          account_id?: string;
          message_id?: string;
          starred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_message_stars_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "social_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      social_messages: {
        Row: {
          body: string;
          channel: string;
          conversation_id: string | null;
          created_at: string;
          id: string;
          location_id: string | null;
          message_type: string;
          reply_to_message_id: string | null;
          request_id: string;
          sender_character_id: string;
          voice_duration_ms: number | null;
          voice_path: string | null;
        };
        Insert: {
          body: string;
          channel: string;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          location_id?: string | null;
          message_type?: string;
          reply_to_message_id?: string | null;
          request_id: string;
          sender_character_id: string;
          voice_duration_ms?: number | null;
          voice_path?: string | null;
        };
        Update: {
          body?: string;
          channel?: string;
          conversation_id?: string | null;
          created_at?: string;
          id?: string;
          location_id?: string | null;
          message_type?: string;
          reply_to_message_id?: string | null;
          request_id?: string;
          sender_character_id?: string;
          voice_duration_ms?: number | null;
          voice_path?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "social_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "social_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_messages_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "social_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_messages_sender_character_id_fkey";
            columns: ["sender_character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
        ];
      };
      social_profile_covers: {
        Row: {
          character_id: string;
          media_id: string;
        };
        Insert: {
          character_id: string;
          media_id: string;
        };
        Update: {
          character_id?: string;
          media_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "social_profile_covers_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: true;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "social_profile_covers_media_id_fkey";
            columns: ["media_id"];
            isOneToOne: false;
            referencedRelation: "social_media_uploads";
            referencedColumns: ["id"];
          },
        ];
      };
      stall_income_days: {
        Row: {
          earning_date: string;
          open_microseconds: number;
          paid: number;
          policy_version: number;
          user_id: string;
        };
        Insert: {
          earning_date: string;
          open_microseconds: number;
          paid?: number;
          policy_version?: number;
          user_id: string;
        };
        Update: {
          earning_date?: string;
          open_microseconds?: number;
          paid?: number;
          policy_version?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stall_income_days_policy_version_fkey";
            columns: ["policy_version"];
            isOneToOne: false;
            referencedRelation: "stall_income_policy";
            referencedColumns: ["version"];
          },
        ];
      };
      stall_income_policy: {
        Row: {
          activated_at: string;
          daily_cap: number;
          retained_dates: number;
          seconds_per_naira: number;
          version: number;
        };
        Insert: {
          activated_at?: string;
          daily_cap?: number;
          retained_dates?: number;
          seconds_per_naira?: number;
          version: number;
        };
        Update: {
          activated_at?: string;
          daily_cap?: number;
          retained_dates?: number;
          seconds_per_naira?: number;
          version?: number;
        };
        Relationships: [];
      };
      stall_income_receipts: {
        Row: {
          character_id: string | null;
          claimed_at: string;
          request_id: string;
          result: Json;
          transaction_id: string | null;
          user_id: string;
        };
        Insert: {
          character_id?: string | null;
          claimed_at: string;
          request_id: string;
          result: Json;
          transaction_id?: string | null;
          user_id: string;
        };
        Update: {
          character_id?: string | null;
          claimed_at?: string;
          request_id?: string;
          result?: Json;
          transaction_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stall_income_receipts_character_id_fkey";
            columns: ["character_id"];
            isOneToOne: false;
            referencedRelation: "characters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stall_income_receipts_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      stall_income_state: {
        Row: {
          is_open: boolean;
          policy_version: number;
          settled_at: string;
          stall_id: string | null;
          user_id: string;
        };
        Insert: {
          is_open?: boolean;
          policy_version?: number;
          settled_at: string;
          stall_id?: string | null;
          user_id: string;
        };
        Update: {
          is_open?: boolean;
          policy_version?: number;
          settled_at?: string;
          stall_id?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stall_income_state_policy_version_fkey";
            columns: ["policy_version"];
            isOneToOne: false;
            referencedRelation: "stall_income_policy";
            referencedColumns: ["version"];
          },
        ];
      };
      thread_prefs: {
        Row: {
          account_id: string;
          last_read_at: string | null;
          muted_until: string | null;
          pinned_at: string | null;
          starred_at: string | null;
          thread_id: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          last_read_at?: string | null;
          muted_until?: string | null;
          pinned_at?: string | null;
          starred_at?: string | null;
          thread_id: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          last_read_at?: string | null;
          muted_until?: string | null;
          pinned_at?: string | null;
          starred_at?: string | null;
          thread_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "thread_prefs_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "social_conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      town_events: {
        Row: {
          created_at: string;
          id: string;
          slug: string;
          starts_at: string;
          title: string;
          venue: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          slug: string;
          starts_at: string;
          title: string;
          venue: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          slug?: string;
          starts_at?: string;
          title?: string;
          venue?: string;
        };
        Relationships: [];
      };
      town_news_comments: {
        Row: {
          body: string;
          created_at: string;
          id: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          id?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          id?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "town_news_comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "town_news_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "town_news_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_news_posts: {
        Row: {
          author_user_id: string | null;
          body: string;
          category: string;
          created_at: string;
          id: string;
          title: string;
        };
        Insert: {
          author_user_id?: string | null;
          body: string;
          category: string;
          created_at?: string;
          id?: string;
          title: string;
        };
        Update: {
          author_user_id?: string | null;
          body?: string;
          category?: string;
          created_at?: string;
          id?: string;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "town_news_posts_author_user_id_fkey";
            columns: ["author_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_news_reactions: {
        Row: {
          created_at: string;
          post_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          post_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          post_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "town_news_reactions_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "town_news_posts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "town_news_reactions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      town_service_prices: {
        Row: {
          active: boolean;
          amount_minor: number;
          service: string;
        };
        Insert: {
          active?: boolean;
          amount_minor: number;
          service: string;
        };
        Update: {
          active?: boolean;
          amount_minor?: number;
          service?: string;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          account: string;
          amount: number;
          balance_after: number | null;
          category: string;
          character_id: string;
          created_at: string;
          description: string;
          destination: string | null;
          id: string;
          kind: string;
          metadata: Json;
          source: string | null;
          transaction_type: string;
          user_id: string;
          wallet_id: string;
        };
        Insert: {
          account?: string;
          amount: number;
          balance_after?: number | null;
          category: string;
          character_id: string;
          created_at?: string;
          description: string;
          destination?: string | null;
          id?: string;
          kind: string;
          metadata?: Json;
          source?: string | null;
          transaction_type: string;
          user_id: string;
          wallet_id: string;
        };
        Update: {
          account?: string;
          amount?: number;
          balance_after?: number | null;
          category?: string;
          character_id?: string;
          created_at?: string;
          description?: string;
          destination?: string | null;
          id?: string;
          kind?: string;
          metadata?: Json;
          source?: string | null;
          transaction_type?: string;
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
      username_accounts: {
        Row: {
          created_at: string;
          user_id: string;
          username: string;
        };
        Insert: {
          created_at?: string;
          user_id: string;
          username: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
          username?: string;
        };
        Relationships: [];
      };
      username_auth_attempts: {
        Row: {
          attempt_count: number;
          attempt_key: string;
          window_start: string;
        };
        Insert: {
          attempt_count?: number;
          attempt_key: string;
          window_start: string;
        };
        Update: {
          attempt_count?: number;
          attempt_key?: string;
          window_start?: string;
        };
        Relationships: [];
      };
      wallets: {
        Row: {
          balance: number;
          bank_balance: number;
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
          bank_balance?: number;
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
          bank_balance?: number;
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
      _acquire_game_property_original: {
        Args: { p_property_id: string; p_tenure: string };
        Returns: Json;
      };
      _activate_property_home: {
        Args: { p_property_id: string };
        Returns: undefined;
      };
      _advance_character_game_time: {
        Args: { p_char: string; p_minutes: number };
        Returns: Json;
      };
      _advance_property_rent_cycles: { Args: never; Returns: number };
      _assert_map_destination_age: {
        Args: { p_character_id: string; p_location_id: string };
        Returns: undefined;
      };
      _audit_house_action: {
        Args: {
          p_action: string;
          p_error_code?: string;
          p_idempotency_key?: string;
          p_metadata?: Json;
          p_outcome: string;
          p_player_id: string;
          p_target_id: string;
        };
        Returns: undefined;
      };
      _cancel_player_house_original: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      _course_completed: {
        Args: { p_character_id: string; p_course_slug: string };
        Returns: boolean;
      };
      _credit: {
        Args: {
          p_amount: number;
          p_category: string;
          p_char: string;
          p_desc: string;
        };
        Returns: undefined;
      };
      _economy_shop_is_open: {
        Args: {
          p_hour: number;
          p_shop: Database["public"]["Tables"]["shops"]["Row"];
        };
        Returns: boolean;
      };
      _ensure_city_event_occurrences: {
        Args: { p_stamp: string };
        Returns: undefined;
      };
      _grant_house_essentials: {
        Args: { p_house_id: string };
        Returns: undefined;
      };
      _grant_xp: { Args: { p_char: string; p_xp: number }; Returns: number };
      _home_furniture_within_owned: {
        Args: { p_character_id: string; p_payload: Json; p_user_id: string };
        Returns: boolean;
      };
      _house_error: { Args: { p_code: string }; Returns: Json };
      _housing_accessory_band: {
        Args: { p_budget_minor: number };
        Returns: string;
      };
      _housing_monthly_income: {
        Args: { p_character_id: string };
        Returns: number;
      };
      _housing_rent_legacy: {
        Args: {
          p_house_type_id: string;
          p_idempotency_key: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      _housing_weekly_income: {
        Args: { p_character_id: string };
        Returns: Json;
      };
      _job_requirement_errors: {
        Args: { p_character_id: string; p_job_id: string };
        Returns: string[];
      };
      _join_city_event_occurrence: {
        Args: { p_event: string; p_occurrence_id: string };
        Returns: Json;
      };
      _map_activity_is_open: {
        Args: { definition: Json; shared_hour: number };
        Returns: boolean;
      };
      _map_schedule_clock: { Args: never; Returns: Json };
      _my_character_id: { Args: never; Returns: string };
      _my_social_character_id: { Args: never; Returns: string };
      _notify: {
        Args: {
          p_body: string;
          p_char: string;
          p_kind?: string;
          p_title: string;
        };
        Returns: undefined;
      };
      _party_active_visit: {
        Args: { p_character_id: string };
        Returns: {
          character_id: string;
          end_reason: string | null;
          ended_at: string | null;
          expires_at: string;
          id: string;
          location_id: string;
          started_at: string;
          user_id: string;
        };
        SetofOptions: {
          from: "*";
          to: "club_visits";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      _party_host_result: {
        Args: { p_event: string; p_now: string };
        Returns: Json;
      };
      _party_is_venue: {
        Args: { p_kind: string; p_location_id: string };
        Returns: boolean;
      };
      _perform_job_base: { Args: { p_request_id: string }; Returns: Json };
      _perform_job_once: { Args: never; Returns: Json };
      _process_player_house_status: {
        Args: { p_player_id: string };
        Returns: undefined;
      };
      _promote_job_base: { Args: never; Returns: Json };
      _recalc_missions: { Args: { p_char: string }; Returns: undefined };
      _refresh_energy: { Args: { p_char: string }; Returns: number };
      _require_bank_location: { Args: { p_char: string }; Returns: undefined };
      _select_job_base: { Args: { p_job_id: string }; Returns: undefined };
      _settle_player_company_earnings: {
        Args: { p_company_id: string };
        Returns: Json;
      };
      _settle_stall_income: {
        Args: { p_stamp: string; p_user: string };
        Returns: undefined;
      };
      _social_blocked: { Args: { p_other: string }; Returns: boolean };
      _social_media_thread_access: {
        Args: { p_me: string; p_thread: string };
        Returns: boolean;
      };
      _stall_income_preview: {
        Args: { p_stamp: string; p_user: string };
        Returns: {
          earning_date: string;
          open_microseconds: number;
          paid: number;
        }[];
      };
      _valid_home_save: { Args: { p: Json }; Returns: boolean };
      _validate_shop_minimum: {
        Args: {
          p_offer: Database["public"]["Tables"]["shop_items"]["Row"];
          p_quantity: number;
        };
        Returns: undefined;
      };
      ack_housing_repossession: {
        Args: { p_cycle_id: string; p_user_id: string };
        Returns: Json;
      };
      acquire_game_property: {
        Args: { p_property_id: string; p_tenure: string };
        Returns: Json;
      };
      apply_party_mood: {
        Args: { p_character_id: string; p_delta: number; p_user_id: string };
        Returns: number;
      };
      apply_rent_relief_hustle: {
        Args: { p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      block_player: { Args: { p_target_character_id: string }; Returns: Json };
      buy_drink: {
        Args: { p_drink_slug: string; p_request_id: string };
        Returns: Json;
      };
      buy_player_company: {
        Args: { p_business_slug: string; p_request_id: string };
        Returns: Json;
      };
      cancel_career_shift: { Args: { p_shift_id: string }; Returns: Json };
      cancel_fixed_term_investment: {
        Args: { p_investment_id: string; p_request_id: string };
        Returns: Json;
      };
      cancel_player_friend_request: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      cancel_player_house: { Args: { p_user_id: string }; Returns: Json };
      check_in_login: { Args: { p_date: string }; Returns: Json };
      choose_move_in_accessory_budget: {
        Args: {
          p_budget_minor: number;
          p_request_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      claim_career_shift: { Args: { p_shift_id: string }; Returns: Json };
      claim_daily_task: {
        Args: { p_date: string; p_task_key: string };
        Returns: Json;
      };
      claim_fixed_term_investment: {
        Args: { p_investment_id: string };
        Returns: Json;
      };
      claim_mission: { Args: { p_player_mission_id: string }; Returns: Json };
      claim_party_host_reward: {
        Args: { p_date: string; p_event_id: string };
        Returns: Json;
      };
      claim_player_company_earnings: {
        Args: { p_company_id: string };
        Returns: Json;
      };
      claim_stall_income: { Args: { p_request_id: string }; Returns: Json };
      clear_social_profile_cover_as_user: {
        Args: { p_character_id: string; p_user_id: string };
        Returns: Json;
      };
      collect_home_food_delivery: {
        Args: { p_order_id: string };
        Returns: Json;
      };
      complete_career_step: {
        Args: { p_shift_id: string; p_step: number };
        Returns: Json;
      };
      complete_education_course: {
        Args: { p_course_slug: string };
        Returns: Json;
      };
      complete_education_course_for_user: {
        Args: { p_course_slug: string; p_user_id: string };
        Returns: Json;
      };
      complete_rent_relief_shift: {
        Args: { p_hustle_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      configure_player_company: {
        Args: { p_company_id: string; p_prices: Json };
        Returns: Json;
      };
      confirm_rent_relief_hustle: {
        Args: { p_hustle_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      contribute_to_community_fund: {
        Args: {
          p_amount_minor: number;
          p_fund_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
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
      create_fixed_term_investment: {
        Args: { p_amount: number; p_product_slug: string; p_request_id: string };
        Returns: Json;
      };
      create_player_status: {
        Args: { p_body: string; p_theme: string };
        Returns: Json;
      };
      create_town_news_comment: {
        Args: { p_body: string; p_post_id: string };
        Returns: Json;
      };
      create_town_news_post: {
        Args: { p_body: string; p_category: string; p_title: string };
        Returns: Json;
      };
      create_voice_message_as_user: {
        Args: {
          p_duration_ms: number;
          p_path: string;
          p_request_id: string;
          p_thread_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      dance_with_npc: {
        Args: { p_npc_slug: string; p_request_id: string };
        Returns: Json;
      };
      dance_with_player: {
        Args: { p_request_id: string; p_target_character_id: string };
        Returns: Json;
      };
      delete_player_status: { Args: { p_status_id: string }; Returns: Json };
      bank_deposit_cash: { Args: { p_amount: number }; Returns: Json };
      bank_withdraw_cash: { Args: { p_amount: number }; Returns: Json };
      deposit_cash: { Args: { p_amount: number }; Returns: Json };
      discard_inventory_item: {
        Args: { p_inventory_id: string; p_quantity?: number };
        Returns: Json;
      };
      drop_side_hustle: {
        Args: { p_hustle_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      eat_at_place: { Args: { p_place_id: string }; Returns: Json };
      enter_club: { Args: { p_request_id: string }; Returns: Json };
      enter_player_home: { Args: never; Returns: Json };
      equip_inventory_item: {
        Args: { p_inventory_id: string; p_slot: string };
        Returns: Json;
      };
      finalize_expired_voice_notes: {
        Args: { p_message_ids: string[] };
        Returns: number;
      };
      finish_social_media_as_user: {
        Args: { p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      get_active_side_hustles: { Args: { p_user_id: string }; Returns: Json };
      get_business_and_investment_market: { Args: never; Returns: Json };
      get_career_life_history: { Args: { p_offset?: number }; Returns: Json };
      get_career_life_summary: { Args: never; Returns: Json };
      get_city_events: { Args: never; Returns: Json };
      get_daily_tasks: { Args: never; Returns: Json };
      get_food_delivery_history: { Args: never; Returns: Json };
      get_friend_home_for_visit: {
        Args: { p_target_character_id: string };
        Returns: Json;
      };
      get_friend_house_for_visit: {
        Args: { p_target_character_id: string };
        Returns: Json;
      };
      create_social_group: {
        Args: { p_member_character_ids: string[]; p_name: string };
        Returns: Json;
      };
      add_social_group_member: {
        Args: { p_character_id: string; p_group_id: string };
        Returns: Json;
      };
      leave_social_group: { Args: { p_group_id: string }; Returns: Json };
      send_social_group_message: {
        Args: { p_body: string; p_group_id: string; p_request_id: string };
        Returns: Json;
      };
      get_social_group_messages: {
        Args: { p_group_id: string; p_limit?: number };
        Returns: Json;
      };
      get_social_groups_overview: { Args: never; Returns: Json };
      set_my_app_tile_style: { Args: { p_style: string }; Returns: Json };
      save_my_world_checkpoint: {
        Args: { p_world_x: number; p_world_y: number };
        Returns: Json;
      };
      send_social_group_media_as_user: {
        Args: {
          p_duration_ms: number | null;
          p_group_id: string;
          p_kind: string;
          p_path: string;
          p_request_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_social_group_media_as_user: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: Json;
      };
      toggle_social_group_reaction: {
        Args: { p_emoji: string; p_message_id: string };
        Returns: Json;
      };
      set_social_group_prefs: {
        Args: { p_group_id: string; p_muted: boolean; p_pinned: boolean };
        Returns: Json;
      };
      get_friend_status_posts: { Args: never; Returns: Json };
      get_house_state: { Args: { p_player_id: string }; Returns: Json };
      get_login_streak: { Args: never; Returns: Json };
      get_nearby_npc_encounters: { Args: never; Returns: Json };
      get_or_create_player_conversation: {
        Args: { p_target_character_id: string };
        Returns: Json;
      };
      get_party_host_results: { Args: never; Returns: Json };
      get_party_invitations: {
        Args: { p_after?: string; p_event_id?: string; p_limit?: number };
        Returns: Json;
      };
      get_player_advertising_market: { Args: never; Returns: Json };
      get_player_profile: { Args: { p_character_id: string }; Returns: Json };
      get_player_social_overview: { Args: never; Returns: Json };
      get_property_map_pins: {
        Args: { p_limit?: number; p_location_id: string };
        Returns: Json;
      };
      get_public_player_stalls: {
        Args: { p_after?: string; p_limit?: number };
        Returns: Json;
      };
      get_social_media_as_user: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: Json;
      };
      get_social_messages: {
        Args: {
          p_before?: string;
          p_conversation_id?: string;
          p_limit?: number;
          p_location_id?: string;
        };
        Returns: Json;
      };
      get_social_messages_v2: {
        Args: {
          p_before?: string;
          p_before_id?: string;
          p_conversation_id?: string;
          p_limit?: number;
          p_location_id?: string;
        };
        Returns: Json;
      };
      get_social_messages_with_media: {
        Args: {
          p_before?: string;
          p_conversation_id?: string;
          p_limit?: number;
          p_location_id?: string;
        };
        Returns: Json;
      };
      get_social_messages_with_media_v2: {
        Args: {
          p_before?: string;
          p_before_id?: string;
          p_conversation_id?: string;
          p_limit?: number;
          p_location_id?: string;
        };
        Returns: Json;
      };
      get_social_profile_card_as_user: {
        Args: { p_character_id: string; p_user_id: string };
        Returns: Json;
      };
      get_social_thread_summaries_as_user: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      get_stall_income: { Args: never; Returns: Json };
      get_town_leaderboard: { Args: never; Returns: Json };
      get_voice_note_as_user: {
        Args: { p_message_id: string; p_user_id: string };
        Returns: Json;
      };
      home_item_mutate: {
        Args: {
          p_action: string;
          p_idempotency_key: string;
          p_item_id: string;
          p_slot_id: string;
          p_user_id: string;
          p_x?: number;
          p_y?: number;
        };
        Returns: Json;
      };
      host_party_event: {
        Args: {
          p_location_id: string;
          p_request_id: string;
          p_requirements: Json;
          p_starts_at: string;
          p_title: string;
        };
        Returns: Json;
      };
      house_move: {
        Args: { p_from_slot: string; p_player_id: string; p_to_slot: string };
        Returns: Json;
      };
      house_move_to_position: {
        Args: {
          p_from_slot: string;
          p_player_id: string;
          p_x: number;
          p_y: number;
        };
        Returns: Json;
      };
      house_place: {
        Args: { p_item_id: string; p_player_id: string; p_slot: string };
        Returns: Json;
      };
      house_remove: {
        Args: { p_player_id: string; p_slot: string };
        Returns: Json;
      };
      housing_choose: {
        Args: {
          p_house_type_id: string;
          p_idempotency_key: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      housing_current_home: { Args: { p_user_id: string }; Returns: Json };
      housing_defer: { Args: { p_user_id: string }; Returns: Json };
      housing_eligible_houses: { Args: { p_user_id: string }; Returns: Json };
      housing_map_properties: { Args: { p_user_id: string }; Returns: Json };
      housing_property_listings: { Args: { p_user_id: string }; Returns: Json };
      housing_relief_state: { Args: { p_user_id: string }; Returns: Json };
      housing_rent: {
        Args: {
          p_house_type_id: string;
          p_idempotency_key: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      housing_rent_property: {
        Args: { p_property_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      interact_with_npc: {
        Args: { p_action: string; p_npc_id: string; p_request_id: string };
        Returns: Json;
      };
      invest_in_player_company: {
        Args: { p_company_id: string; p_request_id: string; p_shares: number };
        Returns: Json;
      };
      is_advertisement_admin: { Args: never; Returns: boolean };
      join_city_event: { Args: { p_event: string }; Returns: Json };
      join_city_event_occurrence: {
        Args: { p_occurrence_id: string };
        Returns: Json;
      };
      join_club_activity: {
        Args: { p_activity_slug: string; p_request_id: string };
        Returns: Json;
      };
      leave_career: { Args: never; Returns: Json };
      leave_club: { Args: { p_request_id: string }; Returns: Json };
      leave_player_home: { Args: never; Returns: Json };
      list_expired_voice_notes: {
        Args: never;
        Returns: {
          message_id: string;
          path: string;
        }[];
      };
      map_get_landmark_details: {
        Args: { p_landmark_id: string; p_user_id: string };
        Returns: Json;
      };
      map_log_age_check: {
        Args: { p_landmark_id: string; p_player_id: string };
        Returns: undefined;
      };
      map_start_travel: {
        Args: {
          p_idempotency_key: string;
          p_landmark_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined };
      my_account_summary: { Args: never; Returns: Json };
      my_bank_account: { Args: never; Returns: Json };
      my_game_property_listings: { Args: never; Returns: Json };
      my_home_save: { Args: never; Returns: Json };
      my_home_visit_policy: { Args: never; Returns: Json };
      my_property_rent_status: { Args: never; Returns: Json };
      mini_game_claim_forfeit: { Args: { p_table: string }; Returns: undefined };
      mini_game_create_table: { Args: { p_stake: number }; Returns: string };
      mini_game_create_whot_table: { Args: { p_stake: number }; Returns: string };
      mini_game_whot_view: { Args: { p_table: string }; Returns: Json };
      mini_game_whot_load: { Args: { p_table: string }; Returns: Json };
      mini_game_whot_init: { Args: { p_state: Json; p_table: string }; Returns: undefined };
      mini_game_whot_commit: {
        Args: {
          p_actor_user: string;
          p_expected_version: number;
          p_state: Json;
          p_table: string;
          p_winner_seat: number | null;
        };
        Returns: number;
      };
      mini_game_heartbeat: { Args: { p_table: string }; Returns: undefined };
      mini_game_join_table: { Args: { p_table: string }; Returns: string };
      mini_game_leave_table: { Args: { p_table: string }; Returns: undefined };
      mini_game_play_move: { Args: { p_cell: number; p_table: string }; Returns: Json };
      okada_ride_cancel: { Args: { p_ride: string }; Returns: Json };
      okada_ride_sync: { Args: never; Returns: undefined };
      open_bank_account: { Args: never; Returns: Json };
      offer_player_company_shares: {
        Args: { p_company_id: string; p_shares: number };
        Returns: Json;
      };
      outfit_equip: {
        Args: { p_item_id: string; p_player_id: string };
        Returns: Json;
      };
      outfit_unequip: {
        Args: { p_player_id: string; p_slot: string };
        Returns: Json;
      };
      party_invitation_action: {
        Args: {
          p_decision?: string;
          p_event_id?: string;
          p_invitation_id?: string;
          p_kind: string;
          p_recipient_character_id?: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      pay_property_rent: {
        Args: { p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      perform_catalog_activity: {
        Args: {
          p_activity_slug: string;
          p_request_id: string;
          p_revision: number;
          p_session: string;
        };
        Returns: Json;
      };
      perform_job: { Args: { p_request_id: string }; Returns: Json };
      perform_location_activity: {
        Args: {
          p_action: string;
          p_amount?: number;
          p_details?: string;
          p_location_id: string;
          p_request_id: string;
          p_target_character_id?: string;
        };
        Returns: Json;
      };
      perform_map_place_action: {
        Args: {
          p_action_definition: Json;
          p_action_id: string;
          p_landmark_id: string;
          p_request_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      personal_simulation_command: {
        Args: {
          p_action?: string;
          p_command: string;
          p_paused?: boolean;
          p_queue?: Json;
          p_request?: string;
          p_revision: number;
          p_session: string;
          p_speed?: number;
        };
        Returns: Json;
      };
      plan_phone_course: { Args: { p_course_slug: string }; Returns: Json };
      prepare_social_media_as_user: {
        Args: {
          p_digest: string;
          p_filename: string;
          p_mime_type: string;
          p_purpose: string;
          p_request_id: string;
          p_size: number;
          p_thread_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      process_home_food_deliveries: { Args: never; Returns: Json };
      process_my_property_rent: { Args: never; Returns: Json };
      process_overdue_player_houses: { Args: never; Returns: number };
      promote_career: { Args: never; Returns: Json };
      promote_current_job: { Args: never; Returns: Json };
      property_rent_status: { Args: never; Returns: Json };
      publish_npc_encounter: {
        Args: { p_action: string; p_npc_id: string };
        Returns: Json;
      };
      purchase_home_furniture: {
        Args: {
          p_expected_revision: number;
          p_item_id: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      purchase_home_upgrade: {
        Args: {
          p_expected_revision: number;
          p_request_id: string;
          p_room_id: string;
          p_upgrade_id: string;
        };
        Returns: Json;
      };
      submit_support_feedback: {
        Args: {
          p_category: string;
          p_kind: string;
          p_message: string;
          p_subject: string;
        };
        Returns: Database["public"]["Tables"]["support_feedback"]["Row"];
      };
      purchase_player_advertisement: {
        Args: {
          p_advertiser_name: string;
          p_billboard_id: string;
          p_creative_theme: string;
          p_description: string;
          p_duration_days: number;
          p_request_id: string;
          p_title: string;
        };
        Returns: Json;
      };
      purchase_shop_item: {
        Args: {
          p_quantity: number;
          p_request_id: string;
          p_shop_item_id: string;
        };
        Returns: Json;
      };
      record_username_auth_attempt: {
        Args: { p_attempt_key: string };
        Returns: boolean;
      };
      refresh_my_energy: { Args: never; Returns: number };
      remove_player_friend: {
        Args: { p_target_character_id: string };
        Returns: Json;
      };
      report_player: {
        Args: {
          p_category: string;
          p_details?: string;
          p_message_id?: string;
          p_target_character_id: string;
        };
        Returns: Json;
      };
      request_food_delivery: {
        Args: { p_items: Json; p_request_id: string; p_vendor_id: string };
        Returns: Json;
      };
      request_okada_ride: {
        Args: { p_destination: string; p_request_id: string };
        Returns: Json;
      };
      resolve_property_overdue: {
        Args: { p_option: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      respond_player_friend_request: {
        Args: { p_accept: boolean; p_request_id: string };
        Returns: Json;
      };
      respond_to_event: {
        Args: { p_request_id: string; p_requirement_id: string };
        Returns: Json;
      };
      respond_to_home_food_delivery: {
        Args: { p_choice: string; p_order_id: string };
        Returns: Json;
      };
      save_dashboard_pins: { Args: { p_pins: Json }; Returns: Json };
      save_my_home: {
        Args: { p_expected_revision: number; p_payload: Json };
        Returns: Json;
      };
      save_phone_event_reminder: {
        Args: { p_enabled: boolean; p_event_id: string };
        Returns: Json;
      };
      save_player_map_position: {
        Args: {
          p_latitude: number;
          p_longitude: number;
          p_movement_state: string;
        };
        Returns: Json;
      };
      save_player_stall: {
        Args: { p_goods: string; p_is_open: boolean; p_name: string };
        Returns: Json;
      };
      save_player_world_position: {
        Args: {
          p_building_slug: string;
          p_expected_revision: number;
          p_request_id: string;
          p_world_x: number;
          p_world_y: number;
        };
        Returns: Json;
      };
      search_player_profiles: {
        Args: { p_limit?: number; p_query: string };
        Returns: Json;
      };
      select_job: { Args: { p_job_id: string }; Returns: undefined };
      sell_inventory_item: {
        Args: { p_inventory_id: string; p_quantity: number; p_shop_id: string };
        Returns: Json;
      };
      send_player_friend_request: {
        Args: { p_request_id: string; p_target_character_id: string };
        Returns: Json;
      };
      send_social_message: {
        Args: {
          p_body: string;
          p_channel: string;
          p_conversation_id?: string;
          p_location_id?: string;
          p_request_id: string;
        };
        Returns: Json;
      };
      send_social_message_as_user: {
        Args: {
          p_body: string;
          p_channel: string;
          p_conversation_id?: string;
          p_location_id?: string;
          p_reply_to_message_id?: string;
          p_request_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      set_active_property_home: {
        Args: { p_player_property_id: string };
        Returns: Json;
      };
      set_my_home_visit_access: {
        Args: { p_allow_friends: boolean };
        Returns: Json;
      };
      set_saved_course: {
        Args: { p_course_slug: string; p_saved: boolean };
        Returns: Json;
      };
      shop_buy: {
        Args: {
          p_idempotency_key: string;
          p_item_id: string;
          p_player_id: string;
        };
        Returns: Json;
      };
      start_career_shift: { Args: never; Returns: Json };
      start_osun_town_travel: {
        Args: {
          p_destination_id: string;
          p_idempotency_key: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      thread_pref_action_as_user: {
        Args: {
          p_action: string;
          p_duration?: string;
          p_thread_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      toggle_town_news_reaction: {
        Args: { p_post_id: string; p_reacted: boolean };
        Returns: Json;
      };
      touch_player_presence: { Args: never; Returns: undefined };
      travel_to_city_location: {
        Args: {
          p_expected_revision: number;
          p_location_id: string;
          p_mode: string;
          p_request_id: string;
          p_world_x: number;
          p_world_y: number;
        };
        Returns: Json;
      };
      travel_to_location: {
        Args: { p_location_id: string; p_mode: string };
        Returns: Json;
      };
      unblock_player: { Args: { p_target_character_id: string }; Returns: Json };
      unequip_item: { Args: { p_slot: string }; Returns: Json };
      update_my_settings: {
        Args: {
          p_display_name?: string;
          p_effects_enabled?: boolean;
          p_music_enabled?: boolean;
          p_reduced_motion?: boolean;
        };
        Returns: Json;
      };
      update_player_advertisement: {
        Args: {
          p_advertisement_id: string;
          p_advertiser_name: string;
          p_creative_theme: string;
          p_description: string;
          p_title: string;
        };
        Returns: Json;
      };
      use_inventory_item: { Args: { p_inventory_id: string }; Returns: Json };
      visit_location: { Args: { p_location_id: string }; Returns: Json };
      withdraw_cash: { Args: { p_amount: number }; Returns: Json };
      world_clock: { Args: never; Returns: Json };
      world_traffic_for_time: {
        Args: { p_hour: number; p_weekday: number };
        Returns: string;
      };
      world_weather_for_day: { Args: { p_day: number }; Returns: string };
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
