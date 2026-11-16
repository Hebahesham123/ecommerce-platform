/// Split any price. Port of PriceSlider.tsx.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

const _slate = Color(0xFF64748B);
const _dark = Color(0xFF334155);

/// "16,000": the rounded number with thousands commas.
String _nf(num n) {
  final digits = n.round().toString();
  final out = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) out.write(',');
    out.write(digits[i]);
  }
  return out.toString();
}

/// JavaScript parseInt(text, 10): the leading whole number, or null.
int? _parseInt(String text) {
  final m = RegExp(r'^\s*([+-]?\d+)').firstMatch(text);
  return m == null ? null : int.tryParse(m.group(1)!);
}

/// Math.max(1, parseInt(months, 10) || 1)
int _months(J i) {
  final p = _parseInt(i.s('months'));
  return math.max(1, p == null || p == 0 ? 1 : p);
}

Widget? priceSliderSection(SectionCtx c) {
  final items = c.settings.l('items').where((i) => i.s('name').isNotEmpty && i.s('months').isNotEmpty).toList();
  if (items.isEmpty) return null;
  return _PriceSlider(settings: c.settings, items: items);
}

class _PriceSlider extends StatefulWidget {
  final J settings;
  final List<J> items;
  const _PriceSlider({required this.settings, required this.items});
  @override
  State<_PriceSlider> createState() => _PriceSliderState();
}

class _PriceSliderState extends State<_PriceSlider> {
  late int _price;
  /// Which plan is being read, and the rest as marks under it.
  ///
  /// One at a time, with the others as their own logos underneath, is the
  /// same information in a third of the height: tap a mark and it takes the
  /// place of the one above.
  int _pick = 0;
  double _width = 0;

  J get s => widget.settings;

  int get _min {
    final v = s.n('minPrice');
    return v > 0 ? v.truncate() : 2999;
  }

  int get _max {
    final v = s.n('maxPrice');
    return math.max(_min + 1, v > 0 ? v.truncate() : 16000);
  }

  @override
  void initState() {
    super.initState();
    final v = s.n('startPrice');
    _price = math.min(_max, math.max(_min, v > 0 ? v.truncate() : 7750));
  }

  // Core React Native has no slider; the track is its own responder, so the
  // touch's x is already relative to it.
  void _setFromX(double x) {
    if (_width <= 0) return;
    final ratio = (x / _width).clamp(0.0, 1.0);
    setState(() => _price = (_min + ratio * (_max - _min)).round());
  }

  @override
  Widget build(BuildContext context) {
    final items = widget.items;
    final min = _min, max = _max;
    final price = _price;
    final cur = s.sOr('currency', 'EGP');
    final at = math.min(_pick, math.max(0, items.length - 1));
    final lead = items[at];
    final rest = [for (var n = 0; n < items.length; n++) if (n != at) items[n]];
    final rv = s.n('radius');
    final r = rv > 0 ? rv : 14.0;
    final pct = (((price - min) / (max - min)) * 100).clamp(0.0, 100.0);
    int perMonth(J i) => (price / _months(i)).round();

    // Four to a row is the ceiling, not the target. A short last row keeps
    // its columns, as the preview's grid does.
    final cols = math.min(4, math.max(1, rest.length));
    final markRows = <List<J>>[];
    for (var n = 0; n < rest.length; n += cols) {
      markRows.add(rest.sublist(n, math.min(rest.length, n + cols)));
    }

    final track = LayoutBuilder(builder: (context, box) {
      _width = box.maxWidth;
      final w = box.maxWidth;
      final fillW = w * pct / 100;
      return GestureDetector(
        behavior: HitTestBehavior.opaque,
        onPanDown: (d) => _setFromX(d.localPosition.dx),
        onPanUpdate: (d) => _setFromX(d.localPosition.dx),
        child: SizedBox(
          height: 24,
          width: w,
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned(
              left: 0,
              right: 0,
              top: 10,
              height: 4,
              child: Container(
                  decoration: BoxDecoration(color: const Color(0xFFE5E7EB), borderRadius: BorderRadius.circular(2))),
            ),
            Positioned(
              left: 0,
              top: 10,
              height: 4,
              width: fillW,
              child: Container(decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(2))),
            ),
            Positioned(
              left: fillW - 8,
              top: 4,
              width: 16,
              height: 16,
              child: Container(decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle)),
            ),
          ]),
        ),
      );
    });

    final card = Container(
      margin: const EdgeInsets.only(top: Spacing.sm),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: css(s.s('cardBg'), colors.surface),
        border: Border.all(color: colors.line),
        borderRadius: BorderRadius.circular(r),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (s.s('priceLabel').isNotEmpty) Text(s.s('priceLabel'), style: ts(11, lh: 16, c: _slate)),
          Text('$cur ${_nf(price)}', style: ts(20, w: 700, lh: 30, c: colors.accent)),
          // The browser's range: marginTop 4, marginBottom -4, 24 tall so a
          // thumb can find it.
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: SizedBox(
              height: 20,
              child: OverflowBox(
                alignment: Alignment.topCenter,
                minHeight: 24,
                maxHeight: 24,
                child: track,
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('$cur ${_nf(min)}', style: ts(10, lh: 15, c: _slate)),
              Text('$cur ${_nf(max)}', style: ts(10, lh: 15, c: _slate)),
            ],
          ),
          const SizedBox(height: 10),
          _LeadRow(item: lead, cur: cur, price: price),
          for (final line in markRows) ...[
            SizedBox(height: gap.itemTight),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var k = 0; k < cols; k++) ...[
                    if (k > 0) const SizedBox(width: 6),
                    Expanded(
                      child: k < line.length
                          ? _Mark(
                              item: line[k],
                              perMonth: perMonth(line[k]),
                              onTap: () => setState(() => _pick = items.indexOf(line[k])),
                            )
                          : const SizedBox.shrink(),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ],
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (s.s('title').isNotEmpty)
          Text(s.s('title'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
        if (s.s('subtitle').isNotEmpty) Text(s.s('subtitle'), style: ts(11, lh: 16, c: _slate)),
        card,
      ],
    );
  }
}

