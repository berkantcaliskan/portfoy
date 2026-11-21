import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/crm_repository.dart';
import '../data/models.dart';
import '../data/sales_rules.dart';
import '../ui/format.dart';
import 'sales_controller.dart';

/// Müşteri detayı. Yazma işlemleri (aşama, arama durumu, not) yalnızca sunucunun izin verdiği
/// kullanıcılara gösterilir; Satış'taki kullanıcılar masaüstünde olduğu gibi okuyabilir.
class LeadDetailPage extends StatefulWidget {
  const LeadDetailPage({super.key, required this.controller, required this.leadId});

  final SalesController controller;
  final String leadId;

  @override
  State<LeadDetailPage> createState() => _LeadDetailPageState();
}

class _LeadDetailPageState extends State<LeadDetailPage> {
  List<LeadActivity>? activities;
  String? activityError;
  bool busy = false;
  final note = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadActivities();
  }

  @override
  void dispose() {
    note.dispose();
    super.dispose();
  }

  Future<void> _loadActivities() async {
    try {
      final rows = await widget.controller.repository.activities(widget.leadId);
      if (mounted) {
        setState(() {
          activities = rows;
          activityError = null;
        });
      }
    } on CrmException catch (e) {
      if (mounted) setState(() => activityError = e.message);
    }
  }

  Future<void> _run(Future<void> Function() action, String success) async {
    if (busy) return;
    setState(() => busy = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await action();
      messenger.showSnackBar(SnackBar(content: Text(success)));
      await _loadActivities();
    } on CrmException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _open(Uri uri) async {
    final messenger = ScaffoldMessenger.of(context);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      messenger.showSnackBar(const SnackBar(content: Text('Bağlantı açılamadı.')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final lead = controller.leadById(widget.leadId);
        final profile = controller.profile;
        if (lead == null || profile == null) {
          return Scaffold(appBar: AppBar(), body: const Center(child: Text('Bu müşteri artık görüntülenemiyor.')));
        }
        final canWrite = canWriteLead(profile, lead);
        final next = nextSalesStage(lead.stage);
        final scheme = Theme.of(context).colorScheme;
        final muted = scheme.onSurface.withValues(alpha: 0.6);
        return Scaffold(
          appBar: AppBar(title: Text(lead.fullName, overflow: TextOverflow.ellipsis)),
          body: ListView(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 32),
            children: [
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(lead.phone, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
                    if (lead.email != null) Text(lead.email!, style: TextStyle(color: muted)),
                    const SizedBox(height: 12),
                    Row(children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: lead.phone.isEmpty ? null : () => _open(telUri(lead.phone)),
                          icon: const Icon(Icons.call_outlined),
                          label: const Text('Ara'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: FilledButton.icon(
                          style: FilledButton.styleFrom(backgroundColor: const Color(0xff25d366), foregroundColor: Colors.white),
                          onPressed: lead.phone.isEmpty
                              ? null
                              : () => _open(whatsappUri(lead.whatsappPhone ?? lead.phone, lead.fullName)),
                          icon: const Icon(Icons.chat_outlined),
                          label: const Text('WhatsApp'),
                        ),
                      ),
                    ]),
                  ]),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    _Row('Aşama', stageLabels[lead.stage] ?? lead.stage),
                    _Row('Bilgi', callStatusLabels[lead.callStatus] ?? lead.callStatus),
                    if (lead.budget != null && lead.budget! > 0) _Row('Bütçe', formatLira(lead.budget!)),
                    if (lead.preferredHousingType != null) _Row('Konut tercihi', lead.preferredHousingType!),
                    _Row('Kanal', lead.channel),
                    if (lead.assignedToUserName != null) _Row('Müşteri temsilcisi', lead.assignedToUserName!),
                    _Row('Satış danışmanı', lead.salesRepUserName ?? 'Satış Ekibi (Genel Havuz)'),
                    if (lead.handedOverByName != null)
                      _Row('Devreden', '${lead.handedOverByName}${lead.handedOverAt == null ? '' : ' · ${shortDateTime(lead.handedOverAt!)}'}'),
                    _Row('Kayıt', shortDateTime(lead.createdAt)),
                  ]),
                ),
              ),
              if (lead.notes != null) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('Açıklama', style: TextStyle(color: muted, fontSize: 12)),
                      const SizedBox(height: 4),
                      Text(lead.notes!),
                    ]),
                  ),
                ),
              ],
              if (canWrite) ...[
                const SizedBox(height: 12),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                      DropdownButtonFormField<String>(
                        // Sunucudan gelen yeni değerle alan yeniden kurulur
                        key: ValueKey('stage-${lead.stage}'),
                        initialValue: stageChoices.contains(normalizeKanbanStage(lead.stage) ?? lead.stage)
                            ? (normalizeKanbanStage(lead.stage) ?? lead.stage)
                            : null,
                        decoration: const InputDecoration(labelText: 'Aşama'),
                        items: [for (final s in stageChoices) DropdownMenuItem(value: s, child: Text(stageLabels[s]!))],
                        onChanged: busy
                            ? null
                            : (value) {
                                if (value == null || value == lead.stage) return;
                                _run(() => controller.changeLead(lead, stageChange(value)), 'Aşama güncellendi.');
                              },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        key: ValueKey('call-${lead.callStatus}'),
                        initialValue: callStatusLabels.containsKey(lead.callStatus) ? lead.callStatus : null,
                        decoration: const InputDecoration(labelText: 'Bilgi'),
                        items: [
                          for (final entry in callStatusLabels.entries)
                            DropdownMenuItem(value: entry.key, child: Text(entry.value)),
                        ],
                        onChanged: busy
                            ? null
                            : (value) {
                                if (value == null || value == lead.callStatus) return;
                                _run(() => controller.changeLead(lead, {'callStatus': value}), 'Bilgi güncellendi.');
                              },
                      ),
                      if (next != null) ...[
                        const SizedBox(height: 12),
                        FilledButton.icon(
                          onPressed: busy
                              ? null
                              : () => _run(() => controller.changeLead(lead, stageChange(next)),
                                  '${stageLabels[next]} aşamasına ilerletildi.'),
                          icon: const Icon(Icons.arrow_forward),
                          label: Text('İlerlet: ${stageLabels[next]}'),
                        ),
                      ],
                      const SizedBox(height: 16),
                      TextField(
                        controller: note,
                        minLines: 1,
                        maxLines: 4,
                        decoration: InputDecoration(
                          hintText: 'Not ekle',
                          suffixIcon: IconButton(
                            tooltip: 'Notu kaydet',
                            icon: const Icon(Icons.send),
                            onPressed: busy
                                ? null
                                : () {
                                    final text = note.text.trim();
                                    if (text.isEmpty) return;
                                    _run(() async {
                                      await controller.addNote(lead, text);
                                      note.clear();
                                    }, 'Not kaydedildi.');
                                  },
                          ),
                        ),
                      ),
                    ]),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              Text('Geçmiş', style: TextStyle(color: muted, fontWeight: FontWeight.w600)),
              const SizedBox(height: 8),
              if (activityError != null)
                Text(activityError!, style: TextStyle(color: scheme.error))
              else if (activities == null)
                const Center(child: Padding(padding: EdgeInsets.all(16), child: CircularProgressIndicator()))
              else if (activities!.isEmpty)
                Text('Henüz kayıt yok.', style: TextStyle(color: muted))
              else
                for (final activity in activities!)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text('${activity.author} · ${shortDateTime(activity.createdAt)}', style: TextStyle(color: muted, fontSize: 12)),
                      const SizedBox(height: 2),
                      Text(activity.content),
                    ]),
                  ),
            ],
          ),
        );
      },
    );
  }
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value);
  final String label, value;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(
            width: 128,
            child: Text(label, style: TextStyle(color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
          ),
          Expanded(child: Text(value)),
        ]),
      );
}
