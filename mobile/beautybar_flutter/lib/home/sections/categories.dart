/// Category chips. Port of Categories.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

class _Chip {
  final String key;
  final J to;
  final String title;
  final String? image;
  final String emoji;
  const _Chip({required this.key, required this.to, required this.title, this.image, this.emoji = ''});
}

/// A sideways row of pill chips, each with a small round picture or an emoji.
Widget? categoriesSection(SectionCtx c) {
  final s = c.settings;
  // The merchant's own picks when they made some; otherwise every collection,
  // which is what a store that has not curated this wants anyway.
  final picked = s
      .l('items')
      .where(
        (i) =>
            i.s('handle').isNotEmpty ||
            i.s('productId').isNotEmpty ||
            i.s('screen').isNotEmpty ||
            i.s('url').isNotEmpty,
      )
      .toList();
  final chips = picked.isNotEmpty
      ? picked.map((i) {
          final got = inherit(i, c.data.collections);
          return _Chip(key: i.s('id'), to: i, title: got.title, image: got.image, emoji: i.s('emoji'));
        }).toList()
      : c.data.collections
            .map((col) => _Chip(key: col.handle, to: J({'handle': col.handle}), title: col.title, image: col.image))
            .toList();
  if (chips.isEmpty) return null;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      SectionHeading(title: s.s('title')),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
        // RN's row stretches its items to the tallest one.
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var n = 0; n < chips.length; n++) ...[
                if (n > 0) SizedBox(width: gap.itemTight),
                KeyedSubtree(
                  key: ValueKey('${chips[n].key}#$n'),
                  child: _ChipView(chip: chips[n], c: c),
                ),
              ],
            ],
          ),
        ),
      ),
    ],
  );
}

class _ChipView extends StatelessWidget {
  final _Chip chip;
  final SectionCtx c;
  const _ChipView({required this.chip, required this.c});

  @override
  Widget build(BuildContext context) {
    final image = chip.image;
    Widget? lead;
    if (image != null && image.isNotEmpty) {
      lead = ClipOval(child: NetImage(image, width: 24, height: 24, background: colors.page));
    } else if (chip.emoji.isNotEmpty) {
      lead = Text(chip.emoji, style: ts(14, c: colors.ink));
    }
    return Tap(
      onTap: () => openLink(chip.to, c.links),
      child: Container(
        padding: const EdgeInsetsDirectional.only(start: 6, end: 12, top: 4, bottom: 4),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(Radii.pill),
          border: Border.all(color: colors.line),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (lead != null) ...[lead, const SizedBox(width: 6)],
            Text(chip.title, style: ts(12, w: 500, c: colors.inkMuted)),
          ],
        ),
      ),
    );
  }
}
