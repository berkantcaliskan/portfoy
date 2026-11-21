import 'package:flutter/material.dart';

import '../data/sales_rules.dart';
import 'sales_controller.dart';

/// Başarı tablosu: Yönetim tüm ekibi, satışçı yalnızca kendini görür (masaüstüyle aynı).
class LeaderboardPage extends StatefulWidget {
  const LeaderboardPage({super.key, required this.controller});

  final SalesController controller;

  @override
  State<LeaderboardPage> createState() => _LeaderboardPageState();
}

class _LeaderboardPageState extends State<LeaderboardPage> {
  SalesPeriod period = SalesPeriod.month;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final profile = controller.profile!;
        final management = isManagementView(profile);
        final ranking = buildSalesRanking(
          soldUnits(controller.projects),
          controller.staff,
          salesPeriodStart(period, DateTime.now()),
        );
        final rows = management ? ranking : ranking.where((r) => r.id == profile.id).toList();
        final scheme = Theme.of(context).colorScheme;
        return RefreshIndicator(
          onRefresh: controller.refresh,
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
            children: [
              SegmentedButton<SalesPeriod>(
                segments: const [
                  ButtonSegment(value: SalesPeriod.week, label: Text('Haftalık')),
                  ButtonSegment(value: SalesPeriod.month, label: Text('Aylık')),
                ],
                selected: {period},
                onSelectionChanged: (value) => setState(() => period = value.first),
              ),
              const SizedBox(height: 6),
              Text(period == SalesPeriod.week ? 'Bu hafta' : 'Bu ay',
                  style: TextStyle(color: scheme.onSurface.withValues(alpha: 0.6))),
              const SizedBox(height: 12),
              if (rows.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(32),
                  child: Center(
                    child: Text(management ? 'Henüz satış ekibi danışmanı bulunmuyor.' : 'Bu dönem için satış kaydın bulunmuyor.'),
                  ),
                )
              else
                for (final (index, rank) in rows.indexed)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Card(
                      child: ListTile(
                        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        leading: CircleAvatar(
                          backgroundColor: scheme.secondary.withValues(alpha: 0.2),
                          child: management
                              ? Text('#${index + 1}', style: const TextStyle(fontWeight: FontWeight.w700))
                              : const Icon(Icons.emoji_events_outlined),
                        ),
                        title: Text(rank.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                        subtitle: Text('${rank.count} satış'),
                        trailing: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text('Satış payı', style: TextStyle(fontSize: 11, color: scheme.onSurface.withValues(alpha: 0.6))),
                            Text('%${rank.percentage.toStringAsFixed(rank.percentage % 1 == 0 ? 0 : 1).replaceAll('.', ',')}',
                                style: TextStyle(fontWeight: FontWeight.w700, color: scheme.secondary)),
                          ],
                        ),
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
