/** Meta hata metinleri token/kişisel veri içerebilir; yalnızca güvenli teşhis gösterilir. */
export async function readMetaLeadResponse(response: Response): Promise<{ data: any[] }> {
  const body = await response.json().catch(() => null)
  if (!response.ok || body?.error) {
    const code = Number.isSafeInteger(body?.error?.code) ? body.error.code : null
    const reason = code === 190 ? 'Sayfa erişim anahtarı geçersiz veya süresi dolmuş.'
      : [10, 200, 294].includes(code) ? 'Sayfanın lead erişimi veya token izinleri eksik.'
      : 'Meta lead sorgusu başarısız oldu.'
    throw new Error(`${reason} (HTTP ${response.status}${code === null ? '' : `, Meta ${code}`}) Veri alımı tamamlanmadı.`)
  }
  if (!body || !Array.isArray(body.data)) throw new Error('Meta geçerli bir lead listesi döndürmedi; veri alımı tamamlanmadı.')
  return body
}
