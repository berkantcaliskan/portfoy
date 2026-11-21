// Masaüstündeki kurallarla birebir aynı sonucu verdiğini doğrulayan testler
// (tests/salesPerformance.test.ts ve permissionService.ts davranışları).
import 'package:flutter_test/flutter_test.dart';
import 'package:portfoy_mobile/core/models.dart';
import 'package:portfoy_mobile/core/sales_rules.dart';
import 'package:portfoy_mobile/ui/format.dart';

Profile profile({String role = 'REPRESENTATIVE', String department = 'Satış', String scope = 'DEPARTMENT', List<String> departments = const []}) =>
    Profile(
      authUserId: 'auth-1',
      id: 'me',
      fullName: 'Hazal Çetin',
      username: 'hazal',
      role: role,
      department: department,
      departments: [department, ...departments],
      scope: scope,
      mustChangePassword: false,
      isManager: false,
      permissions: const {},
    );

Lead lead(String id, {bool handedOver = true, String? salesRep, String stage = 'NEW', String created = '2026-11-20T10:00:00Z'}) =>
    Lead.fromRow({
      'id': id,
      'full_name': 'Müşteri $id',
      'phone': '0532 000 00 00',
      'stage': stage,
      'created_at': created,
      'updated_at': created,
      'assignment_history': [
        {'isSalesHandover': handedOver, 'assignedToUserId': salesRep ?? 'ALL_SALES', 'assignedToUserName': salesRep == null ? 'Satış Ekibi (Genel Havuz)' : 'Kişi'},
      ],
    });

void main() {
  group('Satış görünürlüğü', () {
    test('Satışa devredilmeyen müşteri satışçıya görünmez', () {
      final user = profile();
      expect(canSeeInSales(user, lead('a', handedOver: false)), isFalse);
      expect(canSeeInSales(user, lead('b')), isTrue);
    });
    test('ASSIGNED_ONLY satışçı genel havuzu ve kendine atananı görür, başkasınınkini görmez', () {
      final user = profile(scope: 'ASSIGNED_ONLY');
      expect(canSeeInSales(user, lead('a')), isTrue);
      expect(canSeeInSales(user, lead('b', salesRep: 'me')), isTrue);
      expect(canSeeInSales(user, lead('c', salesRep: 'other')), isFalse);
    });
    test('Satış ekranı yalnızca devredilenleri yeniden eskiye sıralar', () {
      final rows = salesBoardLeads(profile(role: 'ADMIN'), [
        lead('old', created: '2026-11-01T10:00:00Z'),
        lead('new', created: '2026-11-19T10:00:00Z'),
        lead('nope', handedOver: false),
      ]);
      expect(rows.map((l) => l.id), ['new', 'old']);
    });
  });

  group('Yazma yetkisi (sunucudaki crm_can_access_lead ile aynı)', () {
    test('Yalnızca Satış departmanındaki kullanıcı yazamaz', () {
      expect(canWriteLead(profile(), lead('a')), isFalse);
    });
    test('Admin ve Yönetim yazabilir', () {
      expect(canWriteLead(profile(role: 'ADMIN'), lead('a')), isTrue);
      expect(canWriteLead(profile(department: 'Satış', departments: ['Yönetim']), lead('a')), isTrue);
    });
  });

  group('Aşamalar', () {
    test('Eski aşamalar kanban sütunlarına çevrilir, kayıp müşteri sütunda yer almaz', () {
      expect(normalizeKanbanStage('UNDECIDED'), 'CONTACTED');
      expect(normalizeKanbanStage('PRESENTATION'), 'OFFER');
      expect(normalizeKanbanStage('LOST'), isNull);
    });
    test('İlerlet bir sonraki sütuna geçer, Dönüşüm son sütundur', () {
      expect(nextSalesStage('NEW'), 'CONTACTED');
      expect(nextSalesStage('APPOINTMENT'), 'WON');
      expect(nextSalesStage('WON'), isNull);
    });
    test('Aşama değişikliği masaüstüyle aynı isQualified bilgisini gönderir', () {
      expect(stageChange('QUALIFIED'), {'stage': 'QUALIFIED', 'isQualified': true});
      expect(stageChange('CONTACTED'), {'stage': 'CONTACTED', 'isQualified': false});
      expect(stageChange('OFFER'), {'stage': 'OFFER'});
    });
  });

  group('Başarı tablosu (masaüstündeki salesPerformance testleriyle aynı)', () {
    const people = [
      StaffMember('hazal', 'Hazal', 'hazal', 'Satış'),
      StaffMember('levent', 'Levent', 'levent', 'Satış'),
      StaffMember('ertugrul', 'Ertuğrul', 'ertugrul', 'Satış'),
    ];
    final since = DateTime(2026, 11, 16);
    UnitSale sale(String id, String at) => UnitSale(id, id, at);

    test('Satış payı adetten hesaplanır', () {
      final ranking = buildSalesRanking([
        sale('hazal', DateTime(2026, 11, 17).toIso8601String()),
        sale('hazal', DateTime(2026, 11, 18).toIso8601String()),
        sale('levent', DateTime(2026, 11, 18).toIso8601String()),
      ], people, since);
      expect(ranking.map((r) => [r.id, r.count]), [['hazal', 2], ['levent', 1], ['ertugrul', 0]]);
      expect(ranking.first.percentage, closeTo(66.67, 0.01));
    });
    test('Dönem dışındaki ve tarihi olmayan satışlar sayılmaz', () {
      final ranking = buildSalesRanking([
        sale('hazal', DateTime(2026, 11, 10).toIso8601String()),
        UnitSale('levent', 'levent', null),
      ], people, since);
      expect(ranking.every((r) => r.count == 0), isTrue);
    });
    test('Haftalık dönem pazartesi, aylık dönem ayın ilk günü başlar', () {
      final thursday = DateTime(2026, 11, 19, 15, 30);
      expect(salesPeriodStart(SalesPeriod.week, thursday), DateTime(2026, 11, 16));
      expect(salesPeriodStart(SalesPeriod.month, thursday), DateTime(2026, 11, 1));
      expect(salesPeriodStart(SalesPeriod.week, DateTime(2026, 11, 22, 23)), DateTime(2026, 11, 16));
    });
  });

  group('Biçimler', () {
    test('WhatsApp numarası masaüstüyle aynı çevrilir', () {
      expect(internationalDigits('0532 123 45 67'), '905321234567');
      expect(internationalDigits('532 123 45 67'), '905321234567');
      expect(internationalDigits('+90 532 123 45 67'), '905321234567');
    });
    test('Tutar Türk lirası biçiminde yazılır', () {
      expect(formatLira(1250000), '₺1.250.000');
      expect(formatLira(950), '₺950');
    });
    test('Eski ofis adları Ofis olarak görünür', () {
      final apt = Appointment.fromRecord({
        'id': 'apt-1',
        'revision': 1,
        'payload': {'customerName': 'A', 'location': 'Demirtürk Panorama Satış Ofisi'},
      })!;
      expect(apt.location, 'Ofis');
    });
  });
}
