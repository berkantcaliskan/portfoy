import 'package:flutter/material.dart';

import '../data/crm_repository.dart';
import '../data/models.dart';
import '../data/sales_rules.dart';
import '../ui/format.dart';
import 'sales_controller.dart';

/// Randevular: masaüstündeki gibi durum süzgeci (Tümü / Planlanan / Tamamlanan / İptal).
class AppointmentsPage extends StatefulWidget {
  const AppointmentsPage({super.key, required this.controller});

  final SalesController controller;

  @override
  State<AppointmentsPage> createState() => _AppointmentsPageState();
}

class _AppointmentsPageState extends State<AppointmentsPage> {
  String filter = 'ALL';
  String? busyId;

  static const filters = {'ALL': 'Tümü', 'SCHEDULED': 'Planlanan', 'COMPLETED': 'Tamamlanan', 'CANCELLED': 'İptal'};

  Future<void> _setStatus(Appointment appointment, String status) async {
    if (busyId != null) return;
    setState(() => busyId = appointment.id);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await widget.controller.setAppointmentStatus(appointment, status);
      messenger.showSnackBar(SnackBar(content: Text('Randevu: ${appointmentStatusLabels[status]}')));
    } on CrmException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => busyId = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final profile = controller.profile!;
        final items = controller.appointments.where((a) => filter == 'ALL' || a.status == filter).toList()
          ..sort((a, b) => '${a.date} ${a.time}'.compareTo('${b.date} ${b.time}'));
        final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              Wrap(spacing: 8, children: [
                for (final entry in filters.entries)
                  ChoiceChip(
                    selected: filter == entry.key,
                    label: Text(entry.value),
                    onSelected: (_) => setState(() => filter = entry.key),
                  ),
              ]),
              const SizedBox(height: 12),
              if (controller.loading && controller.appointments.isEmpty)
                const Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator()))
              else if (items.isEmpty)
                const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Bu görünümde randevu yok.')))
              else
                for (final appointment in items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(children: [
                            Expanded(
                              child: Text(appointment.customerName,
                                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                            ),
                            Text(appointmentStatusLabels[appointment.status] ?? appointment.status,
                                style: TextStyle(color: muted, fontSize: 12)),
                          ]),
                          const SizedBox(height: 6),
                          Text('${shortDate(appointment.date)} ${appointment.time} · ${appointment.location}'),
                          Text(
                            [
                              appointmentTypeLabels[appointment.type] ?? appointment.type,
                              if (appointment.assignedToUserName.isNotEmpty) 'Sorumlu: ${appointment.assignedToUserName}',
                              if (appointment.projectName != null) appointment.projectName!,
                            ].join(' · '),
                            style: TextStyle(color: muted, fontSize: 13),
                          ),
                          if (appointment.notes != null) ...[
                            const SizedBox(height: 6),
                            Text('"${appointment.notes}"', style: TextStyle(color: muted, fontStyle: FontStyle.italic)),
                          ],
                          // Sunucu yalnızca kaydı oluşturanın (veya departman yöneticisinin) yazmasına izin verir
                          if (appointment.status == 'SCHEDULED' &&
                              (profile.isAdmin || profile.isManager || appointment.payload['createdByUserId'] == profile.id)) ...[
                            const SizedBox(height: 10),
                            Row(children: [
                              Expanded(
                                child: OutlinedButton(
                                  onPressed: busyId == null ? () => _setStatus(appointment, 'CANCELLED') : null,
                                  child: const Text('İptal'),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: FilledButton(
                                  onPressed: busyId == null ? () => _setStatus(appointment, 'COMPLETED') : null,
                                  child: Text(busyId == appointment.id ? 'Kaydediliyor…' : 'Tamamlandı'),
                                ),
                              ),
                            ]),
                          ],
                        ]),
                      ),
                    ),
                  ),
            ],
          ),
        );
      },
    );
  }
}
