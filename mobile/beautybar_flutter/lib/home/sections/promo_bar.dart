import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../section.dart';

/// Offer bar. Generated from the dashboard — App → App theme. (Port of PromoBar.tsx.)
Widget? promoBarSection(SectionCtx c) {
  final lead = c.settings.s('lead');
  final rest = c.settings.s('rest');
  final code = c.settings.s('code');
  if (lead.isEmpty && code.isEmpty) return null;
  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
    decoration: BoxDecoration(color: hexA(colors.accent, '14'), borderRadius: BorderRadius.circular(Radii.lg)),
    child: Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              if (lead.isNotEmpty)
                Text(lead, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(12, w: 700, c: colors.accent)),
              if (rest.isNotEmpty)
                Text(rest, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(10, c: colors.inkSoft)),
            ],
          ),
        ),
        if (code.isNotEmpty) ...[
          const SizedBox(width: Spacing.sm),
          CustomPaint(
            painter: _DashedBorder(color: colors.accent, radius: Radii.sm),
            child: Padding(
              // The 1px border, then 8 across and 4 down.
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
              child: Text(code, style: ts(11, w: 700, c: colors.accent)),
            ),
          ),
        ],
      ],
    ),
  );
}

/// borderStyle "dashed": a 1px rounded outline, 3px on and 3px off (Android's dash).
class _DashedBorder extends CustomPainter {
  final Color color;
  final double radius;
  const _DashedBorder({required this.color, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final rect = RRect.fromRectAndRadius((Offset.zero & size).deflate(0.5), Radius.circular(radius - 0.5));
    final path = Path()..addRRect(rect);
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, d + 3), paint);
        d += 6;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedBorder old) => old.color != color || old.radius != radius;
}
