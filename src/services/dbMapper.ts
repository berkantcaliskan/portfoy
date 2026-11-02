import { Lead, LeadActivity } from '@/types/lead'
import { SharedProject, FlatUnit } from './projectStore'
import { Appointment } from './appointmentStore'
import { CustomerRequest } from './requestStore'
import { AppUser } from './userStore'
import { CollectionRecord, PaymentRecord } from './accountingStore'
import { ApprovalRequest } from './approvalStore'
import { SharedFile } from './sharedFileStore'

// --- LEADS ---
export function leadToRow(l: Lead) {
  return {
    id: l.id,
    full_name: l.fullName,
    phone: l.phone,
    secondary_phone: l.secondaryPhone || null,
    whatsapp_phone: l.whatsappPhone || null,
    email: l.email || null,
    source: l.source,
    form_name: l.formName,
    channel: l.channel,
    stage: l.stage,
    owner: l.owner,
    tags: l.tags || [],
    budget: l.budget ?? null,
    preferred_housing_type: l.preferredHousingType || null,
    notes: l.notes || null,
    assigned_to_user_id: l.assignedToUserId || null,
    assigned_to_user_name: l.assignedToUserName || null,
    inquiries: l.inquiries || [],
    assignment_history: l.assignmentHistory || [],
    stage_history: l.stageHistory || [],
    ai_evaluation: l.aiEvaluation || null,
    is_qualified: Boolean(l.isQualified),
    qualified_by_user_name: l.qualifiedByUserName || null,
    qualified_at: l.qualifiedAt || null,
    meta_answers: l.metaAnswers || [],
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  }
}

function resolveLeadFullName(r: any): string {
  const current = (r.full_name || '').trim()
  const isGeneric =
    !current ||
    current.toLowerCase().includes('meta') ||
    current.toLowerCase().includes('ilgilenen') ||
    current.toLowerCase().includes('bilinmeyen') ||
    current === 'Aday'

  if (!isGeneric) {
    return current
  }

  // Look in meta_answers and inquiries
  const answers = Array.isArray(r.meta_answers) ? r.meta_answers : []
  const inqAnswers = Array.isArray(r.inquiries) && r.inquiries[0]?.metaAnswers ? r.inquiries[0].metaAnswers : []
  const allAnswers = [...answers, ...inqAnswers]

  for (const item of allAnswers) {
    if (!item || !item.question || !item.answer) continue
    const q = String(item.question).toLowerCase().trim()
    const a = String(item.answer).trim()
    if (!a) continue
    if (
      q.includes('adı soyadı') ||
      q.includes('adınız soyadınız') ||
      q.includes('ad soyad') ||
      q.includes('adı') ||
      q.includes('isim') ||
      q.includes('name')
    ) {
      if (!a.startsWith('http') && !a.includes('@') && a.length > 1 && a.length < 70) {
        return a
      }
    }
  }

  if (r.phone) {
    return `Müşteri (${r.phone})`
  }

  return current || 'Müşteri Kaydı'
}

