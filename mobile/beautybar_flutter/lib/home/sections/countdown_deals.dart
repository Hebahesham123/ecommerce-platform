/// Deals of the day. Port of CountdownDeals.tsx.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

String _two(int n) => n < 10 ? '0$n' : '$n';

String get _mono => defaultTargetPlatform == TargetPlatform.iOS || defaultTargetPlatform == TargetPlatform.macOS
    ? 'Menlo'
    : 'monospace';

/// A row of deals under a heading with a split-flap clock counting down.
Widget? countdownDealsSection(SectionCtx c) {
  final items = c.settings
      .l('items')
      .where((i) => i.s('price').isNotEmpty || i.s('imageUrl').isNotEmpty || i.s('handle').isNotEmpty)
      .toList();
  if (items.isEmpty) return null;
  return _CountdownDeals(c: c, items: items);
}

class _CountdownDeals extends StatefulWidget {
  final SectionCtx c;
  final List<J> items;
  const _CountdownDeals({required this.c, required this.items});
  @override
  State<_CountdownDeals> createState() => _CountdownDealsState();
}

class _CountdownDealsState extends State<_CountdownDeals> {
  late int _total = _totalOf(widget.c.settings);
  late int _left = _total;
  Timer? _tick;

  static int _totalOf(J s) {
    final m = s.nOrNull('endsInMinutes');
    final minutes = m != null && m > 0 ? m : 135.0;
    return math.max(0, (minutes * 60).truncate());
  }

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void didUpdateWidget(covariant _CountdownDeals old) {
    super.didUpdateWidget(old);
    final t = _totalOf(widget.c.settings);
    if (t != _total) {
      _total = t;
      _left = t;
      _run();
    }
  }

