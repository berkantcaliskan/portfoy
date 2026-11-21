// Masaüstüyle birebir aynı iş kuralları. Kaynaklar:
//  - src/types/lead.ts (STAGE_CONFIGS, CALL_STATUS_OPTIONS)
//  - src/components/sales/SalesTeamView.tsx (salesDealStages, normalizeKanbanStage)
//  - src/services/permissionService.ts (Satış görünürlüğü)
//  - src/services/leadStore.ts (updateStage → isQualified)
//  - src/utils/salesPerformance.ts (başarı tablosu)
// Bu dosyadaki bir kural değişirse masaüstündeki karşılığı da aynı şekilde değişmelidir.
import 'models.dart';

/// Satış kanban sütunları (masaüstündeki salesDealStages).
const salesDealStages = ['NEW', 'CONTACTED', 'QUALIFIED', 'OFFER', 'WON'];

const stageLabels = {
  'NEW': 'Potansiyel müşteri',
  'CONTACTED': 'İletişim',
  'UNDECIDED': 'İletişim',
  'NO_INTENT': 'Potansiyel değil',
  'QUALIFIED': 'Nitelikli',
  'APPOINTMENT': 'Teklif',
  'PRESENTATION': 'Teklif',
  'OFFER': 'Teklif',
  'WON': 'Dönüşüm',
  'LOST': 'Potansiyel değil',
};

/// Sütun vurgu renkleri (0xAARRGGBB), masaüstündeki accentColor değerleri.
const stageColors = {
  'NEW': 0xfff59e0b,
  'CONTACTED': 0xff38bdf8,
  'QUALIFIED': 0xff2dd4bf,
  'OFFER': 0xffdfb76c,
  'WON': 0xff34d399,
  'LOST': 0xfff43f5e,
};

/// Detaydaki aşama seçenekleri (masaüstündeki StageDropdown).
const stageChoices = ['NEW', 'CONTACTED', 'QUALIFIED', 'OFFER', 'WON', 'LOST'];

/// Sunucunun kabul ettiği 8 arama durumu.
const callStatusLabels = {
  'WAITING': 'Bekliyor',
  'CALLED': 'Arandı',
  'CALL_AGAIN': 'Tekrar ara',
  'UNREACHABLE': 'Ulaşılamadı',
  'INFO_GIVEN': 'Bilgi verildi',
  'UNDECIDED': 'Kararsız',
  'APPOINTMENT_SET': 'Randevu alındı',
  'NO_INTENT': 'Satın alma niyeti yok',
};

const appointmentStatusLabels = {
  'SCHEDULED': 'Planlandı',
  'COMPLETED': 'Tamamlandı',
  'CANCELLED': 'İptal',
  'NO_SHOW': 'Gelmedi',
};

const appointmentTypeLabels = {'ONLINE': 'Online', 'OFFICE': 'Ofis', 'ON_SITE': 'Şantiye'};

/// Eski aşamaları kanban sütununa çevirir; LOST ve NO_INTENT hiçbir sütunda yer almaz.
String? normalizeKanbanStage(String stage) {
  switch (stage) {
    case 'UNDECIDED':
      return 'CONTACTED';
    case 'APPOINTMENT':
    case 'PRESENTATION':
      return 'OFFER';
    default:
      return salesDealStages.contains(stage) ? stage : null;
  }
}

String? nextSalesStage(String stage) {
  final column = normalizeKanbanStage(stage);
  final index = column == null ? -1 : salesDealStages.indexOf(column);
  return index >= 0 && index < salesDealStages.length - 1 ? salesDealStages[index + 1] : null;
}

/// crm_update_lead_work için aşama değişikliği (masaüstündeki updateStage ile aynı isQualified kuralı).
Map<String, Object> stageChange(String stage) => {
      'stage': stage,
      if (stage == 'QUALIFIED') 'isQualified': true,
      if (const {'LOST', 'NO_INTENT', 'NEW', 'CONTACTED'}.contains(stage)) 'isQualified': false,
    };

/// Masaüstündeki permissionService.canAccessLead — Satış görünürlüğü.
/// Sunucu (RLS) zaten süzer; bu, masaüstündeki ek istemci süzgecinin aynısıdır.
bool canSeeInSales(Profile user, Lead lead) {
  if (user.isAdmin) return true;
  if (user.department == 'Müşteri İlişkileri') return lead.assignedToUserId == user.id;
  if (user.scope == 'ALL') return true;
  if (user.department == 'Satış') {
    if (!lead.handedOverToSales) return false;
    if (user.scope == 'ASSIGNED_ONLY') {
      return lead.salesRepUserId == null ||
          lead.salesRepUserId == user.id ||
          lead.assignedToUserId == user.id ||
          lead.owner == user.fullName ||
          lead.owner == user.username;
    }
    return true;
  }
  if (user.scope == 'ASSIGNED_ONLY') {
    return lead.assignedToUserId == user.id || lead.owner == user.fullName || lead.owner == user.username;
  }
  return true;
}

