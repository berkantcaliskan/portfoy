import 'package:flutter/material.dart';

import '../data/models.dart';
import '../data/sales_rules.dart';
import '../ui/format.dart';
import 'lead_detail_page.dart';
import 'sales_controller.dart';

/// Satış kapanış hattı: masaüstündeki kanban sütunları, mobilde aşama sekmeleri olarak.
class PipelinePage extends StatefulWidget {
  const PipelinePage({super.key, required this.controller});

  final SalesController controller;

  @override
  State<PipelinePage> createState() => _PipelinePageState();
}

class _PipelinePageState extends State<PipelinePage> {
  String stage = salesDealStages.first;
  String query = '';

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final leads = controller.boardLeads;
        final counts = {for (final s in salesDealStages) s: 0};
        for (final lead in leads) {
          final column = normalizeKanbanStage(lead.stage);
          if (column != null) counts[column] = counts[column]! + 1;
        }
        final search = query.trim().toLowerCase();
        final visible = leads
            .where((lead) => normalizeKanbanStage(lead.stage) == stage)
            .where((lead) => search.isEmpty ||
                lead.fullName.toLowerCase().contains(search) ||
                lead.phone.replaceAll(' ', '').contains(search.replaceAll(' ', '')))
            .toList();
        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                  child: TextField(
                    onChanged: (value) => setState(() => query = value),
                    decoration: const InputDecoration(prefixIcon: Icon(Icons.search), hintText: 'İsim veya telefon ara'),
                  ),
                ),
              ),
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 48,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    children: [
                      for (final s in salesDealStages)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          child: ChoiceChip(
                            selected: stage == s,
                            onSelected: (_) => setState(() => stage = s),
                            avatar: CircleAvatar(radius: 5, backgroundColor: Color(stageColors[s]!)),
                            label: Text('${stageLabels[s]} (${counts[s]})'),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              if (controller.error != null)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                    child: Text(controller.error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                ),
              if (controller.loading && leads.isEmpty)
                const SliverFillRemaining(hasScrollBody: false, child: Center(child: CircularProgressIndicator()))
              else if (visible.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(child: Text(search.isEmpty ? 'Fırsat yok' : 'Bu aramada fırsat yok')),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                  sliver: SliverList.separated(
                    itemCount: visible.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) => _LeadCard(
                      lead: visible[index],
                      onTap: () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => LeadDetailPage(controller: controller, leadId: visible[index].id),
                      )),
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

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead, required this.onTap});

  final Lead lead;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(
                child: Text(lead.fullName,
                    maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
              ),
              Text(shortDate(lead.createdAt), style: TextStyle(color: muted, fontSize: 12)),
            ]),
            const SizedBox(height: 4),
            Text(lead.phone, style: TextStyle(color: muted)),
            const SizedBox(height: 8),
            Wrap(spacing: 6, runSpacing: 6, children: [
              _Pill(callStatusLabels[lead.callStatus] ?? lead.callStatus),
              if (lead.budget != null && lead.budget! > 0) _Pill(formatLira(lead.budget!)),
              if (lead.salesRepUserName != null) _Pill(lead.salesRepUserName!),
              _Pill(lead.channel),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Theme.of(context).colorScheme.outline),
        ),
        child: Text(text, style: const TextStyle(fontSize: 12)),
      );
}
