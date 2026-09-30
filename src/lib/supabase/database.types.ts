// Generated from the Supabase schema (project rufino-clinical). Do not edit by hand.
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          district: string
          id: string
          is_default: boolean
          label: string | null
          number: string
          recipient_name: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          district: string
          id?: string
          is_default?: boolean
          label?: string | null
          number: string
          recipient_name: string
          state: string
          street: string
          updated_at?: string
          user_id?: string
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          district?: string
          id?: string
          is_default?: boolean
          label?: string | null
          number?: string
          recipient_name?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          position: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          position?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      cep_locations: {
        Row: {
          cep: string
          city: string | null
          fetched_at: string
          latitude: number | null
          longitude: number | null
          state: string | null
        }
        Insert: {
          cep: string
          city?: string | null
          fetched_at?: string
          latitude?: number | null
          longitude?: number | null
          state?: string | null
        }
        Update: {
          cep?: string
          city?: string | null
          fetched_at?: string
          latitude?: number | null
          longitude?: number | null
          state?: string | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_subtotal_cents: number
          redemptions_count: number
          starts_at: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal_cents?: number
          redemptions_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_subtotal_cents?: number
          redemptions_count?: number
          starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_name: string
          quantity: number
          sku: string
          total_cents: number
          unit_price_cents: number
          variant_id: string | null
          variant_name: string
        }
        Insert: {
          id?: string
          order_id: string
          product_name: string
          quantity: number
          sku: string
          total_cents: number
          unit_price_cents: number
          variant_id?: string | null
          variant_name: string
        }
        Update: {
          id?: string
          order_id?: string
          product_name?: string
          quantity?: number
          sku?: string
          total_cents?: number
          unit_price_cents?: number
          variant_id?: string | null
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_notes: {
        Row: {
          created_at: string
          id: string
          notes: string
          order_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes: string
          order_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          canceled_at: string | null
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          customer_document: string | null
          customer_email: string
          customer_name: string
          customer_phone: string | null
          delivered_at: string | null
          discount_cents: number
          expires_at: string | null
          gateway_payment_id: string | null
          id: string
          installments: number | null
          number: number
          paid_at: string | null
          payment_discount_cents: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          shipped_at: string | null
          shipping_address: Json
          shipping_cents: number
          shipping_days: number | null
          shipping_method: Database["public"]["Enums"]["shipping_method"]
          shipping_service: string | null
          shipping_tracking_code: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          canceled_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email: string
          customer_name: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_cents?: number
          expires_at?: string | null
          gateway_payment_id?: string | null
          id?: string
          installments?: number | null
          number?: never
          paid_at?: string | null
          payment_discount_cents?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipped_at?: string | null
          shipping_address: Json
          shipping_cents?: number
          shipping_days?: number | null
          shipping_method?: Database["public"]["Enums"]["shipping_method"]
          shipping_service?: string | null
          shipping_tracking_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          canceled_at?: string | null
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_email?: string
          customer_name?: string
          customer_phone?: string | null
          delivered_at?: string | null
          discount_cents?: number
          expires_at?: string | null
          gateway_payment_id?: string | null
          id?: string
          installments?: number | null
          number?: never
          paid_at?: string | null
          payment_discount_cents?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          shipped_at?: string | null
          shipping_address?: Json
          shipping_cents?: number
          shipping_days?: number | null
          shipping_method?: Database["public"]["Enums"]["shipping_method"]
          shipping_service?: string | null
          shipping_tracking_code?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          installments: number | null
          method: Database["public"]["Enums"]["payment_method"] | null
          order_id: string
          provider: string
          provider_payment_id: string
          raw: Json | null
          status: string
          status_detail: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          installments?: number | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id: string
          provider?: string
          provider_payment_id: string
          raw?: Json | null
          status: string
          status_detail?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          installments?: number | null
          method?: Database["public"]["Enums"]["payment_method"] | null
          order_id?: string
          provider?: string
          provider_payment_id?: string
          raw?: Json | null
          status?: string
          status_detail?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string
          created_at: string
          id: string
          position: number
          product_id: string
          storage_path: string
          variant_id: string | null
        }
        Insert: {
          alt: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          storage_path: string
          variant_id?: string | null
        }
        Update: {
          alt?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          storage_path?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          compare_at_price_cents: number | null
          created_at: string
          height_cm: number
          id: string
          is_active: boolean
          length_cm: number
          name: string
          options: Json
          position: number
          price_cents: number
          product_id: string
          sku: string
          stock_quantity: number
          updated_at: string
          weight_grams: number
          width_cm: number
        }
        Insert: {
          compare_at_price_cents?: number | null
          created_at?: string
          height_cm: number
          id?: string
          is_active?: boolean
          length_cm: number
          name: string
          options?: Json
          position?: number
          price_cents: number
          product_id: string
          sku: string
          stock_quantity?: number
          updated_at?: string
          weight_grams: number
          width_cm: number
        }
        Update: {
          compare_at_price_cents?: number | null
          created_at?: string
          height_cm?: number
          id?: string
          is_active?: boolean
          length_cm?: number
          name?: string
          options?: Json
          position?: number
          price_cents?: number
          product_id?: string
          sku?: string
          stock_quantity?: number
          updated_at?: string
          weight_grams?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          anvisa_registration: string | null
          brand: string | null
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          indications: string | null
          is_active: boolean
          is_featured: boolean
          name: string
          position: number
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          updated_at: string
          usage_instructions: string | null
        }
        Insert: {
          anvisa_registration?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          indications?: string | null
          is_active?: boolean
          is_featured?: boolean
          name: string
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          updated_at?: string
          usage_instructions?: string | null
        }
        Update: {
          anvisa_registration?: string | null
          brand?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          indications?: string | null
          is_active?: boolean
          is_featured?: boolean
          name?: string
          position?: number
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          updated_at?: string
          usage_instructions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          document: string | null
          full_name: string | null
          id: string
          marketing_opt_in: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document?: string | null
          full_name?: string | null
          id: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string | null
          full_name?: string | null
          id?: string
          marketing_opt_in?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          max_days: number
          min_days: number
          price_cents: number
          region: string
          updated_at: string
        }
        Insert: {
          max_days: number
          min_days: number
          price_cents: number
          region: string
          updated_at?: string
        }
        Update: {
          max_days?: number
          min_days?: number
          price_cents?: number
          region?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          actor_id: string | null
          created_at: string
          delta: number
          id: number
          order_id: string | null
          reason: string
          variant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          delta: number
          id?: never
          order_id?: string | null
          reason: string
          variant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          delta?: number
          id?: never
          order_id?: string | null
          reason?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          free_shipping_threshold_cents: number | null
          id: boolean
          interest_free_installments: number
          local_delivery_cutoff: string
          local_delivery_enabled: boolean
          local_delivery_price_cents: number
          local_delivery_radius_km: number
          max_installments: number
          min_installment_cents: number
          origin_zip: string | null
          pickup_address: string | null
          pickup_enabled: boolean
          pickup_hours: string | null
          pix_discount_percent: number
          updated_at: string
        }
        Insert: {
          free_shipping_threshold_cents?: number | null
          id?: boolean
          interest_free_installments?: number
          local_delivery_cutoff?: string
          local_delivery_enabled?: boolean
          local_delivery_price_cents?: number
          local_delivery_radius_km?: number
          max_installments?: number
          min_installment_cents?: number
          origin_zip?: string | null
          pickup_address?: string | null
          pickup_enabled?: boolean
          pickup_hours?: string | null
          pix_discount_percent?: number
          updated_at?: string
        }
        Update: {
          free_shipping_threshold_cents?: number | null
          id?: boolean
          interest_free_installments?: number
          local_delivery_cutoff?: string
          local_delivery_enabled?: boolean
          local_delivery_price_cents?: number
          local_delivery_radius_km?: number
          max_installments?: number
          min_installment_cents?: number
          origin_zip?: string | null
          pickup_address?: string | null
          pickup_enabled?: boolean
          pickup_hours?: string | null
          pix_discount_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          error: string | null
          event_key: string
          id: number
          payload: Json
          processed_at: string | null
          provider: string
          received_at: string
          type: string | null
        }
        Insert: {
          error?: string | null
          event_key: string
          id?: never
          payload: Json
          processed_at?: string | null
          provider: string
          received_at?: string
          type?: string | null
        }
        Update: {
          error?: string | null
          event_key?: string
          id?: never
          payload?: Json
          processed_at?: string | null
          provider?: string
          received_at?: string
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      adjust_stock: {
        Args: { p_delta: number; p_reason?: string; p_variant_id: string }
        Returns: number
      }
      admin_status: { Args: never; Returns: string }
      cancel_order: { Args: { p_order_id: string }; Returns: boolean }
      create_order: {
        Args: {
          p_address_id: string
          p_coupon_code?: string
          p_items: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_shipping?: Database["public"]["Enums"]["shipping_method"]
        }
        Returns: Json
      }
      delete_my_account: { Args: never; Returns: undefined }
      estimate_shipping: {
        Args: { p_goods_cents?: number; p_zip: string }
        Returns: Json
      }
      quote_order: {
        Args: {
          p_address_id: string
          p_coupon_code?: string
          p_items: Json
          p_payment_method: Database["public"]["Enums"]["payment_method"]
          p_shipping?: Database["public"]["Enums"]["shipping_method"]
        }
        Returns: Json
      }
      record_payment: {
        Args: {
          p_amount_cents: number
          p_expires_at?: string
          p_installments: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_provider_payment_id: string
          p_raw: Json
          p_status: string
          p_status_detail: string
        }
        Returns: string
      }
    }
    Enums: {
      discount_type: "percent" | "fixed"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "canceled"
        | "refunded"
      payment_method: "pix" | "credit_card" | "boleto"
      shipping_method: "standard" | "local" | "pickup"
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
    Enums: {
      discount_type: ["percent", "fixed"],
      order_status: [
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "canceled",
        "refunded",
      ],
      payment_method: ["pix", "credit_card", "boleto"],
      shipping_method: ["standard", "local", "pickup"],
    },
  },
} as const
