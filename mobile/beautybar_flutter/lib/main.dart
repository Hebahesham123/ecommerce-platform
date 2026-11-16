/// What runs first. Port of Boot.tsx.
///
/// It fetches the shop's current theme and applies it, then shows the app.
/// The last theme fetched is kept on the phone, so a start with no signal
/// still looks like the shop did last time rather than like the day it was built.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'app.dart';
import 'core/api.dart';
import 'core/color.dart';
import 'core/prefs.dart';
import 'core/theme.dart';

const String _saved = 'app_theme_pack';
const String _visitorKey = 'app_visitor';
/// How long a start waits for the network before going with what it has.
const Duration _wait = Duration(milliseconds: 1500);
/// Coming back to the app checks again, but not more than once a minute.
const int _recheckMs = 60000;

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark.copyWith(statusBarColor: Colors.transparent));
  initBundled(await rootBundle.loadString('assets/bundled_pack.json'));
  await initPrefs();
  AnalyticsLifecycle.install();
  runApp(const Boot());
}

class Boot extends StatefulWidget {
  const Boot({super.key});
  @override
  State<Boot> createState() => _BootState();
}

class _BootState extends State<Boot> with WidgetsBindingObserver {
  bool _started = false;
  /// Bumped when a theme is put on screen mid-visit: redraws without resetting.
  int _rev = 0;
  int _lastCheck = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _boot();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _start() {
    if (_started || !mounted) return;
    setState(() => _started = true);
  }

  void _keep(dynamic pack) => prefs.setString(_saved, jsonEncode(pack));

  /// A theme that only changes words, pictures and sections goes on screen now;
  /// one that changes colours waits for the next start.
  void _showNow(dynamic pack) {
    if (!isApplied(pack) && canApplyLive(pack) && applyPack(pack)) setState(() => _rev++);
  }

  Future<void> _boot() async {
    // This phone, for the shop's customer tracking: made once, kept here.
    var id = prefs.getString(_visitorKey);
    if (id == null || id.isEmpty) {
      final r = Random();
      id = 'a-${List.generate(10, (_) => 'abcdefghijklmnopqrstuvwxyz0123456789'[r.nextInt(36)]).join()}${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}';
      prefs.setString(_visitorKey, id);
    }
    setVisitor(id);
    try {
      final saved = prefs.getString(_saved);
      if (saved != null) applyPack(jsonDecode(saved));
    } catch (_) {
      /* nothing kept, or nothing readable: the built-in theme stands */
    }
    final timer = Timer(_wait, _start);
    _lastCheck = DateTime.now().millisecondsSinceEpoch;
    try {
      final pack = await api('/app-theme');
      _keep(pack);
      if (!_started) {
        applyPack(pack);
      } else {
        _showNow(pack);
      }
    } catch (_) {
      /* offline: the kept theme stands */
    }
    timer.cancel();
    _start();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final now = DateTime.now().millisecondsSinceEpoch;
    if (state != AppLifecycleState.resumed || !_started || now - _lastCheck < _recheckMs) return;
    _lastCheck = now;
    api('/app-theme').then((pack) {
      _keep(pack);
      if (mounted) _showNow(pack);
    }).catchError((_) {});
  }

  @override
  Widget build(BuildContext context) {
    final splash = theme.o('splash');
    return MaterialApp(
      title: theme.s('storeName', 'Shop'),
      debugShowCheckedModeBanner: false,
      // The shop is laid out left to right, whatever the phone's language.
      builder: (context, child) => Directionality(textDirection: TextDirection.ltr, child: child!),
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: colors.accent, primary: colors.accent, surface: colors.page),
        scaffoldBackgroundColor: colors.page,
        textSelectionTheme: TextSelectionThemeData(cursorColor: colors.accent),
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
      ),
      home: _started
          ? ShopApp(rev: _rev)
          : ColoredBox(color: css(splash.s('bg'), colors.page).a == 0 ? colors.page : css(splash.s('bg'), colors.page)),
    );
  }
}
