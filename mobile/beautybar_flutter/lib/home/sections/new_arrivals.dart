import 'package:flutter/widgets.dart';

import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// New arrivals. Generated from the dashboard — App → App theme. (Port of NewArrivals.tsx.)
Widget? newArrivalsSection(SectionCtx c) {
  final limit = c.settings.n('limit', 0);
  final shown = c.data.newArrivals.take(limit > 0 ? limit.floor() : 12).toList();
  if (shown.isEmpty) return null;
  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      SectionHeading(title: c.settings.sOr('title', 'New arrivals')),
      // Out to the screen's edges, as the editor's row runs, with the page's
      // own margin put back inside it.
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Bleed(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < shown.length; i++) ...[
                  if (i > 0) SizedBox(width: gap.item),
                  ProductTile(key: ValueKey(shown[i].id), card: shown[i], onPress: c.onOpenProduct, onAdd: c.onAdd),
                ],
              ],
            ),
          ),
        ),
      ),
    ],
  );
}
