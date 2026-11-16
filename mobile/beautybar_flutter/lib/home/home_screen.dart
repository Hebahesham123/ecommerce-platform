/// The app's home screen. Port of HomeScreen.tsx.
///
/// Which sections appear, in what order and with what in them, is the theme
/// the app fetched when it opened, so a change saved in the editor reaches
/// the phone without a new build. This file only knows how to draw each kind.
library;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/links.dart';
import '../core/style.dart';
import '../core/theme.dart';
import 'registry.dart';
import 'section.dart';

class HomeHandlers {
  final LinkHandlers links;
  final OnAdd? onAdd;
  /// Whether someone is signed in - what Complete your look is built from.
  final bool signedIn;
  const HomeHandlers({required this.links, this.onAdd, this.signedIn = false});
}

/// One section with the line above it, inside its band. Null when it has nothing to draw.
Widget? _section(PackBlock b, HomePayload data, Recommendations? recs, HomeHandlers h) {
  final builder = sectionBuilders[b.type];
  if (builder == null) return null;
  // complete_look only draws with suggestions to show.
  if (b.type == 'complete_look' && (recs == null || recs.products.isEmpty)) return null;
  Widget? body;
  try {
    body = builder(SectionCtx(settings: b.settings, data: data, recs: recs, links: h.links, onAdd: h.onAdd));
  } catch (e, st) {
    debugPrint('section ${b.type} failed: $e\n$st');
    return null;
  }
  if (body == null) return null;
  Widget out = Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (b.kicker.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Text(b.kicker.toUpperCase(), style: ts(10, w: 700, ls: 1.8, c: colors.accent)),
        ),
      body,
    ],
  );
  // The list itself has no side padding: each section puts the page's gutter
  // on, and a band runs to the screen edges with the gutter inside it.
  if (b.band == 'tint' || b.band == 'paper') {
    out = Container(
      padding: EdgeInsets.symmetric(horizontal: Spacing.lg, vertical: gap.section),
      color: b.band == 'paper' ? const Color(0xFFFFFFFF) : hexA(colors.accent, '12'),
      child: out,
    );
  } else if (b.band == 'divider') {
    out = Padding(
      padding: const EdgeInsets.symmetric(horizontal: Spacing.lg),
      child: Container(
        padding: EdgeInsets.only(top: gap.section),
        decoration: BoxDecoration(border: Border(top: BorderSide(color: colors.line))),
        child: out,
      ),
    );
  } else {
    out = Padding(padding: const EdgeInsets.symmetric(horizontal: Spacing.lg), child: out);
  }
  return KeyedSubtree(key: ValueKey(b.id), child: out);
}

List<Widget> _sections(List<PackBlock> list, HomePayload data, Recommendations? recs, HomeHandlers h) {
  final out = <Widget>[];
  for (final b in list) {
    final w = _section(b, data, recs, h);
    if (w == null) continue;
    if (out.isNotEmpty) out.add(SizedBox(height: gap.section));
    out.add(w);
  }
  return out;
}

/// Suggestions for whoever is signed in, when a section in the list uses them.
class _Recs {
  Recommendations? value;
  bool? _forSignedIn;
  Future<void> load(List<PackBlock> list, bool signedIn, VoidCallback changed) async {
    final wanted = list.any((b) => b.type == 'complete_look');
    if (_forSignedIn == signedIn) return;
    _forSignedIn = signedIn;
    if (!wanted || !signedIn) {
      value = null;
      changed();
      return;
    }
    try {
      value = await fetchRecommendations();
    } catch (_) {
      value = null;
    }
    changed();
  }
}

class HomeScreen extends StatefulWidget {
  final HomeHandlers handlers;
  /// What the empty search box offers: the collections' titles.
  final void Function(List<String> titles)? onCollections;
  const HomeScreen({super.key, required this.handlers, this.onCollections});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  HomePayload? _data;
  String? _error;
  final _recs = _Recs();

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load({bool fresh = false}) async {
    try {
      final d = await fetchHome(fresh: fresh);
      if (!mounted) return;
      setState(() {
        _data = d;
        _error = null;
      });
      widget.onCollections?.call(d.collections.map((c) => c.title).where((t) => t.isNotEmpty).toList());
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    _recs.load(layout.home, widget.handlers.signedIn, () {
      if (mounted) setState(() {});
    });
    if (_error != null && _data == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.xl),
          child: Text(_error!, style: ts(13, c: const Color(0xFFE11D48))),
        ),
      );
    }
    final data = _data;
    if (data == null) return Center(child: CircularProgressIndicator(color: colors.accent, strokeWidth: 2.5));
    return Container(
      color: colors.page,
      child: RefreshIndicator(
        color: colors.accent,
        onRefresh: () => _load(fresh: true),
        child: ListView(
          padding: const EdgeInsets.only(bottom: Spacing.lg),
          children: _sections(layout.home, data, _recs.value, widget.handlers),
        ),
      ),
    );
  }
}

/// The same sections, placed elsewhere (product screen, basket).
class _Placed extends StatefulWidget {
  final List<PackBlock> list;
  final HomeHandlers handlers;
  const _Placed({required this.list, required this.handlers});
  @override
  State<_Placed> createState() => _PlacedState();
}

class _PlacedState extends State<_Placed> {
  HomePayload? _data;
  final _recs = _Recs();

  @override
  void initState() {
    super.initState();
    if (widget.list.isNotEmpty) {
      fetchHome().then((d) {
        if (mounted) setState(() => _data = d);
      }).catchError((_) => null);
    }
  }

  @override
  Widget build(BuildContext context) {
    _recs.load(widget.list, widget.handlers.signedIn, () {
      if (mounted) setState(() {});
    });
    final data = _data;
    if (widget.list.isEmpty || data == null) return const SizedBox.shrink();
    return Padding(
      padding: EdgeInsets.symmetric(vertical: gap.section),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: _sections(widget.list, data, _recs.value, widget.handlers),
      ),
    );
  }
}

/// Sections the merchant placed on the product screen.
class ProductSections extends StatelessWidget {
  final HomeHandlers handlers;
  const ProductSections({super.key, required this.handlers});
  @override
  Widget build(BuildContext context) => _Placed(list: layout.product, handlers: handlers);
}

/// Sections the merchant placed on the basket.
class CartSections extends StatelessWidget {
  final HomeHandlers handlers;
  const CartSections({super.key, required this.handlers});
  @override
  Widget build(BuildContext context) => _Placed(list: layout.cart, handlers: handlers);
}
