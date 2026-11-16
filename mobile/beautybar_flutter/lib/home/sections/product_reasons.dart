/// Because you viewed. Port of ProductReasons.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? productReasonsSection(SectionCtx c) {
  final s = c.settings;
  final items = s
      .l('items')
      .where((i) => i.s('name').isNotEmpty || i.s('imageUrl').isNotEmpty || i.s('handle').isNotEmpty)
      .toList();
  if (items.isEmpty) return null;
  void go(J to) => openLink(to, c.links);
  final rv = s.n('radius');
  final r = rv > 0 ? rv : 14.0;
  // Whether the first item is shown big, above the rest.
  final featureFirst = s['featureFirst'] == true;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (s.s('title').isNotEmpty) Text(s.s('title'), style: ts(16, w: 700, c: colors.ink, family: titleFont)),
                if (s.s('subtitle').isNotEmpty) Text(s.s('subtitle'), style: ts(11, c: colors.inkSoft)),
              ],
            ),
          ),
          if (s.s('seeAllLabel').isNotEmpty) ...[
            const SizedBox(width: Spacing.sm),
            Tap(
              onTap: () => go(J({
                'url': s['seeAllUrl'],
                'handle': s['seeAllHandle'],
                'productId': s['seeAllProductId'],
                'screen': s['seeAllScreen'],
              })),
              child: Text(s.s('seeAllLabel'), style: ts(12, w: 600, c: colors.accent)),
            ),
          ],
        ],
      ),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              for (var n = 0; n < items.length; n++) ...[
                if (n > 0) SizedBox(width: gap.item),
                _ReasonCard(
                  item: items[n],
                  lead: featureFirst && n == 0,
                  radius: r,
                  collections: c.data.collections,
                  buttonLabel: s.s('buttonLabel'),
                  onGo: () => go(items[n]),
                ),
              ],
            ],
          ),
        ),
      ),
    ],
  );
}

class _ReasonCard extends StatelessWidget {
  final J item;
  final bool lead;
  final double radius;
  final List<CollectionInfo> collections;
  final String buttonLabel;
  final VoidCallback onGo;
  const _ReasonCard({
    required this.item,
    required this.lead,
    required this.radius,
    required this.collections,
    required this.buttonLabel,
    required this.onGo,
  });

  @override
  Widget build(BuildContext context) {
    final i = item;
    final borrowed = inherit(i, collections);
    final photo = i.s('imageUrl').isNotEmpty ? i.s('imageUrl') : borrowed.image;
    final shotH = lead ? 196.0 : 136.0;
    final metaText = (i.s('rating').isNotEmpty ? '* ${i.s('rating')}  ' : '') + i.s('sold');
    return Container(
      width: lead ? 236 : 166,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.line),
        borderRadius: BorderRadius.circular(radius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Tap(
            onTap: onGo,
            child: Stack(children: [
              photo != null && photo.isNotEmpty
                  ? NetImage(photo, fit: BoxFit.cover, width: double.infinity, height: shotH, background: colors.page)
                  : Container(width: double.infinity, height: shotH, color: colors.page),
              if (i.s('badge').isNotEmpty)
                Positioned(
                  top: 6,
                  right: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(4)),
                    child: Text(i.s('badge'), style: ts(10, w: 700, c: const Color(0xFFFFFFFF))),
                  ),
                ),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.all(8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (i.s('reason').isNotEmpty)
                  Text(i.s('reason'),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, w: 600, c: colors.accent)),
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(i.s('name').isNotEmpty ? i.s('name') : borrowed.title,
                      maxLines: 2, overflow: TextOverflow.ellipsis, style: ts(11, lh: 15, c: colors.ink)),
                ),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(i.s('price'), style: ts(12, w: 700, c: colors.accent)),
                      if (i.s('comparePrice').isNotEmpty) ...[
                        const SizedBox(width: 4),
                        Text(i.s('comparePrice'),
                            style: ts(10, c: colors.inkSoft, deco: TextDecoration.lineThrough)),
                      ],
                    ],
                  ),
                ),
                if (i.s('rating').isNotEmpty || i.s('sold').isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(metaText, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, c: colors.inkSoft)),
                  ),
                if (buttonLabel.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Tap(
                      onTap: onGo,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(8)),
                        child: Text(buttonLabel, style: ts(11, w: 600, c: const Color(0xFFFFFFFF))),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
