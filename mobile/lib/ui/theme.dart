import 'package:flutter/material.dart';

/// Masaüstü uygulamasının renkleri (koyu tema: #1c1a18 zemin, #282522 kart, #4a443f çizgi;
/// vurgu: adaçayı yeşili #657a72, altın #b99881).
class PortfoyColors {
  static const accent = Color(0xff657a72);
  static const gold = Color(0xffb99881);
  static const darkBackground = Color(0xff1c1a18);
  static const darkSurface = Color(0xff282522);
  static const darkCard = Color(0xff34302d);
  static const darkBorder = Color(0xff4a443f);
  static const darkText = Color(0xfff3efe9);
  static const darkMuted = Color(0xffa69f99);
  static const lightBackground = Color(0xfff5f5f2);
  static const lightBorder = Color(0x24292d2b);
  static const lightText = Color(0xff292d2b);
}

ThemeData portfoyTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: PortfoyColors.accent,
    brightness: brightness,
  ).copyWith(
    primary: PortfoyColors.accent,
    onPrimary: Colors.white,
    secondary: PortfoyColors.gold,
    surface: dark ? PortfoyColors.darkSurface : Colors.white,
    onSurface: dark ? PortfoyColors.darkText : PortfoyColors.lightText,
    outline: dark ? PortfoyColors.darkBorder : PortfoyColors.lightBorder,
    outlineVariant: dark ? PortfoyColors.darkBorder : PortfoyColors.lightBorder,
  );
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(22));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: dark ? PortfoyColors.darkBackground : PortfoyColors.lightBackground,
    cardTheme: CardThemeData(
      color: dark ? PortfoyColors.darkSurface : Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: shape.copyWith(side: BorderSide(color: scheme.outline)),
    ),
    appBarTheme: AppBarTheme(
      backgroundColor: dark ? PortfoyColors.darkBackground : PortfoyColors.lightBackground,
      foregroundColor: scheme.onSurface,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    chipTheme: ChipThemeData(shape: const StadiumBorder(), side: BorderSide(color: scheme.outline)),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: dark ? PortfoyColors.darkCard : Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: scheme.outline)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(999), borderSide: BorderSide(color: scheme.outline)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
    ),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(shape: const StadiumBorder())),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(shape: const StadiumBorder())),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: dark ? PortfoyColors.darkSurface : Colors.white,
      indicatorColor: PortfoyColors.accent.withValues(alpha: 0.28),
    ),
  );
}
