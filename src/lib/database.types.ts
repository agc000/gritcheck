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
      events: {
        Row: {
          created_at: string
          device_id: string | null
          id: number
          name: string
          props: Json
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: never
          name: string
          props?: Json
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: never
          name?: string
          props?: Json
        }
        Relationships: []
      }
      spot_hours: {
        Row: {
          closes: string
          day_of_week: number
          id: number
          opens: string
          scraped_at: string
          source: string
          spot_id: string
        }
        Insert: {
          closes: string
          day_of_week: number
          id?: never
          opens: string
          scraped_at?: string
          source?: string
          spot_id: string
        }
        Update: {
          closes?: string
          day_of_week?: number
          id?: never
          opens?: string
          scraped_at?: string
          source?: string
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spot_hours_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spot_current_status"
            referencedColumns: ["spot_id"]
          },
          {
            foreignKeyName: "spot_hours_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      spots: {
        Row: {
          active: boolean
          attributes: Json
          baseline: Json
          building: string
          category: string
          consensus: string | null
          created_at: string
          frozen: boolean
          hours_scraped_at: string | null
          id: string
          lat: number
          lng: number
          name: string
          slug: string
        }
        Insert: {
          active?: boolean
          attributes?: Json
          baseline?: Json
          building: string
          category: string
          consensus?: string | null
          created_at?: string
          frozen?: boolean
          hours_scraped_at?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          slug: string
        }
        Update: {
          active?: boolean
          attributes?: Json
          baseline?: Json
          building?: string
          category?: string
          consensus?: string | null
          created_at?: string
          frozen?: boolean
          hours_scraped_at?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          slug?: string
        }
        Relationships: []
      }
      update_flags: {
        Row: {
          created_at: string
          device_id: string
          update_id: number
        }
        Insert: {
          created_at?: string
          device_id: string
          update_id: number
        }
        Update: {
          created_at?: string
          device_id?: string
          update_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "update_flags_update_id_fkey"
            columns: ["update_id"]
            isOneToOne: false
            referencedRelation: "updates"
            referencedColumns: ["id"]
          },
        ]
      }
      update_rate_limits: {
        Row: {
          created_at: string
          device_id: string
          id: number
          ip_hash: string
          spot_id: string
        }
        Insert: {
          created_at?: string
          device_id: string
          id?: never
          ip_hash: string
          spot_id: string
        }
        Update: {
          created_at?: string
          device_id?: string
          id?: never
          ip_hash?: string
          spot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_rate_limits_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spot_current_status"
            referencedColumns: ["spot_id"]
          },
          {
            foreignKeyName: "update_rate_limits_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
      updates: {
        Row: {
          comment: string | null
          created_at: string
          crowd: number | null
          device_id: string
          flags: number
          hidden: boolean
          id: number
          kind: string
          line: number | null
          noise: number | null
          spot_id: string
          worth_it: boolean | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          crowd?: number | null
          device_id: string
          flags?: number
          hidden?: boolean
          id?: never
          kind: string
          line?: number | null
          noise?: number | null
          spot_id: string
          worth_it?: boolean | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          crowd?: number | null
          device_id?: string
          flags?: number
          hidden?: boolean
          id?: never
          kind?: string
          line?: number | null
          noise?: number | null
          spot_id?: string
          worth_it?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "updates_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spot_current_status"
            referencedColumns: ["spot_id"]
          },
          {
            foreignKeyName: "updates_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      spot_current_status: {
        Row: {
          category: string | null
          confidence: string | null
          confidence_weight: number | null
          crowd: string | null
          is_open: boolean | null
          last_update_at: string | null
          line: string | null
          noise: string | null
          slug: string | null
          spot_id: string | null
          worth_it_pct: number | null
        }
        Relationships: []
      }
      spot_effective_hours: {
        Row: {
          closes: string | null
          day_of_week: number | null
          id: number | null
          opens: string | null
          scraped_at: string | null
          source: string | null
          spot_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "spot_hours_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spot_current_status"
            referencedColumns: ["spot_id"]
          },
          {
            foreignKeyName: "spot_hours_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "spots"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      flag_update: {
        Args: { p_device_id: string; p_update_id: number }
        Returns: undefined
      }
      replace_scraped_hours: {
        Args: { payload: Json }
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
    Enums: {},
  },
} as const

