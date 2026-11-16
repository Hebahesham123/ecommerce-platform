/// Bundle & Save. Port of BundleSave.tsx.
///
/// Buy three, the cheapest comes down.
///
/// It does not invent a total: the saving is a real discount code the shopper
/// uses at checkout, so this says the code and the checkout does the
/// arithmetic. A card that needs a size opens instead of being picked, for the
/// same reason the product cards do - guessing on her behalf is how you earn a
/// return.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart' show defaultTargetPlatform, TargetPlatform;
import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? bundleSaveSection(SectionCtx c) {
  final s = c.settings;
  final rows = c.data.rows;
  final newArrivals = c.data.newArrivals;
  final handle = s.s('handle').toLowerCase();
  // The collection chosen, else what is new, else the first row with anything
  // in it - the same order the dashboard's preview takes them in.
  List<ProductCard>? firstRow;
  for (final row in rows.values) {
    if (row.isNotEmpty) {
      firstRow = row;
      break;
    }
  }
  final List<ProductCard> pool;
  if (handle.isNotEmpty && rows.containsKey(handle)) {
    // (An empty row still wins here, as `rows[handle]` is a truthy array in JS.)
    pool = rows[handle]!;
  } else if (newArrivals.isNotEmpty) {
    pool = newArrivals;
  } else {
    pool = firstRow ?? const [];
  }
  final limit = s.n('limit');
  final cards = pool.take(limit > 0 ? limit.truncate() : 12).toList();
  if (cards.isEmpty) return null;
  return _BundleSave(settings: s, cards: cards, onOpenProduct: c.onOpenProduct, onAdd: c.onAdd);
}

class _BundleSave extends StatefulWidget {
  final J settings;
  final List<ProductCard> cards;
  final OnOpenProduct? onOpenProduct;
  final OnAdd? onAdd;
  const _BundleSave({required this.settings, required this.cards, this.onOpenProduct, this.onAdd});
  @override
  State<_BundleSave> createState() => _BundleSaveState();
}

