/// Rating summary. Port of ReviewSummary.tsx.
///
/// The average, its stars, the count and a bar per star, as on the website.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';

Widget? reviewSummarySection(SectionCtx c) {
  final s = c.settings;
  if (s.s('average').isEmpty && s.s('heading').isEmpty && s.s('headingItalic').isEmpty) return null;
  return _ReviewSummary(settings: s, links: c.links);
}

/// JS `Number(v) || 0`.
double _num0(dynamic v) {
  double n;
  if (v is num) {
    n = v.toDouble();
  } else if (v is bool) {
    n = v ? 1 : 0;
  } else if (v is String) {
    final t = v.trim();
    n = t.isEmpty ? 0 : (double.tryParse(t) ?? double.nan);
  } else {
    n = double.nan;
  }
  return n.isNaN ? 0 : n;
}

/// A number the way JS prints it: 80, 12.5.
String _jsStr(double v) => v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

/// The heading and the big number are always in the serif, as on the website.
String get _serif => defaultTargetPlatform == TargetPlatform.iOS ? 'Georgia' : 'serif';

const _hairline = Color(0x21452E1F); // rgba(69,46,31,0.13)

class _ReviewSummary extends StatefulWidget {
  final J settings;
  final LinkHandlers links;
  const _ReviewSummary({required this.settings, required this.links});
  @override
  State<_ReviewSummary> createState() => _ReviewSummaryState();
}

