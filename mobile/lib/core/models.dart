// Masaüstü uygulamasıyla aynı veri şekilleri (src/types/lead.ts, dbMapper.ts, appointmentStore.ts).
// Alan adları sunucudaki sütun/payload adlarıyla birebir aynıdır; mobil ayrı bir şema kullanmaz.

/// Sunucudaki crm_get_my_profile cevabı.
class Profile {
  const Profile({
    required this.authUserId,
    required this.id,
    required this.fullName,
    required this.username,
    required this.role,
    required this.department,
    required this.departments,
    required this.scope,
    required this.mustChangePassword,
    required this.isManager,
    required this.permissions,
  });

  final String authUserId, id, fullName, username, role, department, scope;
  final List<String> departments;
  final bool mustChangePassword, isManager;
  final Map<String, bool> permissions;

  bool get isAdmin => role == 'ADMIN';
  bool inDepartment(String name) => department == name || departments.contains(name);

  static const roles = {'ADMIN', 'MANAGER', 'SPECIALIST', 'REPRESENTATIVE', 'MEMBER'};
  static const scopes = {'ALL', 'DEPARTMENT', 'ASSIGNED_ONLY'};

  /// Masaüstündeki parseCrmProfile ile aynı doğrulama; şüpheli cevapta null döner.
  static Profile? parse(Object? raw, String authUserId) {
    if (raw is! Map) return null;
    final id = raw['id'], name = raw['full_name'], username = raw['username'];
    final role = raw['role'], department = raw['department'], scope = raw['scope'];
    if (raw['auth_user_id'] != authUserId || id is! String || name is! String || username is! String) return null;
    if (role is! String || !roles.contains(role) || department is! String || scope is! String || !scopes.contains(scope)) return null;
    final rawDepartments = raw['departments'];
    final rawPermissions = raw['permissions'];
    return Profile(
      authUserId: authUserId,
      id: id,
      fullName: name,
      username: username,
      role: role,
      department: department,
      departments: {department, if (rawDepartments is List) ...rawDepartments.whereType<String>()}.toList(),
      scope: scope,
      mustChangePassword: raw['must_change_password'] != false,
      isManager: raw['is_manager'] == true,
      permissions: {
        if (rawPermissions is Map)
          for (final entry in rawPermissions.entries)
            if (entry.key is String && entry.value is bool) entry.key as String: entry.value as bool,
      },
    );
  }
}

/// crm_staff_directory satırı (admin olmayanlar için kısıtlı alanlar).
class StaffMember {
  const StaffMember(this.id, this.fullName, this.username, this.department);
  final String id, fullName, username, department;

  static StaffMember? parse(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'], name = raw['fullName'], username = raw['username'], department = raw['department'];
    if (id is! String || name is! String) return null;
    return StaffMember(id, name, username is String ? username : '', department is String ? department : '');
  }
}