export function rowToLead(r: any): Lead {
  const assignmentHistory = Array.isArray(r.assignment_history) ? r.assignment_history : []
  const latestSalesHandover = assignmentHistory.find(
    (h: any) => h && typeof h.isSalesHandover === 'boolean'
  )
  const isHandedOver =
    typeof r.handed_over_to_sales === 'boolean'
      ? r.handed_over_to_sales
      : Boolean(latestSalesHandover?.isSalesHandover === true)

  return {
    id: r.id,
    fullName: resolveLeadFullName(r),
    phone: r.phone,
    secondaryPhone: r.secondary_phone || undefined,
    whatsappPhone: r.whatsapp_phone || undefined,
    email: r.email || undefined,
    source: r.source || 'WEBSITE',
    formName: r.form_name || 'Genel İletişim',
    channel: r.channel || 'Web',
    stage: r.stage || 'NEW',
    owner: r.owner || 'Atanmamış',
    tags: Array.isArray(r.tags) ? r.tags : [],
    budget: r.budget ? Number(r.budget) : undefined,
    preferredHousingType: r.preferred_housing_type || undefined,
    notes: r.notes || undefined,
    assignedToUserId: r.assigned_to_user_id || undefined,
    assignedToUserName: r.assigned_to_user_name || undefined,
    inquiries: Array.isArray(r.inquiries) ? r.inquiries : [],
    assignmentHistory: Array.isArray(r.assignment_history) ? r.assignment_history : [],
    stageHistory: Array.isArray(r.stage_history) ? r.stage_history : [],
    aiEvaluation: r.ai_evaluation || undefined,
    isQualified: Boolean(r.is_qualified),
    qualifiedByUserName: r.qualified_by_user_name || undefined,
    qualifiedAt: r.qualified_at || undefined,
    metaAnswers: Array.isArray(r.meta_answers) && r.meta_answers.length > 0
      ? r.meta_answers
      : (Array.isArray(r.inquiries) && r.inquiries[0]?.metaAnswers)
        ? r.inquiries[0].metaAnswers
        : (Array.isArray(r.inquiries) && r.inquiries[0]?.formAnswers)
          ? r.inquiries[0].formAnswers
          : undefined,
    handedOverToSales: isHandedOver,
    handedOverToSalesAt: isHandedOver ? latestSalesHandover?.assignedAt : undefined,
    handedOverToSalesByUserId: isHandedOver ? latestSalesHandover?.assignedByUserId : undefined,
    handedOverToSalesByUserName: isHandedOver ? latestSalesHandover?.assignedByUserName : undefined,
    handedOverToSalesByDepartment: isHandedOver ? latestSalesHandover?.assignedByDepartment : undefined,
    salesRepUserId: isHandedOver && latestSalesHandover?.assignedToUserId !== 'ALL_SALES' ? latestSalesHandover?.assignedToUserId : undefined,
    salesRepUserName: isHandedOver && latestSalesHandover?.assignedToUserId !== 'ALL_SALES' ? latestSalesHandover?.assignedToUserName : undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// --- ACTIVITIES ---
export function activityToRow(a: LeadActivity) {
  return {
    id: a.id,
    lead_id: a.leadId,
    type: a.type,
    content: a.content,
    author: a.author,
    created_at: a.createdAt,
  }
}

export function rowToActivity(r: any): LeadActivity {
  return {
    id: r.id,
    leadId: r.lead_id,
    type: r.type,
    content: r.content,
    author: r.author,
    createdAt: r.created_at,
  }
}

// --- PROJECTS ---
const PROJECT_META_MARKER = '\n<!--KROKI_META:'
const PROJECT_META_END = '-->'

function encodeProjectDescriptionWithMeta(p: SharedProject): string | null {
  const cleanDesc = (p.description || '').split(PROJECT_META_MARKER)[0]
  const meta = {
    maxFloors: p.maxFloors,
    unitsPerFloor: p.unitsPerFloor,
    blockCount: p.blockCount,
    defaultRoomType: p.defaultRoomType,
    layoutTemplate: p.layoutTemplate,
    customAreas: p.customAreas,
    customFacades: p.customFacades,
    footerInfo: p.footerInfo,
    parcelInfo: p.parcelInfo,
    krokiCustomized: p.krokiCustomized,
    sourceDocumentName: p.sourceDocumentName,
    sourceDocumentSummary: p.sourceDocumentSummary,
    blueprintUrl:
      p.blueprintUrl && p.blueprintUrl.length < 120000 ? p.blueprintUrl : undefined,
  }
  try {
    return `${cleanDesc}${PROJECT_META_MARKER}${JSON.stringify(meta)}${PROJECT_META_END}`
  } catch {
    return cleanDesc || null
  }
}

function decodeProjectDescriptionAndMeta(rawDesc: any): {
  description?: string
  meta: Partial<SharedProject>
} {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return { description: undefined, meta: {} }
  }
  const idx = rawDesc.indexOf(PROJECT_META_MARKER)
  if (idx === -1) {
    return { description: rawDesc || undefined, meta: {} }
  }
  const cleanDesc = rawDesc.slice(0, idx).trim() || undefined
  const jsonPart = rawDesc
    .slice(idx + PROJECT_META_MARKER.length)
    .replace(/-->\s*$/, '')
  try {
    const parsed = JSON.parse(jsonPart)
    return { description: cleanDesc, meta: parsed && typeof parsed === 'object' ? parsed : {} }
  } catch {
    return { description: cleanDesc, meta: {} }
  }
}

export function projectToRow(p: SharedProject) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    location: p.location || '',
    city: p.city || '',
    district: p.district || null,
    mevki: p.mevki || null,
    type: p.type || '',
    total_units: p.totalUnits || 0,
    delivery_date: p.deliveryDate || '',
    starting_price: p.startingPrice ?? null,
    image_url: p.imageUrl || '',
    status: p.status || 'SATISTA',
    description: encodeProjectDescriptionWithMeta(p),
  }
}

