import 'dart:async';

import 'package:flutter/widgets.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/crm_repository.dart';
import '../core/models.dart';
import '../core/sales_rules.dart';

/// Satış ekranlarının ortak verisi. Masaüstündeki gibi: açılışta, öne gelince,
/// canlı değişiklik haberinde ve öndeyken düzenli aralıklarla sunucudan yeniden okunur.
class SalesController extends ChangeNotifier with WidgetsBindingObserver {
  SalesController(this.repository);

  final CrmRepository repository;

  Profile? profile;
  List<StaffMember> staff = const [];
  List<Lead> allLeads = const [];
  List<Appointment> appointments = const [];
  List<Map<String, dynamic>> projects = const [];
  String? error;
  bool loading = true;

  RealtimeChannel? _channel;
  Timer? _timer;
  Timer? _debounce;
  bool _reading = false, _readAgain = false, _disposed = false;

  List<Lead> get boardLeads => profile == null ? const [] : salesBoardLeads(profile!, allLeads);

  Lead? leadById(String id) => allLeads.where((lead) => lead.id == id).firstOrNull;

  Future<void> start() async {
    WidgetsBinding.instance.addObserver(this);
    await refresh();
    if (_disposed || profile == null || profile!.mustChangePassword) return;
    _channel = repository.watchLeads(_scheduleLeadRefresh);
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => refresh(quiet: true));
  }

  void _scheduleLeadRefresh() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () => refresh(quiet: true, leadsOnly: true));
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) refresh(quiet: true);
  }

  Future<void> refresh({bool quiet = false, bool leadsOnly = false}) async {
    if (_reading) {
      _readAgain = true;
      return;
    }
    _reading = true;
    if (!quiet) {
      loading = true;
      _notify();
    }
    try {
      profile ??= await repository.profile();
      if (profile!.mustChangePassword) return;
      if (leadsOnly) {
        allLeads = await repository.leads();
      } else {
        final results = await Future.wait([
          repository.leads(),
          repository.staffDirectory(),
          repository.appointments(),
          repository.projects(),
        ]);
        allLeads = results[0] as List<Lead>;
        staff = results[1] as List<StaffMember>;
        appointments = results[2] as List<Appointment>;
        projects = results[3] as List<Map<String, dynamic>>;
      }
      error = null;
    } on CrmException catch (e) {
      error = e.message;
    } finally {
      _reading = false;
      loading = false;
      _notify();
      if (_readAgain && !_disposed) {
        _readAgain = false;
        unawaited(refresh(quiet: true, leadsOnly: leadsOnly));
      }
    }
  }

  /// Bir müşteride değişiklik: sunucunun döndürdüğü güncel satır listeye yazılır.
  Future<void> changeLead(Lead lead, Map<String, Object?> change) async {
    final saved = await repository.updateLeadWork(lead, change);
    if (saved != null) {
      allLeads = [for (final item in allLeads) item.id == saved.id ? saved : item];
      _notify();
    }
    unawaited(refresh(quiet: true, leadsOnly: true));
  }

  Future<void> addNote(Lead lead, String note) async {
    await repository.addNote(lead.id, note);
    unawaited(refresh(quiet: true, leadsOnly: true));
  }

  Future<void> setAppointmentStatus(Appointment appointment, String status) async {
    final saved = await repository.updateAppointment(appointment, {'status': status});
    appointments = [for (final item in appointments) item.id == saved.id ? saved : item];
    _notify();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    WidgetsBinding.instance.removeObserver(this);
    _timer?.cancel();
    _debounce?.cancel();
    final channel = _channel;
    if (channel != null) unawaited(repository.client.removeChannel(channel));
    super.dispose();
  }
}