  /// A second at a time, until nought.
  void _run() {
    _tick?.cancel();
    if (_left <= 0) return;
    _tick = Timer.periodic(const Duration(seconds: 1), (t) {
      if (!mounted) return;
      setState(() => _left = _left > 0 ? _left - 1 : 0);
      if (_left <= 0) t.cancel();
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.c;
    final s = c.settings;
    final items = widget.items;
    final tc = theme.o('card');

    final parts = [_two(_left ~/ 3600), _two((_left % 3600) ~/ 60), _two(_left % 60)];
    const units = ['H', 'M', 'S'];

    // Every product the phone has, for a deal that names one.
    final all = <ProductCard>[...c.data.newArrivals];
    for (final list in c.data.rows.values) {
      all.addAll(list);
    }
    ProductCard? named(J i) {
      final pid = i.s('productId');
      final handle = i.s('handle');
      if (pid.isEmpty && handle.isEmpty) return null;
      ProductCard? hit;
      if (pid.isNotEmpty) {
        for (final p in all) {
          if (p.id == pid || p.handle == pid) {
            hit = p;
            break;
          }
        }
      }
      if (hit != null || pid.isNotEmpty) return hit;
      for (final p in all) {
        if (p.handle == handle) return p;
      }
      return null;
    }

    bool oneTap(ProductCard p) =>
        p.variantId != null && ((p.variantCount == null || p.variantCount == 0) ? 1 : p.variantCount) == 1;

    // One product per deal, and a different one each time.
    //
    // A deal naming a product is that product. A deal naming a collection takes
    // a product out of it that no earlier deal has taken, preferring one that
    // can go in the bag in a single tap - a deal the shopper cannot act on is a
    // poor deal to feature.
    final chosen = <int, ProductCard?>{};
    final taken = <String>[];
    for (var n = 0; n < items.length; n++) {
      final i = items[n];
      final own = named(i);
      if (own != null) {
        chosen[n] = own;
        taken.add(own.id);
        continue;
      }
      final pool = (c.data.rows[i.s('handle')] ?? const <ProductCard>[]).where((p) => !taken.contains(p.id)).toList();
      final singles = pool.where(oneTap).toList();
      final one = singles.isNotEmpty ? singles.first : (pool.isNotEmpty ? pool.first : null);
      chosen[n] = one;
      if (one != null) taken.add(one.id);
    }

    final title = s.s('title');
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ts(16, w: 700, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4),
              ),
            ),
            if (s['showTimer'] != false) ...[
              const SizedBox(width: Spacing.sm),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: hexA(colors.accent, '12'), borderRadius: BorderRadius.circular(12)),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const _Ping(),
                    for (var k = 0; k < 3; k++) ...[
                      const SizedBox(width: 5),
                      _Flap(key: ValueKey(k), value: parts[k], unit: units[k]),
                    ],
                  ],
                ),
              ),
            ],
          ],
        ),
        Padding(
          padding: const EdgeInsets.only(top: Spacing.sm),
          child: Bleed(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xs),
              child: IntrinsicHeight(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (var n = 0; n < items.length; n++) ...[
                      if (n > 0) SizedBox(width: gap.item),
                      _DealCard(
                        key: ValueKey('${items[n].s('id')}#$n'),
                        c: c,
                        i: items[n],
                        lead: s['featureFirst'] == true && n == 0,
                        product: chosen[n],
                        single: chosen[n] != null && oneTap(chosen[n]!),
                        tc: tc,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _DealCard extends StatelessWidget {
  final SectionCtx c;
  final J i;
  final bool lead;
  final ProductCard? product;
  final bool single;
  final J tc;
  const _DealCard({
    super.key,
    required this.c,
    required this.i,
    required this.lead,
    required this.product,
    required this.single,
    required this.tc,
  });

  void _go() => openLink(i, c.links);

  @override
  Widget build(BuildContext context) {
    final s = c.settings;
    final borrowed = inherit(i, c.data.collections);
    // Hers if she pasted one, then the product this deal was given, and only
    // then the collection's lead - the last of which is what made two deals
    // look identical.
    String? photo = i.s('imageUrl');
    if (photo.isEmpty) photo = (product?.image != null && product!.image!.isNotEmpty) ? product!.image : borrowed.image;
    final claimed = i.s('claimed');
    final m = RegExp(r'^\s*([+-]?\d+)').firstMatch(claimed);
    final pct = (m != null ? int.parse(m.group(1)!) : 0).clamp(0, 100);
    final dealLeft = product?.available;
    final scarce = tc.b('stock') && dealLeft != null && dealLeft > 0 && dealLeft <= tc.n('lowAt', 5);
    final notes = notesFor(product, scarce, dealLeft);
    final badge = i.s('badge');
    final badgeBg = css(s.s('badgeBg'), colors.accent);
    final was = i.s('comparePrice');
    final canAdd = tc.b('add') && (c.onAdd != null || c.onOpenProduct != null);

    return SizedBox(
      width: lead ? 224 : 158,
      child: Stack(
        children: [
          Tap(
            onTap: _go,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // The picture takes whatever height the row settles on, so the
                // prices line up across it and a featured card leads by being
                // wider rather than by leaving a step behind it.
                Expanded(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: lead ? 168 : 120),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(tc.n('radius', 22)),
                      child: Container(
                        color: css(tc.s('photoBg'), const Color(0xFFECE8E3)),
                        child: Stack(
                          children: [
                            if (photo != null && photo.isNotEmpty)
                              Positioned.fill(child: NetImage(photo, fit: BoxFit.cover)),
                            if (badge.isNotEmpty)
                              Positioned(
                                top: 6,
                                left: 6,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(color: badgeBg, borderRadius: BorderRadius.circular(4)),
                                  child: Text(badge, style: ts(10, lh: 15, w: 700, c: const Color(0xFFFFFFFF))),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                Padding(
                  padding: const EdgeInsets.only(left: 8, top: 8, bottom: 8, right: 32),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: i.s('price'),
                              style: ts(13, lh: 19, w: 700, c: colors.accent),
                            ),
                            if (was.isNotEmpty) ...[
                              const WidgetSpan(child: SizedBox(width: 4)),
                              TextSpan(
                                text: was,
                                style: ts(10, lh: 15, c: const Color(0xFF94A3B8), deco: TextDecoration.lineThrough),
                              ),
                            ],
                          ],
                        ),
                        style: ts(13, lh: 19, w: 700, c: colors.accent),
                      ),
                      CardNote(notes: notes),
                      if (s['showClaimed'] != false && claimed.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 6),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              ClipRRect(
                                borderRadius: BorderRadius.circular(3),
                                child: Container(
                                  height: 6,
                                  color: const Color(0xFFF1F5F9),
                                  alignment: Alignment.centerLeft,
                                  child: FractionallySizedBox(
                                    widthFactor: pct / 100,
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: colors.accent,
                                        borderRadius: BorderRadius.circular(3),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(claimed, style: ts(9, lh: 13, c: const Color(0xFF64748B))),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // The same plus the product cards carry, in the same corner. A deal
          // nobody can add without choosing a size opens instead of guessing one
          // for her.
          if (canAdd)
            Positioned(
              right: 2,
              bottom: 4,
              child: Semantics(
                button: true,
                label: single ? say(tc.s('addLabel'), 'Add to bag') : 'Choose a size',
                child: Tap(
                  onTap: () {
                    final p = product;
                    if (single && p != null && p.variantId != null && c.onAdd != null) {
                      c.onAdd!(p.variantId!, p.id);
                    } else {
                      _go();
                    }
                  },
                  child: Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: colors.accent,
                      shape: BoxShape.circle,
                      boxShadow: [rnShadow(opacity: 0.05, radius: 1, offset: const Offset(0, 1))],
                    ),
                    child: const Center(child: PlusMark()),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// The live dot: a solid dot with a ring leaving it, once a second.
class _Ping extends StatefulWidget {
  const _Ping();
  @override
  State<_Ping> createState() => _PingState();
}

class _PingState extends State<_Ping> with SingleTickerProviderStateMixin {
  late final AnimationController _t = AnimationController(vsync: this, duration: const Duration(milliseconds: 1000))
    ..repeat();
  static const _ease = Cubic(0, 0, 0.2, 1);

  @override
  void dispose() {
    _t.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dot = Container(
      width: 6,
      height: 6,
      decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(3)),
    );
    return Container(
      width: 6,
      height: 6,
      margin: const EdgeInsets.only(bottom: 8),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          AnimatedBuilder(
            animation: _t,
            builder: (_, child) {
              final v = _ease.transform(_t.value);
              final opacity = v <= 0.75 ? 0.75 * (1 - v / 0.75) : 0.0;
              final scale = v <= 0.75 ? 1 + v / 0.75 : 2.0;
              return Opacity(
                opacity: opacity.clamp(0.0, 1.0),
                child: Transform.scale(scale: scale, child: child),
              );
            },
            child: dot,
          ),
          dot,
        ],
      ),
    );
  }
}

/// One tile of the clock, flipping over on its top edge when its number
/// changes, with what it counts written under it.
class _Flap extends StatefulWidget {
  final String value;
  final String unit;
  const _Flap({super.key, required this.value, required this.unit});
  @override
  State<_Flap> createState() => _FlapState();
}

class _FlapState extends State<_Flap> with SingleTickerProviderStateMixin {
  late final AnimationController _turn = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
    value: 1,
  );
  static const _ease = Cubic(0.3, 0.8, 0.4, 1);

  @override
  void didUpdateWidget(covariant _Flap old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) _turn.forward(from: 0);
  }

  @override
  void dispose() {
    _turn.dispose();
    super.dispose();
  }

  static double _lerp3(double t, double a, double b, double c) =>
      t <= 0.6 ? a + (b - a) * (t / 0.6) : b + (c - b) * ((t - 0.6) / 0.4);

  @override
  Widget build(BuildContext context) {
    final hair = 1 / MediaQuery.devicePixelRatioOf(context);
    final tile = Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 5),
      decoration: BoxDecoration(
        color: colors.accent,
        borderRadius: BorderRadius.circular(7),
        boxShadow: [rnShadow(color: const Color(0xFF0F172A), opacity: 0.25, radius: 1, offset: const Offset(0, 1))],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Text(
            widget.value,
            style: ts(
              13,
              lh: 14,
              w: 700,
              c: const Color(0xFFFFFFFF),
              family: _mono,
            ).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
          ),
          // The fold across the middle of a split-flap tile (it spans the whole
          // tile, padding included).
          Positioned(
            left: -7,
            right: -7,
            top: 7,
            child: IgnorePointer(
              child: Container(height: hair, color: const Color(0x29000000)),
            ),
          ),
        ],
      ),
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        AnimatedBuilder(
          animation: _turn,
          builder: (_, child) {
            final t = _ease.transform(_turn.value.clamp(0.0, 1.0));
            final opacity = _lerp3(t, 0.35, 1, 1);
            final deg = _lerp3(t, -82, 8, 0);
            return Opacity(
              opacity: opacity.clamp(0.0, 1.0),
              child: Transform(
                alignment: Alignment.topCenter,
                transform: Matrix4.identity()
                  ..setEntry(3, 2, 1 / 160)
                  ..rotateX(deg * math.pi / 180),
                child: child,
              ),
            );
          },
          child: tile,
        ),
        Padding(
          padding: const EdgeInsets.only(top: 3),
          child: Text(widget.unit, style: ts(7, lh: 8, w: 700, ls: 0.7, c: hexA(colors.accent, '99'))),
        ),
      ],
    );
  }
}