export function rowToProject(r: any, units: FlatUnit[] = []): SharedProject {
  const { description, meta } = decodeProjectDescriptionAndMeta(r.description)
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    location: r.location || '',
    city: r.city || '',
    district: r.district || undefined,
    mevki: r.mevki || undefined,
    type: r.type || '',
    totalUnits: r.total_units || 0,
    deliveryDate: r.delivery_date || '',
    startingPrice: r.starting_price ? Number(r.starting_price) : undefined,
    imageUrl: r.image_url || '',
    status: r.status || 'SATISTA',
    description,
    maxFloors: meta.maxFloors,
    unitsPerFloor: meta.unitsPerFloor,
    blockCount: meta.blockCount,
    defaultRoomType: meta.defaultRoomType,
    layoutTemplate: meta.layoutTemplate,
    customAreas: meta.customAreas,
    customFacades: meta.customFacades,
    footerInfo: meta.footerInfo,
    parcelInfo: meta.parcelInfo,
    krokiCustomized: meta.krokiCustomized,
    sourceDocumentName: meta.sourceDocumentName,
    sourceDocumentSummary: meta.sourceDocumentSummary,
    blueprintUrl: meta.blueprintUrl,
    units,
  }
}

// --- UNITS ---
const UNIT_META_MARKER = '\n<!--UNIT_META:'
const UNIT_META_END = '-->'

function encodeUnitDescriptionWithMeta(u: FlatUnit): string | null {
  const cleanDesc = (u.description || '').split(UNIT_META_MARKER)[0]
  const meta = {
    planBox: u.planBox,
    sizePreset: u.sizePreset,
    entrance: u.entrance,
    statusLabel: u.statusLabel,
  }
  try {
    return `${cleanDesc}${UNIT_META_MARKER}${JSON.stringify(meta)}${UNIT_META_END}`
  } catch {
    return cleanDesc || null
  }
}

function decodeUnitDescriptionAndMeta(rawDesc: any): {
  description?: string
  meta: Partial<FlatUnit>
} {
  if (!rawDesc || typeof rawDesc !== 'string') {
    return { description: undefined, meta: {} }
  }
  const idx = rawDesc.indexOf(UNIT_META_MARKER)
  if (idx === -1) {
    return { description: rawDesc || undefined, meta: {} }
  }
  const cleanDesc = rawDesc.slice(0, idx).trim() || undefined
  const jsonPart = rawDesc
    .slice(idx + UNIT_META_MARKER.length)
    .replace(/-->\s*$/, '')
  try {
    const parsed = JSON.parse(jsonPart)
    return { description: cleanDesc, meta: parsed && typeof parsed === 'object' ? parsed : {} }
  } catch {
    return { description: cleanDesc, meta: {} }
  }
}

export function unitToRow(u: FlatUnit) {
  return {
    id: u.id,
    project_id: u.projectId,
    unit_number: u.unitNumber,
    block: u.block || null,
    floor: u.floor,
    room_type: u.roomType,
    gross_sqm: u.grossSqm,
    net_sqm: u.netSqm,
    price: u.price,
    status: u.status,
    facade: u.facade || null,
    description: encodeUnitDescriptionWithMeta(u),
    reservation: u.reservation || null,
    sale: u.sale || null,
    history: u.history || [],
  }
}

export function rowToUnit(r: any): FlatUnit {
  const { description, meta } = decodeUnitDescriptionAndMeta(r.description)
  return {
    id: r.id,
    projectId: r.project_id,
    unitNumber: r.unit_number,
    block: r.block || undefined,
    entrance: meta.entrance || undefined,
    floor: r.floor,
    roomType: r.room_type,
    grossSqm: Number(r.gross_sqm),
    netSqm: Number(r.net_sqm),
    price: Number(r.price),
    status: r.status,
    statusLabel: meta.statusLabel || undefined,
    planBox: meta.planBox || undefined,
    sizePreset: meta.sizePreset || undefined,
    facade: r.facade || undefined,
    description,
    reservation: r.reservation || undefined,
    sale: r.sale || undefined,
    history: Array.isArray(r.history) ? r.history : [],
  }
}

// --- APPOINTMENTS ---
export function appointmentToRow(a: Appointment) {
  return {
    id: a.id,
    lead_id: a.leadId || null,
    customer_name: a.customerName,
    customer_phone: a.customerPhone,
    date: a.date,
    time: a.time,
    location: a.location,
    type: a.type,
    status: a.status,
    assigned_to_user_id: a.assignedToUserId || null,
    assigned_to_user_name: a.assignedToUserName,
    created_by_user_id: a.createdByUserId,
    created_by_department: a.createdByDepartment,
    project_name: a.projectName || null,
    notes: a.notes || null,
    outcome_note: a.outcomeNote || null,
    created_at: a.createdAt,
  }
}