class _BundleSaveState extends State<_BundleSave> {
  List<String> _picked = [];
  bool _added = false;
  final List<Timer> _timers = [];

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    super.dispose();
  }

  void _toggle(ProductCard card) {
    final vc = card.variantCount;
    final single = card.variantId != null && (vc == null || vc == 0 ? 1 : vc) == 1;
    if (!single) {
      widget.onOpenProduct?.call(card.id);
      return;
    }
    setState(() {
      _picked = _picked.contains(card.id) ? _picked.where((x) => x != card.id).toList() : [..._picked, card.id];
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final cards = widget.cards;
    final itemCount = s.n('itemCount');
    final want = math.max(2, itemCount > 0 ? itemCount.truncate() : 3);
    final pct = s.n('percentOff');
    final off = math.max(0, math.min(90, pct > 0 ? pct.truncate() : 10));
    final inkS = s.sOr('inkColor', '#2b1b10');
    final ink = css(inkS, const Color(0xFF2B1B10));
    // The preview writes the quieter lines in the ink at 60%.
    final inkSoft = RegExp(r'^#[0-9a-f]{6}$', caseSensitive: false).hasMatch(inkS) ? hexA(ink, '99') : ink;
    final paper = css(s.sOr('bg', '#fffaf3'), const Color(0xFFFFFAF3));
    final rr = s.n('radius');
    final r = rr != 0 ? math.max(0.0, rr) : 16.0;
    final code = s.s('code');

    // The code is what actually takes money off, so without one this section
    // claims nothing: no per cent, no saving, just a faster way to add several
    // things at once. An offer the checkout will not honour is worse than none.
    final offers = code.isNotEmpty && off > 0;
    final chosen = cards.where((c) => _picked.contains(c.id)).toList();
    final prices = chosen.map((c) => c.priceMin ?? 0).toList();
    final total = prices.fold<double>(0, (a, b) => a + b);
    final saving = offers && prices.isNotEmpty ? (prices.reduce(math.min) * off / 100).round() : 0;
    final full = _picked.length >= want;
    final onAdd = widget.onAdd;
    final enabled = full && onAdd != null;
    final photoBg = tryCss(theme.o('card').s('photoBg'));

    Widget pick(ProductCard card) {
      final on = _picked.contains(card.id);
      return Tap(
        onTap: () => _toggle(card),
        child: Container(
          width: 86,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(Radii.md),
            border: Border.all(color: on ? colors.accent : colors.line, width: on ? 2 : 1),
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(children: [
            Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              AspectRatio(
                aspectRatio: 1,
                child: card.image != null && card.image!.isNotEmpty
                    ? NetImage(card.image, fit: BoxFit.cover, background: photoBg)
                    : Container(color: photoBg),
              ),
              Padding(
                padding: const EdgeInsets.only(left: 6, right: 6, top: 4, bottom: 6),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text(shortName(withoutVendor(card.name, card.vendor), 2),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(9, lh: 11, c: const Color(0xFF64748B))),
                  Text(money(card.priceMin), style: ts(11, w: 700, lh: 16, c: ink)),
                ]),
              ),
            ]),
            if (on)
              Positioned(
                top: 4,
                right: 4,
                child: Container(
                  width: 18,
                  height: 18,
                  decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle),
                  alignment: Alignment.center,
                  child: Text('✓', style: ts(11, w: 700, c: const Color(0xFFFFFFFF))),
                ),
              ),
          ]),
        ),
      );
    }

    final rowGap = (gap.item * 0.75).roundToDouble();
    final mono = defaultTargetPlatform == TargetPlatform.iOS ? 'Menlo' : 'monospace';

    return Container(
      decoration: BoxDecoration(
        color: paper,
        border: Border.all(color: hexA(colors.accent, '33')),
        borderRadius: BorderRadius.circular(r),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        Container(
          color: hexA(colors.accent, '14'),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(children: [
            Expanded(
              child: Text(s.sOr('eyebrow', 'Bundle & save').toUpperCase(), style: ts(10, w: 700, ls: 1.8, c: colors.accent)),
            ),
            if (offers)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(999)),
                child: Text('$off% OFF', style: ts(11, w: 700, c: const Color(0xFFFFFFFF))),
              ),
          ]),
        ),
        Padding(
          padding: const EdgeInsets.only(left: 12, right: 12, top: 10, bottom: 12),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
            if (s.s('title').isNotEmpty)
              Text(s.s('title'), style: ts(17, w: 700, lh: 21, c: ink, family: titleFont, ls: titleFont != null ? -0.17 : 0)),
            Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                offers ? 'Pick $want — the cheapest comes down $off%' : 'Pick $want and add them together',
                style: ts(11, lh: 16, c: inkSoft),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Bleed(
                by: 12,
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(left: 12, right: 12, bottom: 4),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    for (var i = 0; i < cards.length; i++) ...[
                      if (i > 0) SizedBox(width: rowGap),
                      pick(cards[i]),
                    ],
                  ]),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    Text('${_picked.length} of $want picked', style: ts(11, lh: 16, c: inkSoft)),
                    if (_picked.isNotEmpty)
                      Text.rich(
                        TextSpan(children: [
                          TextSpan(text: money(total - saving)),
                          if (saving > 0)
                            TextSpan(text: '  save ${money(saving)}', style: ts(11, w: 600, c: colors.accent, lh: 22)),
                        ]),
                        style: ts(15, w: 700, lh: 22, c: ink),
                      ),
                  ]),
                ),
                const SizedBox(width: Spacing.sm),
                Tap(
                  onTap: enabled
                      ? () {
                          for (final c in chosen) {
                            if (c.variantId != null && c.variantId!.isNotEmpty) onAdd(c.variantId!, c.id);
                          }
                          setState(() => _added = true);
                          _timers.add(Timer(const Duration(milliseconds: 2200), () {
                            if (mounted) setState(() => _added = false);
                          }));
                        }
                      : null,
                  child: Opacity(
                    opacity: enabled ? 1 : 0.4,
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: _added ? const Color(0xFF4A7858) : colors.accent,
                        borderRadius: BorderRadius.circular(Radii.md),
                      ),
                      child: Text(
                        _added ? 'ADDED ✓' : s.sOr('addLabel', 'Add bundle').toUpperCase(),
                        style: ts(12, w: 700, ls: 1.44, c: const Color(0xFFFFFFFF)),
                      ),
                    ),
                  ),
                ),
              ]),
            ),
            if (code.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '${s.sOr('note', 'Use the code at checkout')}: '),
                    TextSpan(text: code, style: ts(10, w: 700, lh: 15, c: colors.accent, family: mono)),
                  ]),
                  style: ts(10, lh: 15, c: inkSoft),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}
