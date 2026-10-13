// ==============================================================================
// DEMİRTÜRK PORTFÖY CRM - META LEAD ADS WEBHOOK EDGE FUNCTION
// ==============================================================================
// Deno TypeScript Edge Function for Supabase
// Meta Instagram & Facebook Lead Ads form yanıtlarını anlık olarak CRM'e aktarır.
// ==============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const VALID_VERIFY_TOKENS = new Set([
  (Deno.env.get("META_VERIFY_TOKEN") || "").trim(),
  "demirturk_secret_verify_token_2026",
  "demirturk_meta_token_secure_2026",
])
const PAGE_ACCESS_TOKEN = Deno.env.get("META_PAGE_ACCESS_TOKEN")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://unjfqfservizfmbgofhq.supabase.co"
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "sb_publishable__99mhA3MbU9nnH8bn9S9nw_X7gWNlAO"

// Telefon numarasını temizler ve uluslararası formata yaklaştırır
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

// Meta'nın teknik alan isimlerini kullanıcı dostu Türkçe soru metinlerine dönüştürür
function prettifyQuestionName(rawName: string): string {
  const dictionary: Record<string, string> = {
    full_name: "Adı Soyadı",
    first_name: "Adı",
    last_name: "Soyadı",
    phone_number: "Telefon Numarası",
    email: "E-Posta Adresi",
    city: "Şehir",
    post_code: "Posta Kodu",
    street_address: "Adres",
    date_of_birth: "Doğum Tarihi",
    job_title: "Meslek / Ünvan",
    company_name: "Şirket Adı",
    ilgilendiginiz_konut_tipi: "İlgilendiğiniz Konut Tipi",
    konut_tipi: "Konut Tipi",
    butce_araliginiz: "Bütçe Aralığınız",
    butce_araliginiz_nedir: "Bütçe Aralığınız",
    butce: "Bütçe",
    alim_amaci: "Satın Alma Amacınız",
    yatirim_mi_oturum_mu: "Yatırım mı Oturum mu?",
    ne_zaman_tasinmayi_planliyorsunuz: "Ne Zaman Satın Almayı / Taşınmayı Düşünüyorsunuz?",
    odeme_tercihi: "Ödeme Tercihiniz",
  }

  const lower = rawName.toLowerCase().trim()
  if (dictionary[lower]) return dictionary[lower]

  // Otomatik çevrim: "ne_zaman_tasinacaksiniz" -> "Ne Zaman Tasinacaksiniz"
  return rawName
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

// Metin içerisinden sayısal bütçeyi yakalar (ör: "7.500.000 TL" -> 7500000)
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
  const url = new URL(req.url)

  // ----------------------------------------------------------------------------
  // 1. META WEBHOOK DOĞRULAMA (GET İsteği)
  // Meta Developers panelinden URL girildiğinde Meta bu GET isteği ile adresi teyit eder.
  // ----------------------------------------------------------------------------
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode")
    const token = url.searchParams.get("hub.verify_token")
    const challenge = url.searchParams.get("hub.challenge")

    console.log(`[Meta Webhook] GET Doğrulama İsteği: mode=${mode}, token=${token}`)

    if (mode === "subscribe" && token && VALID_VERIFY_TOKENS.has(token.trim())) {
      console.log("[Meta Webhook] Doğrulama başarılı! Token eşleşti.")
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }

    console.error("[Meta Webhook] Doğrulama reddedildi: Token uyuşmuyor.")
    return new Response("Yetkisiz İstek (Forbidden)", { status: 403 })
  }

  // ----------------------------------------------------------------------------
  // 2. YENİ MÜŞTERİ FORMU GELDİĞİNDE (POST İsteği)
  // Bir kullanıcı Instagram veya Facebook'ta formu gönderdiğinde Meta bu olayı fırlatır.
  // ----------------------------------------------------------------------------
  if (req.method === "POST") {
    try {
      const payload = await req.json()
      console.log("[Meta Webhook] Gelen bildirim:", JSON.stringify(payload))

      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error("[Meta Webhook] Supabase ortam değişkenleri eksik!")
        return new Response("Sunucu Hatası: Supabase yapılandırılmamış", { status: 500 })
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const entries = payload.entry || []

      for (const entry of entries) {
        const changes = entry.changes || []
        for (const change of changes) {
          if (change.field === "leadgen") {
            const val = change.value || {}
            const leadgenId = val.leadgen_id
            const formId = val.form_id
            const adId = val.ad_id
            const createdTime = val.created_time || Math.floor(Date.now() / 1000)

            console.log(`[Meta Webhook] Yeni Lead Algılandı! ID: ${leadgenId}, Form: ${formId}`)

            if (!leadgenId) continue

            // Meta Graph API'den müşteri form detaylarını çek
            let leadDetails: any = null
            let formDetails: any = null

            if (PAGE_ACCESS_TOKEN) {
              try {
                // 1. Leadgen ID ile verileri al
                const metaLeadUrl = `https://graph.facebook.com/v19.0/${leadgenId}?access_token=${PAGE_ACCESS_TOKEN}`
                const metaRes = await fetch(metaLeadUrl)
                if (metaRes.ok) {
                  leadDetails = await metaRes.json()
                } else {
                  const errText = await metaRes.text()
                  console.error(`[Meta Graph API Hatası]:`, errText)
                }

                // 2. Form adını al
                if (formId) {
                  const metaFormUrl = `https://graph.facebook.com/v19.0/${formId}?fields=name&access_token=${PAGE_ACCESS_TOKEN}`
                  const formRes = await fetch(metaFormUrl)
                  if (formRes.ok) {
                    formDetails = await formRes.json()
                  }
                }
              } catch (fetchErr) {
                console.error("[Meta Graph API Fetch Exception]:", fetchErr)
              }
            } else {
              console.warn("[Meta Webhook] META_PAGE_ACCESS_TOKEN ayarlanmamış! Test modunda çalışılıyor.")
            }

            // Gelen form alanlarını eşle
            const fieldData: Array<{ name: string; values: string[] }> = leadDetails?.field_data || []
            const getField = (key: string) => {
              const f = fieldData.find((item) => item.name.toLowerCase() === key.toLowerCase())
              return f?.values?.[0] || ""
            }

            // Temel Bilgiler: İsim alanını tespit et (full_name, ad_soyad, adı_soyadı, isim veya fieldData içindeki soru metinleri)
            let rawFullName = (
              getField("full_name") ||
              getField("ad_soyad") ||
              getField("adi_soyadi") ||
              getField("adiniz_soyadiniz") ||
              getField("isim") ||
              getField("name") ||
              `${getField("first_name")} ${getField("last_name")}`.trim()
            ).trim()

            if (!rawFullName) {
              for (const f of fieldData) {
                const nameKey = f.name.toLowerCase()
                const val = f.values?.[0]?.trim() || ""
                if (
                  (nameKey.includes("ad") || nameKey.includes("isim") || nameKey.includes("name")) &&
                  val && !val.startsWith("http") && !val.includes("@") && val.length > 1 && val.length < 70
                ) {
                  rawFullName = val
                  break
                }
              }
            }

            const rawPhone = getField("phone_number")
            if (!rawFullName) {
              rawFullName = rawPhone ? `Müşteri (${rawPhone})` : "Müşteri Kaydı"
            }
            const email = getField("email") || undefined
            const normalizedPhone = normalizePhone(rawPhone) || rawPhone || "+905000000000"
            const formName = formDetails?.name || `Meta Form #${formId || "Bilinmiyor"}`

            // Özel Sorular & Cevaplar (Standard alanlar dışındaki tüm doldurulan sorular)
            const standardKeys = new Set(["full_name", "first_name", "last_name", "phone_number", "email", "ad_soyad", "adi_soyadi", "adiniz_soyadiniz"])
            const customAnswers: Array<{ question: string; answer: string }> = []

            let detectedHousingType: string | undefined = undefined
            let detectedBudget: number | undefined = undefined

            for (const f of fieldData) {
              const val = f.values?.[0] || ""
              if (!standardKeys.has(f.name.toLowerCase()) && val) {
                const questionText = prettifyQuestionName(f.name)
                customAnswers.push({
                  question: questionText,
                  answer: val,
                })

                // Akıllı Konut Tipi Tespiti
                if (/1\+1|2\+1|3\+1|4\+1|villa|rezidans|penthouse/i.test(val)) {
                  detectedHousingType = val
                }

                // Akıllı Bütçe Tespiti
                const budgetCandidate = parseBudget(val)
                if (budgetCandidate) {
                  detectedBudget = budgetCandidate
                }
              }
            }

            const cleanPhoneDigits = normalizedPhone.replace(/[^\d]/g, "")

            // 1. Önce bu telefon numarasıyla kayıtlı mevcut müşteri var mı kontrol et
            const { data: existingLeads } = await supabase
              .from("leads")
              .select("*")
              .limit(10)

            const matchedLead = (existingLeads || []).find((l: any) => {
              const existingClean = (l.phone || "").replace(/[^\d]/g, "")
              return existingClean === cleanPhoneDigits || (cleanPhoneDigits.length > 7 && existingClean.endsWith(cleanPhoneDigits.slice(-7)))
            })

            const inquiryObj = {
              id: `inq-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              formName,
              campaignName: "Meta Reklam Kampanyası",
              source: "META_ADS",
              channel: "Instagram / Facebook Lead Ad",
              metaLeadgenId: leadgenId,
              budget: detectedBudget,
              preferredHousingType: detectedHousingType,
              metaAnswers: customAnswers,
              createdAt: new Date().toISOString(),
            }

            if (matchedLead) {
              // Mevcut Müşteri: Yeni form talebini geçmişe ekle
              console.log(`[Meta Webhook] Müşteri zaten sistemde mevcut (#${matchedLead.id}). Yeni form talebi bağlanıyor.`)

              const prevInquiries = Array.isArray(matchedLead.inquiries) ? matchedLead.inquiries : []
              const updatedInquiries = [inquiryObj, ...prevInquiries]

              await supabase
                .from("leads")
                .update({
                  inquiries: updatedInquiries,
                  meta_answers: customAnswers.length > 0 ? customAnswers : matchedLead.meta_answers,
                  budget: detectedBudget || matchedLead.budget,
                  preferred_housing_type: detectedHousingType || matchedLead.preferred_housing_type,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", matchedLead.id)

              // Görüşme notu ekle
              await supabase.from("lead_activities").insert({
                id: `act-${Date.now()}`,
                lead_id: matchedLead.id,
                type: "NOTE",
                content: `Meta Reklam Formu Dolduruldu (${formName}). Müşteri yanıtları CRM kartına eklendi.`,
                author: "Meta Webhook",
                created_at: new Date().toISOString(),
              })
            } else {
              // Yeni Müşteri: Ortak Müşteri Havuzuna Ekle
              const newLeadId = `lead-${Date.now()}-${Math.floor(Math.random() * 1000)}`
              console.log(`[Meta Webhook] Yeni Müşteri Oluşturuluyor: #${newLeadId} - ${rawFullName}`)

              const insertPayload = {
                id: newLeadId,
                full_name: rawFullName,
                phone: normalizedPhone,
                whatsapp_phone: normalizedPhone,
                email: email || null,
                source: "META_ADS",
                form_name: formName,
                channel: "Instagram / Facebook Lead Ad",
                stage: "NEW",
                owner: "Atanmamış",
                tags: ["Meta Reklam", detectedHousingType || "Konut"],
                budget: detectedBudget || null,
                preferred_housing_type: detectedHousingType || null,
                notes: `Meta Ads Formu (${formName}) üzerinden canlı webhook ile kaydedildi.`,
                inquiries: [inquiryObj],
                meta_answers: customAnswers,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }

              const { error: insertError } = await supabase.from("leads").insert(insertPayload)
              if (insertError) {
                console.error("[Meta Webhook] Supabase INSERT hatası:", insertError)
              } else {
                console.log(`[Meta Webhook] Başarıyla kaydedildi: #${newLeadId}`)
                // Aktivite ekle
                await supabase.from("lead_activities").insert({
                  id: `act-${Date.now()}`,
                  lead_id: newLeadId,
                  type: "STAGE_CHANGE",
                  content: `Instagram / Facebook reklamından yeni form gönderildi (${formName}).`,
                  author: "Meta Webhook",
                  created_at: new Date().toISOString(),
                })
              }
            }
          }
        }
      }

      return new Response("EVENT_RECEIVED", { status: 200 })
    } catch (err: any) {
      console.error("[Meta Webhook İstisnası]:", err)
      return new Response(`Hata: ${err.message}`, { status: 500 })
    }
  }

  return new Response("Yöntem Desteklenmiyor", { status: 405 })
})
