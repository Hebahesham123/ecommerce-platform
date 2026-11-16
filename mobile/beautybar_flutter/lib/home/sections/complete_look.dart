/// Complete your look. Port of CompleteLook.tsx.
///
/// What goes with the shopper's past orders. The shop does the matching; a
/// guest or a first-time shopper gets nothing back, and then this is not drawn.
library;

import 'package:flutter/widgets.dart';

import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// "{product}" becomes the piece they bought; with no piece, the line goes.
String _withProduct(String line, String? product) {
  if (!line.contains('{product}')) return line;
  if (product == null || product.isEmpty) return '';
  final short = product.length > 32 ? product.substring(0, 32).replaceFirst(RegExp(r' +[^ ]*$'), '') : product;
  return line.split('{product}').join(short);
}

Widget? completeLookSection(SectionCtx c) {
  final recs = c.recs;
  if (recs == null || recs.products.isEmpty) return null;
  final s = c.settings;
  final pairs = recs.mode != 'fallback';
  final title = pairs ? s.sOr('title', 'Complete your look') : s.sOr('fallbackTitle', 'Recommended for you');
  final subtitle = _withProduct(pairs ? s.s('subtitle') : s.s('fallbackSubtitle'), recs.basedOn);
  final products = recs.products;

  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
    if (title.isNotEmpty)
      Text(title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
    if (subtitle.isNotEmpty)
      Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: const Color(0xFF64748B))),
    Padding(
      padding: const EdgeInsets.only(top: Spacing.sm),
      child: Bleed(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: 4),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            // 148 wide, the width the preview gives a card in a sideways row.
            for (var i = 0; i < products.length; i++) ...[
              if (i > 0) SizedBox(width: gap.item),
              ProductTile(key: ValueKey(products[i].id), card: products[i], width: 148, onPress: c.onOpenProduct),
            ],
          ]),
        ),
      ),
    ),
  ]);
}
