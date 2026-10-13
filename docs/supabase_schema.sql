-- ==============================================================================
-- DEMİRTÜRK PORTFÖY CRM - SUPABASE VERİTABANI ŞEMASI (TAM KOD)
-- ==============================================================================
-- Bu kodun TAMAMINI seçip Supabase SQL Editörüne yapıştırın ve "RUN"a basın.
-- ==============================================================================

-- 1. KULLANICILAR & PERSONEL TABLOSU
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    company_name TEXT DEFAULT 'Demirtürk İnşaat',
    department TEXT NOT NULL,
    departments JSONB DEFAULT '[]'::jsonb,
    role TEXT NOT NULL,
    is_manager BOOLEAN DEFAULT false,
    scope TEXT DEFAULT 'ALL',
    permissions JSONB DEFAULT '{}'::jsonb,
    must_change_password BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. MÜŞTERİLER & META REKLAM FORMLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.leads (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    secondary_phone TEXT,
    whatsapp_phone TEXT,
    email TEXT,
    source TEXT DEFAULT 'WEBSITE',
    form_name TEXT DEFAULT 'Genel İletişim',
    channel TEXT DEFAULT 'Web',
    stage TEXT DEFAULT 'NEW',
    owner TEXT DEFAULT 'Atanmamış',
    tags JSONB DEFAULT '[]'::jsonb,
    budget NUMERIC,
    preferred_housing_type TEXT,
    notes TEXT,
    assigned_to_user_id TEXT,
    assigned_to_user_name TEXT,
    inquiries JSONB DEFAULT '[]'::jsonb,
    assignment_history JSONB DEFAULT '[]'::jsonb,
    stage_history JSONB DEFAULT '[]'::jsonb,
    ai_evaluation JSONB,
    is_qualified BOOLEAN DEFAULT false,
    qualified_by_user_name TEXT,
    qualified_at TIMESTAMPTZ,
    meta_answers JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Var olan veritabanları için sütun kontrolü
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS meta_answers JSONB DEFAULT '[]'::jsonb;

-- 3. MÜŞTERİ AKTİVİTELERİ & GÖRÜŞME NOTLARI
CREATE TABLE IF NOT EXISTS public.lead_activities (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. PROJELER TABLOSU
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    city TEXT,
    district TEXT,
    mevki TEXT,
    type TEXT,
    total_units INTEGER DEFAULT 0,
    delivery_date TEXT,
    starting_price NUMERIC,
    image_url TEXT,
    status TEXT DEFAULT 'SATISTA',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. DAİRELER & BAĞIMSIZ BÖLÜMLER TABLOSU
CREATE TABLE IF NOT EXISTS public.units (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    block TEXT,
    floor INTEGER DEFAULT 1,
    room_type TEXT NOT NULL,
    gross_sqm NUMERIC,
    net_sqm NUMERIC,
    price NUMERIC NOT NULL,
    status TEXT DEFAULT 'SATISTA',
    facade TEXT,
    description TEXT,
    reservation JSONB,
    sale JSONB,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. TAKİP & RANDEVULAR TABLOSU
CREATE TABLE IF NOT EXISTS public.appointments (
    id TEXT PRIMARY KEY,
    lead_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT,
    type TEXT DEFAULT 'OFFICE',
    status TEXT DEFAULT 'SCHEDULED',
    assigned_to_user_id TEXT,
    assigned_to_user_name TEXT,
    created_by_user_id TEXT,
    created_by_department TEXT,
    project_name TEXT,
    notes TEXT,
    outcome_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. MÜŞTERİ TALEPLERİ TABLOSU
CREATE TABLE IF NOT EXISTS public.customer_requests (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    subject TEXT NOT NULL,
    category TEXT,
    priority TEXT DEFAULT 'Orta',
    status TEXT DEFAULT 'Açık',
    assigned_to_user_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. KASA TAHSİLATLARI TABLOSU
CREATE TABLE IF NOT EXISTS public.collections (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    customer_id TEXT,
    project_name TEXT,
    unit_number TEXT,
    type TEXT,
    amount NUMERIC,
    due_date TEXT,
    paid_date TEXT,
    status TEXT,
    payment_method TEXT,
    receipt_no TEXT,
    notes TEXT,
    refund_reason TEXT,
    refunded_by_user_name TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. ÖDEMELER TABLOSU
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    payee TEXT,
    category TEXT,
    amount NUMERIC,
    due_date TEXT,
    paid_date TEXT,
    status TEXT,
    invoice_no TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. ONAY TALEPLERİ TABLOSU
CREATE TABLE IF NOT EXISTS public.approvals (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    project_name TEXT,
    unit_number TEXT,
    amount NUMERIC,
    reason TEXT,
    requested_by_user_id TEXT,
    requested_by_user_name TEXT,
    requested_department TEXT,
    status TEXT DEFAULT 'BEKLEMEDE',
    reviewed_by_user_id TEXT,
    reviewed_by_user_name TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. PAYLAŞILAN DOSYALAR TABLOSU
CREATE TABLE IF NOT EXISTS public.shared_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL,
    size TEXT,
    type TEXT,
    uploaded_by_user_id TEXT NOT NULL,
    uploaded_by_user_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    share_target TEXT NOT NULL,
    target_departments JSONB DEFAULT '[]'::jsonb,
    target_member_ids JSONB DEFAULT '[]'::jsonb,
    permissions JSONB DEFAULT '{"canView": true, "canEdit": false, "canReshare": true}'::jsonb,
    download_count INTEGER DEFAULT 0,
    downloads_audit JSONB DEFAULT '[]'::jsonb
);

-- ==============================================================================
-- İNDEKS TANIMLARI
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_leads_phone ON public.leads(phone);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON public.leads(stage);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON public.leads(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_units_project ON public.units(project_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON public.units(status);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);

-- ==============================================================================
-- GÜVENLİK VE ERİŞİM POLİTİKALARI (DEMO & EKİP KULLANIMI İÇİN)
-- ==============================================================================
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public all access" ON public.app_users;
CREATE POLICY "Allow public all access" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.leads;
CREATE POLICY "Allow public all access" ON public.leads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.lead_activities;
CREATE POLICY "Allow public all access" ON public.lead_activities FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.projects;
CREATE POLICY "Allow public all access" ON public.projects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.units;
CREATE POLICY "Allow public all access" ON public.units FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.appointments;
CREATE POLICY "Allow public all access" ON public.appointments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.customer_requests;
CREATE POLICY "Allow public all access" ON public.customer_requests FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.collections;
CREATE POLICY "Allow public all access" ON public.collections FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.payments;
CREATE POLICY "Allow public all access" ON public.payments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.approvals;
CREATE POLICY "Allow public all access" ON public.approvals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public all access" ON public.shared_files;
CREATE POLICY "Allow public all access" ON public.shared_files FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- REALTIME (ANLIK SENKRONİZASYON) YAYINI
-- ==============================================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE 
      public.leads, 
      public.lead_activities, 
      public.projects, 
      public.units, 
      public.appointments, 
      public.customer_requests, 
      public.app_users, 
      public.collections, 
      public.payments, 
      public.approvals,
      public.shared_files;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

