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
          sepay_id: string;
        };
        Insert: {
          amount: number;
          channel: string;
          created_at?: string;
          id?: string;
          invoice_id: string;
          raw?: Json;
          sepay_id: string;
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
        };
        Insert: Database["public"]["Tables"]["plans"]["Row"];
        Update: Partial<Database["public"]["Tables"]["plans"]["Row"]>;
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
          status: string;
          suspend_source: string | null;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          display_name?: string;
          email: string;
          id: string;
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
          role: string;
          user_id: string;
          workspace_id: string;
        };
        Insert: {
          created_at?: string;
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
          synced_at?: string | null;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["scrape_sources"]["Insert"]>;
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
    };
    Views: Record<string, never>;
    Functions: {
      acquire_hold: { Args: { p_subject: string; p_bucket: string; p_ttl_seconds: number }; Returns: boolean };
      admit: {
        Args: { p_subject: string; p_bucket: string; p_max_hits: number; p_window_seconds: number };
        Returns: boolean;
      };
      consume_quota: {
        Args: { p_workspace_id: string; p_field: string; p_amount: number; p_limit: number };
        Returns: boolean;
      };
      current_member_role: { Args: Record<string, never>; Returns: string };
      current_workspace_id: { Args: Record<string, never>; Returns: string };
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
      platform_role: { Args: Record<string, never>; Returns: string };
      platform_workspace_counts: { Args: { p_workspace_id: string }; Returns: Json };
      record_platform_audit: {
        Args: { p_action: string; p_entity_type: string; p_entity_id: string | null; p_before: Json; p_after: Json };
        Returns: undefined;
      };
      release_hold: { Args: { p_subject: string; p_bucket: string }; Returns: undefined };
      remove_workspace_member: { Args: { p_workspace_id: string; p_user_id: string }; Returns: undefined };
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
