/// Price tiers. Port of Tiers.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// "Under 500", "Under 1,000"... as cards in two columns.
Widget? tiersSection(SectionCtx c) {
  final s = c.settings;
  final tiers = s.l('items');
  if (tiers.isEmpty) return null;
  final cardBg = css(s.sOr('cardBg', '#fffaf3'), const Color(0xFFFFFAF3));
  final line = css(s.sOr('lineColor', '#e7d8c4'), const Color(0xFFE7D8C4));
  final ink = css(s.sOr('inkColor', '#2b1b10'), const Color(0xFF2B1B10));
  final muted = css(s.sOr('mutedColor', '#8a6e57'), const Color(0xFF8A6E57));
  // Two columns, as the preview's grid draws them: rows of two, the last one
  // keeping its half rather than stretching across.
  final pairs = <List<J>>[];
  for (var n = 0; n < tiers.length; n += 2) {
    pairs.add(tiers.sublist(n, n + 2 > tiers.length ? tiers.length : n + 2));
  }
  final title = s.s('title');
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (title.isNotEmpty)
        Text(
          title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: ts(16, lh: 24, w: 700, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4),
        ),
      const SizedBox(height: Spacing.sm),
      for (var row = 0; row < pairs.length; row++) ...[
        if (row > 0) SizedBox(height: gap.itemTight),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var k = 0; k < pairs[row].length; k++) ...[
                if (k > 0) SizedBox(width: gap.itemTight),
                Expanded(
                  child: _Tier(t: pairs[row][k], c: c, bg: cardBg, line: line, ink: ink, muted: muted),
                ),
              ],
              if (pairs[row].length < 2) ...[SizedBox(width: gap.itemTight), const Expanded(child: SizedBox())],
            ],
          ),
        ),
      ],
    ],
  );
}

class _Tier extends StatelessWidget {
  final J t;
  final SectionCtx c;
  final Color bg, line, ink, muted;
  const _Tier({
    required this.t,
    required this.c,
    required this.bg,
    required this.line,
    required this.ink,
    required this.muted,
  });

  @override
  Widget build(BuildContext context) {
    final prefix = t.s('prefix');
    return Tap(
      onTap: () => openLink(t, c.links),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: line),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (prefix.isNotEmpty) Text(prefix.toUpperCase(), style: ts(9, lh: 13, ls: 1.62, w: 600, c: muted)),
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                t.s('amount'),
                style: ts(19, lh: 21, w: 700, c: ink, family: titleFont, ls: titleFont != null ? -0.19 : 0),
              ),
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Container(margin: const EdgeInsets.only(top: 8), height: 1, width: 24, color: colors.accent),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                t.s('label'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ts(11, lh: 16, c: muted),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
