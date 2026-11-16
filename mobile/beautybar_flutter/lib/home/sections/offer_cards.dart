/// Offers for you. Port of OfferCards.tsx.
library;

import 'dart:ui' show PathMetric;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? offerCardsSection(SectionCtx c) {
  final s = c.settings;
  final items = s.l('items').where((i) => i.s('badge').isNotEmpty || i.s('title').isNotEmpty).toList();
  if (items.isEmpty) return null;
  final rv = s.n('radius');
  final r = rv > 0 ? rv : 14.0;
  final claim = s.sOr('claimLabel', 'Claim');

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (s.s('title').isNotEmpty) SectionHeading(title: s.s('title')),
      if (s.s('subtitle').isNotEmpty)
        Text(s.s('subtitle'), style: ts(11, lh: 16.5, c: const Color(0xFF64748B))),
      // Bleeds to the screen edge like the editor's row, so a card can scroll
      // past the page padding instead of being cut at it.
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Bleed(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(Spacing.lg, 0, Spacing.lg, Spacing.xs),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var n = 0; n < items.length; n++) ...[
                    if (n > 0) SizedBox(width: gap.item),
                    _OfferCard(item: items[n], radius: r, claim: claim, links: c.links),
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

class _OfferCard extends StatelessWidget {
  final J item;
  final double radius;
  final String claim;
  final LinkHandlers links;
  const _OfferCard({required this.item, required this.radius, required this.claim, required this.links});

  @override
  Widget build(BuildContext context) {
    final colour = css(item.s('color'), colors.accent);
    final parts = <Widget>[
      if (item.s('badge').isNotEmpty) Text(item.s('badge'), style: ts(20, w: 700, lh: 20, c: colour)),
      if (item.s('title').isNotEmpty) Text(item.s('title'), style: ts(11, w: 700, lh: 16.5, c: colors.ink)),
      if (item.s('subtitle').isNotEmpty) Text(item.s('subtitle'), style: ts(10, lh: 13.75, c: const Color(0xFF64748B))),
      if (claim.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Tap(
            onTap: () => openLink(item, links),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 6),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colour, borderRadius: BorderRadius.circular(8)),
              child: Text(claim, style: ts(11, w: 600, lh: 16.5, c: const Color(0xFFFFFFFF))),
            ),
          ),
        ),
    ];
    return SizedBox(
      width: 152,
      child: CustomPaint(
        foregroundPainter: _DashedRRect(color: colour, radius: radius),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: hexA(colour, '0f'), borderRadius: BorderRadius.circular(radius)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var n = 0; n < parts.length; n++) ...[
                if (n > 0) const SizedBox(height: 4),
                parts[n],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// A dashed rounded border (RN `borderStyle: "dashed"`), drawn over its child.
class _DashedRRect extends CustomPainter {
  final Color color;
  final double radius;
  double get width => 1;
  const _DashedRRect({required this.color, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    final rect = (Offset.zero & size).deflate(width / 2);
    final rr = (radius - width / 2).clamp(0.0, 9999.0);
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(rr)));
    final dash = 3 * width;
    for (final PathMetric m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, d + dash), paint);
        d += dash * 2;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRect old) => old.color != color || old.radius != radius || old.width != width;
}
