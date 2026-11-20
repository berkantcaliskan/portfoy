import { userStore } from '@/services/userStore'
import { dateInputValue } from '@/utils/promissoryNotes'

export type ContractFormat = 'template-v1' | 'docx' | 'pdf' | 'legacy'
export interface ContractSummary {
  id: string; number: string; name: string; title: string; status: string
  lead_id: string | null; visitor_id?: string; format: ContractFormat; revision: number; updated_at?: string
}
export interface Contract extends ContractSummary {
  fields: Record<string,string>; advisor_id: string | null; file: string | null
}
export interface Customer { id: string; name: string; phone: string; advisor?: string }
export const sections = [
  ['Taraflar', [['date','Sözleşme tarihi','date'],['buyer','Alıcının adı soyadı'],['identity','T.C. kimlik no'],['phone','Telefon','tel'],['address','Adres','long'],['seller','Satıcı / firma'],['sellerSigner','Satıcı yetkilisi'],['advisor','Satış danışmanı']]],
  ['Taşınmaz', [['project','Proje adı'],['city','İl'],['district','İlçe'],['block','Ada'],['parcel','Parsel'],['entry','Blok / giriş'],['floor','Kat'],['unit','Bağımsız bölüm / daire no'],['unitType','Daire tipi']]],
  ['Bedel ve teslim', [['price','Satış fiyatı (TL)'],['delivery','Teslim tarihi','date'],['terms','Açıklama ve ödeme koşulları','long']]],
] as const
export const statuses: Record<string,string> = { DRAFT:'Taslak', READY:'Hazır', SIGNED:'İmzalandı' }
export function draft(customer?: Customer, visitorId?:string): Contract {
  return {id:crypto.randomUUID(),number:'',revision:0,title:'Gayrimenkul Satış Vaadi Sözleşmesi',name:customer?.name || '',
    lead_id:visitorId ? null : customer?.id || null, advisor_id:null,status:'DRAFT',file:null,format:'template-v1',
    fields:{date:dateInputValue(new Date()),buyer:customer?.name || '',phone:customer?.phone || '',city:'Sakarya',district:'Karasu',
      seller:'DEMİRTÜRK YAPI İNŞAAT SANAYİ VE TİCARET LİMİTED ŞİRKETİ (PAŞA DEMİRTÜRK)',sellerSigner:'Paşa Demirtürk',
      ...(visitorId?{visitorId}:{})}}
}
async function rpc(name:string,args:Record<string,unknown>) {
  const client=userStore.getServerClient(), actor=userStore.getCurrentUser()?.id
  if(!actor || !client) throw Error('Sözleşmeler için oturum açın.')
  const res=await client.rpc(name,args).abortSignal(AbortSignal.timeout(60000))
  if(userStore.getCurrentUser()?.id!==actor) throw Error('Oturum değişti.')
  if(res.error) {
    const msg=res.error.message
    if(msg.includes('contract_conflict') || res.error.code==='23505') throw Error('Kayıt değişmiş veya bu müşteriye bir sözleşme eklenmiş. Listeyi yenileyin.')
    if(msg.includes('forbidden') || res.error.code==='42501') throw Error('Bu müşteri veya sözleşme için yetkiniz bulunmuyor.')
    if(msg.includes('contract_invalid')) throw Error('Sözleşme alanlarını ve dosyayı kontrol edin.')
    throw Error('Sunucu işlemi tamamlanamadı. Aynı işlemi tekrar deneyebilirsiniz.')
  }
  return res.data
}
export async function listContracts(leadId?:string):Promise<ContractSummary[]> {
  const rows:ContractSummary[]=[]
  for(;;) {
    const page=await rpc('crm_contract_list',{p_lead:leadId || null,p_after:rows.at(-1)?.id || null})
    if(!Array.isArray(page))throw Error('Sözleşme listesi okunamadı.')
    if(page.length && rows.length && page[0].id<=rows.at(-1)!.id)throw Error('Sözleşme listesi yenilenemedi.')
    rows.push(...page); if(page.length<100)return rows
  }
}
export const customers=(query:string):Promise<Customer[]>=>rpc('crm_contract_customers',{p_query:query})
export const openContract=(id:string):Promise<Contract>=>rpc('crm_contract_open',{p_id:id})
export async function writeContract(doc:Contract,request:string,file:string|null,remove=false) {
  const {format,status,fields,lead_id,advisor_id,name,title}=doc
  const row=await rpc('crm_contract_write',{p_request:request,p_id:doc.id,p_revision:doc.revision,p_doc:{format,status,fields,lead_id,advisor_id,name,title},p_file:file,p_delete:remove})
  if(row?.id!==doc.id || row.revision!==doc.revision+1)throw Error('Sunucu kaydı doğrulanamadı. Tekrar deneyin.')
}
export function decodeFile(base64:string):Uint8Array<ArrayBuffer> {return Uint8Array.from(atob(base64),c=>c.charCodeAt(0))}
export function encodeFile(bytes:Uint8Array) {
  let raw=''
  for(let pos=0;pos<bytes.length;pos+=16384)raw+=String.fromCharCode(...bytes.subarray(pos,pos+16384))
  return btoa(raw)
}
