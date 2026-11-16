/// Customer reviews. Port of Reviews.tsx.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? reviewsSection(SectionCtx c) {
  final s = c.settings;
  final limit = s.n('limit');
  final shown = c.data.reviews.take(limit > 0 ? limit.truncate() : 6).toList();
  if (shown.isEmpty) return null;
  final title = s.s('ratingLabel').isNotEmpty ? s.s('ratingLabel') : s.sOr('title', 'What customers say');
  void seeAll() => openLink(
        J({
          'url': s['seeAllUrl'],
          'handle': s['seeAllHandle'],
          'productId': s['seeAllProductId'],
          'screen': s['seeAllScreen'],
        }),
        c.links,
      );
  final subtitle = s.s('subtitle');
  final seeAllLabel = s.s('seeAllLabel');

  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
    Row(children: [
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
          if (title.isNotEmpty)
            Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
          if (subtitle.isNotEmpty)
            Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: const Color(0xFF64748B))),
        ]),
      ),
      if (seeAllLabel.isNotEmpty) ...[
        const SizedBox(width: Spacing.sm),
        Tap(onTap: seeAll, child: Text('$seeAllLabel ›', style: ts(12, w: 700, lh: 18, c: colors.accent))),
      ],
    ]),
    Padding(
      padding: const EdgeInsets.only(top: Spacing.sm),
      child: Bleed(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: 4),
          // The row stretches its cards to the tallest, as the RN content container does.
          child: IntrinsicHeight(
            child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              for (var i = 0; i < shown.length; i++) ...[
                if (i > 0) SizedBox(width: gap.item),
                _ReviewCard(review: shown[i]),
              ],
            ]),
          ),
        ),
      ),
    ),
  ]);
}

class _ReviewCard extends StatelessWidget {
  final J review;
  const _ReviewCard({required this.review});

  @override
  Widget build(BuildContext context) {
    final r = review;
    final rating = r.nOrNull('productRating');
    final comment = r.s('comment');
    return Container(
      width: 224,
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.line),
        borderRadius: BorderRadius.circular(Radii.lg),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Flexible(child: Text(r.s('name'), style: ts(12, w: 600, lh: 16, c: colors.ink))),
          if (r['productRating'] != null) ...[
            const SizedBox(width: Spacing.sm),
            Text('★' * math.max(0, math.min(5, (rating ?? 0).round())), style: ts(12, lh: 16, c: const Color(0xFFF59E0B))),
          ],
        ]),
        if (comment.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(comment, maxLines: 3, overflow: TextOverflow.ellipsis, style: ts(11, lh: 18, c: colors.inkMuted)),
          ),
      ]),
    );
  }
}