/// Satış ekranında görünen müşteriler: erişilebilir ve satışa devredilmiş (SalesTeamView'daki gibi).
List<Lead> salesBoardLeads(Profile user, Iterable<Lead> leads) {
  final visible = leads.where((lead) => canSeeInSales(user, lead) && lead.handedOverToSales).toList();
  visible.sort((a, b) => (b.createdAt.isNotEmpty ? b.createdAt : b.updatedAt)
      .compareTo(a.createdAt.isNotEmpty ? a.createdAt : a.updatedAt));
  return visible;
}

/// Sunucudaki crm_can_access_lead(p_write=true) kuralının istemci karşılığı.
/// Yalnızca Satış'taki kullanıcılar müşteriye yazamaz; mobil bu yüzden onlara yazma düğmesi göstermez.
bool canWriteLead(Profile user, Lead lead) {
  if (user.isAdmin || user.inDepartment('Yönetim')) return true;
  if (user.inDepartment('Müşteri İlişkileri')) return lead.assignedToUserId == user.id;
  return false;
}

/// Başarı tablosunu tüm ekip için görenler (SalesTeamView.isManagementView).
bool isManagementView(Profile user) => user.isAdmin || user.inDepartment('Yönetim');

enum SalesPeriod { week, month }

/// Haftalıkta bu haftanın pazartesisi, aylıkta ayın ilk günü (yerel saat 00:00).
DateTime salesPeriodStart(SalesPeriod period, DateTime now) {
  if (period == SalesPeriod.month) return DateTime(now.year, now.month, 1);
  final today = DateTime(now.year, now.month, now.day);
  return today.subtract(Duration(days: today.weekday - DateTime.monday));
}

class SalesRank {
  SalesRank(this.id, this.name);
  final String id, name;
  int count = 0;
  double percentage = 0;
}

/// Masaüstündeki buildSalesRanking ile aynı hesap.
List<SalesRank> buildSalesRanking(Iterable<UnitSale> sales, Iterable<StaffMember> people, DateTime since) {
  final rows = <String, SalesRank>{
    for (final person in people.where((p) => p.department == 'Satış')) person.id: SalesRank(person.id, person.fullName),
  };
  var total = 0;
  for (final sale in sales) {
    final soldAt = sale.soldAt == null ? null : DateTime.tryParse(sale.soldAt!);
    if (soldAt == null || soldAt.toLocal().isBefore(since)) continue;
    final byName = people.where((p) => p.fullName == sale.soldByUserName).toList();
    final person = sale.soldByUserId != null && sale.soldByUserId!.isNotEmpty
        ? people.where((p) => p.id == sale.soldByUserId).firstOrNull
        : (byName.length == 1 ? byName.first : null);
    final id = person?.id ??
        (sale.soldByUserId?.isNotEmpty == true
            ? sale.soldByUserId!
            : (sale.soldByUserName?.isNotEmpty == true ? 'legacy-${sale.soldByUserName}' : 'unassigned'));
    final name = person?.fullName ?? (sale.soldByUserName?.isNotEmpty == true ? sale.soldByUserName! : 'Danışmanı belirtilmemiş');
    rows.putIfAbsent(id, () => SalesRank(id, name)).count++;
    total++;
  }
  for (final row in rows.values) {
    row.percentage = total == 0 ? 0 : row.count / total * 100;
  }
  return rows.values.toList()
    ..sort((a, b) => b.count != a.count ? b.count - a.count : a.name.compareTo(b.name));
}

/// Proje kayıtlarındaki satılmış daireler (status SATILDI).
List<UnitSale> soldUnits(Iterable<Map<String, dynamic>> projects) => [
      for (final project in projects)
        if (project['units'] is List)
          for (final unit in project['units'] as List)
            if (unit is Map && unit['status'] == 'SATILDI')
              UnitSale(_saleField(unit, 'soldByUserId'), _saleField(unit, 'soldByUserName'), _saleField(unit, 'soldAt')),
    ];

String? _saleField(Map unit, String key) {
  final sale = unit['sale'];
  final value = sale is Map ? sale[key] : null;
  return value is String ? value : null;
}
