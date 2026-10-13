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
      appointments: {
        Row: {
          appointment_date: string
          appointment_id: string
          appointment_time: string
          appointment_type: string
          created_at: string
          created_by: string
          customer_id: string
          lead_id: string
          notes: string
          salesperson_id: string
          status: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          appointment_date: string
          appointment_id: string
          appointment_time: string
          appointment_type: string
          created_at: string
          created_by: string
          customer_id: string
          lead_id: string
          notes?: string
          salesperson_id: string
          status: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          appointment_date?: string
          appointment_id?: string
          appointment_time?: string
          appointment_type?: string
          created_at?: string
          created_by?: string
          customer_id?: string
          lead_id?: string
          notes?: string
          salesperson_id?: string
          status?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["lead_id"]
          },
          {
            foreignKeyName: "appointments_salesperson_id_fkey"
            columns: ["salesperson_id"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["salesperson_id"]
          },
          {
            foreignKeyName: "appointments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled: boolean
          id: number
          message: string
          name: string
          phone: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled?: boolean
          id?: never
          message: string
          name: string
          phone?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled?: boolean
          id?: never
          message?: string
          name?: string
          phone?: string | null
          subject?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          budget_max: number | null
          budget_min: number | null
          buyer_profile: string | null
          city: string | null
          created_at: string
          customer_id: string
          estimated_down_payment: number
          family_size: number | null
          financing_needed: boolean | null
          first_name: string
          last_name: string
          lead_source: string | null
          notes: string
          preferred_brand: string | null
          preferred_vehicle_type: string | null
          purchase_timeline: string | null
          state: string
          synthetic_email: string | null
          synthetic_phone: string
          trade_in: boolean | null
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          budget_min?: number | null
          buyer_profile?: string | null
          city?: string | null
          created_at: string
          customer_id: string
          estimated_down_payment?: number
          family_size?: number | null
          financing_needed?: boolean | null
          first_name: string
          last_name: string
          lead_source?: string | null
          notes?: string
          preferred_brand?: string | null
          preferred_vehicle_type?: string | null
          purchase_timeline?: string | null
          state?: string
          synthetic_email?: string | null
          synthetic_phone: string
          trade_in?: boolean | null
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          budget_min?: number | null
          buyer_profile?: string | null
          city?: string | null
          created_at?: string
          customer_id?: string
          estimated_down_payment?: number
          family_size?: number | null
          financing_needed?: boolean | null
          first_name?: string
          last_name?: string
          lead_source?: string | null
          notes?: string
          preferred_brand?: string | null
          preferred_vehicle_type?: string | null
          purchase_timeline?: string | null
          state?: string
          synthetic_email?: string | null
          synthetic_phone?: string
          trade_in?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      features: {
        Row: {
          category: string
          created_at: string
          feature_id: string
          name: string
        }
        Insert: {
          category: string
          created_at?: string
          feature_id: string
          name: string
        }
        Update: {
          category?: string
          created_at?: string
          feature_id?: string
          name?: string
        }
        Relationships: []
      }
      financing_options: {
        Row: {
          active: boolean
          apr_max: number
          apr_min: number
          created_at: string
          disclaimer: string
          financing_rule_id: string
          maximum_vehicle_age_years: number
          minimum_down_payment_percent: number
          term_months: number
          updated_at: string
          vehicle_condition: string
        }
        Insert: {
          active?: boolean
          apr_max: number
          apr_min: number
          created_at?: string
          disclaimer: string
          financing_rule_id: string
          maximum_vehicle_age_years: number
          minimum_down_payment_percent: number
          term_months: number
          updated_at?: string
          vehicle_condition: string
        }
        Update: {
          active?: boolean
          apr_max?: number
          apr_min?: number
          created_at?: string
          disclaimer?: string
          financing_rule_id?: string
          maximum_vehicle_age_years?: number
          minimum_down_payment_percent?: number
          term_months?: number
          updated_at?: string
          vehicle_condition?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_salesperson: string | null
          budget: number | null
          created_at: string
          customer_id: string
          financing_needed: boolean | null
          lead_id: string
          lead_score: number
          lead_status: string
          lead_temperature: string
          next_followup_date: string | null
          notes: string
          purchase_timeline: string | null
          source: string
          trade_in: boolean | null
          updated_at: string
          vehicle_interest: string | null
        }
        Insert: {
          assigned_salesperson?: string | null
          budget?: number | null
          created_at: string
          customer_id: string
          financing_needed?: boolean | null
          lead_id: string
          lead_score: number
          lead_status: string
          lead_temperature: string
          next_followup_date?: string | null
          notes?: string
          purchase_timeline?: string | null
          source: string
          trade_in?: boolean | null
          updated_at?: string
          vehicle_interest?: string | null
        }
        Update: {
          assigned_salesperson?: string | null
          budget?: number | null
          created_at?: string
          customer_id?: string
          financing_needed?: boolean | null
          lead_id?: string
          lead_score?: number
          lead_status?: string
          lead_temperature?: string
          next_followup_date?: string | null
          notes?: string
          purchase_timeline?: string | null
          source?: string
          trade_in?: boolean | null
          updated_at?: string
          vehicle_interest?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_salesperson_fkey"
            columns: ["assigned_salesperson"]
            isOneToOne: false
            referencedRelation: "salespeople"
            referencedColumns: ["salesperson_id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "leads_vehicle_interest_fkey"
            columns: ["vehicle_interest"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      salespeople: {
        Row: {
          active: boolean
          created_at: string
          languages: string[]
          name: string
          salesperson_id: string
          shift_end: string
          shift_start: string
          specialization: string
          synthetic_email: string
          synthetic_phone: string
          updated_at: string
          working_days: string[]
        }
        Insert: {
          active?: boolean
          created_at?: string
          languages: string[]
          name: string
          salesperson_id: string
          shift_end: string
          shift_start: string
          specialization: string
          synthetic_email: string
          synthetic_phone: string
          updated_at?: string
          working_days: string[]
        }
        Update: {
          active?: boolean
          created_at?: string
          languages?: string[]
          name?: string
          salesperson_id?: string
          shift_end?: string
          shift_start?: string
          specialization?: string
          synthetic_email?: string
          synthetic_phone?: string
          updated_at?: string
          working_days?: string[]
        }
        Relationships: []
      }
      trade_ins: {
        Row: {
          condition: string
          created_at: string
          customer_id: string
          estimated_value: number
          lead_id: string
          loan_balance: number
          make: string
          mileage: number
          model: string
          notes: string
          trade_in_id: string
          updated_at: string
          year: number
        }
        Insert: {
          condition: string
          created_at?: string
          customer_id: string
          estimated_value: number
          lead_id: string
          loan_balance?: number
          make: string
          mileage: number
          model: string
          notes: string
          trade_in_id: string
          updated_at?: string
          year: number
        }
        Update: {
          condition?: string
          created_at?: string
          customer_id?: string
          estimated_value?: number
          lead_id?: string
          loan_balance?: number
          make?: string
          mileage?: number
          model?: string
          notes?: string
          trade_in_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "trade_ins_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "trade_ins_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["lead_id"]
          },
        ]
      }
      vehicle_features: {
        Row: {
          created_at: string
          feature_id: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_features_feature_fk"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "features"
            referencedColumns: ["feature_id"]
          },
          {
            foreignKeyName: "vehicle_features_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      vehicle_images: {
        Row: {
          created_at: string
          id: number
          is_primary: boolean
          sort_order: number
          storage_path: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_primary?: boolean
          sort_order?: number
          storage_path: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: number
          is_primary?: boolean
          sort_order?: number
          storage_path?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_storage_images_vehicle_fk"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      vehicle_model_images: {
        Row: {
          fetched_at: string
          height: number | null
          image_key: string
          image_url: string
          make: string
          model: string
          model_year: number | null
          provider: string
          source_url: string | null
          thumbnail_url: string | null
          usage_license: string
          width: number | null
        }
        Insert: {
          fetched_at?: string
          height?: number | null
          image_key: string
          image_url: string
          make: string
          model: string
          model_year?: number | null
          provider?: string
          source_url?: string | null
          thumbnail_url?: string | null
          usage_license?: string
          width?: number | null
        }
        Update: {
          fetched_at?: string
          height?: number | null
          image_key?: string
          image_url?: string
          make?: string
          model?: string
          model_year?: number | null
          provider?: string
          source_url?: string | null
          thumbnail_url?: string | null
          usage_license?: string
          width?: number | null
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          body_type: string
          certification: string
          condition: string
          created_at: string
          dealership_location: string
          drivetrain: string
          exterior_color: string
          fuel_type: string
          interior_color: string
          is_featured: boolean | null
          make: string
          mileage: number
          model: string
          msrp: number
          sale_price: number
          seating_capacity: number
          stock_number: string
          test_drive_available: boolean
          transmission: string
          trim: string
          updated_at: string
          vehicle_id: string
          vehicle_status: string
          vin: string
          warranty: string
          year: number
        }
        Insert: {
          body_type: string
          certification: string
          condition: string
          created_at?: string
          dealership_location: string
          drivetrain: string
          exterior_color: string
          fuel_type: string
          interior_color: string
          is_featured?: boolean | null
          make: string
          mileage?: number
          model: string
          msrp: number
          sale_price: number
          seating_capacity: number
          stock_number: string
          test_drive_available?: boolean
          transmission: string
          trim: string
          updated_at?: string
          vehicle_id: string
          vehicle_status: string
          vin: string
          warranty: string
          year: number
        }
        Update: {
          body_type?: string
          certification?: string
          condition?: string
          created_at?: string
          dealership_location?: string
          drivetrain?: string
          exterior_color?: string
          fuel_type?: string
          interior_color?: string
          is_featured?: boolean | null
          make?: string
          mileage?: number
          model?: string
          msrp?: number
          sale_price?: number
          seating_capacity?: number
          stock_number?: string
          test_drive_available?: boolean
          transmission?: string
          trim?: string
          updated_at?: string
          vehicle_id?: string
          vehicle_status?: string
          vin?: string
          warranty?: string
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_appointment: { Args: { p_request: Json }; Returns: Json }
      admin_create_vehicle: {
        Args: { p_vehicle: Json }
        Returns: {
          body_type: string
          certification: string
          condition: string
          created_at: string
          dealership_location: string
          drivetrain: string
          exterior_color: string
          fuel_type: string
          interior_color: string
          is_featured: boolean | null
          make: string
          mileage: number
          model: string
          msrp: number
          sale_price: number
          seating_capacity: number
          stock_number: string
          test_drive_available: boolean
          transmission: string
          trim: string
          updated_at: string
          vehicle_id: string
          vehicle_status: string
          vin: string
          warranty: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      check_vehicle_availability: {
        Args: { p_vehicle_id: string }
        Returns: Json
      }
      create_or_update_lead: {
        Args: {
          p_assigned_salesperson?: string
          p_budget?: number
          p_customer_id: string
          p_financing_needed?: boolean
          p_notes?: string
          p_purchase_timeline?: string
          p_trade_in?: boolean
          p_vehicle_id?: string
        }
        Returns: Json
      }
      create_test_drive: {
        Args: {
          p_appointment_date: string
          p_appointment_time: string
          p_customer_id: string
          p_lead_id: string
          p_notes?: string
          p_salesperson_id: string
          p_vehicle_id: string
        }
        Returns: Json
      }
      create_test_drive_atomic: { Args: { p_request: Json }; Returns: Json }
      create_test_drive_website: { Args: { p_request: Json }; Returns: Json }
      dashboard_bookings_by_hour: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bookings: number
          hour: number
        }[]
      }
      dashboard_bookings_by_status: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bookings: number
          status: string
        }[]
      }
      dashboard_bookings_by_weekday: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bookings: number
          weekday: number
        }[]
      }
      dashboard_bookings_over_time: {
        Args: { p_from: string; p_to: string }
        Returns: {
          bookings: number
          day: string
        }[]
      }
      dashboard_inventory_breakdown: {
        Args: { p_dimension?: string }
        Returns: {
          label: string
          total_value: number
          vehicles: number
        }[]
      }
      dashboard_kpis: { Args: { p_from: string; p_to: string }; Returns: Json }
      dashboard_top_vehicles: {
        Args: { p_from: string; p_limit?: number; p_to: string }
        Returns: {
          bookings: number
          vehicle_id: string
          vehicle_name: string
        }[]
      }
      get_test_drive_slots: {
        Args: { p_appointment_date: string; p_vehicle_id: string }
        Returns: Json
      }
      get_vehicle_details: { Args: { p_vehicle_id: string }; Returns: Json }
      inventory_facets: { Args: never; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      normalize_customer_phone: { Args: { p_phone: string }; Returns: string }
      resolve_or_create_customer: {
        Args: {
          p_email?: string
          p_first_name: string
          p_last_name?: string
          p_phone: string
        }
        Returns: Json
      }
      resolve_or_create_customer_website: {
        Args: {
          p_email?: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: Json
      }
      search_inventory: {
        Args: {
          p_body_type?: string
          p_budget_max?: number
          p_budget_min?: number
          p_condition?: string
          p_drivetrain?: string
          p_features?: string
          p_make?: string
          p_mileage_max?: number
          p_model?: string
          p_seating_capacity?: number
          p_year_max?: number
          p_year_min?: number
        }
        Returns: Json
      }
      upsert_lead_atomic: { Args: { p_request: Json }; Returns: Json }
      upsert_lead_website: { Args: { p_request: Json }; Returns: Json }
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