class _ReviewSummaryState extends State<_ReviewSummary> with SingleTickerProviderStateMixin {
  late final AnimationController _grow = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
    value: widget.settings['animate'] == false ? 1 : 0,
  );
  Timer? _delay;

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void didUpdateWidget(covariant _ReviewSummary old) {
    super.didUpdateWidget(old);
    if ((old.settings['animate'] == false) != (widget.settings['animate'] == false)) _run();
  }

  void _run() {
    _delay?.cancel();
    if (widget.settings['animate'] == false) return;
    _delay = Timer(const Duration(milliseconds: 150), () {
      if (mounted) _grow.animateTo(1, curve: const Cubic(0.19, 1, 0.22, 1));
    });
  }

  @override
  void dispose() {
    _delay?.cancel();
    _grow.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    void go() => openLink(s, widget.links);
    Color col(String key, String fb, int argb) => css(s.sOr(key, fb), Color(argb));
    final star = col('starColor', '#c9a227', 0xFFC9A227);
    final track = col('barTrack', '#e5dbcd', 0xFFE5DBCD);
    final brown = col('brownColor', '#684329', 0xFF684329);
    final caramel = col('accentColor', '#9d6540', 0xFF9D6540);
    final ink = col('inkColor', '#211a15', 0xFF211A15);
    final muted = col('mutedColor', '#74685e', 0xFF74685E);
    final filled = math.max(0, math.min(5, _num0(s['average']).floor()));
    double pct(int n) => math.max(0.0, math.min(100.0, _num0(s['pct$n'])));
    final count = [s.s('reviewCount'), s.s('reviewsWord')].where((x) => x.isNotEmpty).join(' ');
    final rad = s.n('radius');
    final r = rad > 0 ? rad : 18.0;
    final avgN = s.n('avgSize');
    final avgSize = avgN > 0 ? avgN : 58.0;
    final panelFrom = col('panelFrom', '#fdf9f3', 0xFFFDF9F3);
    final panelTo = col('panelTo', '#f3e9db', 0xFFF3E9DB);
    final barTo = s.s('barTo').isNotEmpty ? css(s.s('barTo'), caramel) : caramel;
    final barFrom = col('barFrom', '#c9a227', 0xFFC9A227);
    final eyebrow = s.s('eyebrow');
    final heading = s.s('heading');
    final italic = s.s('headingItalic');
    final average = s.s('average');
    final trust = s.s('trustNote');
    final button = s.s('buttonLabel');

    Widget rule() => Opacity(opacity: 0.5, child: Container(width: 34, height: 1, color: caramel));

    final card = Tap(
      onTap: go,
      child: Container(
        margin: const EdgeInsets.only(top: 20),
        decoration: BoxDecoration(color: panelFrom, border: Border.all(color: _hairline), borderRadius: BorderRadius.circular(r)),
        clipBehavior: Clip.antiAlias,
        child: Stack(children: [
          Positioned.fill(child: Fade(angle: 160, colors: [panelFrom, panelTo], borderRadius: BorderRadius.circular(r))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 22),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Container(
                padding: const EdgeInsets.only(bottom: 16),
                decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _hairline))),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (average.isNotEmpty)
                    Text(average,
                        textAlign: TextAlign.center,
                        style: ts(avgSize, w: 600, c: ink, lh: avgSize, ls: -avgSize * 0.01, family: _serif)),
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      for (var i = 0; i < 5; i++) ...[
                        if (i > 0) const SizedBox(width: 3),
                        _StarMark(size: 16, color: i < filled ? star : track),
                      ],
                    ]),
                  ),
                  if (count.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(count, style: ts(11.5, lh: 17, c: muted)),
                    ),
                  if (trust.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Row(mainAxisSize: MainAxisSize.min, children: [
                        Svg(
                            '<path d="M4 12l5 5L20 6" stroke="${sc(caramel)}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
                            size: 11,
                            rootAttrs: 'fill="none"'),
                        const SizedBox(width: 6),
                        Flexible(child: Text(trust.toUpperCase(), style: ts(9.5, w: 600, lh: 14, ls: 1.14, c: caramel))),
                      ]),
                    ),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  for (final n in const [5, 4, 3, 2, 1]) ...[
                    if (n != 5) const SizedBox(height: 7),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Row(children: [
                        SizedBox(width: 10, child: Text('$n', style: ts(11.5, w: 600, lh: 17, c: ink))),
                        const SizedBox(width: 10),
                        _StarMark(size: 12, color: star),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              height: 7,
                              color: track,
                              alignment: Alignment.centerLeft,
                              child: AnimatedBuilder(
                                animation: _grow,
                                builder: (_, child) => FractionallySizedBox(
                                  widthFactor: (pct(n) / 100 * _grow.value).clamp(0.0, 1.0),
                                  heightFactor: 1,
                                  child: child,
                                ),
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(20),
                                  child: Container(
                                    color: barTo,
                                    child: Fade(angle: 90, colors: [barFrom, barTo]),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        SizedBox(
                          width: 32,
                          child: Text('${_jsStr(pct(n))}%', textAlign: TextAlign.right, style: ts(11, lh: 16, c: muted)),
                        ),
                      ]),
                    ),
                  ],
                ]),
              ),
            ]),
          ),
        ]),
      ),
    );

    final body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      if (eyebrow.isNotEmpty)
        Row(mainAxisAlignment: MainAxisAlignment.center, children: [
          rule(),
          const SizedBox(width: 12),
          Flexible(child: Text(eyebrow.toUpperCase(), style: ts(10.5, w: 600, lh: 16, ls: 2.52, c: brown))),
          const SizedBox(width: 12),
          rule(),
        ]),
      if (heading.isNotEmpty || italic.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 12),
          child: Text.rich(
            TextSpan(children: [
              TextSpan(text: heading.isNotEmpty ? '$heading ' : ''),
              if (italic.isNotEmpty)
                TextSpan(text: italic, style: ts(28, w: 500, lh: 35, ls: -0.28, c: caramel, italic: true, family: _serif)),
            ]),
            textAlign: TextAlign.center,
            style: ts(28, w: 600, lh: 35, ls: -0.28, c: ink, family: _serif),
          ),
        ),
      card,
      if (button.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 20),
          child: Center(
            child: Tap(
              onTap: go,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 26, vertical: 13),
                decoration: BoxDecoration(color: brown, borderRadius: BorderRadius.circular(100)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  Text(button.toUpperCase(), style: ts(10.5, w: 700, lh: 16, ls: 1.89, c: const Color(0xFFFFFFFF))),
                  const SizedBox(width: 8),
                  const Svg(
                      '<path d="M5 12h14M13 6l6 6-6 6" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
                      size: 14,
                      rootAttrs: 'fill="none"'),
                ]),
              ),
            ),
          ),
        ),
    ]);

    final bg = s.s('bg');
    if (bg.isEmpty) return body;
    return Bleed(
      child: Container(
        color: css(bg),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        child: body,
      ),
    );
  }
}

/// The star the preview draws, as a shape rather than a glyph, so it is the same size on every phone.
class _StarMark extends StatelessWidget {
  final double size;
  final Color color;
  const _StarMark({required this.size, required this.color});
  @override
  Widget build(BuildContext context) => Svg(
      '<path d="M12 2l2.9 6.26 6.85.72-5.1 4.6 1.44 6.72L12 16.9l-6.09 3.4 1.44-6.72-5.1-4.6 6.85-.72z" fill="${sc(color)}"/>',
      size: size);
}
