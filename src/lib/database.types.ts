export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Rel = [];

export type Database = {
  public: {
    Tables: {
      billing_provider_configs: {
        Row: { provider: string; enabled: boolean; mode: string; account_label: string; public_config: Json; encrypted_credentials: Json; updated_by: string | null; created_at: string; updated_at: string };
        Insert: { provider: string; enabled?: boolean; mode?: string; account_label?: string; public_config?: Json; encrypted_credentials?: Json; updated_by?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["billing_provider_configs"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_connections: {
        Row: { id: string; workspace_id: string; created_by: string | null; name: string; token_hash: string; token_prefix: string; scopes: string[]; status: string; last_used_at: string | null; expires_at: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; created_by?: string | null; name: string; token_hash: string; token_prefix: string; scopes?: string[]; status?: string; last_used_at?: string | null; expires_at?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_connections"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_tool_calls: {
        Row: { id: string; workspace_id: string; connection_id: string | null; actor_user_id: string | null; request_id: string | null; tool_name: string; status: string; duration_ms: number; input_summary: Json; result_count: number | null; error_code: string | null; created_at: string };
        Insert: { id?: string; workspace_id: string; connection_id?: string | null; actor_user_id?: string | null; request_id?: string | null; tool_name: string; status: string; duration_ms?: number; input_summary?: Json; result_count?: number | null; error_code?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_tool_calls"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_settings: {
        Row: { id: number; enabled: boolean; read_tools_enabled: boolean; write_tools_enabled: boolean; last_alert_fingerprint: string | null; last_alert_sent_at: string | null; last_alert_resolved_at: string | null; updated_by: string | null; updated_at: string };
        Insert: { id?: number; enabled?: boolean; read_tools_enabled?: boolean; write_tools_enabled?: boolean; last_alert_fingerprint?: string | null; last_alert_sent_at?: string | null; last_alert_resolved_at?: string | null; updated_by?: string | null; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_settings"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_action_requests: {
        Row: { id: string; workspace_id: string; connection_id: string | null; requested_by: string | null; reviewed_by: string | null; action_type: string; payload: Json; status: string; result: Json | null; error_message: string | null; reviewed_at: string | null; completed_at: string | null; expires_at: string; idempotency_key: string | null; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; connection_id?: string | null; requested_by?: string | null; reviewed_by?: string | null; action_type: string; payload?: Json; status?: string; result?: Json | null; error_message?: string | null; reviewed_at?: string | null; completed_at?: string | null; expires_at?: string; idempotency_key?: string | null; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_action_requests"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_idempotency_keys: {
        Row: { id: string; workspace_id: string; connection_id: string; tool_name: string; idempotency_key: string; result: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; connection_id: string; tool_name: string; idempotency_key: string; result?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_idempotency_keys"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_oauth_clients: {
        Row: { client_id: string; client_name: string; redirect_uris: string[]; grant_types: string[]; response_types: string[]; token_endpoint_auth_method: string; status: string; registration_fingerprint: string | null; created_at: string; last_used_at: string | null };
        Insert: { client_id: string; client_name: string; redirect_uris: string[]; grant_types?: string[]; response_types?: string[]; token_endpoint_auth_method?: string; status?: string; registration_fingerprint?: string | null; created_at?: string; last_used_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["mcp_oauth_clients"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_oauth_codes: {
        Row: { code_hash: string; client_id: string; connection_id: string; workspace_id: string; user_id: string | null; redirect_uri: string; scopes: string[]; code_challenge: string; resource: string; expires_at: string; used_at: string | null; created_at: string };
        Insert: { code_hash: string; client_id: string; connection_id: string; workspace_id: string; user_id?: string | null; redirect_uri: string; scopes?: string[]; code_challenge: string; resource: string; expires_at: string; used_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_oauth_codes"]["Insert"]>;
        Relationships: Rel;
      };
      mcp_oauth_tokens: {
        Row: { id: string; access_token_hash: string; refresh_token_hash: string | null; client_id: string; connection_id: string; workspace_id: string; user_id: string | null; scopes: string[]; resource: string; access_expires_at: string; refresh_expires_at: string | null; revoked_at: string | null; last_used_at: string | null; created_at: string };
        Insert: { id?: string; access_token_hash: string; refresh_token_hash?: string | null; client_id: string; connection_id: string; workspace_id: string; user_id?: string | null; scopes?: string[]; resource: string; access_expires_at: string; refresh_expires_at?: string | null; revoked_at?: string | null; last_used_at?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["mcp_oauth_tokens"]["Insert"]>;
        Relationships: Rel;
      };
      activities: {
        Row: {
          id: string;
          workspace_id: string;
          actor_user_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          deal_id: string | null;
          lead_id: string | null;
          quote_id: string | null;
          task_id: string | null;
          activity_type: string;
          title: string;
          body: string | null;
          occurred_at: string;
          is_system: boolean;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_user_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          deal_id?: string | null;
          lead_id?: string | null;
          quote_id?: string | null;
          task_id?: string | null;
          activity_type: string;
          title: string;
          body?: string | null;
          occurred_at?: string;
          is_system?: boolean;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activities"]["Insert"]>;
        Relationships: Rel;
      };
      companies: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          domain: string;
          website: string;
          industry: string;
          company_size: string;
          phone: string;
          email: string;
          address: string;
          tax_code: string;
          logo_path: string;
          owner_user_id: string | null;
          lifecycle_stage: string;
          lead_source: string;
          notes: string;
          legacy_client_id: string | null;
          external_place_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          domain?: string;
          website?: string;
          industry?: string;
          company_size?: string;
          phone?: string;
          email?: string;
          address?: string;
          tax_code?: string;
          logo_path?: string;
          owner_user_id?: string | null;
          lifecycle_stage?: string;
          lead_source?: string;
          notes?: string;
          legacy_client_id?: string | null;
          external_place_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
        Relationships: Rel;
      };
      contacts: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string | null;
          first_name: string;
          last_name: string;
          display_name: string;
          email: string;
          phone: string;
          job_title: string;
          linkedin_url: string;
          owner_user_id: string | null;
          relationship_strength: string;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id?: string | null;
          first_name?: string;
          last_name?: string;
          display_name?: string;
          email?: string;
          phone?: string;
          job_title?: string;
          linkedin_url?: string;
          owner_user_id?: string | null;
          relationship_strength?: string;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["contacts"]["Insert"]>;
        Relationships: Rel;
      };
      deal_contacts: {
        Row: {
          workspace_id: string;
          deal_id: string;
          contact_id: string;
          stakeholder_role: string;
          influence_level: string;
          relationship_strength: string;
          is_primary: boolean;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          deal_id: string;
          contact_id: string;
          stakeholder_role?: string;
          influence_level?: string;
          relationship_strength?: string;
          is_primary?: boolean;
          notes?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deal_contacts"]["Insert"]>;
        Relationships: Rel;
      };
      deals: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          primary_contact_id: string | null;
          pipeline_id: string;
          stage_id: string;
          owner_user_id: string | null;
          title: string;
          description: string;
          deal_type: string;
          amount: number;
          currency: string;
          probability: number;
          expected_close_date: string | null;
          priority: string;
          source: string;
          lost_reason: string | null;
          won_at: string | null;
          lost_at: string | null;
          last_activity_at: string | null;
          next_activity_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id: string;
          primary_contact_id?: string | null;
          pipeline_id: string;
          stage_id: string;
          owner_user_id?: string | null;
          title: string;
          description?: string;
          deal_type?: string;
          amount?: number;
          currency?: string;
          probability?: number;
          expected_close_date?: string | null;
          priority?: string;
          source?: string;
          lost_reason?: string | null;
          won_at?: string | null;
          lost_at?: string | null;
          last_activity_at?: string | null;
          next_activity_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
        Relationships: Rel;
      };
      leads: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string | null;
          contact_id: string | null;
          owner_user_id: string | null;
          status: string;
          source: string;
          score: number | null;
          score_reason: string | null;
          next_action_at: string | null;
          last_activity_at: string | null;
          converted_deal_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          company_id?: string | null;
          contact_id?: string | null;
          owner_user_id?: string | null;
          status?: string;
          source?: string;
          score?: number | null;
          score_reason?: string | null;
          next_action_at?: string | null;
          last_activity_at?: string | null;
          converted_deal_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
        Relationships: Rel;
      };
      pipeline_stages: {
        Row: {
          id: string;
          workspace_id: string;
          pipeline_id: string;
          name: string;
          position: number;
          probability: number;
          stage_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          pipeline_id: string;
          name: string;
          position?: number;
          probability?: number;
          stage_type?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipeline_stages"]["Insert"]>;
        Relationships: Rel;
      };
      pipelines: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          kind: string;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          name: string;
          kind?: string;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pipelines"]["Insert"]>;
        Relationships: Rel;
      };
      tasks: {
        Row: {
          id: string;
          workspace_id: string;
          assigned_to: string | null;
          deal_id: string | null;
          company_id: string | null;
          contact_id: string | null;
          type: string;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          due_at: string | null;
          completed_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          assigned_to?: string | null;
          deal_id?: string | null;
          company_id?: string | null;
          contact_id?: string | null;
          type?: string;
          title: string;
          description?: string | null;
          priority?: string;
          status?: string;
          due_at?: string | null;
          completed_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Insert"]>;
        Relationships: Rel;
      };
      clients: {
        Row: {
          address: string;
          authorization_doc: string;
          company_name: string;
          contact_name: string;
          created_at: string;
          email: string;
          id: string;
          industry: string;
          logo_url: string;
          notes: string;
          phone: string;
          representative_title: string;
          tax_code: string;
          workspace_id: string;
        };
        Insert: {
          address?: string;
          authorization_doc?: string;
          company_name: string;
          contact_name?: string;
          created_at?: string;
          email?: string;
          id?: string;
          industry?: string;
          logo_url?: string;
          notes?: string;
          phone?: string;
          representative_title?: string;
          tax_code?: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["clients"]["Insert"]>;
        Relationships: [];
      };
      invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: string;
          token_hash: string;
          workspace_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          role: string;
          token_hash: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["invites"]["Insert"]>;
        Relationships: [];
      };
      invoices: {
        Row: {
          amount: number;
          billing_interval: string;
          created_at: string;
          currency: string;
          id: string;
          paid_at: string | null;
          payment_code: string;
          plan_id: string;
          price_snapshot: Json;
          status: string;
          subscription_id: string | null;
          vat_requested: boolean;
          vat_tax_code: string;
          workspace_id: string;
          provider: string;
          external_invoice_id: string | null;
          provider_status: string | null;
          hosted_invoice_url: string | null;
          billing_country: string | null;
          display_currency: string | null;
          subtotal_amount: number | null;
          tax_amount: number;
          total_amount: number | null;
          tax_behavior: "inclusive" | "exclusive" | null;
          tax_calculation_id: string | null;
        };
        Insert: {
          amount: number;
          billing_interval?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          paid_at?: string | null;
          payment_code: string;
          plan_id: string;
          price_snapshot?: Json;
          status?: string;
          subscription_id?: string | null;
          vat_requested?: boolean;
          vat_tax_code?: string;
          workspace_id: string;
          provider?: string;
          external_invoice_id?: string | null;
          provider_status?: string | null;
          hosted_invoice_url?: string | null;
          billing_country?: string | null;
          display_currency?: string | null;
          subtotal_amount?: number | null;
          tax_amount?: number;
          total_amount?: number | null;
          tax_behavior?: "inclusive" | "exclusive" | null;
          tax_calculation_id?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["invoices"]["Insert"]>;
        Relationships: [];
      };
      module_templates: {
        Row: {
          category: string;
          default_qty: number;
          description: string;
          id: string;
          name: string;
          sort_order: number;
          suggested_price: number;
          visual_hint: string;
        };
        Insert: Database["public"]["Tables"]["module_templates"]["Row"];
        Update: Partial<Database["public"]["Tables"]["module_templates"]["Row"]>;
        Relationships: [];
      };
      knowledge_documents: {
        Row: {
          id: string;
          workspace_id: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          byte_size: number;
          status: "processing" | "ready" | "error" | "archived";
          extracted_chars: number;
          chunk_count: number;
          error_message: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          file_name: string;
          storage_path: string;
          mime_type?: string;
          byte_size?: number;
          status?: "processing" | "ready" | "error" | "archived";
          extracted_chars?: number;
          chunk_count?: number;
          error_message?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_documents"]["Insert"]>;
        Relationships: [];
      };
      knowledge_chunks: {
        Row: {
          id: string;
          workspace_id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          metadata: Json;
          embedding: string;
          search_vector: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          document_id: string;
          chunk_index: number;
          content: string;
          metadata?: Json;
          embedding: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_chunks"]["Insert"]>;
        Relationships: [];
      };
      knowledge_module_drafts: {
        Row: {
          id: string;
          workspace_id: string;
          document_id: string;
          name: string;
          description: string;
          suggested_price: number;
          source_excerpt: string;
          status: "pending" | "approved" | "rejected";
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          document_id: string;
          name: string;
          description?: string;
          suggested_price?: number;
          source_excerpt?: string;
          status?: "pending" | "approved" | "rejected";
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_module_drafts"]["Insert"]>;
        Relationships: [];
      };
      modules: {
        Row: {
          category: string;
          created_at: string;
          default_qty: number;
          description: string;
          id: string;
          name: string;
          suggested_price: number;
          visual_hint: string;
          workspace_id: string;
        };
        Insert: {
          category?: string;
          created_at?: string;
          default_qty?: number;
          description?: string;
          id?: string;
          name: string;
          suggested_price?: number;
          visual_hint?: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["modules"]["Insert"]>;
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          channel: string;
          created_at: string;
          id: string;
          invoice_id: string;
          raw: Json;
          sepay_id: string | null;
          provider: string;
          external_payment_id: string | null;
          currency: string;
          provider_fee: number | null;
          net_amount: number | null;
          refund_status: string | null;
        };
        Insert: {
          amount: number;
          channel: string;
          created_at?: string;
          id?: string;
          invoice_id: string;
          raw?: Json;
          sepay_id?: string | null;
          provider?: string;
          external_payment_id?: string | null;
          currency?: string;
          provider_fee?: number | null;
          net_amount?: number | null;
          refund_status?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["payments"]["Insert"]>;
        Relationships: [];
      };
      plans: {
        Row: {
          badge: string;
          created_at: string;
          features: Json;
          id: string;
          is_free: boolean;
          is_public: boolean;
          name: string;
          price_monthly: number;
          price_yearly: number;
          quotas: Json;
          slot: number;
          slug: string;
          sort_order: number;
          trial_days: number;
          updated_at: string;
          entitlement_version: number;
        };
        Insert: Omit<Database["public"]["Tables"]["plans"]["Row"], "entitlement_version"> & { entitlement_version?: number };
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
        Relationships: [];
      };
      billing_provider_prices: {
        Row: {
          id: string;
          plan_id: string;
          provider: "stripe" | "paypal" | "sepay";
          billing_interval: "monthly" | "yearly";
          currency: string;
          amount: number;
          external_product_id: string | null;
          external_price_id: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["billing_provider_prices"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["billing_provider_prices"]["Insert"]>;
        Relationships: [];
      };
      billing_webhook_events: {
        Row: {
          id: string;
          provider: "stripe" | "paypal" | "sepay";
          external_event_id: string;
          event_type: string;
          payload: Json;
          received_at: string;
          processed_at: string | null;
          processing_error: string | null;
        };
        Insert: {
          id?: string;
          provider: "stripe" | "paypal" | "sepay";
          external_event_id: string;
          event_type: string;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
          processing_error?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["billing_webhook_events"]["Insert"]>;
        Relationships: [];
      };
      platform_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          role: string;
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Insert"]>;
        Relationships: [];
      };
      platform_invites: {
        Row: {
          accepted_at: string | null;
          created_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          role: string;
          token_hash: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string;
          email: string;
          expires_at: string;
          id?: string;
          invited_by: string;
          role: string;
          token_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_invites"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          display_name: string;
          email: string;
          id: string;
          preferred_locale: string | null;
          status: string;
          suspend_source: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          email: string;
          id: string;
          preferred_locale?: string | null;
          status?: string;
          suspend_source?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      public_quotes: {
        Row: {
          created_at: string;
          id: string;
          payload: Json;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          payload: Json;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["public_quotes"]["Insert"]>;
        Relationships: [];
      };
      quotes: {
        Row: {
          client_id: string | null;
          contract_number: string;
          created_at: string;
          currency: string;
          deliverables: Json;
          discount: number;
          id: string;
          items: Json;
          maintenance_fee_monthly: number;
          next_steps: string;
          payment_milestones: Json;
          project_overview: string;
          project_type: string;
          public_id: string;
          status: string;
          tech_stack: Json;
          timeline: string;
          title: string;
          updated_at: string;
          valid_until: string | null;
          vat_rate: number;
          warranty_months: number;
          workspace_id: string;
          deal_id: string | null;
          revision_number: number;
          supersedes_quote_id: string | null;
          quote_status_v2: string | null;
          sent_at: string | null;
          accepted_at: string | null;
          rejected_at: string | null;
          deck_style: string;
          presentation_source: string;
          proposal_pdf_path: string | null;
          proposal_pdf_name: string | null;
          contract_docx_path: string | null;
          contract_docx_name: string | null;
          contract_status: string;
        };
        Insert: {
          client_id?: string | null;
          contract_number?: string;
          created_at?: string;
          currency?: string;
          deliverables?: Json;
          discount?: number;
          id?: string;
          items?: Json;
          maintenance_fee_monthly?: number;
          next_steps?: string;
          payment_milestones?: Json;
          project_overview?: string;
          project_type?: string;
          public_id: string;
          status?: string;
          tech_stack?: Json;
          timeline?: string;
          title?: string;
          updated_at?: string;
          valid_until?: string | null;
          vat_rate?: number;
          warranty_months?: number;
          workspace_id: string;
          deal_id?: string | null;
          revision_number?: number;
          supersedes_quote_id?: string | null;
          quote_status_v2?: string | null;
          sent_at?: string | null;
          accepted_at?: string | null;
          rejected_at?: string | null;
          deck_style?: string;
          presentation_source?: string;
          proposal_pdf_path?: string | null;
          proposal_pdf_name?: string | null;
          contract_docx_path?: string | null;
          contract_docx_name?: string | null;
          contract_status?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotes"]["Insert"]>;
        Relationships: [];
      };
      subscription_events: {
        Row: {
          id: string;
          workspace_id: string;
          subscription_id: string | null;
          event_type: string;
          from_plan_id: string | null;
          to_plan_id: string | null;
          provider: string | null;
          external_event_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          subscription_id?: string | null;
          event_type: string;
          from_plan_id?: string | null;
          to_plan_id?: string | null;
          provider?: string | null;
          external_event_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_events"]["Insert"]>;
        Relationships: [];
      };
      subscriptions: {
        Row: {
          billing_interval: string;
          created_at: string;
          current_period_end: string;
          current_period_start: string;
          grace_days: number;
          id: string;
          plan_id: string;
          status: string;
          updated_at: string;
          workspace_id: string;
          provider: string;
          external_customer_id: string | null;
          external_subscription_id: string | null;
          external_plan_id: string | null;
          provider_status: string | null;
          cancel_at_period_end: boolean;
          trial_end: string | null;
          entitlement_version: number;
          entitlement_snapshot: Json;
          last_reconciled_at: string | null;
          reconciliation_error: string | null;
          scheduled_plan_id: string | null;
          scheduled_change_at: string | null;
          grace_ends_at: string | null;
          canceled_at: string | null;
          ended_at: string | null;
          provider_event_at: string | null;
        };
        Insert: {
          billing_interval?: string;
          created_at?: string;
          current_period_end: string;
          current_period_start?: string;
          grace_days?: number;
          id?: string;
          plan_id: string;
          status?: string;
          updated_at?: string;
          workspace_id: string;
          provider?: string;
          external_customer_id?: string | null;
          external_subscription_id?: string | null;
          external_plan_id?: string | null;
          provider_status?: string | null;
          cancel_at_period_end?: boolean;
          trial_end?: string | null;
          entitlement_version?: number;
          entitlement_snapshot?: Json;
          last_reconciled_at?: string | null;
          reconciliation_error?: string | null;
          scheduled_plan_id?: string | null;
          scheduled_change_at?: string | null;
          grace_ends_at?: string | null;
          canceled_at?: string | null;
          ended_at?: string | null;
          provider_event_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["subscriptions"]["Insert"]>;
        Relationships: [];
      };
      usage_counters: {
        Row: {
          ai_briefs: number;
          maps_people: number;
          maps_places: number;
          maps_scrapes: number;
          period: string;
          quotes_created: number;
          workspace_id: string;
        };
        Insert: {
          ai_briefs?: number;
          maps_people?: number;
          maps_places?: number;
          maps_scrapes?: number;
          period: string;
          quotes_created?: number;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["usage_counters"]["Insert"]>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          created_at: string;
          seat_priority_at: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
          seat_priority_at?: string;
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_members"]["Insert"]>;
        Relationships: [];
      };
      workspace_settings: {
        Row: {
          about: string;
          accent_color: string;
          address: string;
          bank_account_name: string;
          bank_account_number: string;
          bank_name: string;
          company_name: string;
          contract_number_prefix: string;
          currency: string;
          default_maintenance_fee: number;
          default_warranty_months: number;
          email: string;
          legal_representative: string;
          legal_representative_title: string;
          logo_path: string;
          phone: string;
          quote_validity_days: number;
          short_name: string;
          tax_code: string;
          terms: Json;
          updated_at: string;
          vat_rate: number;
          website: string;
          workspace_id: string;
        };
        Insert: {
          about?: string;
          accent_color?: string;
          address?: string;
          bank_account_name?: string;
          bank_account_number?: string;
          bank_name?: string;
          company_name?: string;
          contract_number_prefix?: string;
          currency?: string;
          default_maintenance_fee?: number;
          default_warranty_months?: number;
          email?: string;
          legal_representative?: string;
          legal_representative_title?: string;
          logo_path?: string;
          phone?: string;
          quote_validity_days?: number;
          short_name?: string;
          tax_code?: string;
          terms?: Json;
          updated_at?: string;
          vat_rate?: number;
          website?: string;
          workspace_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_settings"]["Insert"]>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          archived_at: string | null;
          created_at: string;
          id: string;
          locked: boolean;
          name: string;
          plan_id: string;
          plan_status: string;
          plan_deactivated_at: string | null;
          plan_deactivated_by: string | null;
          plan_deactivation_reason: string | null;
          plan_status_before_deactivation: string | null;
          slug: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          id?: string;
          locked?: boolean;
          name: string;
          plan_id: string;
          plan_status?: string;
          plan_deactivated_at?: string | null;
          plan_deactivated_by?: string | null;
          plan_deactivation_reason?: string | null;
          plan_status_before_deactivation?: string | null;
          slug: string;
          type: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspaces"]["Insert"]>;
        Relationships: [];
      };
      apify_connections: {
        Row: {
          id: string; owner_user_id: string; apify_user_id: string; apify_username: string; apify_email: string;
          apify_avatar_url: string | null; apify_plan_id: string | null; encrypted_access_token: string;
          encrypted_refresh_token: string | null; token_expires_at: string | null; status: string;
          auth_method: string; token_last_four: string | null; token_label: string | null;
          current_memory_gbytes: number | null; max_memory_gbytes: number | null; monthly_usage_usd: number | null;
          max_monthly_usage_usd: number | null; usage_cycle_start: string | null; usage_cycle_end: string | null;
          last_synced_at: string | null; last_error: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["apify_connections"]["Row"]> & { owner_user_id: string; apify_user_id: string; encrypted_access_token: string };
        Update: Partial<Database["public"]["Tables"]["apify_connections"]["Row"]>;
        Relationships: Rel;
      };
      workspace_apify_connections: {
        Row: { id: string; workspace_id: string; apify_connection_id: string; connected_by: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["workspace_apify_connections"]["Row"]> & { workspace_id: string; apify_connection_id: string };
        Update: Partial<Database["public"]["Tables"]["workspace_apify_connections"]["Row"]>;
        Relationships: Rel;
      };
      lead_scrape_jobs: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string | null;
          query: string;
          location: string;
          language: string;
          max_results: number;
          filters: Json;
          status: string;
          source_id: string | null;
          apify_actor_id: string;
          apify_run_id: string | null;
          apify_dataset_id: string | null;
          apify_connection_id: string | null;
          apify_account_id: string | null;
          apify_account_username: string | null;
          apify_usage_usd: number | null;
          webhook_secret: string;
          places_found: number;
          places_imported: number;
          people_found: number;
          people_imported: number;
          enrich_people: boolean;
          max_people_per_place: number;
          verify_emails: boolean;
          pdpa_confirmed: boolean;
          error_message: string | null;
          started_at: string | null;
          finished_at: string | null;
          created_at: string;
          updated_at: string;
          actor_contract_hash: string | null;
          actor_build_id: string | null;
          actor_input_hash: string | null;
          pricing_basis: Json | null;
          actor_validation_result: Json | null;
          guide_source_versions: Json | null;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_scrape_jobs"]["Row"]> & { workspace_id: string; query: string };
        Update: Partial<Database["public"]["Tables"]["lead_scrape_jobs"]["Row"]>;
        Relationships: Rel;
      };
      lead_scrape_results: {
        Row: {
          id: string;
          workspace_id: string;
          job_id: string;
          google_place_id: string | null;
          name: string;
          category: string | null;
          address: string | null;
          city: string | null;
          phone: string | null;
          website: string | null;
          email: string | null;
          rating: number | null;
          reviews_count: number | null;
          lat: number | null;
          lng: number | null;
          maps_url: string | null;
          image_url: string | null;
          raw: Json;
          match_status: string;
          matched_company_id: string | null;
          matched_lead_id: string | null;
          selected: boolean;
          imported_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_scrape_results"]["Row"]> & { workspace_id: string; job_id: string };
        Update: Partial<Database["public"]["Tables"]["lead_scrape_results"]["Row"]>;
        Relationships: Rel;
      };
      lead_scrape_people: {
        Row: {
          id: string;
          workspace_id: string;
          result_id: string;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          job_title: string | null;
          linkedin_url: string | null;
          department: string | null;
          seniority: string | null;
          email_verification: string | null;
          raw: Json;
          match_status: string;
          matched_contact_id: string | null;
          selected: boolean;
          imported_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_scrape_people"]["Row"]> & { workspace_id: string; result_id: string };
        Update: Partial<Database["public"]["Tables"]["lead_scrape_people"]["Row"]>;
        Relationships: Rel;
      };
      data_collections: {
        Row: {
          id: string; workspace_id: string; scrape_job_id: string | null; name: string; description: string;
          source_type: string; source_actor_id: string; external_dataset_id: string | null; schema_version: number;
          record_count: number; status: string; created_by: string | null; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["data_collections"]["Row"]> & { workspace_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["data_collections"]["Row"]>;
        Relationships: Rel;
      };
      data_records: {
        Row: {
          id: string; workspace_id: string; collection_id: string; scrape_result_id: string | null;
          source_item_key: string; record_type: string; title: string; canonical_url: string;
          normalized_data: Json; raw_data: Json; identity_keys: Json; content_hash: string;
          promoted_company_id: string | null; promoted_contact_id: string | null;
          captured_at: string; created_at: string; updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["data_records"]["Row"]> & {
          workspace_id: string; collection_id: string; source_item_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_records"]["Row"]>;
        Relationships: Rel;
      };
      data_assets: {
        Row: {
          id: string; workspace_id: string; collection_id: string; record_id: string | null; asset_type: string;
          file_name: string; mime_type: string; source_url: string; storage_path: string; byte_size: number;
          checksum: string; metadata: Json; created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["data_assets"]["Row"]> & { workspace_id: string; collection_id: string };
        Update: Partial<Database["public"]["Tables"]["data_assets"]["Row"]>;
        Relationships: Rel;
      };
      data_record_links: {
        Row: {
          id: string; workspace_id: string; from_record_id: string; to_record_id: string;
          relation_type: string; metadata: Json; created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["data_record_links"]["Row"]> & {
          workspace_id: string; from_record_id: string; to_record_id: string; relation_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_record_links"]["Row"]>;
        Relationships: Rel;
      };
      lead_lists: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string | null;
          source: string;
          scrape_job_id: string | null;
          owner_user_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_lists"]["Row"]> & { workspace_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["lead_lists"]["Row"]>;
        Relationships: Rel;
      };
      lead_list_members: {
        Row: {
          id: string;
          workspace_id: string;
          list_id: string;
          company_id: string;
          lead_id: string | null;
          contact_id: string | null;
          added_from: string;
          status: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lead_list_members"]["Row"]> & {
          workspace_id: string;
          list_id: string;
          company_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["lead_list_members"]["Row"]>;
        Relationships: Rel;
      };
      ai_usage_events: {
        Row: {
          id: string;
          workspace_id: string;
          actor_user_id: string | null;
          operation: string;
          source: "byok" | "platform";
          provider: string;
          model: string;
          status: "success" | "error";
          latency_ms: number;
          prompt_tokens: number | null;
          completion_tokens: number | null;
          total_tokens: number | null;
          error_message: string;
          degraded: boolean;
          request_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          actor_user_id?: string | null;
          operation: string;
          source: "byok" | "platform";
          provider: string;
          model?: string;
          status: "success" | "error";
          latency_ms?: number;
          prompt_tokens?: number | null;
          completion_tokens?: number | null;
          total_tokens?: number | null;
          error_message?: string;
          degraded?: boolean;
          request_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["ai_usage_events"]["Insert"]>;
        Relationships: [];
      };
      workspace_ai_providers: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          base_url: string;
          model: string;
          encrypted_api_key: string;
          is_default: boolean;
          status: string;
          created_by: string | null;
          last_tested_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["workspace_ai_providers"]["Row"]> & {
          workspace_id: string;
          base_url: string;
          model: string;
          encrypted_api_key: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_ai_providers"]["Row"]>;
        Relationships: Rel;
      };
      quote_engagement_events: {
        Row: {
          id: string;
          workspace_id: string;
          quote_id: string | null;
          public_quote_id: string | null;
          deal_id: string | null;
          viewer_session_id: string | null;
          event_type: string;
          section: string | null;
          occurred_at: string;
          metadata: Json;
        };
        Insert: Partial<Database["public"]["Tables"]["quote_engagement_events"]["Row"]> & {
          workspace_id: string;
          event_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["quote_engagement_events"]["Row"]>;
        Relationships: Rel;
      };
      contracts: {
        Row: {
          id: string;
          workspace_id: string;
          deal_id: string;
          quote_id: string | null;
          company_id: string | null;
          title: string;
          status: string;
          signed_at: string | null;
          notes: string;
          docx_path: string | null;
          docx_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["contracts"]["Row"]> & {
          workspace_id: string;
          deal_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["contracts"]["Row"]>;
        Relationships: Rel;
      };
      notifications: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string | null;
          title: string;
          body: string;
          kind: string;
          entity_type: string | null;
          entity_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & { workspace_id: string; title: string };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: Rel;
      };
      integration_connections: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          status: string;
          account_email: string;
          metadata: Json;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["integration_connections"]["Row"]> & {
          workspace_id: string;
          provider: string;
        };
        Update: Partial<Database["public"]["Tables"]["integration_connections"]["Row"]>;
        Relationships: Rel;
      };
      crm_connections: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          status: string;
          sync_direction: string;
          conflict_policy: string;
          sync_objects: string[];
          account_label: string;
          last_synced_at: string | null;
          last_error: string | null;
          metadata: Json;
          setup_step: string;
          sync_interval_minutes: number;
          webhook_status: string;
          last_full_sync_at: string | null;
          next_sync_at: string | null;
          access_token_secret_id: string | null;
          refresh_token_secret_id: string | null;
          token_expires_at: string | null;
          granted_scopes: string[];
          authorized_by: string | null;
          authorized_at: string | null;
          revoked_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_connections"]["Row"]> & {
          workspace_id: string;
          provider: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_connections"]["Row"]>;
        Relationships: Rel;
      };
      crm_provider_configs: {
        Row: {
          provider: string;
          enabled: boolean;
          rollout_status: string;
          notes: string;
          client_id_secret_id: string | null;
          client_secret_secret_id: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_provider_configs"]["Row"]> & {
          provider: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_provider_configs"]["Row"]>;
        Relationships: Rel;
      };
      crm_field_mappings: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string;
          object_type: string;
          leadely_field: string;
          external_field: string;
          sync_direction: string;
          transformation: string;
          required: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_field_mappings"]["Row"]> & {
          workspace_id: string;
          connection_id: string;
          object_type: string;
          leadely_field: string;
          external_field: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_field_mappings"]["Row"]>;
        Relationships: Rel;
      };
      crm_connection_audit: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string | null;
          actor_user_id: string | null;
          action: string;
          detail: Json;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_connection_audit"]["Row"]> & {
          workspace_id: string;
          action: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_connection_audit"]["Row"]>;
        Relationships: Rel;
      };
      crm_record_links: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string;
          object_type: string;
          leadely_record_id: string;
          external_record_id: string;
          leadely_updated_at: string | null;
          external_updated_at: string | null;
          last_synced_at: string | null;
          sync_status: string;
          content_hash: string | null;
          last_error: string | null;
          conflict_resolution: string | null;
          external_snapshot: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_record_links"]["Row"]> & {
          workspace_id: string;
          connection_id: string;
          object_type: string;
          leadely_record_id: string;
          external_record_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_record_links"]["Row"]>;
        Relationships: Rel;
      };
      crm_sync_runs: {
        Row: {
          id: string;
          workspace_id: string;
          connection_id: string;
          direction: string;
          status: string;
          records_read: number;
          records_created: number;
          records_updated: number;
          records_skipped: number;
          records_failed: number;
          error_summary: string | null;
          started_at: string;
          completed_at: string | null;
          sync_objects: string[];
          cursor_state: Json;
          attempt_count: number;
          next_attempt_at: string;
          requested_by: string | null;
          cancel_requested: boolean;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["crm_sync_runs"]["Row"]> & {
          workspace_id: string;
          connection_id: string;
          direction: string;
        };
        Update: Partial<Database["public"]["Tables"]["crm_sync_runs"]["Row"]>;
        Relationships: Rel;
      };
      crm_sync_record_failures: {
        Row: { id: string; workspace_id: string; connection_id: string; run_id: string | null; object_type: string; external_record_id: string; error_message: string; record_snapshot: Json; status: string; attempt_count: number; last_attempt_at: string; resolved_at: string | null; created_at: string; updated_at: string };
        Insert: Partial<Database["public"]["Tables"]["crm_sync_record_failures"]["Row"]> & { workspace_id: string; connection_id: string; object_type: string; external_record_id: string; error_message: string };
        Update: Partial<Database["public"]["Tables"]["crm_sync_record_failures"]["Row"]>;
        Relationships: Rel;
      };
      communications: {
        Row: {
          id: string;
          workspace_id: string;
          provider: string;
          direction: string;
          subject: string;
          body: string;
          from_address: string;
          to_address: string;
          company_id: string | null;
          contact_id: string | null;
          deal_id: string | null;
          lead_id: string | null;
          occurred_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["communications"]["Row"]> & { workspace_id: string };
        Update: Partial<Database["public"]["Tables"]["communications"]["Row"]>;
        Relationships: Rel;
      };
      meetings: {
        Row: {
          id: string;
          workspace_id: string;
          title: string;
          starts_at: string;
          ends_at: string | null;
          location: string;
          notes: string;
          company_id: string | null;
          contact_id: string | null;
          deal_id: string | null;
          owner_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["meetings"]["Row"]> & { workspace_id: string; title: string; starts_at: string };
        Update: Partial<Database["public"]["Tables"]["meetings"]["Row"]>;
        Relationships: Rel;
      };
      sequences: {
        Row: {
          id: string;
          workspace_id: string;
          name: string;
          description: string;
          status: string;
          owner_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sequences"]["Row"]> & { workspace_id: string; name: string };
        Update: Partial<Database["public"]["Tables"]["sequences"]["Row"]>;
        Relationships: Rel;
      };
      sequence_steps: {
        Row: {
          id: string;
          workspace_id: string;
          sequence_id: string;
          position: number;
          step_type: string;
          delay_days: number;
          subject: string;
          body: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sequence_steps"]["Row"]> & {
          workspace_id: string;
          sequence_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sequence_steps"]["Row"]>;
        Relationships: Rel;
      };
      sequence_enrollments: {
        Row: {
          id: string;
          workspace_id: string;
          sequence_id: string;
          company_id: string | null;
          contact_id: string | null;
          lead_id: string | null;
          status: string;
          current_step: number;
          next_run_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["sequence_enrollments"]["Row"]> & {
          workspace_id: string;
          sequence_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["sequence_enrollments"]["Row"]>;
        Relationships: Rel;
      };
      account_plans: {
        Row: {
          id: string;
          workspace_id: string;
          company_id: string;
          objective: string;
          strategy: string;
          risks: string;
          next_review_at: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["account_plans"]["Row"]> & {
          workspace_id: string;
          company_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_plans"]["Row"]>;
        Relationships: Rel;
      };
      platform_audit_log: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          before: Json;
          after: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          before?: Json;
          after?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_audit_log"]["Insert"]>;
        Relationships: Rel;
      };
      platform_flags: {
        Row: {
          id: number;
          signup_enabled: boolean;
          ai_enabled: boolean;
          scrape_enabled: boolean;
          share_enabled: boolean;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          id?: number;
          signup_enabled?: boolean;
          ai_enabled?: boolean;
          scrape_enabled?: boolean;
          share_enabled?: boolean;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_flags"]["Insert"]>;
        Relationships: Rel;
      };
      integration_heartbeats: {
        Row: {
          id: string;
          kind: string;
          ok: boolean;
          detail: string;
          ran_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          ok: boolean;
          detail?: string;
          ran_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integration_heartbeats"]["Insert"]>;
        Relationships: Rel;
      };
      workspace_overrides: {
        Row: {
          workspace_id: string;
          quotas: Json;
          features: Json;
          updated_at: string;
        };
        Insert: {
          workspace_id: string;
          quotas?: Json;
          features?: Json;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_overrides"]["Insert"]>;
        Relationships: Rel;
      };
      workspace_notes: {
        Row: {
          id: string;
          workspace_id: string;
          body: string;
          author_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          body: string;
          author_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_notes"]["Insert"]>;
        Relationships: Rel;
      };
      invoice_archive: {
        Row: {
          id: string;
          source_invoice_id: string;
          workspace_id: string;
          workspace_name: string;
          plan_id: string | null;
          payment_code: string;
          amount: number;
          currency: string;
          billing_interval: string;
          status: string;
          vat_requested: boolean;
          vat_tax_code: string;
          paid_at: string | null;
          payments: Json;
          invoice_created_at: string;
          archived_at: string;
        };
        Insert: {
          id?: string;
          source_invoice_id: string;
          workspace_id: string;
          workspace_name: string;
          plan_id?: string | null;
          payment_code: string;
          amount: number;
          currency: string;
          billing_interval: string;
          status: string;
          vat_requested?: boolean;
          vat_tax_code?: string;
          paid_at?: string | null;
          payments?: Json;
          invoice_created_at: string;
          archived_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["invoice_archive"]["Insert"]>;
        Relationships: Rel;
      };
      scrape_sources: {
        Row: {
          id: string;
          apify_id: string;
          slug: string;
          title: string;
          description: string;
          picture_url: string | null;
          store_url: string | null;
          categories: string[];
          pricing_model: string | null;
          pricing_info: Json | null;
          notice: string | null;
          review_rating: number | null;
          review_count: number;
          total_users: number;
          adapter_status: string;
          input_schema: Json | null;
          example_input: Json | null;
          output_schema: Json | null;
          schema_fetched_at: string | null;
          actor_build_id: string | null;
          actor_build_number: string | null;
          actor_build_tag: string | null;
          contract_hash: string | null;
          readme_markdown: string | null;
          contract_last_checked_at: string | null;
          contract_fetch_status: string;
          contract_fetch_error: string | null;
          actor_store_url: string | null;
          synced_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          apify_id: string;
          slug: string;
          title: string;
          description?: string;
          picture_url?: string | null;
          store_url?: string | null;
          categories?: string[];
          pricing_model?: string | null;
          pricing_info?: Json | null;
          notice?: string | null;
          review_rating?: number | null;
          review_count?: number;
          total_users?: number;
          adapter_status?: string;
          input_schema?: Json | null;
          example_input?: Json | null;
          output_schema?: Json | null;
          schema_fetched_at?: string | null;
          actor_build_id?: string | null;
          actor_build_number?: string | null;
          actor_build_tag?: string | null;
          contract_hash?: string | null;
          readme_markdown?: string | null;
          contract_last_checked_at?: string | null;
          contract_fetch_status?: string;
          contract_fetch_error?: string | null;
          actor_store_url?: string | null;
          synced_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scrape_sources"]["Insert"]>;
        Relationships: Rel;
      };
      actor_input_drafts: {
        Row: { id: string; workspace_id: string; user_id: string; source_id: string; contract_hash: string; input: Json; expires_at: string; created_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; source_id: string; contract_hash: string; input?: Json; expires_at?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["actor_input_drafts"]["Insert"]>;
        Relationships: Rel;
      };
      actor_generated_guides: {
        Row: { id: string; source_id: string; contract_hash: string; locale: string; prompt_version: string; provider: string; model: string; guide: Json; generated_at: string };
        Insert: { id?: string; source_id: string; contract_hash: string; locale: string; prompt_version: string; provider: string; model: string; guide: Json; generated_at?: string };
        Update: Partial<Database["public"]["Tables"]["actor_generated_guides"]["Insert"]>;
        Relationships: Rel;
      };
      actor_guidance_events: {
        Row: { id: string; workspace_id: string; user_id: string | null; source_id: string | null; event_type: string; metadata: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; user_id?: string | null; source_id?: string | null; event_type: string; metadata?: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["actor_guidance_events"]["Insert"]>;
        Relationships: Rel;
      };
      scrape_source_contract_versions: {
        Row: {
          id: string;
          source_id: string;
          actor_slug: string;
          build_id: string;
          build_number: string | null;
          build_tag: string;
          contract_hash: string;
          input_schema: Json;
          example_input: Json | null;
          readme_markdown: string | null;
          root_description: string | null;
          output_schema: Json | null;
          pricing_snapshot: Json | null;
          actor_store_url: string;
          fetched_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          actor_slug: string;
          build_id: string;
          build_number?: string | null;
          build_tag?: string;
          contract_hash: string;
          input_schema: Json;
          example_input?: Json | null;
          readme_markdown?: string | null;
          root_description?: string | null;
          output_schema?: Json | null;
          pricing_snapshot?: Json | null;
          actor_store_url: string;
          fetched_at: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scrape_source_contract_versions"]["Insert"]>;
        Relationships: Rel;
      };
      workspace_scrape_sources: {
        Row: {
          id: string;
          workspace_id: string;
          source_id: string;
          installed_by: string | null;
          installed_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          source_id: string;
          installed_by?: string | null;
          installed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workspace_scrape_sources"]["Insert"]>;
        Relationships: Rel;
      };
      workspace_agent_settings: {
        Row: { workspace_id: string; enabled: boolean; allow_platform_fallback: boolean; write_enabled: boolean; updated_by: string | null; updated_at: string };
        Insert: { workspace_id: string; enabled?: boolean; allow_platform_fallback?: boolean; write_enabled?: boolean; updated_by?: string | null; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["workspace_agent_settings"]["Insert"]>;
        Relationships: Rel;
      };
      agent_conversations: {
        Row: { id: string; workspace_id: string; user_id: string; title: string; status: string; unread: boolean; summary: string; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; title?: string; status?: string; unread?: boolean; summary?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_conversations"]["Insert"]>;
        Relationships: Rel;
      };
      agent_messages: {
        Row: { id: string; conversation_id: string; workspace_id: string; user_id: string; role: string; content: string; blocks: Json; status: string; request_id: string | null; created_at: string };
        Insert: { id?: string; conversation_id: string; workspace_id: string; user_id: string; role: string; content?: string; blocks?: Json; status?: string; request_id?: string | null; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_messages"]["Insert"]>;
        Relationships: Rel;
      };
      agent_tool_calls: {
        Row: { id: string; conversation_id: string; message_id: string | null; workspace_id: string; user_id: string; request_id: string | null; tool_name: string; arguments: Json; result: Json; status: string; latency_ms: number; record_ids: string[]; created_at: string };
        Insert: { id?: string; conversation_id: string; message_id?: string | null; workspace_id: string; user_id: string; request_id?: string | null; tool_name: string; arguments?: Json; result?: Json; status: string; latency_ms?: number; record_ids?: string[]; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_tool_calls"]["Insert"]>;
        Relationships: Rel;
      };
      agent_entity_refs: {
        Row: { id: string; conversation_id: string; workspace_id: string; user_id: string; entity_type: string; entity_id: string; label: string; created_at: string };
        Insert: { id?: string; conversation_id: string; workspace_id: string; user_id: string; entity_type: string; entity_id: string; label?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_entity_refs"]["Insert"]>;
        Relationships: Rel;
      };
      agent_attachments: {
        Row: { id: string; conversation_id: string | null; workspace_id: string; user_id: string; file_name: string; storage_path: string; mime_type: string; byte_size: number; extracted_text: string; created_at: string };
        Insert: { id?: string; conversation_id?: string | null; workspace_id: string; user_id: string; file_name: string; storage_path: string; mime_type: string; byte_size: number; extracted_text?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_attachments"]["Insert"]>;
        Relationships: Rel;
      };
      agent_approvals: {
        Row: { id: string; workspace_id: string; user_id: string; conversation_id: string | null; tool_name: string; tier: number; payload: Json; payload_hash: string; status: string; preview: Json; result: Json | null; expires_at: string; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; conversation_id?: string | null; tool_name: string; tier: number; payload: Json; payload_hash: string; status?: string; preview?: Json; result?: Json | null; expires_at: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_approvals"]["Insert"]>;
        Relationships: Rel;
      };
      agent_idempotency_keys: {
        Row: { id: string; workspace_id: string; user_id: string; tool_name: string; idempotency_key: string; result: Json; created_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; tool_name: string; idempotency_key: string; result: Json; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_idempotency_keys"]["Insert"]>;
        Relationships: Rel;
      };
      agent_jobs: {
        Row: { id: string; workspace_id: string; user_id: string; conversation_id: string | null; kind: string; status: string; file_name: string; mapping: Json; duplicate_policy: string; list_name: string; cursor_row: number; counts: Json; plan_snapshot: Json; error_message: string; created_at: string; updated_at: string };
        Insert: { id?: string; workspace_id: string; user_id: string; conversation_id?: string | null; kind: string; status?: string; file_name?: string; mapping?: Json; duplicate_policy?: string; list_name?: string; cursor_row?: number; counts?: Json; plan_snapshot?: Json; error_message?: string; created_at?: string; updated_at?: string };
        Update: Partial<Database["public"]["Tables"]["agent_jobs"]["Insert"]>;
        Relationships: Rel;
      };
      agent_import_rows: {
        Row: { id: string; job_id: string; workspace_id: string; row_number: number; raw: Json; status: string; error_message: string; record_id: string | null };
        Insert: { id?: string; job_id: string; workspace_id: string; row_number: number; raw: Json; status?: string; error_message?: string; record_id?: string | null };
        Update: Partial<Database["public"]["Tables"]["agent_import_rows"]["Insert"]>;
        Relationships: Rel;
      };
    };
    Views: Record<string, never>;
    Functions: {
      agent_fuzzy_names: {
        Args: { p_kind: string; p_query: string; p_limit: number };
        Returns: { id: string; label: string; score: number; updated_at: string }[];
      };
      replace_workspace_ai_provider: {
        Args: {
          target_workspace_id: string;
          provider_name: string;
          provider_base_url: string;
          provider_model: string;
          provider_encrypted_api_key: string;
        };
        Returns: string;
      };
      claim_mcp_alert_delivery: {
        Args: { p_fingerprint: string; p_sent_at: string; p_cooldown_minutes: number };
        Returns: boolean;
      };
      mcp_create_company: {
        Args: { p_workspace_id: string; p_connection_id: string; p_actor_user_id: string | null; p_idempotency_key: string; p_company: Json };
        Returns: Json;
      };
      mcp_create_crm_record: {
        Args: { p_workspace_id: string; p_connection_id: string; p_actor_user_id: string | null; p_tool_name: string; p_idempotency_key: string; p_payload: Json };
        Returns: Json;
      };
      mcp_mutate_crm_record: {
        Args: { p_workspace_id: string; p_connection_id: string; p_actor_user_id: string | null; p_tool_name: string; p_idempotency_key: string; p_record_id: string | null; p_payload: Json };
        Returns: Json;
      };
      mcp_create_sales_artifact: {
        Args: { p_workspace_id: string; p_connection_id: string; p_actor_user_id: string | null; p_tool_name: string; p_idempotency_key: string; p_payload: Json };
        Returns: Json;
      };
      mcp_manage_sales_workflow: {
        Args: { p_workspace_id: string; p_connection_id: string; p_actor_user_id: string | null; p_tool_name: string; p_idempotency_key: string; p_payload: Json };
        Returns: Json;
      };
      cleanup_mcp_data: { Args: Record<string, never>; Returns: Json };
      expire_mcp_action_requests: { Args: { p_workspace_id?: string | null }; Returns: number };
      claim_next_crm_sync_run: { Args: Record<string, never>; Returns: Database["public"]["Tables"]["crm_sync_runs"]["Row"][] };
      resolve_crm_sync_conflict: { Args: { p_workspace_id: string; p_issue_id: string; p_resolution: string; p_requested_by: string | null }; Returns: Json };
      retry_crm_sync_record_failure: { Args: { p_workspace_id: string; p_failure_id: string; p_requested_by: string | null }; Returns: Json };
      crm_provider_availability: {
        Args: Record<string, never>;
        Returns: { provider: string; enabled: boolean; rollout_status: string; credentials_configured: boolean }[];
      };
      set_crm_provider_credentials: {
        Args: { p_provider: string; p_client_id?: string | null; p_client_secret?: string | null };
        Returns: undefined;
      };
      get_crm_provider_credentials: {
        Args: { p_provider: string };
        Returns: { client_id: string | null; client_secret: string | null }[];
      };
      store_crm_connection_tokens: {
        Args: {
          p_connection_id: string;
          p_access_token: string;
          p_refresh_token?: string | null;
          p_expires_at?: string | null;
          p_scopes?: string[];
          p_actor_user_id?: string | null;
          p_detail?: Json;
        };
        Returns: undefined;
      };
      get_crm_connection_tokens: {
        Args: { p_connection_id: string };
        Returns: { access_token: string | null; refresh_token: string | null; token_expires_at: string | null }[];
      };
      revoke_crm_connection: {
        Args: { p_connection_id: string; p_actor_user_id: string };
        Returns: undefined;
      };
      acquire_hold: { Args: { p_subject: string; p_bucket: string; p_ttl_seconds: number }; Returns: boolean };
      admit: {
        Args: { p_subject: string; p_bucket: string; p_max_hits: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_quota: {
        Args: { p_workspace_id: string; p_field: string; p_amount: number; p_limit: number };
        Returns: boolean;
      };
      apply_sepay_invoice_payment: {
        Args: { p_invoice_id: string; p_sepay_id: string; p_channel: string; p_amount: number; p_raw: Json };
        Returns: Json;
      };
      prune_expired_scrape_results: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      workspace_seat_limit: { Args: { p_workspace_id: string }; Returns: number };
      has_workspace_seat: { Args: { p_workspace_id: string; p_user_id?: string }; Returns: boolean };
      create_workspace_invite: {
        Args: { p_email: string; p_role: string; p_token_hash: string; p_expires_at: string };
        Returns: string;
      };
      accept_workspace_invite: { Args: { p_token_hash: string }; Returns: string };
      current_member_role: { Args: Record<string, never>; Returns: string };
      current_workspace_id: { Args: Record<string, never>; Returns: string };
      data_library_type_counts: {
        Args: Record<string, never>;
        Returns: { record_type: string; record_count: number }[];
      };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      lookup_companies_for_ingest: {
        Args: { p_workspace_id: string; p_place_ids: string[]; p_domains: string[] };
        Returns: {
          id: string;
          external_place_id: string | null;
          domain: string;
          phone: string;
          name: string;
          address: string;
        }[];
      };
      lookup_contacts_for_ingest: {
        Args: { p_workspace_id: string; p_emails: string[] };
        Returns: { id: string; email: string; company_id: string | null; display_name: string }[];
      };
      match_knowledge_chunks: {
        Args: { query_embedding: string; query_text: string; match_count?: number };
        Returns: {
          id: string;
          document_id: string;
          file_name: string;
          content: string;
          metadata: Json;
          similarity: number;
          text_rank: number;
        }[];
      };
      match_mcp_knowledge_chunks: {
        Args: { p_workspace_id: string; p_connection_id: string; query_embedding: string; query_text: string; match_count?: number };
        Returns: {
          id: string;
          document_id: string;
          file_name: string;
          chunk_index: number;
          content: string;
          metadata: Json;
          similarity: number;
          text_rank: number;
        }[];
      };
      platform_role: { Args: Record<string, never>; Returns: string };
      platform_workspace_counts: { Args: { p_workspace_id: string }; Returns: Json };
      record_platform_audit: {
        Args: { p_action: string; p_entity_type: string; p_entity_id: string | null; p_before: Json; p_after: Json };
        Returns: undefined;
      };
      release_hold: { Args: { p_subject: string; p_bucket: string }; Returns: undefined };
      remove_workspace_member: { Args: { p_workspace_id: string; p_user_id: string }; Returns: undefined };
      review_mcp_quote_action: {
        Args: { p_request_id: string; p_workspace_id: string; p_reviewer_id: string; p_decision: string };
        Returns: Json;
      };
      set_workspace_member_role: {
        Args: { p_workspace_id: string; p_user_id: string; p_role: string };
        Returns: undefined;
      };
      transfer_workspace_owner: { Args: { p_workspace_id: string; p_new_owner: string }; Returns: undefined };
      seed_default_sales_pipeline: { Args: { p_workspace_id: string }; Returns: undefined };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
