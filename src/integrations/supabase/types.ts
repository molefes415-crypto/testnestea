export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      auto_robot_trades: {
        Row: {
          created_at: string
          detail: Json | null
          direction: string
          robot_id: string
          signal_key: string
          status: string
          symbol: string
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          direction: string
          robot_id: string
          signal_key: string
          status?: string
          symbol: string
        }
        Update: {
          created_at?: string
          detail?: Json | null
          direction?: string
          robot_id?: string
          signal_key?: string
          status?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "auto_robot_trades_robot_id_fkey"
            columns: ["robot_id"]
            isOneToOne: false
            referencedRelation: "auto_robots"
            referencedColumns: ["id"]
          },
        ]
      }
      auto_robots: {
        Row: {
          account_login: number
          account_server: string
          bot_name: string
          detail: string | null
          id: string
          last_run_at: string | null
          news_enabled: boolean
          owner_key: string
          running: boolean
          symbols: Json
          token_cipher: string | null
          updated_at: string
        }
        Insert: {
          account_login: number
          account_server: string
          bot_name?: string
          detail?: string | null
          id?: string
          last_run_at?: string | null
          news_enabled?: boolean
          owner_key: string
          running?: boolean
          symbols?: Json
          token_cipher?: string | null
          updated_at?: string
        }
        Update: {
          account_login?: number
          account_server?: string
          bot_name?: string
          detail?: string | null
          id?: string
          last_run_at?: string | null
          news_enabled?: boolean
          owner_key?: string
          running?: boolean
          symbols?: Json
          token_cipher?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      news_automation_orders: {
        Row: {
          job_id: string
          ordinal: number
          result: Json | null
          signal: Json
          status: string
          symbol: string
        }
        Insert: {
          job_id: string
          ordinal: number
          result?: Json | null
          signal: Json
          status: string
          symbol: string
        }
        Update: {
          job_id?: string
          ordinal?: number
          result?: Json | null
          signal?: Json
          status?: string
          symbol?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_automation_orders_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "news_automations"
            referencedColumns: ["id"]
          },
        ]
      }
      news_automations: {
        Row: {
          account_login: number
          account_server: string
          created_at: string
          detail: string | null
          event_data: Json
          event_id: string
          execute_at: string
          id: string
          lead_seconds: number
          lot: number
          owner_key: string
          status: string
          symbols: string[]
          token_cipher: string | null
          trades: number
        }
        Insert: {
          account_login: number
          account_server: string
          created_at?: string
          detail?: string | null
          event_data: Json
          event_id: string
          execute_at: string
          id?: string
          lead_seconds: number
          lot: number
          owner_key: string
          status?: string
          symbols: string[]
          token_cipher?: string | null
          trades: number
        }
        Update: {
          account_login?: number
          account_server?: string
          created_at?: string
          detail?: string | null
          event_data?: Json
          event_id?: string
          execute_at?: string
          id?: string
          lead_seconds?: number
          lot?: number
          owner_key?: string
          status?: string
          symbols?: string[]
          token_cipher?: string | null
          trades?: number
        }
        Relationships: []
      }
      news_calendar_cache: {
        Row: {
          events: Json
          fetched_at: string
          id: number
        }
        Insert: {
          events: Json
          fetched_at?: string
          id: number
        }
        Update: {
          events?: Json
          fetched_at?: string
          id?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          email: string
          id: string
          payer_email: string | null
          paypal_capture_id: string | null
          paypal_order_id: string
          provider: string
          raw: Json | null
          status: string
          user_ref: string
          verified_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          email: string
          id?: string
          payer_email?: string | null
          paypal_capture_id?: string | null
          paypal_order_id: string
          provider?: string
          raw?: Json | null
          status?: string
          user_ref: string
          verified_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          email?: string
          id?: string
          payer_email?: string | null
          paypal_capture_id?: string | null
          paypal_order_id?: string
          provider?: string
          raw?: Json | null
          status?: string
          user_ref?: string
          verified_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
