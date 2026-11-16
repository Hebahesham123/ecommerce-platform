/// Image cards. Port of Cards.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// A sideways row of picture cards, each with a title and an optional line under it.
Widget? cardsSection(SectionCtx c) {
  final s = c.settings;
  final cards = s.l('items');
  if (cards.isEmpty) return null;
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
              for (var n = 0; n < cards.length; n++) ...[
                if (n > 0) SizedBox(width: gap.item),
                _Card(item: cards[n], c: c),
              ],
            ],
          ),
        ),
      ),
    ],
  );
}

class _Card extends StatelessWidget {
  final J item;
  final SectionCtx c;
  const _Card({required this.item, required this.c});

  @override
  Widget build(BuildContext context) {
    final got = inherit(item, c.data.collections);
    final image = got.image;
    final sub = item.s('subtitle');
    return Tap(
      onTap: () => openLink(item, c.links),
      child: Container(
        width: 144,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(Radii.lg),
          border: Border.all(color: colors.line),
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // RN sizes the picture 144 wide inside the card's 1px border, so it is
            // clipped to the card's inner width; filling that width is the same.
            SizedBox(
              height: 180,
              child: image != null && image.isNotEmpty
                  ? NetImage(image, fit: BoxFit.cover, background: colors.page)
                  : Container(color: colors.page),
            ),
            Padding(
              padding: const EdgeInsets.all(Spacing.sm),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    got.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: ts(12, w: 600, c: colors.ink),
                  ),
                  if (sub.isNotEmpty)
                    Text(
                      sub,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ts(10, c: colors.inkSoft),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
