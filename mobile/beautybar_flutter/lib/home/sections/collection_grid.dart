/// Collection grid. Port of CollectionGrid.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

const int _allRowsCap = 8;

/// One collection's products as a wrapping grid of 168-wide cards - or, with
/// no collection chosen, a grid for each collection.
///
/// Null when none of them has a product to show (RN draws an empty fragment,
/// which the home screen then leaves out).
Widget? collectionGridSection(SectionCtx c) {
  final s = c.settings;
  final handle = s.s('handle');
  final end = _limit(s, 6);
  final targets = handle.isNotEmpty
      ? c.data.collections.where((col) => col.handle == handle).toList()
      : c.data.collections.take(_allRowsCap).toList();

  final blocks = <Widget>[];
  for (final col in targets) {
    final products = _slice(c.data.rows[col.handle] ?? const <ProductCard>[], end);
    if (products.isEmpty) continue;
    blocks.add(
      Column(
        key: ValueKey(col.handle),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          SectionHeading(
            title: handle.isNotEmpty ? s.sOr('title', col.title) : col.title,
            onSeeAll: () => c.onOpenCollection?.call(col.handle),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
            // flexWrap + space-between + gap: as many 168 cards as fit with the
            // gap between them, a lone one in a line sitting at its start.
            child: Wrap(
              alignment: WrapAlignment.spaceBetween,
              spacing: gap.item,
              runSpacing: gap.item,
              children: [
                for (final p in products)
                  ProductTile(key: ValueKey(p.id), card: p, width: 168, onPress: c.onOpenProduct),
              ],
            ),
          ),
        ],
      ),
    );
  }
  if (blocks.isEmpty) return null;
  return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: blocks);
}

/// `settings.limit ?? fallback`, as JS `slice` would then read it.
double _limit(J s, double fallback) {
  final v = s['limit'];
  if (v == null) return fallback;
  if (v is num) return v.toDouble();
  if (v is bool) return v ? 1 : 0;
  if (v is String) return v.trim().isEmpty ? 0 : (double.tryParse(v.trim()) ?? double.nan);
  return double.nan;
}

/// JS `list.slice(0, end)`: NaN reads as 0, a negative end counts from the back.
List<T> _slice<T>(List<T> list, double end) {
  if (end.isNaN) return const [];
  var e = end.isInfinite ? (end > 0 ? list.length : 0) : end.truncate();
  if (e < 0) e = list.length + e;
  if (e <= 0) return const [];
  return list.take(e).toList();
}
