/// Info rows. Port of InfoRows.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// A list of rows: an emoji tile, a title and line under it, and a note at the end.
Widget? infoRowsSection(SectionCtx c) {
  final s = c.settings;
  final items = s.l('items').where((i) => i.s('title').isNotEmpty).toList();
  if (items.isEmpty) return null;

  final rv = s.nOrNull('radius');
  final r = rv != null && rv > 0 ? rv : 14.0;
  final bg = css(s.s('cardBg'), colors.surface);
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
      for (var n = 0; n < items.length; n++) ...[
        if (n > 0) SizedBox(height: gap.itemTight),
        _Row(i: items[n], c: c, bg: bg, r: r),
      ],
    ],
  );
}

class _Row extends StatelessWidget {
  final J i;
  final SectionCtx c;
  final Color bg;
  final double r;
  const _Row({required this.i, required this.c, required this.bg, required this.r});

  @override
  Widget build(BuildContext context) {
    final emoji = i.s('emoji');
    final sub = i.s('subtitle');
    final note = i.s('note');
    return Tap(
      onTap: () => openLink(i, c.links),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(r),
          border: Border.all(color: colors.line),
        ),
        child: Row(
          children: [
            if (emoji.isNotEmpty) ...[
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: hexA(colors.accent, '1f'),
                  borderRadius: BorderRadius.circular(Radii.sm),
                ),
                child: Text(emoji, style: ts(16, lh: 24, c: colors.ink)),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    i.s('title'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ts(12, lh: 18, w: 700, c: colors.ink),
                  ),
                  if (sub.isNotEmpty)
                    Text(
                      sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ts(11, lh: 16, c: const Color(0xFF64748B)),
                    ),
                ],
              ),
            ),
            if (note.isNotEmpty) ...[
              const SizedBox(width: 12),
              Text(note, style: ts(11, lh: 16, w: 600, c: colors.accent)),
            ],
          ],
        ),
      ),
    );
  }
}
