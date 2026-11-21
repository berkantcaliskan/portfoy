// Sunucu çağrıları — masaüstündeki leadStore.ts, crmBackendRepository.ts ve crmAuthService.ts ile
// aynı RPC'ler, aynı parametre adları ve aynı tekrar deneme (istek kimliği) kuralı.
// Mobil yeni bir sunucu fonksiyonu veya tablo gerektirmez; masaüstünü etkileyecek bir şey yazmaz.
import 'dart:convert';

import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:uuid/uuid.dart';

import 'models.dart';

class CrmException implements Exception {
  const CrmException(this.message, {this.code});
  final String message;
  final String? code;
  @override
  String toString() => message;
}

/// Masaüstündeki giriş kuralı: kullanıcı adı → e-posta.
String loginEmail(String input) {
  final name = input.trim().toLowerCase();
  if (name.contains('@')) return name;
  if (name == 'berkant') return 'dijital@demirturkinsaat.com';
  return '$name@staff.demirturk.invalid';
}

class CrmRepository {
  CrmRepository(this.client, this.authUserId);

  final SupabaseClient client;
  final String authUserId;
  final _uuid = Uuid();

  /// Bekleyen müşteri değişiklikleri: aynı değişiklik tekrar gönderilirse aynı istek kimliği kullanılır.
  final _pendingWork = <String, ({String change, String requestId})>{};
  final _pendingNotes = <String, ({String note, String requestId})>{};
  final _pendingWrites = <String, ({String key, String requestId})>{};

  void _checkAccount() {
    if (client.auth.currentUser?.id != authUserId) {
      throw const CrmException('Oturum değişti. Yeniden giriş yapın.');
    }
  }

