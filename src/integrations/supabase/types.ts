export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
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
          metadata: NonNullable<Json>;
          name: string;
          requirements: NonNullable<Json>;
          rewards: NonNullable<Json>;
          slug: string;
          thirst_delta: number;
          updated_at: string;
          xp_reward: number;
        };
        ComputedFields: never;
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
          metadata?: NonNullable<Json>;
          name: string;
          requirements?: NonNullable<Json>;
          rewards?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
          name?: string;
          requirements?: NonNullable<Json>;
          rewards?: NonNullable<Json>;
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
      advertisement_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
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
        ComputedFields: never;
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
      business_catalog: {
        Row: {
          active: boolean;
          daily_customers: number;
          description: string;
          id: string;
          location_slug: string;
          name: string;
          purchase_price: number;
          service_catalog: NonNullable<Json>;
          slug: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          daily_customers: number;
          description: string;
          id?: string;
          location_slug: string;
          name: string;
          purchase_price: number;
          service_catalog: NonNullable<Json>;
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
          service_catalog?: NonNullable<Json>;
          slug?: string;
        };
        Relationships: [];
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
        ComputedFields: never;
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
          payload: NonNullable<Json>;
          revision: number;
          schema_version: number;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          allow_friend_visits?: boolean;
          character_id: string;
          payload: NonNullable<Json>;
          revision?: number;
          schema_version?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allow_friend_visits?: boolean;
          character_id?: string;
          payload?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          character_snapshot: NonNullable<Json>;
          character_time: NonNullable<Json>;
          heartbeat_at: string;
          minute_remainder: number;
          needs: NonNullable<Json>;
          paused: boolean;
          personal_time: NonNullable<Json>;
          queued_actions: NonNullable<Json>;
          revision: number;
          session_id: string | null;
          skills: NonNullable<Json>;
          speed: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          action_location?: string | null;
          active_action?: string | null;
          active_request?: string | null;
          character_id: string;
          character_snapshot: NonNullable<Json>;
          character_time: NonNullable<Json>;
          heartbeat_at?: string;
          minute_remainder?: number;
          needs: NonNullable<Json>;
          paused?: boolean;
          personal_time: NonNullable<Json>;
          queued_actions?: NonNullable<Json>;
          revision?: number;
          session_id?: string | null;
          skills?: NonNullable<Json>;
          speed?: number;
          user_id: string;
        };
        Update: {
          action_location?: string | null;
          active_action?: string | null;
          active_request?: string | null;
          character_id?: string;
          character_snapshot?: NonNullable<Json>;
          character_time?: NonNullable<Json>;
          heartbeat_at?: string;
          minute_remainder?: number;
          needs?: NonNullable<Json>;
          paused?: boolean;
          personal_time?: NonNullable<Json>;
          queued_actions?: NonNullable<Json>;
          revision?: number;
          session_id?: string | null;
          skills?: NonNullable<Json>;
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
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          character_id: string;
          created_at?: string;
          operation_id: string;
          operation_type: string;
          result: NonNullable<Json>;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          operation_id?: string;
          operation_type?: string;
          result?: NonNullable<Json>;
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
          appearance: NonNullable<Json>;
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
        ComputedFields: never;
        Insert: {
          age: number;
          appearance?: NonNullable<Json>;
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
          is_adult?: never;
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
          appearance?: NonNullable<Json>;
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
          is_adult?: never;
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
        ComputedFields: never;
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
      city_event_participation: {
        Row: {
          character_id: string;
          event_id: string;
          joined_at: string;
          world_day: number;
        };
        ComputedFields: never;
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
        ComputedFields: never;
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
      economy_request_results: {
        Row: {
          character_id: string;
          created_at: string;
          operation: string;
          request_id: string;
          result: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          character_id: string;
          created_at?: string;
          operation: string;
          request_id: string;
          result: NonNullable<Json>;
        };
        Update: {
          character_id?: string;
          created_at?: string;
          operation?: string;
          request_id?: string;
          result?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
      game_action_audit: {
        Row: {
          action: string;
          created_at: string;
          error_code: string | null;
          id: string;
          idempotency_key: string | null;
          metadata: NonNullable<Json>;
          outcome: string;
          player_id: string;
          target_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          error_code?: string | null;
          id?: string;
          idempotency_key?: string | null;
          metadata?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          metadata: NonNullable<Json>;
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
        ComputedFields: never;
        Insert: {
          created_at?: string;
          description: string;
          house_type_id?: string | null;
          id?: string;
          image_url?: string | null;
          is_active?: boolean;
          level_required?: number;
          location_id: string;
          metadata?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
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
          response: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          idempotency_key: string;
          request_hash: string;
          response: NonNullable<Json>;
          user_id: string;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          request_hash?: string;
          response?: NonNullable<Json>;
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
        ComputedFields: never;
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
          response: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          created_at?: string;
          idempotency_key: string;
          player_id: string;
          request_hash: string;
          response: NonNullable<Json>;
        };
        Update: {
          action?: string;
          created_at?: string;
          idempotency_key?: string;
          player_id?: string;
          request_hash?: string;
          response?: NonNullable<Json>;
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
        };
        ComputedFields: never;
        Insert: {
          id?: string;
          item_id: string;
          placed_at?: string;
          player_house_id: string;
          slot: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          placed_at?: string;
          player_house_id?: string;
          slot?: string;
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
          extra_requirements: NonNullable<Json>;
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
          slots: NonNullable<Json>;
          sort_order: number;
          starter_accessories: NonNullable<Json>;
          verify: boolean;
          weekly_rent_minor: number;
        };
        ComputedFields: never;
        Insert: {
          asset_key: string;
          bathroom_access: string;
          bedrooms: number;
          deposit: number;
          deposit_weeks?: number;
          description?: string;
          extra_requirements?: NonNullable<Json>;
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
          slots?: NonNullable<Json>;
          sort_order?: number;
          starter_accessories?: NonNullable<Json>;
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
          extra_requirements?: NonNullable<Json>;
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
          slots?: NonNullable<Json>;
          sort_order?: number;
          starter_accessories?: NonNullable<Json>;
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
          response: NonNullable<Json>;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          idempotency_key: string;
          request_hash: string;
          response: NonNullable<Json>;
          user_id: string;
        };
        Update: {
          created_at?: string;
          idempotency_key?: string;
          request_hash?: string;
          response?: NonNullable<Json>;
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
          effects: NonNullable<Json>;
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
        ComputedFields: never;
        Insert: {
          buy_price?: number;
          category?: string;
          created_at?: string;
          description: string;
          effects?: NonNullable<Json>;
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
          effects?: NonNullable<Json>;
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
          metadata: NonNullable<Json>;
          name: string;
          place_id: string | null;
          reputation_reward: number;
          required_course_slug: string | null;
          required_level: number;
          requirements: NonNullable<Json>;
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
        ComputedFields: never;
        Insert: {
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
          metadata?: NonNullable<Json>;
          name: string;
          place_id?: string | null;
          reputation_reward?: number;
          required_course_slug?: string | null;
          required_level?: number;
          requirements?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
          name?: string;
          place_id?: string | null;
          reputation_reward?: number;
          required_course_slug?: string | null;
          required_level?: number;
          requirements?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          metadata: NonNullable<Json>;
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
        ComputedFields: never;
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
          metadata?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
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
      map_age_check_logs: {
        Row: {
          checked_at: string;
          id: number;
          landmark_id: string;
          player_id: string;
        };
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
      map_landmarks: {
        Row: {
          created_at: string;
          district_id: string;
          id: string;
          is_available: boolean;
          location_id: string | null;
          min_age: number;
        };
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          response: NonNullable<Json>;
          status: string;
          to_district_id: string;
          travel_minutes: number;
          user_id: string;
        };
        ComputedFields: never;
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
          response: NonNullable<Json>;
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
          response?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          routine: NonNullable<Json>;
          topics: string[];
          work_location_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          home_location_id?: string | null;
          id: string;
          interests?: string[];
          name: string;
          personality: string;
          role: string;
          routine?: NonNullable<Json>;
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
          routine?: NonNullable<Json>;
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
        ComputedFields: never;
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
      osun_town_routes: {
        Row: {
          distance_units: number;
          fare_minor: number;
          from_town_id: string;
          to_town_id: string;
          travel_minutes: number;
        };
        ComputedFields: never;
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
          response: NonNullable<Json>;
          status: string;
          to_town_id: string;
          travel_minutes: number;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          arrival_at: string;
          character_id: string;
          departed_at?: string;
          fare_minor: number;
          from_town_id: string;
          id?: string;
          idempotency_key: string;
          response: NonNullable<Json>;
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
          response?: NonNullable<Json>;
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
        ComputedFields: never;
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
      player_blocks: {
        Row: {
          blocked_character_id: string;
          blocker_character_id: string;
          created_at: string;
        };
        ComputedFields: never;
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
      player_companies: {
        Row: {
          accrued_at: string;
          business_id: string;
          id: string;
          owner_character_id: string;
          owner_user_id: string;
          service_prices: NonNullable<Json>;
          shares_for_sale: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accrued_at?: string;
          business_id: string;
          id?: string;
          owner_character_id: string;
          owner_user_id: string;
          service_prices?: NonNullable<Json>;
          shares_for_sale?: number;
          updated_at?: string;
        };
        Update: {
          accrued_at?: string;
          business_id?: string;
          id?: string;
          owner_character_id?: string;
          owner_user_id?: string;
          service_prices?: NonNullable<Json>;
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
        ComputedFields: never;
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
      player_courses: {
        Row: {
          character_id: string;
          completed_at: string;
          course_id: string;
          id: string;
          tuition_paid: number;
          user_id: string;
        };
        ComputedFields: never;
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
          metadata: NonNullable<Json>;
          slot: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          character_id: string;
          durability?: number | null;
          equipped_at?: string;
          id?: string;
          item_id: string;
          metadata?: NonNullable<Json>;
          slot: string;
          user_id: string;
        };
        Update: {
          character_id?: string;
          durability?: number | null;
          equipped_at?: string;
          id?: string;
          item_id?: string;
          metadata?: NonNullable<Json>;
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
      player_fixed_investments: {
        Row: {
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
        ComputedFields: never;
        Insert: {
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          items: NonNullable<Json>;
          player_property_id: string;
        };
        ComputedFields: never;
        Insert: {
          band: string;
          budget_minor: number;
          character_id: string;
          created_at?: string;
          id?: string;
          items: NonNullable<Json>;
          player_property_id: string;
        };
        Update: {
          band?: string;
          budget_minor?: number;
          character_id?: string;
          created_at?: string;
          id?: string;
          items?: NonNullable<Json>;
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
        ComputedFields: never;
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
          rented_at: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          house_type_id: string;
          id?: string;
          next_rent_due_at: string;
          player_id: string;
          rented_at?: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          house_type_id?: string;
          id?: string;
          next_rent_due_at?: string;
          player_id?: string;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
      player_outfit: {
        Row: {
          player_id: string;
          slots: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          player_id: string;
          slots?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          player_id?: string;
          slots?: NonNullable<Json>;
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
          lease_ends_at: string | null;
          next_rent_due_at: string | null;
          property_id: string;
          rent_amount: number | null;
          rent_period_days: number | null;
          tenure: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          acquired_at?: string;
          character_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
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
        ComputedFields: never;
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
          next_shift_at: string;
          rent_cycle_id: string;
          shift_pay_minor: number;
          shifts_completed: number;
          shifts_total: number;
          status: string;
          title: string;
        };
        ComputedFields: never;
        Insert: {
          character_id: string;
          created_at?: string;
          dropped_at?: string | null;
          id?: string;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          created_at: string;
          dashboard_pins: NonNullable<Json>;
          display_name: string | null;
          id: string;
          reduced_motion: boolean;
          sound_enabled: boolean;
          updated_at: string;
          username: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dashboard_pins?: NonNullable<Json>;
          display_name?: string | null;
          id: string;
          reduced_motion?: boolean;
          sound_enabled?: boolean;
          updated_at?: string;
          username?: string | null;
        };
        Update: {
          created_at?: string;
          dashboard_pins?: NonNullable<Json>;
          display_name?: string | null;
          id?: string;
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
          paid_at: string | null;
          period_start_at: string;
          player_property_id: string;
          rescue_ends_at: string;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          amount_minor: number;
          character_id: string;
          created_at?: string;
          due_at: string;
          grace_ends_at: string;
          id?: string;
          paid_at?: string | null;
          period_start_at: string;
          player_property_id: string;
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
          paid_at?: string | null;
          period_start_at?: string;
          player_property_id?: string;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
          metadata: NonNullable<Json>;
          source: string | null;
          transaction_type: string;
          user_id: string;
          wallet_id: string;
        };
        ComputedFields: never;
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
          metadata?: NonNullable<Json>;
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
          metadata?: NonNullable<Json>;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
        ComputedFields: never;
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
      _advance_character_game_time: { Args: { p_char: string; p_minutes: number }; Returns: Json };
      _advance_property_rent_cycles: { Args: Record<PropertyKey, never>; Returns: number };
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
      _course_completed: {
        Args: { p_character_id: string; p_course_slug: string };
        Returns: boolean;
      };
      _credit: {
        Args: { p_amount: number; p_category: string; p_char: string; p_desc: string };
        Returns: undefined;
      };
      _economy_shop_is_open: {
        Args: {
          p_hour: number;
          p_shop: Omit<
            Database["public"]["Tables"]["shops"]["Row"],
            Database["public"]["Tables"]["shops"]["ComputedFields"]
          >;
        };
        Returns: boolean;
      };
      _grant_xp: { Args: { p_char: string; p_xp: number }; Returns: number };
      _home_furniture_within_owned: {
        Args: { p_character_id: string; p_payload: Json; p_user_id: string };
        Returns: boolean;
      };
      _house_error: { Args: { p_code: string }; Returns: Json };
      _housing_accessory_band: { Args: { p_budget_minor: number }; Returns: string };
      _housing_monthly_income: { Args: { p_character_id: string }; Returns: number };
      _housing_weekly_income: { Args: { p_character_id: string }; Returns: Json };
      _job_requirement_errors: {
        Args: { p_character_id: string; p_job_id: string };
        Returns: string[];
      };
      _my_character_id: { Args: Record<PropertyKey, never>; Returns: string };
      _my_social_character_id: { Args: Record<PropertyKey, never>; Returns: string };
      _notify: {
        Args: { p_body: string; p_char: string; p_kind?: string; p_title: string };
        Returns: undefined;
      };
      _perform_job_once: { Args: Record<PropertyKey, never>; Returns: Json };
      _process_player_house_status: { Args: { p_player_id: string }; Returns: undefined };
      _recalc_missions: { Args: { p_char: string }; Returns: undefined };
      _refresh_energy: { Args: { p_char: string }; Returns: number };
      _require_bank_location: { Args: { p_char: string }; Returns: undefined };
      _settle_player_company_earnings: { Args: { p_company_id: string }; Returns: Json };
      _social_blocked: { Args: { p_other: string }; Returns: boolean };
      _valid_home_save: { Args: { p: Json }; Returns: boolean };
      _validate_shop_minimum: {
        Args: {
          p_offer: Omit<
            Database["public"]["Tables"]["shop_items"]["Row"],
            Database["public"]["Tables"]["shop_items"]["ComputedFields"]
          >;
          p_quantity: number;
        };
        Returns: undefined;
      };
      acquire_game_property: { Args: { p_property_id: string; p_tenure: string }; Returns: Json };
      apply_rent_relief_hustle: {
        Args: { p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      block_player: { Args: { p_target_character_id: string }; Returns: Json };
      buy_player_company: {
        Args: { p_business_slug: string; p_request_id: string };
        Returns: Json;
      };
      cancel_player_friend_request: { Args: { p_request_id: string }; Returns: Json };
      choose_move_in_accessory_budget: {
        Args: { p_budget_minor: number; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      claim_fixed_term_investment: { Args: { p_investment_id: string }; Returns: Json };
      claim_mission: { Args: { p_player_mission_id: string }; Returns: Json };
      claim_player_company_earnings: { Args: { p_company_id: string }; Returns: Json };
      complete_education_course: { Args: { p_course_slug: string }; Returns: Json };
      complete_education_course_for_user: {
        Args: { p_course_slug: string; p_user_id: string };
        Returns: Json;
      };
      complete_rent_relief_shift: {
        Args: { p_hustle_id: string; p_request_id: string; p_user_id: string };
        Returns: Json;
      };
      configure_player_company: { Args: { p_company_id: string; p_prices: Json }; Returns: Json };
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
      create_player_status: { Args: { p_body: string; p_theme: string }; Returns: Json };
      delete_player_status: { Args: { p_status_id: string }; Returns: Json };
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
      equip_inventory_item: { Args: { p_inventory_id: string; p_slot: string }; Returns: Json };
      get_active_side_hustles: { Args: { p_user_id: string }; Returns: Json };
      get_business_and_investment_market: { Args: Record<PropertyKey, never>; Returns: Json };
      get_friend_home_for_visit: { Args: { p_target_character_id: string }; Returns: Json };
      get_friend_status_posts: { Args: Record<PropertyKey, never>; Returns: Json };
      get_house_state: { Args: { p_player_id: string }; Returns: Json };
      enter_player_home: { Args: Record<PropertyKey, never>; Returns: Json };
      leave_player_home: { Args: Record<PropertyKey, never>; Returns: Json };
      get_or_create_player_conversation: { Args: { p_target_character_id: string }; Returns: Json };
      get_player_profile: { Args: { p_character_id: string }; Returns: Json };
      get_player_social_overview: { Args: Record<PropertyKey, never>; Returns: Json };
      get_property_map_pins: { Args: { p_limit?: number; p_location_id: string }; Returns: Json };
      get_social_messages: {
        Args: {
          p_before?: string;
          p_conversation_id?: string;
          p_limit?: number;
          p_location_id?: string;
        };
        Returns: Json;
      };
      get_social_thread_summaries_as_user: { Args: { p_user_id: string }; Returns: Json };
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
      house_place: {
        Args: { p_item_id: string; p_player_id: string; p_slot: string };
        Returns: Json;
      };
      house_remove: { Args: { p_player_id: string; p_slot: string }; Returns: Json };
      housing_choose: {
        Args: { p_house_type_id: string; p_idempotency_key: string; p_user_id: string };
        Returns: Json;
      };
      housing_defer: { Args: { p_user_id: string }; Returns: Json };
      housing_eligible_houses: { Args: { p_user_id: string }; Returns: Json };
      housing_rent: {
        Args: { p_house_type_id: string; p_idempotency_key: string; p_user_id: string };
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
      is_advertisement_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      join_city_event: { Args: { p_event: string }; Returns: Json };
      map_get_landmark_details: {
        Args: { p_landmark_id: string; p_user_id: string };
        Returns: Json;
      };
      map_log_age_check: {
        Args: { p_landmark_id: string; p_player_id: string };
        Returns: undefined;
      };
      map_start_travel: {
        Args: { p_idempotency_key: string; p_landmark_id: string; p_user_id: string };
        Returns: Json;
      };
      mark_notifications_read: { Args: { p_id?: string }; Returns: undefined };
      my_game_property_listings: { Args: Record<PropertyKey, never>; Returns: Json };
      my_home_save: { Args: Record<PropertyKey, never>; Returns: Json };
      my_home_visit_policy: { Args: Record<PropertyKey, never>; Returns: Json };
      my_property_rent_status: { Args: Record<PropertyKey, never>; Returns: Json };
      offer_player_company_shares: {
        Args: { p_company_id: string; p_shares: number };
        Returns: Json;
      };
      outfit_equip: { Args: { p_item_id: string; p_player_id: string }; Returns: Json };
      outfit_unequip: { Args: { p_player_id: string; p_slot: string }; Returns: Json };
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
      process_my_property_rent: { Args: Record<PropertyKey, never>; Returns: Json };
      process_overdue_player_houses: { Args: Record<PropertyKey, never>; Returns: number };
      promote_current_job: { Args: Record<PropertyKey, never>; Returns: Json };
      property_rent_status: { Args: Record<PropertyKey, never>; Returns: Json };
      purchase_home_furniture: {
        Args: { p_expected_revision: number; p_item_id: string; p_request_id: string };
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
      purchase_shop_item: {
        Args: { p_quantity: number; p_request_id: string; p_shop_item_id: string };
        Returns: Json;
      };
      record_username_auth_attempt: { Args: { p_attempt_key: string }; Returns: boolean };
      refresh_my_energy: { Args: Record<PropertyKey, never>; Returns: number };
      remove_player_friend: { Args: { p_target_character_id: string }; Returns: Json };
      report_player: {
        Args: {
          p_category: string;
          p_details?: string;
          p_message_id?: string;
          p_target_character_id: string;
        };
        Returns: Json;
      };
      respond_player_friend_request: {
        Args: { p_accept: boolean; p_request_id: string };
        Returns: Json;
      };
      save_dashboard_pins: { Args: { p_pins: Json }; Returns: Json };
      save_my_home: { Args: { p_expected_revision: number; p_payload: Json }; Returns: Json };
      save_player_map_position: {
        Args: { p_latitude: number; p_longitude: number; p_movement_state: string };
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
      search_player_profiles: { Args: { p_limit?: number; p_query: string }; Returns: Json };
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
      set_my_home_visit_access: { Args: { p_allow_friends: boolean }; Returns: Json };
      shop_buy: {
        Args: { p_idempotency_key: string; p_item_id: string; p_player_id: string };
        Returns: Json;
      };
      start_osun_town_travel: {
        Args: { p_destination_id: string; p_idempotency_key: string; p_user_id: string };
        Returns: Json;
      };
      thread_pref_action_as_user: {
        Args: { p_action: string; p_duration?: string; p_thread_id: string; p_user_id: string };
        Returns: Json;
      };
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
      travel_to_location: { Args: { p_location_id: string; p_mode: string }; Returns: Json };
      unblock_player: { Args: { p_target_character_id: string }; Returns: Json };
      unequip_item: { Args: { p_slot: string }; Returns: Json };
      use_inventory_item: { Args: { p_inventory_id: string }; Returns: Json };
      visit_location: { Args: { p_location_id: string }; Returns: Json };
      withdraw_cash: { Args: { p_amount: number }; Returns: Json };
      world_clock: { Args: Record<PropertyKey, never>; Returns: Json };
      world_traffic_for_time: { Args: { p_hour: number; p_weekday: number }; Returns: string };
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
