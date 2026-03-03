export type UserRole = 'admin' | 'manager' | 'cashier';
export type SaleStatus = 'completed' | 'suspended' | 'voided' | 'refunded';
export type ActivityType = 'login' | 'logout' | 'sale' | 'refund' | 'void' |
  'stock_adjustment' | 'product_create' | 'product_update' |
  'price_change' | 'settings_change' | 'report_generate';

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: UserRole;
          pin_code: string | null;
          is_active: boolean;
          last_login_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          parent_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          category_id: string | null;
          unit_of_measure: string;
          cost_price: number;
          retail_price: number;
          margin_percentage: number | null;
          tax_rate: number;
          has_variants: boolean;
          track_inventory: boolean;
          is_active: boolean;
          image_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'margin_percentage' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          sku: string;
          variant_name: string;
          variant_type: string;
          variant_value: string;
          cost_price: number;
          retail_price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['product_variants']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['product_variants']['Insert']>;
      };
      barcodes: {
        Row: {
          id: string;
          barcode: string;
          product_id: string | null;
          variant_id: string | null;
          is_primary: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['barcodes']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['barcodes']['Insert']>;
      };
      locations: {
        Row: {
          id: string;
          name: string;
          code: string;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['locations']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['locations']['Insert']>;
      };
      inventory: {
        Row: {
          id: string;
          location_id: string;
          product_id: string | null;
          variant_id: string | null;
          quantity: number;
          low_stock_threshold: number;
          batch_number: string | null;
          expiry_date: string | null;
          last_counted_at: string | null;
          last_counted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>;
      };
      customers: {
        Row: {
          id: string;
          customer_code: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          loyalty_points: number;
          total_spent: number;
          visit_count: number;
          last_visit_at: string | null;
          date_of_birth: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      sales: {
        Row: {
          id: string;
          sale_number: string;
          location_id: string;
          customer_id: string | null;
          cashier_id: string;
          shift_id: string | null;
          status: SaleStatus;
          subtotal: number;
          discount_amount: number;
          discount_percentage: number;
          tax_amount: number;
          total_amount: number;
          amount_paid: number;
          change_amount: number;
          loyalty_points_earned: number;
          loyalty_points_redeemed: number;
          notes: string | null;
          voided_by: string | null;
          voided_at: string | null;
          void_reason: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['sales']['Insert']>;
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string | null;
          variant_id: string | null;
          product_name: string;
          sku: string;
          quantity: number;
          unit_price: number;
          discount_amount: number;
          discount_percentage: number;
          tax_rate: number;
          tax_amount: number;
          line_total: number;
          cost_price: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>;
      };
      payment_methods: {
        Row: {
          id: string;
          name: string;
          code: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payment_methods']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['payment_methods']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          payment_method_id: string;
          amount: number;
          reference_number: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['payments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      tax_rules: {
        Row: {
          id: string;
          name: string;
          rate: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['tax_rules']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['tax_rules']['Insert']>;
      };
      stock_adjustments: {
        Row: {
          id: string;
          adjustment_number: string;
          location_id: string;
          product_id: string | null;
          variant_id: string | null;
          quantity_change: number;
          reason: string;
          notes: string | null;
          adjusted_by: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['stock_adjustments']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['stock_adjustments']['Insert']>;
      };
      refunds: {
        Row: {
          id: string;
          refund_number: string;
          sale_id: string;
          sale_item_id: string | null;
          customer_id: string | null;
          refunded_by: string;
          quantity: number;
          refund_amount: number;
          reason: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['refunds']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['refunds']['Insert']>;
      };
      activity_logs: {
        Row: {
          id: string;
          user_id: string | null;
          activity_type: ActivityType;
          description: string;
          metadata: Record<string, unknown> | null;
          ip_address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['activity_logs']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['activity_logs']['Insert']>;
      };
    };
  };
}

export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type ProductVariant = Database['public']['Tables']['product_variants']['Row'];
export type Barcode = Database['public']['Tables']['barcodes']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];
export type Inventory = Database['public']['Tables']['inventory']['Row'];
export type Customer = Database['public']['Tables']['customers']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type PaymentMethod = Database['public']['Tables']['payment_methods']['Row'];
export type TaxRule = Database['public']['Tables']['tax_rules']['Row'];
export type StockAdjustment = Database['public']['Tables']['stock_adjustments']['Row'];
export type Refund = Database['public']['Tables']['refunds']['Row'];
export type ActivityLog = Database['public']['Tables']['activity_logs']['Row'];

export interface CartItem {
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  cost_price: number | null;
  tax_rate: number;
  discount_percentage: number;
  discount_amount: number;
  line_total: number;
  tax_amount: number;
}

export interface ProductWithInventory extends Product {
  inventory?: Inventory[];
  barcodes?: Barcode[];
  category?: Category;
}
