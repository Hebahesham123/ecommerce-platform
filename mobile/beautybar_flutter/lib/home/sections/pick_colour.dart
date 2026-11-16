/// Pick a colour. Port of PickColour.tsx.
library;

import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;
import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? pickColourSection(SectionCtx c) {
  final s = c.settings;
  final items = s.l('items').where((i) => i.s('color').isNotEmpty).toList();
  if (items.isEmpty) return null;
  void go(J to) => openLink(to, c.links);
  if (s.s('style') == 'palette') return _Palette(settings: s, items: items, go: go);
  final sv = s.n('size');
  final size = sv > 0 ? sv : 44.0;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      if (s.s('title').isNotEmpty) SectionHeading(title: s.s('title')),
      if (s.s('subtitle').isNotEmpty) Text(s.s('subtitle'), style: ts(11, lh: 16.5, c: const Color(0xFF64748B))),
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Bleed(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(Spacing.lg, 0, Spacing.lg, Spacing.xs),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var n = 0; n < items.length; n++) ...[
                  if (n > 0) SizedBox(width: gap.item),
                  Tap(
                    onTap: () => go(items[n]),
                    child: SizedBox(
                      width: size + 16,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: size,
                            height: size,
                            decoration: BoxDecoration(
                              color: css(items[n].s('color')),
                              borderRadius: BorderRadius.circular((size / 2).roundToDouble()),
                              border: Border.all(color: colors.line),
                            ),
                          ),
                          if (items[n].s('label').isNotEmpty) ...[
                            const SizedBox(height: 4),
                            SizedBox(
                              width: double.infinity,
                              child: Text(items[n].s('label'),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  textAlign: TextAlign.center,
                                  style: ts(10, lh: 15, c: colors.inkMuted)),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

/// `typeof v === "number" && v > 0 ? v : fallback`
double _num(J s, String key, double fallback) {
  final v = s[key];
  return v is num && v > 0 ? v.toDouble() : fallback;
}

/// The palette is always set in a serif, whatever the app's own titles use - as on the website.
String get _serif => defaultTargetPlatform == TargetPlatform.iOS ? 'Georgia' : 'serif';

/// Shop by palette: the website's section - photo cards with a swatch on their edge.
class _Palette extends StatelessWidget {
  final J settings;
  final List<J> items;
  final void Function(J to) go;
  const _Palette({required this.settings, required this.items, required this.go});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    final ink = css(s.s('inkColor'), const Color(0xFF211A15));
    final muted = css(s.s('mutedColor'), const Color(0xFF74685E));
    final caramel = css(s.s('accentColor'), const Color(0xFF9D6540));
    final line = css(s.s('lineColor'), const Color(0xFFE0D4C4));
    final r = _num(s, 'radius', 12);
    final h = _num(s, 'imageHeight', 104);
    final w = _num(s, 'cardWidth', 0);
    final sw = _num(s, 'swatchSize', 22);
    final half = (sw / 2).roundToDouble();
    final titleSize = _num(s, 'titleSize', 28);
    final link = s.sOr('linkLabel', 'Shop now');
    final pill = J({
      'handle': s['pillHandle'],
      'url': s['pillUrl'],
      'productId': s['pillProductId'],
      'screen': s['pillScreen'],
    });
    final cardBg = css(s.s('cardBg'), const Color(0xFFFFFDFA));

    Widget card(J i) {
      final swatch = css(i.s('color'), line);
      final lines = [i.s('line1'), i.s('line2')].where((t) => t.isNotEmpty).join('\n');
      return Tap(
        onTap: () => go(i),
        child: Container(
          decoration: BoxDecoration(
            color: cardBg,
            borderRadius: BorderRadius.circular(r),
            border: Border.all(color: line),
            boxShadow: [rnShadow(color: const Color(0xFF211A15), opacity: 0.06, radius: 4, offset: const Offset(0, 2))],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(r - 1 < 0 ? 0 : r - 1),
                  topRight: Radius.circular(r - 1 < 0 ? 0 : r - 1),
                ),
                child: i.s('imageUrl').isNotEmpty
                    ? NetImage(i.s('imageUrl'), fit: BoxFit.cover, width: double.infinity, height: h)
                    : Container(width: double.infinity, height: h, color: swatch),
              ),
              // The swatch sits half on the photo, ringed in the card's cream; the
              // ring is outside the swatch, so the colour keeps its full size.
              // (RN: marginTop -half-2, marginBottom -2.)
              SizedBox(
                height: sw - half,
                child: Stack(clipBehavior: Clip.none, children: [
                  Positioned(
                    top: -half - 2,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: sw + 4,
                        height: sw + 4,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: const Color(0xFFFFFDFA),
                          shape: BoxShape.circle,
                          boxShadow: [rnShadow(color: const Color(0xFF000000), opacity: 0.18, radius: 3, offset: const Offset(0, 2))],
                        ),
                        child: Container(
                          width: sw,
                          height: sw,
                          decoration: BoxDecoration(color: swatch, shape: BoxShape.circle),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(4, 6, 4, 8),
                  child: Column(
                    children: [
                      if (i.s('label').isNotEmpty)
                        Text(i.s('label').toUpperCase(),
                            textAlign: TextAlign.center,
                            style: ts(8.5, w: 400, lh: 10.6, ls: 0.68, c: ink, family: _serif)),
                      if (lines.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(lines, textAlign: TextAlign.center, style: ts(7.5, lh: 10.3, c: muted)),
                        ),
                      const Spacer(),
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(link.toUpperCase(),
                            textAlign: TextAlign.center,
                            style: ts(7, w: 700, lh: 10.5, ls: 0.56, c: ink, deco: TextDecoration.underline)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final Widget cards = w > 0
        ? Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Bleed(
              by: Spacing.sm,
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(Spacing.sm, 0, Spacing.sm, Spacing.xs),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var n = 0; n < items.length; n++) ...[
                        if (n > 0) const SizedBox(width: 6),
                        SizedBox(width: w, child: card(items[n])),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          )
        : Padding(
            padding: const EdgeInsets.only(top: 16),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var n = 0; n < items.length; n++) ...[
                    if (n > 0) const SizedBox(width: 5),
                    Expanded(child: card(items[n])),
                  ],
                ],
              ),
            ),
          );

    return Bleed(
      child: Container(
        color: css(s.s('bg'), const Color(0xFFF6F0E8)),
        padding: const EdgeInsets.symmetric(horizontal: Spacing.sm, vertical: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (s.s('eyebrow').isNotEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: Spacing.sm),
                child: Text(s.s('eyebrow').toUpperCase(),
                    textAlign: TextAlign.center, style: ts(10, w: 600, lh: 15, ls: 2.2, c: caramel)),
              ),
            if (s.s('title').isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(Spacing.sm, 6, Spacing.sm, 0),
                child: Text(s.s('title'),
                    textAlign: TextAlign.center,
                    style: ts(titleSize, w: 400, lh: titleSize * 1.25, ls: -0.01 * titleSize, c: ink, family: _serif)),
              ),
            if (s.s('subtitle').isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 300),
                    child: Text(s.s('subtitle'), textAlign: TextAlign.center, style: ts(12, lh: 19.5, c: muted)),
                  ),
                ),
              ),
            cards,
            if (s.s('pillText').isNotEmpty || s.s('pillCta').isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(Spacing.sm, 20, Spacing.sm, 0),
                child: Tap(
                  onTap: () => go(pill),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                    decoration: BoxDecoration(
                      color: css(s.s('pillBg'), const Color(0xFFF1E7D9)),
                      border: Border.all(color: line),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (s.s('pillText').isNotEmpty)
                          Text.rich(
                            TextSpan(children: [
                              TextSpan(text: '✦ ', style: TextStyle(color: caramel)),
                              TextSpan(text: s.s('pillText')),
                            ]),
                            textAlign: TextAlign.center,
                            style: ts(11, lh: 16.5, c: muted),
                          ),
                        if (s.s('pillText').isNotEmpty && s.s('pillCta').isNotEmpty) const SizedBox(height: 4),
                        if (s.s('pillCta').isNotEmpty)
                          Text('${s.s('pillCta').toUpperCase()} →',
                              textAlign: TextAlign.center, style: ts(11, w: 600, lh: 16.5, ls: 1.54, c: ink)),
                      ],
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
