import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../section.dart';

/// Free delivery bar. Generated from the dashboard — App → App theme. (Port of ShippingGoal.tsx.)
Widget? shippingGoalSection(SectionCtx c) {
  final s = c.settings;
  final title = s.s('title');
  final subtitle = s.s('subtitle');
  if (title.isEmpty && subtitle.isEmpty) return null;
  // Only a real number counts (typeof === "number"); anything else is a full bar.
  final raw = s['percent'];
  final double pct = (raw is num ? raw.toDouble() : 100.0).clamp(0.0, 100.0);
  final r = s.n('radius', 0) > 0 ? s.n('radius') : 14.0;
  final startLabel = s.s('startLabel');
  final endLabel = s.s('endLabel');
  return Container(
    padding: const EdgeInsets.all(Spacing.md),
    decoration: BoxDecoration(
      color: css(s.s('cardBg'), colors.surface),
      borderRadius: BorderRadius.circular(r),
      border: Border.all(color: colors.line),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (title.isNotEmpty) Text(title, style: ts(12, w: 700, c: colors.ink)),
        if (subtitle.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(subtitle, style: ts(11, lh: 16, c: colors.inkSoft)),
          ),
        Padding(
          padding: const EdgeInsets.only(top: Spacing.sm),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Container(
              height: 8,
              color: colors.page,
              alignment: Alignment.centerLeft,
              child: FractionallySizedBox(
                widthFactor: pct / 100,
                child: Container(
                  height: 8,
                  decoration: BoxDecoration(
                    color: css(s.s('barColor'), colors.accent),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
        ),
        if (startLabel.isNotEmpty || endLabel.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(startLabel, style: ts(10, c: colors.inkSoft)),
                Text(endLabel, style: ts(10, c: colors.inkSoft)),
              ],
            ),
          ),
      ],
    ),
  );
}
