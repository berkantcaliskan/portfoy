import 'package:flutter/material.dart';

import '../data/sales_rules.dart';
import 'appointments_page.dart';
import 'leaderboard_page.dart';
import 'pipeline_page.dart';
import 'sales_controller.dart';

/// Satış çalışma alanı: masaüstündeki Satış menüsünün mobil karşılığı.
class SalesHome extends StatefulWidget {
  const SalesHome({super.key, required this.controller, required this.onSignOut});

  final SalesController controller;
  final Future<void> Function() onSignOut;

  @override
  State<SalesHome> createState() => _SalesHomeState();
}

class _SalesHomeState extends State<SalesHome> {
  int tab = 0;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    return ListenableBuilder(
      listenable: controller,
      builder: (context, _) {
        final profile = controller.profile;
        if (profile == null) {
          return Scaffold(
            body: Center(
              child: controller.error == null
                  ? const CircularProgressIndicator()
                  : _Message(text: controller.error!, actionLabel: 'Tekrar dene', onAction: controller.refresh),
            ),
          );
        }
        if (profile.mustChangePassword) {
          return Scaffold(
            body: _Message(
              text: 'İlk girişte parolanızı masaüstü uygulamasından değiştirin, ardından mobilden giriş yapın.',
              actionLabel: 'Çıkış yap',
              onAction: widget.onSignOut,
            ),
          );
        }
        final pages = [
          PipelinePage(controller: controller),
          AppointmentsPage(controller: controller),
          LeaderboardPage(controller: controller),
        ];
        final titles = ['Satış', 'Randevular', isManagementView(profile) ? 'Satış Ekibi Başarı Tablosu' : 'Başarı Tablon'];
        return Scaffold(
          appBar: AppBar(
            title: Text(titles[tab], style: const TextStyle(fontWeight: FontWeight.w700)),
            actions: [
              PopupMenuButton<String>(
                tooltip: profile.fullName,
                icon: CircleAvatar(
                  radius: 16,
                  backgroundColor: Theme.of(context).colorScheme.secondary.withValues(alpha: 0.25),
                  child: Text(_initials(profile.fullName), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                ),
                onSelected: (value) {
                  if (value == 'logout') widget.onSignOut();
                },
                itemBuilder: (context) => [
                  PopupMenuItem(enabled: false, child: Text('${profile.fullName} · @${profile.username}')),
                  const PopupMenuItem(value: 'logout', child: Text('Çıkış yap')),
                ],
              ),
              const SizedBox(width: 8),
            ],
          ),
          body: SafeArea(top: false, child: IndexedStack(index: tab, children: pages)),
          bottomNavigationBar: NavigationBar(
            selectedIndex: tab,
            onDestinationSelected: (value) => setState(() => tab = value),
            destinations: const [
              NavigationDestination(icon: Icon(Icons.trending_up_outlined), selectedIcon: Icon(Icons.trending_up), label: 'Satış Hattı'),
              NavigationDestination(icon: Icon(Icons.event_outlined), selectedIcon: Icon(Icons.event), label: 'Randevular'),
              NavigationDestination(icon: Icon(Icons.emoji_events_outlined), selectedIcon: Icon(Icons.emoji_events), label: 'Başarı'),
            ],
          ),
        );
      },
    );
  }
}

String _initials(String name) {
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  return parts.take(2).map((p) => p[0].toUpperCase()).join();
}

class _Message extends StatelessWidget {
  const _Message({required this.text, required this.actionLabel, required this.onAction});

  final String text, actionLabel;
  final Future<void> Function() onAction;

  @override
  Widget build(BuildContext context) => SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(28),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              Text(text, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              FilledButton(onPressed: () => onAction(), child: Text(actionLabel)),
            ]),
          ),
        ),
      );
}