class _LeadRow extends StatelessWidget {
  final J item;
  final String cur;
  final int price;
  const _LeadRow({required this.item, required this.cur, required this.price});

  @override
  Widget build(BuildContext context) {
    final i = item;
    final months = _months(i);
    final tone = css(i.s('color'), colors.accent);
    final perks = i.s('perks').split(RegExp(r'[·,|]')).map((p) => p.trim()).where((p) => p.isNotEmpty).toList();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(border: Border.all(color: colors.line), borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          SizedBox(
            width: 56,
            height: 36,
            child: Center(
              child: i.s('logo').isNotEmpty
                  ? Semantics(label: i.s('name'), child: NetImage(i.s('logo'), fit: BoxFit.contain, width: 56, height: 36))
                  : SizedBox(
                      width: 56,
                      child: Text(i.s('name'),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, w: 600, c: _dark)),
                    ),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '$cur ${_nf((price / months).round())}'),
                    TextSpan(text: ' / month', style: ts(10, w: 500, c: _slate)),
                  ]),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: ts(13, w: 700, lh: 19, c: colors.accent),
                ),
                Text('$months months', style: ts(10, lh: 15, c: _slate)),
                if (perks.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        for (final p in perks)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                            decoration: BoxDecoration(color: hexA(tone, '14'), borderRadius: BorderRadius.circular(999)),
                            child: Text(p, style: ts(9, w: 600, lh: 13, c: tone)),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
          if (i.s('badge').isNotEmpty) ...[
            const SizedBox(width: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(color: hexA(tone, '1f'), borderRadius: BorderRadius.circular(999)),
              child: Text(i.s('badge'), style: ts(9, w: 600, lh: 13, c: tone)),
            ),
          ],
        ],
      ),
    );
  }
}

class _Mark extends StatelessWidget {
  final J item;
  final int perMonth;
  final VoidCallback onTap;
  const _Mark({required this.item, required this.perMonth, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final i = item;
    return Semantics(
      label: i.s('name'),
      button: true,
      child: Tap(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          decoration: BoxDecoration(
            color: colors.surface,
            border: Border.all(color: colors.line),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              SizedBox(
                height: 16,
                width: double.infinity,
                child: Center(
                  child: i.s('logo').isNotEmpty
                      ? NetImage(i.s('logo'), fit: BoxFit.contain, width: double.infinity, height: 16)
                      : Text(i.s('name'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: ts(9, w: 700, lh: 13, c: _dark)),
                ),
              ),
              const SizedBox(height: 2),
              Text.rich(
                TextSpan(children: [
                  TextSpan(text: _nf(perMonth)),
                  TextSpan(text: '/mo', style: ts(9, w: 500, lh: 13, c: _slate).copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
                ]),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: ts(9, w: 600, lh: 13, c: _slate).copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
