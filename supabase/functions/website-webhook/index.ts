// ==============================================================================
// DEMİRTÜRK PORTFÖY CRM - RESMİ WEB SİTESİ WEBHOOK EDGE FUNCTION
// ==============================================================================
// demirturkinsaat.com veya herhangi bir web sitesinden gelen:
// - İletişim / Bize Ulaşın mesajları
// - Ücretsiz Tanıtım Turu talepleri
// - Proje bilgi / katalog formları
// anlık olarak Portföy CRM'e akar ve uygulamaya canlı sesli bildirimle düşer.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://unjfqfservizfmbgofhq.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "sb_publishable__99mhA3MbU9nnH8bn9S9nw_X7gWNlAO"

// İsteğe bağlı API Güvenlik Anahtarı (Header'da veya query'de x-api-key gelebilir)
const SECRET_WEBHOOK_KEY = "demirturk_website_secret_2026"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key, X-Requested-With",
}

// Telefon numarasını Türkiye ve uluslararası standarda getirir
function normalizePhone(rawPhone?: string | null): string {
  if (!rawPhone) return ""
  let cleaned = rawPhone.replace(/[^\d+]/g, "").trim()
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2)
  } else if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "+9" + cleaned
  } else if (!cleaned.startsWith("+") && cleaned.length === 10) {
    cleaned = "+90" + cleaned
  }
  return cleaned
}

// Bütçe metninden sayısal değeri ayıklar
function parseBudget(valueStr?: string): number | undefined {
  if (!valueStr) return undefined
  const cleaned = valueStr.replace(/[.\sTLtl]/g, "")
  const match = cleaned.match(/\d+/)
  if (match) {
    const num = parseInt(match[0], 10)
    if (!isNaN(num) && num > 10000) return num
  }
  return undefined
}

serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Health check / GET isteği
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        status: "active",
        service: "Demirtürk Portföy Website Webhook",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Form verisini hem JSON hem FormData hem de x-www-form-urlencoded olarak okuyabilir
    let payload: Record<string, any> = {}
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      payload = await req.json()
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await req.formData()
      for (const [key, value] of formData.entries()) {
        payload[key] = value.toString()
      }
    } else {
      // Düz metin veya JSON dene
      try {
        const text = await req.text()
        payload = JSON.parse(text)
      } catch {
        payload = {}
      }
    }

    console.log("[Website Webhook] Gelen form verisi:", payload)

    // Esnek Alan Eşleme (Farklı form eklentilerinin isimlerine toleranslı)
    const rawFullName = (
      payload.fullName ||
      payload.full_name ||
      payload.name ||
      payload.ad_soyad ||
      payload.adsoyad ||
      payload.your_name ||
      `${payload.first_name || payload.ad || ""} ${payload.last_name || payload.soyad || ""}`
    ).trim()

    const rawPhone = (
      payload.phone ||
      payload.phoneNumber ||
      payload.phone_number ||
      payload.tel ||
      payload.telefon ||
      payload.your_phone ||
      ""
    ).toString().trim()

    const rawEmail = (
      payload.email ||
      payload.eposta ||
      payload.e_posta ||
      payload.your_email ||
      ""
    ).trim()

    // Form Başlığı / Tipi (Örn: Ücretsiz Tanıtım Turu, Bize Ulaşın, Karasu Proje Bilgi Formu)
    const formName = (
      payload.formName ||
      payload.form_name ||
      payload.formType ||
      payload.form_type ||
      payload.subject ||
      payload.konu ||
      "Web Sitesi İletişim Formu"
    ).trim()

    const message = (
      payload.message ||
      payload.mesaj ||
      payload.notes ||
      payload.not ||
      payload.your_message ||
      ""
    ).trim()

    const preferredHousingType = (
      payload.preferredHousingType ||
      payload.preferred_housing_type ||
      payload.housing_type ||
      payload.konut_tipi ||
      payload.proje ||
      ""
    ).trim()

    const rawBudget = payload.budget || payload.butce || ""
    const detectedBudget = typeof rawBudget === "number" ? rawBudget : parseBudget(rawBudget)

    // Tarih seçimi (Tanıtım turu için tarih/saat seçilmişse)
    const preferredDate = payload.preferredDate || payload.tarih || payload.tur_tarihi || ""

    if (!rawPhone && !rawFullName) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "İsim veya telefon numarası zorunludur.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    const normalizedPhone = normalizePhone(rawPhone) || rawPhone || "+905000000000"
    const fullName = rawFullName || (rawPhone ? `Web Ziyaretçisi (${rawPhone})` : "Web Ziyaretçisi")
    const cleanPhoneDigits = normalizedPhone.replace(/[^\d]/g, "")

    // 1. Önce bu telefon numarasıyla kayıtlı mevcut müşteri var mı kontrol et
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("*")
      .limit(20)

    const matchedLead = (existingLeads || []).find((l: any) => {
      const existingClean = (l.phone || "").replace(/[^\d]/g, "")
      return (
        existingClean === cleanPhoneDigits ||
        (cleanPhoneDigits.length > 7 && existingClean.endsWith(cleanPhoneDigits.slice(-7)))
      )
    })

    const inquiryObj = {
      id: `inq-web-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      formName,
      campaignName: "Web Sitesi Başvurusu",
      source: "WEBSITE",
      channel: `Web Sitesi / ${formName}`,
      budget: detectedBudget,
      preferredHousingType: preferredHousingType || undefined,
      notes: message || (preferredDate ? `Tercih Edilen Tur Tarihi: ${preferredDate}` : undefined),
      rawPayload: payload,
      createdAt: new Date().toISOString(),
    }

    if (matchedLead) {
      // Mevcut Müşteri: Yeni form talebini müşterinin geçmişine ekle
      console.log(`[Website Webhook] Mevcut müşteri bulundu (#${matchedLead.id}). Yeni talep ekleniyor.`)

      const prevInquiries = Array.isArray(matchedLead.inquiries) ? matchedLead.inquiries : []
      const updatedInquiries = [inquiryObj, ...prevInquiries]

      const noteText = [
        `Web Sitesinden Yeni Form Dolduruldu: "${formName}"`,
        preferredHousingType ? `Konut Talebi: ${preferredHousingType}` : null,
        preferredDate ? `Tercih Edilen Tarih: ${preferredDate}` : null,
        message ? `Mesaj: "${message}"` : null,
      ]
        .filter(Boolean)
        .join(" | ")

      await supabase
        .from("leads")
        .update({
          inquiries: updatedInquiries,
          budget: detectedBudget || matchedLead.budget,
          preferred_housing_type: preferredHousingType || matchedLead.preferred_housing_type,
          updated_at: new Date().toISOString(),
        })
        .eq("id", matchedLead.id)

      // Aktivite kaydı ekle
      await supabase.from("lead_activities").insert({
        id: `act-${Date.now()}`,
        lead_id: matchedLead.id,
        type: "NOTE",
        content: noteText,
        author: "Web Sitesi",
        created_at: new Date().toISOString(),
      })

      // Talepler sayfasına (customer_requests) anlık olarak düşür
      try {
        const isTour = formName.toLowerCase().includes("tur") || formName.toLowerCase().includes("tanıtım")
        await supabase.from("customer_requests").insert({
          id: `req-web-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          customer_name: matchedLead.full_name || fullName,
          customer_phone: normalizedPhone,
          subject: `Web Sitesi: ${formName}`,
          category: isTour ? "Satış Öncesi Bilgi" : "Genel Talep",
          priority: isTour ? "Yüksek" : "Orta",
          status: "Açık",
          assigned_to_user_name: "Web Sitesi",
          notes: noteText,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
      } catch (reqErr) {
        console.warn("[Website Webhook] customer_requests eklenirken hata:", reqErr)
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Mevcut müşteri kartına yeni form talebi başarıyla eklendi.",
          leadId: matchedLead.id,
          matched: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // 2. Yeni Müşteri: Ortak Müşteri Havuzuna Canlı Ekle
    const newLeadId = `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    console.log(`[Website Webhook] Yeni Müşteri Oluşturuluyor: #${newLeadId} - ${fullName}`)

    const tags = ["Web Sitesi"]
    if (formName.toLowerCase().includes("tur") || formName.toLowerCase().includes("tanıtım")) {
      tags.push("Tanıtım Turu")
    }
    if (preferredHousingType) {
      tags.push(preferredHousingType)
    }

    const noteContent = [
      `Form: ${formName}`,
      preferredDate ? `Randevu/Tur Tarihi: ${preferredDate}` : null,
      message ? `Müşteri Notu: ${message}` : null,
    ]
      .filter(Boolean)
      .join("\n")

    const insertPayload = {
      id: newLeadId,
      full_name: fullName,
      phone: normalizedPhone,
      whatsapp_phone: normalizedPhone,
      email: rawEmail || null,
      source: "WEBSITE",
      form_name: formName,
      channel: `Web Sitesi / ${formName}`,
      stage: "NEW",
      owner: "Atanmamış",
      tags,
      budget: detectedBudget || null,
      preferred_housing_type: preferredHousingType || null,
      notes: noteContent || `Web sitesi (${formName}) üzerinden gönderildi.`,
      inquiries: [inquiryObj],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { error: insertError } = await supabase.from("leads").insert(insertPayload)

    if (insertError) {
      console.error("[Website Webhook] Supabase INSERT hatası:", insertError)
      return new Response(
        JSON.stringify({ success: false, error: insertError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      )
    }

    // İlk aktivite kaydını oluştur
    await supabase.from("lead_activities").insert({
      id: `act-${Date.now()}`,
      lead_id: newLeadId,
      type: "NOTE",
      content: `Web sitesi üzerinden form dolduruldu (${formName}).`,
      author: "Web Sitesi",
      created_at: new Date().toISOString(),
    })

    // Talepler sayfasına (customer_requests) anlık olarak düşür
    try {
      const isTour = formName.toLowerCase().includes("tur") || formName.toLowerCase().includes("tanıtım")
      await supabase.from("customer_requests").insert({
        id: `req-web-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customer_name: fullName,
        customer_phone: normalizedPhone,
        subject: `Web Sitesi: ${formName}`,
        category: isTour ? "Satış Öncesi Bilgi" : "Genel Talep",
        priority: isTour ? "Yüksek" : "Orta",
        status: "Açık",
        assigned_to_user_name: "Web Sitesi",
        notes: noteContent || message || `Web sitesi (${formName}) üzerinden gönderildi.`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
    } catch (reqErr) {
      console.warn("[Website Webhook] customer_requests eklenirken hata:", reqErr)
    }

    console.log(`[Website Webhook] Başarıyla kaydedildi: #${newLeadId}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: "Başvuru başarıyla alındı ve Portföy CRM'e iletildi.",
        leadId: newLeadId,
        matched: false,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  } catch (err: any) {
    console.error("[Website Webhook] Beklenmeyen hata:", err)
    return new Response(
      JSON.stringify({ success: false, error: err.message || "Bilinmeyen hata" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    )
  }
})
