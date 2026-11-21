import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/crm_repository.dart';
import 'sales/sales_controller.dart';
import 'sales/sales_home.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Masaüstüyle aynı Supabase projesi; yalnızca herkese açık (publishable) anahtar kullanılır.
  const url = String.fromEnvironment('SUPABASE_URL');
  const key = String.fromEnvironment('SUPABASE_PUBLISHABLE_KEY');
  SupabaseClient? client;
  if (Uri.tryParse(url)?.scheme == 'https' && key.isNotEmpty) {
    await Supabase.initialize(
      url: url,
      publishableKey: key,
      // İlk sürümde oturum yalnızca bellekte tutulur; uygulama kapanınca yeniden giriş gerekir.
      authOptions: const FlutterAuthClientOptions(localStorage: EmptyLocalStorage()),
    );
    client = Supabase.instance.client;
  }
  runApp(PortfoyApp(client: client));
}

class PortfoyApp extends StatelessWidget {
  const PortfoyApp({super.key, this.client});

  final SupabaseClient? client;

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Demirtürk Portföy',
        debugShowCheckedModeBanner: false,
        locale: const Locale('tr'),
        supportedLocales: const [Locale('tr')],
        localizationsDelegates: GlobalMaterialLocalizations.delegates,
        theme: portfoyTheme(Brightness.light),
        darkTheme: portfoyTheme(Brightness.dark),
        themeMode: ThemeMode.system,
        home: client == null
            ? const Scaffold(
                body: SafeArea(
                  child: Center(
                    child: Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('Bu mobil paket Portföy sunucu adresi olmadan derlenmiş. Lütfen güncel paketi kurun.',
                          textAlign: TextAlign.center),
                    ),
                  ),
                ),
              )
            : SessionGate(client: client!),
      );
}

class SessionGate extends StatelessWidget {
  const SessionGate({super.key, required this.client});

  final SupabaseClient client;

  @override
  Widget build(BuildContext context) => StreamBuilder<AuthState>(
        stream: client.auth.onAuthStateChange,
        builder: (context, _) {
          final id = client.auth.currentSession?.user.id;
          return id == null
              ? LoginPage(client: client)
              : SalesWorkspace(key: ValueKey(id), repository: CrmRepository(client, id));
        },
      );
}

/// Oturum açık hesabın Satış çalışma alanı; hesap değişince baştan kurulur.
class SalesWorkspace extends StatefulWidget {
  const SalesWorkspace({super.key, required this.repository});

  final CrmRepository repository;

  @override
  State<SalesWorkspace> createState() => _SalesWorkspaceState();
}

class _SalesWorkspaceState extends State<SalesWorkspace> {
  late final SalesController controller = SalesController(widget.repository);

  @override
  void initState() {
    super.initState();
    controller.start();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SalesHome(
        controller: controller,
        onSignOut: () => widget.repository.client.auth.signOut(scope: SignOutScope.local),
      );
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, required this.client});

  final SupabaseClient client;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final name = TextEditingController(), password = TextEditingController();
  bool busy = false;
  String? error;

  Future<void> submit() async {
    if (busy) return;
    if (name.text.trim().isEmpty || password.text.isEmpty) {
      setState(() => error = 'Kullanıcı adınızı ve parolanızı girin.');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      // Masaüstüyle aynı kural: kullanıcı adı → e-posta
      await widget.client.auth.signInWithPassword(email: loginEmail(name.text), password: password.text);
    } on AuthException catch (e) {
      if (mounted) {
        setState(() => error = e.statusCode == '429'
            ? 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.'
            : 'Kullanıcı adı veya parola hatalı.');
      }
    } catch (_) {
      if (mounted) setState(() => error = 'Giriş tamamlanamadı. Bağlantınızı kontrol edin.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    name.dispose();
    password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: AutofillGroup(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Demirtürk Portföy',
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      Text('Kurumsal Gayrimenkul & Portföy Yönetim Platformu',
                          textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodySmall),
                      const SizedBox(height: 28),
                      TextField(
                        controller: name,
                        autofillHints: const [AutofillHints.username],
                        autocorrect: false,
                        textInputAction: TextInputAction.next,
                        decoration: const InputDecoration(
                            prefixIcon: Icon(Icons.person_outline), hintText: 'E-posta veya kullanıcı adı'),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: password,
                        obscureText: true,
                        autofillHints: const [AutofillHints.password],
                        onSubmitted: (_) => submit(),
                        decoration: const InputDecoration(prefixIcon: Icon(Icons.lock_outline), hintText: 'Parola'),
                      ),
                      if (error != null) ...[
                        const SizedBox(height: 10),
                        Text(error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                      ],
                      const SizedBox(height: 20),
                      FilledButton(
                        onPressed: busy ? null : submit,
                        style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(48)),
                        child: Text(busy ? 'Giriş yapılıyor…' : 'Giriş Yap'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}
