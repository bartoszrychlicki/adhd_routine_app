export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          created_at: string
          created_by_profile_id: string | null
          criteria: Json
          deleted_at: string | null
          description: string | null
          family_id: string | null
          icon_url: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by_profile_id?: string | null
          criteria: Json
          deleted_at?: string | null
          description?: string | null
          family_id?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by_profile_id?: string | null
          criteria?: Json
          deleted_at?: string | null
          description?: string | null
          family_id?: string | null
          icon_url?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "achievements_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      child_access_tokens: {
        Row: {
          created_at: string
          created_by_profile_id: string | null
          deactivated_at: string | null
          deactivated_by_profile_id: string | null
          id: string
          last_used_at: string | null
          metadata: Json
          profile_id: string
          token: string
        }
        Insert: {
          created_at?: string
          created_by_profile_id?: string | null
          deactivated_at?: string | null
          deactivated_by_profile_id?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json
          profile_id: string
          token: string
        }
        Update: {
          created_at?: string
          created_by_profile_id?: string | null
          deactivated_at?: string | null
          deactivated_by_profile_id?: string | null
          id?: string
          last_used_at?: string | null
          metadata?: Json
          profile_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_access_tokens_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_access_tokens_deactivated_by_profile_id_fkey"
            columns: ["deactivated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_access_tokens_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      child_routines: {
        Row: {
          child_profile_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_enabled: boolean
          position: number
          routine_id: string
          updated_at: string
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_enabled?: boolean
          position?: number
          routine_id: string
          updated_at?: string
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_enabled?: boolean
          position?: number
          routine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "child_routines_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "child_routines_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          deleted_at: string | null
          family_name: string
          id: string
          settings: Json
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          family_name: string
          id?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          family_name?: string
          id?: string
          settings?: Json
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      family_points_snapshots: {
        Row: {
          created_at: string
          earned_points: number
          family_id: string
          id: string
          points_balance: number
          profile_id: string
          snapshot_date: string
          spent_points: number
        }
        Insert: {
          created_at?: string
          earned_points?: number
          family_id: string
          id?: string
          points_balance: number
          profile_id: string
          snapshot_date: string
          spent_points?: number
        }
        Update: {
          created_at?: string
          earned_points?: number
          family_id?: string
          id?: string
          points_balance?: number
          profile_id?: string
          snapshot_date?: string
          spent_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "family_points_snapshots_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_points_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          balance_after: number
          created_at: string
          created_by_profile_id: string | null
          family_id: string
          id: string
          metadata: Json
          points_delta: number
          profile_id: string
          reason: string | null
          reference_id: string | null
          reference_table: string | null
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by_profile_id?: string | null
          family_id: string
          id?: string
          metadata?: Json
          points_delta: number
          profile_id: string
          reason?: string | null
          reference_id?: string | null
          reference_table?: string | null
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by_profile_id?: string | null
          family_id?: string
          id?: string
          metadata?: Json
          points_delta?: number
          profile_id?: string
          reason?: string | null
          reference_id?: string | null
          reference_table?: string | null
          transaction_type?: Database["public"]["Enums"]["point_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email: string | null
          family_id: string
          id: string
          last_login_at: string | null
          pin_failed_attempts: number
          pin_hash: string | null
          pin_lock_expires_at: string | null
          role: Database["public"]["Enums"]["profile_role"]
          settings: Json
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email?: string | null
          family_id: string
          id?: string
          last_login_at?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_lock_expires_at?: string | null
          role: Database["public"]["Enums"]["profile_role"]
          settings?: Json
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email?: string | null
          family_id?: string
          id?: string
          last_login_at?: string | null
          pin_failed_attempts?: number
          pin_hash?: string | null
          pin_lock_expires_at?: string | null
          role?: Database["public"]["Enums"]["profile_role"]
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_child_visibility: {
        Row: {
          child_profile_id: string
          created_at: string
          deleted_at: string | null
          id: string
          is_visible: boolean
          reward_id: string
          updated_at: string
          visible_from: string | null
          visible_until: string | null
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_visible?: boolean
          reward_id: string
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_visible?: boolean
          reward_id?: string
          updated_at?: string
          visible_from?: string | null
          visible_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reward_child_visibility_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_child_visibility_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_redemptions: {
        Row: {
          cancelled_at: string | null
          cancelled_by_profile_id: string | null
          child_profile_id: string
          confirmed_at: string | null
          confirmed_by_profile_id: string | null
          created_at: string
          id: string
          metadata: Json
          notes: string | null
          point_transaction_id: string | null
          points_cost: number
          requested_at: string
          reward_id: string
          status: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          child_profile_id: string
          confirmed_at?: string | null
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          point_transaction_id?: string | null
          points_cost: number
          requested_at?: string
          reward_id: string
          status?: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by_profile_id?: string | null
          child_profile_id?: string
          confirmed_at?: string | null
          confirmed_by_profile_id?: string | null
          created_at?: string
          id?: string
          metadata?: Json
          notes?: string | null
          point_transaction_id?: string | null
          points_cost?: number
          requested_at?: string
          reward_id?: string
          status?: Database["public"]["Enums"]["reward_redemption_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_redemptions_cancelled_by_profile_id_fkey"
            columns: ["cancelled_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_confirmed_by_profile_id_fkey"
            columns: ["confirmed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_point_transaction_id_fkey"
            columns: ["point_transaction_id"]
            isOneToOne: false
            referencedRelation: "point_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_redemptions_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      rewards: {
        Row: {
          cost_points: number
          created_at: string
          created_by_profile_id: string | null
          deleted_at: string | null
          description: string | null
          family_id: string
          id: string
          is_active: boolean
          is_repeatable: boolean
          name: string
          settings: Json
          updated_at: string
          updated_by_profile_id: string | null
        }
        Insert: {
          cost_points: number
          created_at?: string
          created_by_profile_id?: string | null
          deleted_at?: string | null
          description?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          name: string
          settings?: Json
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Update: {
          cost_points?: number
          created_at?: string
          created_by_profile_id?: string | null
          deleted_at?: string | null
          description?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          is_repeatable?: boolean
          name?: string
          settings?: Json
          updated_at?: string
          updated_by_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rewards_created_by_profile_id_fkey"
            columns: ["created_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewards_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_performance_stats: {
        Row: {
          best_duration_seconds: number | null
          best_session_id: string | null
          child_profile_id: string
          last_completed_session_id: string | null
          last_completed_at: string | null
          routine_id: string
          streak_days: number
          updated_at: string
        }
        Insert: {
          best_duration_seconds?: number | null
          best_session_id?: string | null
          child_profile_id: string
          last_completed_session_id?: string | null
          last_completed_at?: string | null
          routine_id: string
          streak_days?: number
          updated_at?: string
        }
        Update: {
          best_duration_seconds?: number | null
          best_session_id?: string | null
          child_profile_id?: string
          last_completed_session_id?: string | null
          last_completed_at?: string | null
          routine_id?: string
          streak_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_performance_stats_best_session_id_fkey"
            columns: ["best_session_id"]
            isOneToOne: false
            referencedRelation: "routine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_performance_stats_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_performance_stats_last_completed_session_id_fkey"
            columns: ["last_completed_session_id"]
            isOneToOne: false
            referencedRelation: "routine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_performance_stats_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_sessions: {
        Row: {
          auto_closed_at: string | null
          best_time_beaten: boolean
          bonus_multiplier: number
          child_profile_id: string
          completed_at: string | null
          completion_reason: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          notes: string | null
          planned_end_at: string | null
          points_awarded: number
          routine_id: string
          session_date: string
          started_at: string | null
          status: Database["public"]["Enums"]["routine_session_status"]
          updated_at: string
        }
        Insert: {
          auto_closed_at?: string | null
          best_time_beaten?: boolean
          bonus_multiplier?: number
          child_profile_id: string
          completed_at?: string | null
          completion_reason?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          planned_end_at?: string | null
          points_awarded?: number
          routine_id: string
          session_date: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["routine_session_status"]
          updated_at?: string
        }
        Update: {
          auto_closed_at?: string | null
          best_time_beaten?: boolean
          bonus_multiplier?: number
          child_profile_id?: string
          completed_at?: string | null
          completion_reason?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          notes?: string | null
          planned_end_at?: string | null
          points_awarded?: number
          routine_id?: string
          session_date?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["routine_session_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_sessions_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_sessions_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routine_tasks: {
        Row: {
          child_profile_id: string
          created_at: string
          deleted_at: string | null
          description: string | null
          expected_duration_seconds: number | null
          id: string
          is_active: boolean
          is_optional: boolean
          name: string
          points: number
          position: number
          routine_id: string
          updated_at: string
        }
        Insert: {
          child_profile_id: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expected_duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name: string
          points?: number
          position: number
          routine_id: string
          updated_at?: string
        }
        Update: {
          child_profile_id?: string
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expected_duration_seconds?: number | null
          id?: string
          is_active?: boolean
          is_optional?: boolean
          name?: string
          points?: number
          position?: number
          routine_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_tasks_child_profile_id_fkey"
            columns: ["child_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_tasks_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          auto_close_after_minutes: number | null
          created_at: string
          deleted_at: string | null
          end_time: string | null
          family_id: string
          id: string
          is_active: boolean
          name: string
          routine_type: Database["public"]["Enums"]["routine_type"]
          settings: Json
          slug: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          auto_close_after_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          end_time?: string | null
          family_id: string
          id?: string
          is_active?: boolean
          name: string
          routine_type?: Database["public"]["Enums"]["routine_type"]
          settings?: Json
          slug: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          auto_close_after_minutes?: number | null
          created_at?: string
          deleted_at?: string | null
          end_time?: string | null
          family_id?: string
          id?: string
          is_active?: boolean
          name?: string
          routine_type?: Database["public"]["Enums"]["routine_type"]
          settings?: Json
          slug?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          duration_since_session_start_seconds: number | null
          id: string
          metadata: Json
          points_awarded: number
          position: number
          routine_session_id: string
          routine_task_id: string | null
          was_bonus: boolean
        }
        Insert: {
          completed_at?: string
          duration_since_session_start_seconds?: number | null
          id?: string
          metadata?: Json
          points_awarded: number
          position: number
          routine_session_id: string
          routine_task_id?: string | null
          was_bonus?: boolean
        }
        Update: {
          completed_at?: string
          duration_since_session_start_seconds?: number | null
          id?: string
          metadata?: Json
          points_awarded?: number
          position?: number
          routine_session_id?: string
          routine_task_id?: string | null
          was_bonus?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_routine_session_id_fkey"
            columns: ["routine_session_id"]
            isOneToOne: false
            referencedRelation: "routine_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_routine_task_id_fkey"
            columns: ["routine_task_id"]
            isOneToOne: false
            referencedRelation: "routine_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_id: string
          awarded_at: string
          awarded_by_profile_id: string | null
          id: string
          metadata: Json
          profile_id: string
        }
        Insert: {
          achievement_id: string
          awarded_at?: string
          awarded_by_profile_id?: string | null
          id?: string
          metadata?: Json
          profile_id: string
        }
        Update: {
          achievement_id?: string
          awarded_at?: string
          awarded_by_profile_id?: string | null
          id?: string
          metadata?: Json
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_awarded_by_profile_id_fkey"
            columns: ["awarded_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_achievements_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_family: {
        Args: { target_family_id: string }
        Returns: boolean
      }
      can_access_profile: {
        Args: { target_profile_id: string }
        Returns: boolean
      }
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
      current_family_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_profile_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      current_profile_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["profile_role"]
      }
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_child: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      is_parent: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
    }
    Enums: {
      point_transaction_type:
        | "task_completion"
        | "routine_bonus"
        | "manual_adjustment"
        | "reward_redeem"
      profile_role: "parent" | "child" | "admin"
      reward_redemption_status:
        | "pending"
        | "approved"
        | "fulfilled"
        | "rejected"
        | "cancelled"
      routine_session_status:
        | "scheduled"
        | "in_progress"
        | "completed"
        | "auto_closed"
        | "skipped"
        | "expired"
      routine_type: "morning" | "afternoon" | "evening" | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      point_transaction_type: [
        "task_completion",
        "routine_bonus",
        "manual_adjustment",
        "reward_redeem",
      ],
      profile_role: ["parent", "child", "admin"],
      reward_redemption_status: [
        "pending",
        "approved",
        "fulfilled",
        "rejected",
        "cancelled",
      ],
      routine_session_status: [
        "scheduled",
        "in_progress",
        "completed",
        "auto_closed",
        "skipped",
        "expired",
      ],
      routine_type: ["morning", "afternoon", "evening", "custom"],
    },
  },
} as const