  Future<T> _guard<T>(Future<T> Function() call) async {
    _checkAccount();
    try {
      final result = await call().timeout(const Duration(seconds: 20));
      _checkAccount();
      return result;
    } on PostgrestException catch (error) {
      throw _mapError(error);
    } on CrmException {
      rethrow;
    } catch (_) {
      throw const CrmException('Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    }
  }

  CrmException _mapError(PostgrestException error) {
    final message = error.message;
    final code = error.code;
    if (message.contains('crm_lead_forbidden') || code == '42501') {
      return CrmException('Bu kayıtta değişiklik yetkiniz yok.', code: code);
    }
    if (message.contains('conflict') || code == '40001') {
      return CrmException('Kayıt başka bir yerde değişti. Liste yenilendi, tekrar deneyin.', code: code);
    }
    if (message.contains('crm_invalid') || code == '22023') {
      return CrmException('Bilgiler sunucu tarafından kabul edilmedi. Alanları kontrol edin.', code: code);
    }
    if (message.contains('crm_rate_limited') || code == '54000') {
      return CrmException('Çok fazla işlem yapıldı. Bir dakika sonra tekrar deneyin.', code: code);
    }
    if (code == 'PGRST202') {
      return CrmException('Bu özellik için sunucu güncellemesi henüz kurulmamış.', code: code);
    }
    return CrmException('Sunucu işlemi doğrulayamadı. Tekrar deneyin.', code: code);
  }

  // ------------------------------------------------------------------ Profil ve ekip

  Future<Profile> profile() => _guard(() async {
        final raw = await client.rpc('crm_get_my_profile');
        final profile = Profile.parse(raw, authUserId);
        if (profile == null) throw const CrmException('Hesap bilgileri doğrulanamadı.');
        return profile;
      });

  Future<List<StaffMember>> staffDirectory() => _guard(() async {
        final raw = await client.rpc('crm_staff_directory');
        final rows = raw is List ? raw : (raw is Map && raw['records'] is List ? raw['records'] as List : const []);
        return rows.map(StaffMember.parse).whereType<StaffMember>().toList();
      });

  // ------------------------------------------------------------------ Müşteriler

  /// Masaüstüyle aynı okuma: leads tablosu, id'ye göre 100'erli sayfalar. Görünürlüğü sunucu (RLS) belirler.
  Future<List<Lead>> leads() => _guard(() async {
        final result = <Lead>[];
        String? after;
        while (true) {
          var query = client.from('leads').select();
          if (after != null) query = query.gt('id', after);
          final page = await query.order('id', ascending: true).limit(100);
          _checkAccount();
          result.addAll(page.map(Lead.fromRow));
          if (page.length < 100) break;
          after = page.last['id'] as String;
        }
        return result;
      });

  Future<List<LeadActivity>> activities(String leadId) => _guard(() async {
        final rows = await client
            .from('lead_activities')
            .select()
            .eq('lead_id', leadId)
            .order('created_at', ascending: false)
            .limit(50);
        return rows.map(LeadActivity.fromRow).toList();
      });

  /// crm_update_lead_work: aşama, arama durumu, açıklama vb. Masaüstündeki saveCentralLeadWork ile aynı.
  Future<Lead?> updateLeadWork(Lead lead, Map<String, Object?> change) => _guard(() async {
        final changeKey = jsonEncode(change);
        final pending = _pendingWork[lead.id];
        if (pending != null && pending.change != changeKey) {
          throw const CrmException('Bu müşteride kaydedilmeyi bekleyen başka bir değişiklik var.');
        }
        final requestId = pending?.requestId ?? _uuid.v4();
        _pendingWork[lead.id] = (change: changeKey, requestId: requestId);
        try {
          final row = await client.rpc('crm_update_lead_work', params: {
            'p_request': requestId,
            'p_id': lead.id,
            'p_expected': lead.updatedAt,
            'p_change': change,
          });
          _pendingWork.remove(lead.id);
          if (row is Map && row['id'] == lead.id && row['updated_at'] is String) {
            return Lead.fromRow(Map<String, dynamic>.from(row));
          }
          return null;
        } on PostgrestException catch (error) {
          // Kesin red: aynı istek kimliğiyle tekrar denemenin anlamı yok.
          if (const {'40001', '42501', '22023'}.contains(error.code)) _pendingWork.remove(lead.id);
          rethrow;
        }
      });

  /// crm_add_lead_note: cevap 'crm-note-<istek>' olmalı.
  Future<void> addNote(String leadId, String note) => _guard(() async {
        final pending = _pendingNotes[leadId];
        final requestId = pending != null && pending.note == note ? pending.requestId : _uuid.v4();
        _pendingNotes[leadId] = (note: note, requestId: requestId);
        final receipt = await client.rpc('crm_add_lead_note', params: {
          'p_request': requestId,
          'p_id': leadId,
          'p_note': note,
        });
        if (receipt != 'crm-note-$requestId') throw const CrmException('Not kaydı doğrulanamadı. Tekrar deneyin.');
        _pendingNotes.remove(leadId);
      });

  // ------------------------------------------------------------------ Kayıt modülleri (randevu, proje)

  /// crm_backend_list: tüm sayfalar okunur.
  Future<List<Map<String, dynamic>>> backendList(String module) => _guard(() async {
        final records = <Map<String, dynamic>>[];
        var cursor = '';
        while (true) {
          final raw = await client.rpc('crm_backend_list', params: {'p_module': module, 'p_after': cursor, 'p_limit': 100});
          if (raw is! Map || raw['records'] is! List) throw const CrmException('Kayıt listesi doğrulanamadı.');
          final page = (raw['records'] as List).whereType<Map>().map((r) => Map<String, dynamic>.from(r)).toList();
          records.addAll(page);
          if (raw['has_more'] != true || page.isEmpty) break;
          final next = page.last['id'];
          if (next is! String || next.compareTo(cursor) <= 0) throw const CrmException('Kayıt listesi doğrulanamadı.');
          cursor = next;
        }
        return records;
      });

  Future<List<Appointment>> appointments() async {
    final records = await backendList('appointments');
    final result = records.map(Appointment.fromRecord).whereType<Appointment>().toList();
    result.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return result;
  }

  Future<List<Map<String, dynamic>>> projects() async {
    final records = await backendList('projects');
    return [
      for (final record in records)
        if (record['payload'] is Map) Map<String, dynamic>.from(record['payload'] as Map),
    ];
  }

  /// crm_backend_write — masaüstündeki updateAppointment ile aynı: birleştirilmiş kaydın tamamı ve mevcut revizyon.
  Future<Appointment> updateAppointment(Appointment appointment, Map<String, Object?> updates) => _guard(() async {
        final payload = {...appointment.payload, ...updates};
        final key = jsonEncode(['update', appointment.id, updates]);
        final pending = _pendingWrites[appointment.id];
        final requestId = pending != null && pending.key == key ? pending.requestId : _uuid.v4();
        _pendingWrites[appointment.id] = (key: key, requestId: requestId);
        final raw = await client.rpc('crm_backend_write', params: {
          'p_request': requestId,
          'p_module': 'appointments',
          'p_id': appointment.id,
          'p_revision': appointment.revision,
          'p_payload': payload,
          'p_archive': false,
        });
        if (raw is! Map || raw['id'] != appointment.id || raw['revision'] is! int) {
          throw const CrmException('Randevu kaydı doğrulanamadı.');
        }
        _pendingWrites.remove(appointment.id);
        final saved = raw['payload'] is Map ? Map<String, dynamic>.from(raw['payload'] as Map) : payload;
        return Appointment(id: appointment.id, revision: raw['revision'] as int, payload: {...appointment.payload, ...saved});
      });

  // ------------------------------------------------------------------ Canlı güncelleme

  /// Masaüstündeki gibi: leads ve lead_activities değişince liste baştan okunur.
  RealtimeChannel watchLeads(void Function() onChange) {
    final channel = client.channel('mobile-crm-leads-$authUserId-${DateTime.now().millisecondsSinceEpoch}');
    for (final table in const ['leads', 'lead_activities']) {
      channel.onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: table,
        callback: (_) => onChange(),
      );
    }
    return channel.subscribe();
  }
}
