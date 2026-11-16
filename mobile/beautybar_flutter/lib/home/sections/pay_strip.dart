/// How you can pay. Port of PayStrip.tsx.
///
/// A thin strip naming the ways the shop takes money, one at a time — drawn
/// as the App theme editor's preview draws it: the provider's mark on a white
/// chip, its name with the strip's tag beside it, the note underneath, and a
/// dot for each way.
///
/// What it names comes from the merchant's payment settings, the same place
/// the checkout reads, so the strip cannot advertise a provider that was
/// switched off a month ago. A shop that takes one way shows one banner
/// standing still rather than a carousel of one.
///
/// It rises rather than slides: everything else on this screen travels
/// sideways, and one strip moving the other way gets read.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';

/// JS `Number(v)`: NaN for anything that is not a number.
double _jsNumber(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  if (v is bool) return v ? 1 : 0;
  if (v is String) {
    final t = v.trim();
    if (t.isEmpty) return 0;
    return double.tryParse(t) ?? double.nan;
  }
  return double.nan;
}

/// React Native's default timing curve: Easing.inOut(Easing.ease).
class _RnEaseInOut extends Curve {
  const _RnEaseInOut();
  @override
  double transformInternal(double t) {
    const ease = Curves.easeIn; // Easing.ease = bezier(0.42, 0, 1, 1)
    if (t < 0.5) return ease.transform(t * 2) / 2;
    return 1 - ease.transform((1 - t) * 2) / 2;
  }
}

Widget? payStripSection(SectionCtx c) {
  final payments = c.data.payments;
  if (payments.isEmpty) return null;
  final s = c.settings;
  // Every three seconds unless the merchant said otherwise; 0 stands still.
  final raw = s.raw.containsKey('every') ? _jsNumber(s['every']) : 3.0;
  final every = math.max(0.0, math.min(12.0, raw.isNaN ? 0.0 : raw));
  return _PayStrip(every: every, title: s.s('title'), payments: payments);
}

class _PayStrip extends StatefulWidget {
  final double every;
  final String title;
  final List<J> payments;
  const _PayStrip({required this.every, required this.title, required this.payments});
  @override
  State<_PayStrip> createState() => _PayStripState();
}

class _PayStripState extends State<_PayStrip> with SingleTickerProviderStateMixin {
  int _at = 0;
  late final AnimationController _rise = AnimationController(vsync: this, duration: const Duration(milliseconds: 420), value: 1);
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void didUpdateWidget(covariant _PayStrip old) {
    super.didUpdateWidget(old);
    if (old.every != widget.every || old.payments.length != widget.payments.length) _start();
  }

  void _start() {
    _timer?.cancel();
    _timer = null;
    if (widget.every <= 0 || widget.payments.length < 2) return;
    _timer = Timer.periodic(Duration(milliseconds: (widget.every * 1000).round()), (_) {
      if (!mounted) return;
      _rise.value = 0;
      setState(() => _at = (_at + 1) % widget.payments.length);
      _rise.animateTo(1, curve: const _RnEaseInOut());
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _rise.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final payments = widget.payments;
    final way = payments[_at % payments.length];
    final ground = css(way.s('color'), colors.accent);
    final dots = payments.take(8).toList();
    final note = way.s('note');

    final face = Container(
      color: ground,
      child: Stack(children: [
        // The provider's colour, deepening a little towards the far corner.
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0x00000000), Color(0x00000000), Color(0x21000000)],
                stops: [0, 0.55, 1],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 9),
            child: Row(children: [
              _Mark(way: way),
              const SizedBox(width: 8),
              Expanded(
                child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Flexible(
                      child: Text(way.s('name'),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(13, w: 800, c: const Color(0xFFFFFFFF))),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(color: const Color(0x33FFFFFF), borderRadius: BorderRadius.circular(4)),
                      child: Text(say(widget.title, 'Pay your way').toUpperCase(),
                          maxLines: 1, style: ts(7.5, w: 700, ls: 0.6, c: const Color(0xE6FFFFFF))),
                    ),
                  ]),
                  if (note.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(note, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(10.5, c: const Color(0xCCFFFFFF))),
                    ),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );

    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: SizedBox(
        height: 44,
        child: Stack(children: [
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _rise,
              builder: (_, child) => Opacity(
                opacity: _rise.value.clamp(0.0, 1.0),
                child: Transform.translate(offset: Offset(0, 14 * (1 - _rise.value)), child: child),
              ),
              child: ClipRect(child: face),
            ),
          ),
          if (payments.length > 1)
            Positioned(
              bottom: 4,
              right: 9,
              child: IgnorePointer(
                child: Row(children: [
                  for (var i = 0; i < dots.length; i++) ...[
                    if (i > 0) const SizedBox(width: 2.5),
                    Container(
                      width: i == _at % dots.length ? 8 : 3,
                      height: 3,
                      decoration: BoxDecoration(
                        color: i == _at % dots.length ? const Color(0xFFFFFFFF) : const Color(0x73FFFFFF),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ],
                ]),
              ),
            ),
        ]),
      ),
    );
  }
}

/// The provider's own logo if the merchant gave it one; a drawn note for money
/// at the door, which is not a brand; otherwise its initials. Two clean letters
/// rather than a hand-drawn guess at somebody else's trademark.
class _Mark extends StatelessWidget {
  final J way;
  const _Mark({required this.way});

  @override
  Widget build(BuildContext context) {
    // PORT NOTE: the generated RN code splits on the regex /s+/ (a literal "s",
    // a generator escaping slip); this splits on whitespace, as the editor's
    // preview and format.dart's shortName do.
    final initials = way
        .s('name')
        .split(RegExp(r'\s+'))
        .where((w) => w.isNotEmpty)
        .take(2)
        .map((w) => w[0])
        .join()
        .toUpperCase();
    final logo = way.s('logo');
    final Widget inner;
    if (logo.isNotEmpty) {
      inner = NetImage(logo, fit: BoxFit.contain, width: 48, height: 19);
    } else if (way.s('kind') == 'cod') {
      inner = const Svg(
        '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
        size: 16,
        rootAttrs: 'fill="none" stroke="#334155" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
      );
    } else {
      inner = Text(initials, style: ts(11, w: 800, c: const Color(0xFF1E293B)));
    }
    return Container(
      height: 27,
      constraints: const BoxConstraints(minWidth: 27, maxWidth: 56),
      padding: const EdgeInsets.symmetric(horizontal: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFFFF),
        borderRadius: BorderRadius.circular(7),
        // Android elevation 1.
        boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 1.5, offset: Offset(0, 0.5))],
      ),
      clipBehavior: Clip.antiAlias,
      // A Column rather than `alignment`, so the chip keeps its content's width (27..56).
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [inner]),
    );
  }
}