export function rowToAppointment(r: any): Appointment {
  return {
    id: r.id,
    leadId: r.lead_id || undefined,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    date: r.date,
    time: r.time,
    location: r.location,
    type: r.type,
    status: r.status,
    assignedToUserId: r.assigned_to_user_id || undefined,
    assignedToUserName: r.assigned_to_user_name,
    createdByUserId: r.created_by_user_id,
    createdByDepartment: r.created_by_department,
    projectName: r.project_name || undefined,
    notes: r.notes || undefined,
    outcomeNote: r.outcome_note || undefined,
    createdAt: r.created_at,
  }
}

// --- REQUESTS ---
export function requestToRow(rq: CustomerRequest) {
  return {
    id: rq.id,
    customer_name: rq.customerName,
    customer_phone: rq.customerPhone,
    subject: rq.subject,
    category: rq.category,
    priority: rq.priority,
    status: rq.status,
    assigned_to_user_name: rq.assignedToUserName,
    notes: rq.notes || '',
    created_at: rq.createdAt,
    updated_at: rq.updatedAt,
  }
}

export function rowToRequest(r: any): CustomerRequest {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    subject: r.subject,
    category: r.category,
    priority: r.priority,
    status: r.status,
    assignedToUserName: r.assigned_to_user_name,
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

// --- USERS ---
export function userToRow(u: AppUser) {
  return {
    id: u.id,
    full_name: u.fullName,
    username: u.username,
    password: u.password,
    email: u.email || null,
    avatar_url: u.avatarUrl || null,
    company_name: u.companyName,
    department: u.department,
    departments: u.departments || [],
    role: u.role,
    is_manager: u.isManager,
    scope: u.scope,
    permissions: u.permissions || {},
    must_change_password: Boolean(u.mustChangePassword),
    created_at: u.createdAt,
  }
}

export function rowToUser(r: any): AppUser {
  return {
    id: r.id,
    fullName: r.full_name,
    username: r.username,
    password: r.password,
    email: r.email || undefined,
    avatarUrl: r.avatar_url || undefined,
    companyName: r.company_name || 'Demirtürk İnşaat',
    department: r.department,
    departments: Array.isArray(r.departments) ? r.departments : [r.department],
    role: r.role,
    isManager: Boolean(r.is_manager),
    scope: r.scope || 'ALL',
    permissions: r.permissions || {},
    mustChangePassword: Boolean(r.must_change_password),
    createdAt: r.created_at,
  }
}

// --- COLLECTIONS & PAYMENTS ---
export function collectionToRow(c: CollectionRecord) {
  return {
    id: c.id,
    customer_name: c.customerName,
    customer_id: c.customerId || null,
    project_name: c.projectName,
    unit_number: c.unitNumber,
    type: c.type,
    amount: c.amount,
    due_date: c.dueDate,
    paid_date: c.paidDate || null,
    status: c.status,
    payment_method: c.paymentMethod || null,
    receipt_no: c.receiptNo || null,
    notes: c.notes || null,
    refund_reason: c.refundReason || null,
    refunded_by_user_name: c.refundedByUserName || null,
    created_at: c.createdAt,
  }
}

export function rowToCollection(r: any): CollectionRecord {
  return {
    id: r.id,
    customerName: r.customer_name,
    customerId: r.customer_id || undefined,
    projectName: r.project_name,
    unitNumber: r.unit_number,
    type: r.type,
    amount: Number(r.amount),
    dueDate: r.due_date,
    paidDate: r.paid_date || undefined,
    status: r.status,
    paymentMethod: r.payment_method || undefined,
    receiptNo: r.receipt_no || undefined,
    notes: r.notes || undefined,
    refundReason: r.refund_reason || undefined,
    refundedByUserName: r.refunded_by_user_name || undefined,
    createdAt: r.created_at,
  }
}

export function paymentToRow(p: PaymentRecord) {
  return {
    id: p.id,
    title: p.title,
    payee: p.payee,
    category: p.category,
    amount: p.amount,
    due_date: p.dueDate,
    paid_date: p.paidDate || null,
    status: p.status,
    invoice_no: p.invoiceNo || null,
    notes: p.notes || null,
    created_at: p.createdAt,
  }
}

export function rowToPayment(r: any): PaymentRecord {
  return {
    id: r.id,
    title: r.title,
    payee: r.payee,
    category: r.category,
    amount: Number(r.amount),
    dueDate: r.due_date,
    paidDate: r.paid_date || undefined,
    status: r.status,
    invoiceNo: r.invoice_no || undefined,
    notes: r.notes || undefined,
    createdAt: r.created_at,
  }
}

// --- APPROVALS ---
export function approvalToRow(a: ApprovalRequest) {
  return {
    id: a.id,
    type: a.type,
    title: a.title,
    customer_name: a.customerName,
    project_name: a.projectName,
    unit_number: a.unitNumber || null,
    amount: a.amount ?? null,
    reason: a.reason,
    requested_by_user_id: a.requestedByUserId,
    requested_by_user_name: a.requestedByUserName,
    requested_department: a.requestedDepartment,
    status: a.status,
    reviewed_by_user_id: a.reviewedByUserId || null,
    reviewed_by_user_name: a.reviewedByUserName || null,
    reviewed_at: a.reviewedAt || null,
    review_notes: a.reviewNotes || null,
    created_at: a.createdAt,
  }
}

export function rowToApproval(r: any): ApprovalRequest {
  return {
    id: r.id,
    type: r.type,
    title: r.title,
    customerName: r.customer_name,
    projectName: r.project_name,
    unitNumber: r.unit_number || undefined,
    amount: r.amount ? Number(r.amount) : undefined,
    reason: r.reason,
    requestedByUserId: r.requested_by_user_id,
    requestedByUserName: r.requested_by_user_name,
    requestedDepartment: r.requested_department,
    status: r.status,
    reviewedByUserId: r.reviewed_by_user_id || undefined,
    reviewedByUserName: r.reviewed_by_user_name || undefined,
    reviewedAt: r.reviewed_at || undefined,
    reviewNotes: r.review_notes || undefined,
    createdAt: r.created_at,
  }
}

// --- SHARED FILES ---
const LEGACY_FILE_FOLDERS = new Set([
  'Proje Katalogları',
  'Satış Sözleşmeleri',
  'Mimari Çizimler',
  'Lansman Videoları',
  'Finans & Muhasebe',
])

export function sharedFileToRow(f: SharedFile) {
  const cleanNotes =
    f.notes !== undefined
      ? f.notes
      : f.folder && !LEGACY_FILE_FOLDERS.has(f.folder)
        ? f.folder
        : ''
  return {
    id: f.id,
    name: f.name,
    folder: cleanNotes,
    size: f.size || null,
    type: f.type,
    uploaded_by_user_id: f.uploadedByUserId,
    uploaded_by_user_name: f.uploadedByUserName,
    created_at: f.createdAt,
    updated_at: f.updatedAt,
    share_target: f.shareTarget,
    target_departments: f.targetDepartments || [],
    target_member_ids: f.targetMemberIds || [],
    permissions: {
      ...f.permissions,
      notes: cleanNotes,
      mimeType: f.mimeType,
      fileDataUrl: f.fileDataUrl,
    },
    download_count: f.downloadCount,
    downloads_audit: f.downloadsAudit || [],
  }
}

export function rowToSharedFile(r: any): SharedFile {
  const perms = r.permissions || { canView: true, canEdit: false, canReshare: true }
  const rawNotes =
    perms.notes !== undefined
      ? String(perms.notes || '')
      : r.folder && !LEGACY_FILE_FOLDERS.has(String(r.folder))
        ? String(r.folder)
        : ''
  return {
    id: r.id,
    name: r.name,
    folder: rawNotes,
    notes: rawNotes,
    size: r.size || '1.0 MB',
    type: r.type || 'other',
    mimeType: perms.mimeType || undefined,
    fileDataUrl: perms.fileDataUrl || undefined,
    uploadedByUserId: r.uploaded_by_user_id,
    uploadedByUserName: r.uploaded_by_user_name,
    createdAt: r.created_at,
    updatedAt: r.updated_at || r.created_at,
    shareTarget: r.share_target || 'ALL_TEAM',
    targetDepartments: Array.isArray(r.target_departments) ? r.target_departments : [],
    targetMemberIds: Array.isArray(r.target_member_ids) ? r.target_member_ids : [],
    permissions: {
      canView: perms.canView ?? true,
      canEdit: Boolean(perms.canEdit),
      canReshare: perms.canReshare ?? true,
    },
    downloadCount: r.download_count || 0,
    downloadsAudit: Array.isArray(r.downloads_audit) ? r.downloads_audit : [],
  }
}