class Lead {
  const Lead({
    required this.id,
    required this.fullName,
    required this.phone,
    required this.whatsappPhone,
    required this.email,
    required this.source,
    required this.channel,
    required this.stage,
    required this.callStatus,
    required this.owner,
    required this.budget,
    required this.preferredHousingType,
    required this.notes,
    required this.assignedToUserId,
    required this.assignedToUserName,
    required this.handedOverToSales,
    required this.salesRepUserId,
    required this.salesRepUserName,
    required this.handedOverAt,
    required this.handedOverByName,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id, fullName, phone, source, channel, stage, callStatus, owner;
  final String? whatsappPhone, email, preferredHousingType, notes, assignedToUserId, assignedToUserName;
  final double? budget;
  final bool handedOverToSales;
  final String? salesRepUserId, salesRepUserName, handedOverAt, handedOverByName;
  /// Sunucudaki updated_at; yazmalarda p_expected olarak aynen geri gönderilir.
  final String createdAt, updatedAt;

  /// Masaüstündeki rowToLead ile aynı eşleme.
  factory Lead.fromRow(Map<String, dynamic> r) {
    final history = r['assignment_history'] is List ? r['assignment_history'] as List : const [];
    final handover = history.cast<Object?>().firstWhere(
      (h) => h is Map && h['isSalesHandover'] is bool,
      orElse: () => null,
    ) as Map?;
    final handedOver = r['handed_over_to_sales'] is bool
        ? r['handed_over_to_sales'] as bool
        : handover?['isSalesHandover'] == true;
    final handoverTarget = handover?['assignedToUserId'];
    final salesRep = handoverTarget is String && handoverTarget != 'ALL_SALES' ? handoverTarget : null;
    final phone = _text(r['phone']) ?? '';
    final budget = r['budget'];
    return Lead(
      id: r['id'] as String,
      fullName: _text(r['full_name']) ?? (phone.isNotEmpty ? phone : 'İsimsiz müşteri'),
      phone: phone,
      whatsappPhone: _text(r['whatsapp_phone']),
      email: _text(r['email']),
      source: _text(r['source']) ?? 'WEBSITE',
      channel: _text(r['channel']) ?? 'Web',
      stage: _text(r['stage']) ?? 'NEW',
      callStatus: _text(r['call_status']) ?? 'WAITING',
      owner: _text(r['owner']) ?? 'Atanmamış',
      budget: budget is num ? budget.toDouble() : (budget is String ? double.tryParse(budget) : null),
      preferredHousingType: _text(r['preferred_housing_type']),
      notes: _text(r['notes']),
      assignedToUserId: _text(r['assigned_to_user_id']),
      assignedToUserName: _text(r['assigned_to_user_name']),
      handedOverToSales: handedOver,
      salesRepUserId: salesRep,
      salesRepUserName: salesRep == null ? null : _text(handover?['assignedToUserName']),
      handedOverAt: _text(handover?['assignedAt']),
      handedOverByName: _text(handover?['assignedByUserName']),
      createdAt: _text(r['created_at']) ?? '',
      updatedAt: _text(r['updated_at']) ?? '',
    );
  }
}

class LeadActivity {
  const LeadActivity(this.id, this.leadId, this.type, this.content, this.author, this.createdAt);
  final String id, leadId, type, content, author, createdAt;

  factory LeadActivity.fromRow(Map<String, dynamic> r) => LeadActivity(
        r['id'] as String,
        _text(r['lead_id']) ?? '',
        _text(r['type']) ?? 'NOTE',
        _text(r['content']) ?? '',
        _text(r['author']) ?? '',
        _text(r['created_at']) ?? '',
      );
}

/// crm_backend_list('appointments') kaydı: payload + sunucu sütunları.
class Appointment {
  const Appointment({
    required this.id,
    required this.revision,
    required this.payload,
  });

  final String id;
  final int revision;
  /// Masaüstüyle aynı payload; güncellerken tamamı (birleştirilmiş hali) geri yazılır.
  final Map<String, dynamic> payload;

  String get customerName => _text(payload['customerName']) ?? '';
  String get customerPhone => _text(payload['customerPhone']) ?? '';
  String get date => _text(payload['date']) ?? '';
  String get time => _text(payload['time']) ?? '';
  String get type => _text(payload['type']) ?? 'OFFICE';
  String get status => _text(payload['status']) ?? 'SCHEDULED';
  String get assignedToUserName => _text(payload['assignedToUserName']) ?? '';
  String? get projectName => _text(payload['projectName']);
  String? get notes => _text(payload['notes']);
  String get createdAt => _text(payload['createdAt']) ?? '';

  /// Masaüstündeki normalizeAppointmentLocation ile aynı: eski ofis adları "Ofis" olur.
  String get location {
    final value = (_text(payload['location']) ?? '').trim();
    return value.isEmpty || value == 'Demirtürk Panorama Satış Ofisi' || value == 'Merkez Satış Ofisi' ? 'Ofis' : value;
  }

  static Appointment? fromRecord(Object? raw) {
    if (raw is! Map) return null;
    final id = raw['id'], revision = raw['revision'], payload = raw['payload'];
    if (id is! String || revision is! int || payload is! Map) return null;
    return Appointment(
      id: id,
      revision: revision,
      payload: {
        ...Map<String, dynamic>.from(payload),
        'id': id,
        if (raw['owner_id'] is String) 'createdByUserId': raw['owner_id'],
        if (raw['department'] is String) 'createdByDepartment': raw['department'],
      },
    );
  }
}

/// Proje kaydındaki satılmış bir daire (başarı tablosu için yeterli alanlar).
class UnitSale {
  const UnitSale(this.soldByUserId, this.soldByUserName, this.soldAt);
  final String? soldByUserId, soldByUserName, soldAt;
}

String? _text(Object? value) => value is String && value.trim().isNotEmpty ? value : null;
