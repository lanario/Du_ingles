export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15";
  };
  public: {
    Tables: {
      assignment_submissions: {
        Row: {
          assignment_id: string;
          content: string | null;
          feedback: string | null;
          file_path: string | null;
          graded_at: string | null;
          graded_by: string | null;
          id: string;
          organization_id: string;
          score: number | null;
          status: Database["public"]["Enums"]["assignment_status"];
          student_id: string;
          submitted_at: string | null;
        };
        Insert: {
          assignment_id: string;
          content?: string | null;
          feedback?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          organization_id: string;
          score?: number | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          student_id: string;
          submitted_at?: string | null;
        };
        Update: {
          assignment_id?: string;
          content?: string | null;
          feedback?: string | null;
          file_path?: string | null;
          graded_at?: string | null;
          graded_by?: string | null;
          id?: string;
          organization_id?: string;
          score?: number | null;
          status?: Database["public"]["Enums"]["assignment_status"];
          student_id?: string;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_graded_by_fkey";
            columns: ["graded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignment_submissions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      assignments: {
        Row: {
          created_at: string;
          created_by: string;
          due_at: string | null;
          group_id: string;
          id: string;
          instructions: Json | null;
          max_score: number | null;
          organization_id: string;
          session_id: string | null;
          title: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          due_at?: string | null;
          group_id: string;
          id?: string;
          instructions?: Json | null;
          max_score?: number | null;
          organization_id: string;
          session_id?: string | null;
          title: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          due_at?: string | null;
          group_id?: string;
          id?: string;
          instructions?: Json | null;
          max_score?: number | null;
          organization_id?: string;
          session_id?: string | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assignments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assignments_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          id: string;
          notes: string | null;
          organization_id: string;
          recorded_at: string;
          recorded_by: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Insert: {
          id?: string;
          notes?: string | null;
          organization_id: string;
          recorded_at?: string;
          recorded_by: string;
          session_id: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id: string;
        };
        Update: {
          id?: string;
          notes?: string | null;
          organization_id?: string;
          recorded_at?: string;
          recorded_by?: string;
          session_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"] | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: number;
          ip_address: unknown;
          metadata: Json;
          organization_id: string;
          user_agent: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: number;
          ip_address?: unknown;
          metadata?: Json;
          organization_id: string;
          user_agent?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"] | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: number;
          ip_address?: unknown;
          metadata?: Json;
          organization_id?: string;
          user_agent?: string | null;
        };
        Relationships: [];
      };
      class_sessions: {
        Row: {
          content: Json;
          created_at: string;
          duration_minutes: number;
          ended_at: string | null;
          group_id: string;
          homework: string | null;
          id: string;
          is_published: boolean;
          lesson_plan_id: string | null;
          locked_at: string | null;
          locked_by: string | null;
          organization_id: string;
          pdf_generated_at: string | null;
          pdf_path: string | null;
          scheduled_at: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["session_status"];
          teacher_id: string;
          teacher_notes: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          group_id: string;
          homework?: string | null;
          id?: string;
          is_published?: boolean;
          lesson_plan_id?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          organization_id: string;
          pdf_generated_at?: string | null;
          pdf_path?: string | null;
          scheduled_at: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          teacher_id: string;
          teacher_notes?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          duration_minutes?: number;
          ended_at?: string | null;
          group_id?: string;
          homework?: string | null;
          id?: string;
          is_published?: boolean;
          lesson_plan_id?: string | null;
          locked_at?: string | null;
          locked_by?: string | null;
          organization_id?: string;
          pdf_generated_at?: string | null;
          pdf_path?: string | null;
          scheduled_at?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          teacher_id?: string;
          teacher_notes?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_sessions_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_lesson_plan_id_fkey";
            columns: ["lesson_plan_id"];
            isOneToOne: false;
            referencedRelation: "lesson_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_locked_by_fkey";
            columns: ["locked_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "class_sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          is_muted: boolean;
          last_read_at: string | null;
          profile_id: string;
        };
        Insert: {
          conversation_id: string;
          is_muted?: boolean;
          last_read_at?: string | null;
          profile_id: string;
        };
        Update: {
          conversation_id?: string;
          is_muted?: boolean;
          last_read_at?: string | null;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_participants_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string;
          group_id: string | null;
          id: string;
          last_message_at: string | null;
          organization_id: string;
          posting_changed_at: string | null;
          posting_changed_by: string | null;
          students_can_post: boolean;
          title: string | null;
          type: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          group_id?: string | null;
          id?: string;
          last_message_at?: string | null;
          organization_id: string;
          posting_changed_at?: string | null;
          posting_changed_by?: string | null;
          students_can_post?: boolean;
          title?: string | null;
          type: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          group_id?: string | null;
          id?: string;
          last_message_at?: string | null;
          organization_id?: string;
          posting_changed_at?: string | null;
          posting_changed_by?: string | null;
          students_can_post?: boolean;
          title?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_posting_changed_by_fkey";
            columns: ["posting_changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      courses: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          name: string;
          organization_id: string;
          total_hours: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          name: string;
          organization_id: string;
          total_hours?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          level?: Database["public"]["Enums"]["cefr_level"];
          name?: string;
          organization_id?: string;
          total_hours?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "courses_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          enrolled_at: string;
          group_id: string;
          id: string;
          organization_id: string;
          status: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
        };
        Insert: {
          enrolled_at?: string;
          group_id: string;
          id?: string;
          organization_id: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id: string;
        };
        Update: {
          enrolled_at?: string;
          group_id?: string;
          id?: string;
          organization_id?: string;
          status?: Database["public"]["Enums"]["enrollment_status"];
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      finance_entries: {
        Row: {
          amount_cents: number;
          category: string;
          counterparty: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          due_on: string;
          id: string;
          kind: Database["public"]["Enums"]["finance_entry_kind"];
          notes: string | null;
          occurred_on: string;
          organization_id: string;
          paid_on: string | null;
          payment_method: Database["public"]["Enums"]["finance_payment_method"] | null;
          status: Database["public"]["Enums"]["finance_entry_status"];
          updated_at: string;
        };
        Insert: {
          amount_cents: number;
          category?: string;
          counterparty?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          due_on: string;
          id?: string;
          kind: Database["public"]["Enums"]["finance_entry_kind"];
          notes?: string | null;
          occurred_on: string;
          organization_id: string;
          paid_on?: string | null;
          payment_method?: Database["public"]["Enums"]["finance_payment_method"] | null;
          status?: Database["public"]["Enums"]["finance_entry_status"];
          updated_at?: string;
        };
        Update: {
          amount_cents?: number;
          category?: string;
          counterparty?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          due_on?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["finance_entry_kind"];
          notes?: string | null;
          occurred_on?: string;
          organization_id?: string;
          paid_on?: string | null;
          payment_method?: Database["public"]["Enums"]["finance_payment_method"] | null;
          status?: Database["public"]["Enums"]["finance_entry_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_entries_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      groups: {
        Row: {
          course_id: string | null;
          created_at: string;
          end_date: string | null;
          id: string;
          is_active: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          max_students: number;
          name: string;
          organization_id: string;
          schedule: Json;
          start_date: string | null;
          teacher_id: string;
          updated_at: string;
        };
        Insert: {
          course_id?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          max_students?: number;
          name: string;
          organization_id: string;
          schedule?: Json;
          start_date?: string | null;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string | null;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          is_active?: boolean;
          level?: Database["public"]["Enums"]["cefr_level"];
          max_students?: number;
          name?: string;
          organization_id?: string;
          schedule?: Json;
          start_date?: string | null;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "groups_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "groups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "groups_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string | null;
          name: string;
          organization_id: string;
          phone: string | null;
          source: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message?: string | null;
          name: string;
          organization_id: string;
          phone?: string | null;
          source?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string | null;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      lesson_plans: {
        Row: {
          author_id: string;
          content: Json;
          course_id: string | null;
          created_at: string;
          duration_minutes: number;
          id: string;
          is_shared: boolean;
          is_template: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          objectives: string[];
          organization_id: string;
          search_vector: unknown;
          summary: string | null;
          tags: string[];
          title: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          author_id: string;
          content?: Json;
          course_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          is_shared?: boolean;
          is_template?: boolean;
          level: Database["public"]["Enums"]["cefr_level"];
          objectives?: string[];
          organization_id: string;
          search_vector?: unknown;
          summary?: string | null;
          tags?: string[];
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          author_id?: string;
          content?: Json;
          course_id?: string | null;
          created_at?: string;
          duration_minutes?: number;
          id?: string;
          is_shared?: boolean;
          is_template?: boolean;
          level?: Database["public"]["Enums"]["cefr_level"];
          objectives?: string[];
          organization_id?: string;
          search_vector?: unknown;
          summary?: string | null;
          tags?: string[];
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lesson_plans_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_plans_course_id_fkey";
            columns: ["course_id"];
            isOneToOne: false;
            referencedRelation: "courses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lesson_plans_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          attachment_path: string | null;
          body: string;
          conversation_id: string;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          organization_id: string;
          sender_id: string;
        };
        Insert: {
          attachment_path?: string | null;
          body: string;
          conversation_id: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          organization_id: string;
          sender_id: string;
        };
        Update: {
          attachment_path?: string | null;
          body?: string;
          conversation_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          organization_id?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          link: string | null;
          organization_id: string;
          read_at: string | null;
          recipient_id: string;
          title: string;
          type: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          organization_id: string;
          read_at?: string | null;
          recipient_id: string;
          title: string;
          type: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          link?: string | null;
          organization_id?: string;
          read_at?: string | null;
          recipient_id?: string;
          title?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey";
            columns: ["recipient_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          logo_url: string | null;
          name: string;
          settings: Json;
          slug: string;
          timezone: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name: string;
          settings?: Json;
          slug: string;
          timezone?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          logo_url?: string | null;
          name?: string;
          settings?: Json;
          slug?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          birth_date: string | null;
          cpf: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_seen_at: string | null;
          must_change_password: boolean;
          organization_id: string;
          phone: string | null;
          role: Database["public"]["Enums"]["app_role"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          full_name: string;
          id: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          must_change_password?: boolean;
          organization_id: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          birth_date?: string | null;
          cpf?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          last_seen_at?: string | null;
          must_change_password?: boolean;
          organization_id?: string;
          phone?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          action: string;
          attempted_at: string;
          id: number;
          identifier: string;
        };
        Insert: {
          action: string;
          attempted_at?: string;
          id?: number;
          identifier: string;
        };
        Update: {
          action?: string;
          attempted_at?: string;
          id?: number;
          identifier?: string;
        };
        Relationships: [];
      };
      session_content_versions: {
        Row: {
          content: Json;
          created_at: string;
          created_by: string;
          id: string;
          session_id: string;
        };
        Insert: {
          content: Json;
          created_at?: string;
          created_by: string;
          id?: string;
          session_id: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          created_by?: string;
          id?: string;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_content_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_content_versions_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "class_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_connect_accounts: {
        Row: {
          application_fee_percent: number;
          business_name: string | null;
          charge_model: Database["public"]["Enums"]["stripe_charge_model"];
          charges_enabled: boolean;
          connected_at: string | null;
          country: string;
          created_at: string;
          default_currency: string;
          details_submitted: boolean;
          id: string;
          livemode: boolean;
          organization_id: string;
          payouts_enabled: boolean;
          requirements: Json;
          stripe_account_id: string;
          updated_at: string;
        };
        Insert: {
          application_fee_percent?: number;
          business_name?: string | null;
          charge_model?: Database["public"]["Enums"]["stripe_charge_model"];
          charges_enabled?: boolean;
          connected_at?: string | null;
          country?: string;
          created_at?: string;
          default_currency?: string;
          details_submitted?: boolean;
          id?: string;
          livemode?: boolean;
          organization_id: string;
          payouts_enabled?: boolean;
          requirements?: Json;
          stripe_account_id: string;
          updated_at?: string;
        };
        Update: {
          application_fee_percent?: number;
          business_name?: string | null;
          charge_model?: Database["public"]["Enums"]["stripe_charge_model"];
          charges_enabled?: boolean;
          connected_at?: string | null;
          country?: string;
          created_at?: string;
          default_currency?: string;
          details_submitted?: boolean;
          id?: string;
          livemode?: boolean;
          organization_id?: string;
          payouts_enabled?: boolean;
          requirements?: Json;
          stripe_account_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_connect_accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      student_plans: {
        Row: {
          accent: string;
          badge: string | null;
          billing_interval: Database["public"]["Enums"]["plan_interval"];
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string | null;
          features: Json;
          headline: string | null;
          id: string;
          is_active: boolean;
          is_featured: boolean;
          is_public: boolean;
          lessons_per_month: number | null;
          level: Database["public"]["Enums"]["cefr_level"] | null;
          minutes_per_lesson: number | null;
          name: string;
          organization_id: string;
          price_cents: number;
          seat_limit: number | null;
          setup_fee_cents: number;
          sort_order: number;
          stripe_payment_link_id: string | null;
          stripe_payment_link_url: string | null;
          stripe_price_id: string | null;
          stripe_product_id: string | null;
          sync_error: string | null;
          sync_status: Database["public"]["Enums"]["plan_sync_status"];
          synced_at: string | null;
          trial_days: number;
          updated_at: string;
        };
        Insert: {
          accent?: string;
          badge?: string | null;
          billing_interval?: Database["public"]["Enums"]["plan_interval"];
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          features?: Json;
          headline?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_public?: boolean;
          lessons_per_month?: number | null;
          level?: Database["public"]["Enums"]["cefr_level"] | null;
          minutes_per_lesson?: number | null;
          name: string;
          organization_id: string;
          price_cents: number;
          seat_limit?: number | null;
          setup_fee_cents?: number;
          sort_order?: number;
          stripe_payment_link_id?: string | null;
          stripe_payment_link_url?: string | null;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          sync_error?: string | null;
          sync_status?: Database["public"]["Enums"]["plan_sync_status"];
          synced_at?: string | null;
          trial_days?: number;
          updated_at?: string;
        };
        Update: {
          accent?: string;
          badge?: string | null;
          billing_interval?: Database["public"]["Enums"]["plan_interval"];
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string | null;
          features?: Json;
          headline?: string | null;
          id?: string;
          is_active?: boolean;
          is_featured?: boolean;
          is_public?: boolean;
          lessons_per_month?: number | null;
          level?: Database["public"]["Enums"]["cefr_level"] | null;
          minutes_per_lesson?: number | null;
          name?: string;
          organization_id?: string;
          price_cents?: number;
          seat_limit?: number | null;
          setup_fee_cents?: number;
          sort_order?: number;
          stripe_payment_link_id?: string | null;
          stripe_payment_link_url?: string | null;
          stripe_price_id?: string | null;
          stripe_product_id?: string | null;
          sync_error?: string | null;
          sync_status?: Database["public"]["Enums"]["plan_sync_status"];
          synced_at?: string | null;
          trial_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_plans_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      student_profiles: {
        Row: {
          current_level: Database["public"]["Enums"]["cefr_level"];
          enrollment_date: string;
          goals: string | null;
          guardian_email: string | null;
          guardian_name: string | null;
          guardian_phone: string | null;
          notes: string | null;
          organization_id: string;
          profile_id: string;
        };
        Insert: {
          current_level?: Database["public"]["Enums"]["cefr_level"];
          enrollment_date?: string;
          goals?: string | null;
          guardian_email?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          notes?: string | null;
          organization_id: string;
          profile_id: string;
        };
        Update: {
          current_level?: Database["public"]["Enums"]["cefr_level"];
          enrollment_date?: string;
          goals?: string | null;
          guardian_email?: string | null;
          guardian_name?: string | null;
          guardian_phone?: string | null;
          notes?: string | null;
          organization_id?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_subscriptions: {
        Row: {
          amount_cents: number | null;
          cancel_at_period_end: boolean;
          canceled_at: string | null;
          created_at: string;
          currency: string;
          current_period_end: string | null;
          current_period_start: string | null;
          hosted_invoice_url: string | null;
          id: string;
          organization_id: string;
          plan_id: string | null;
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id: string | null;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          student_id: string;
          trial_end: string | null;
          updated_at: string;
        };
        Insert: {
          amount_cents?: number | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          organization_id: string;
          plan_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          student_id: string;
          trial_end?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_cents?: number | null;
          cancel_at_period_end?: boolean;
          canceled_at?: string | null;
          created_at?: string;
          currency?: string;
          current_period_end?: string | null;
          current_period_start?: string | null;
          hosted_invoice_url?: string | null;
          id?: string;
          organization_id?: string;
          plan_id?: string | null;
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_checkout_session_id?: string | null;
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          student_id?: string;
          trial_end?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "student_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_subscriptions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_profiles: {
        Row: {
          bio: string | null;
          certifications: string[];
          hourly_rate: number | null;
          is_public: boolean;
          organization_id: string;
          profile_id: string;
          specialties: string[];
        };
        Insert: {
          bio?: string | null;
          certifications?: string[];
          hourly_rate?: number | null;
          is_public?: boolean;
          organization_id: string;
          profile_id: string;
          specialties?: string[];
        };
        Update: {
          bio?: string | null;
          certifications?: string[];
          hourly_rate?: number | null;
          is_public?: boolean;
          organization_id?: string;
          profile_id?: string;
          specialties?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "teacher_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_profiles_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_invites: {
        Row: {
          accepted_at: string | null;
          accepted_profile_id: string | null;
          created_at: string;
          created_by: string | null;
          expires_at: string;
          full_name: string;
          id: string;
          organization_id: string;
          phone: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["user_invite_status"];
          token_hash: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at: string;
          full_name: string;
          id?: string;
          organization_id: string;
          phone: string;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["user_invite_status"];
          token_hash: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_profile_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          expires_at?: string;
          full_name?: string;
          id?: string;
          organization_id?: string;
          phone?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["user_invite_status"];
          token_hash?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_invites_accepted_profile_id_fkey";
            columns: ["accepted_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invites_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_invites_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_org: { Args: never; Returns: string };
      auth_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      can_post_in_conversation: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      check_rate_limit: {
        Args: {
          p_action: string;
          p_identifier: string;
          p_max: number;
          p_window_seconds: number;
        };
        Returns: boolean;
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      enrolled_in_group: { Args: { p_group: string }; Returns: boolean };
      ensure_group_conversation: {
        Args: { p_group_id: string };
        Returns: string;
      };
      generate_recurring_sessions: {
        Args: { p_group_id?: string };
        Returns: number;
      };
      group_assignment_completion_rate: {
        Args: { p_group: string };
        Returns: number;
      };
      group_chat_overview: {
        Args: never;
        Returns: {
          conversation_id: string;
          group_id: string;
          group_name: string;
          is_active: boolean;
          last_message_at: string;
          last_message_body: string;
          last_message_sender: string;
          level: Database["public"]["Enums"]["cefr_level"];
          member_count: number;
          students_can_post: boolean;
          teacher_id: string;
          teacher_name: string;
          unread_count: number;
        }[];
      };
      is_admin: { Args: never; Returns: boolean };
      is_conversation_participant: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      own_profile_immutable_fields: {
        Args: never;
        Returns: {
          deleted_at: string;
          is_active: boolean;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
        }[];
      };
      profile_role: {
        Args: { p_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      revoke_user_sessions: { Args: { p_user_id: string }; Returns: undefined };
      student_attendance_rate: {
        Args: { p_group: string; p_student: string };
        Returns: number;
      };
      teaches_group: { Args: { p_group: string }; Returns: boolean };
    };
    Enums: {
      app_role: "admin" | "teacher" | "student";
      assignment_status: "pending" | "submitted" | "graded" | "late";
      attendance_status: "present" | "absent" | "late" | "excused";
      cefr_level: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
      enrollment_status: "active" | "paused" | "completed" | "cancelled";
      finance_entry_kind: "revenue" | "professional_cost" | "operating_expense";
      finance_entry_status: "pending" | "paid";
      finance_payment_method:
        "pix" | "boleto" | "credit_card" | "debit_card" | "cash" | "transfer" | "other";
      plan_interval: "month" | "quarter" | "semester" | "year" | "one_time";
      plan_sync_status: "draft" | "synced" | "error";
      session_status: "scheduled" | "in_progress" | "completed" | "cancelled";
      stripe_charge_model: "destination" | "direct";
      subscription_status:
        | "incomplete"
        | "incomplete_expired"
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "unpaid"
        | "paused";
      user_invite_status: "pending" | "accepted" | "revoked";
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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    Enums: {
      app_role: ["admin", "teacher", "student"],
      assignment_status: ["pending", "submitted", "graded", "late"],
      attendance_status: ["present", "absent", "late", "excused"],
      cefr_level: ["A1", "A2", "B1", "B2", "C1", "C2"],
      enrollment_status: ["active", "paused", "completed", "cancelled"],
      finance_entry_kind: ["revenue", "professional_cost", "operating_expense"],
      finance_entry_status: ["pending", "paid"],
      finance_payment_method: [
        "pix",
        "boleto",
        "credit_card",
        "debit_card",
        "cash",
        "transfer",
        "other",
      ],
      plan_interval: ["month", "quarter", "semester", "year", "one_time"],
      plan_sync_status: ["draft", "synced", "error"],
      session_status: ["scheduled", "in_progress", "completed", "cancelled"],
      stripe_charge_model: ["destination", "direct"],
      subscription_status: [
        "incomplete",
        "incomplete_expired",
        "trialing",
        "active",
        "past_due",
        "canceled",
        "unpaid",
        "paused",
      ],
      user_invite_status: ["pending", "accepted", "revoked"],
    },
  },
} as const;
