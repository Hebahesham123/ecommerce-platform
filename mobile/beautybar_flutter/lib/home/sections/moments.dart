/// Moments. Port of Moments.tsx (with its FocalImage, which brand_timeline uses too).
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// Where a CSS object-position puts the picture, as two fractions.
///
/// "50% 25%", "center top", "left 30%" all read the way a browser reads them:
/// the first percentage across, the second down, keywords by their meaning,
/// and anything missing in the middle.
({double x, double y}) focalPoint(String? focal, String fallback) {
  ({double x, double y}) read(String text) {
    double? x;
    double? y;
    final loose = <double>[];
    for (final word in text.trim().toLowerCase().split(RegExp(r'\s+')).where((w) => w.isNotEmpty)) {
      if (word == 'left') {
        x = 0;
      } else if (word == 'right') {
        x = 1;
      } else if (word == 'top') {
        y = 0;
      } else if (word == 'bottom') {
        y = 1;
      } else if (word == 'center') {
        loose.add(0.5);
      } else {
        final n = _parseFloat(word);
        if (n != null && n.isFinite) loose.add(n.clamp(0.0, 100.0) / 100);
      }
    }
    for (final n in loose) {
      if (x == null) {
        x = n;
      } else {
        y ??= n;
      }
    }
    return (x: x ?? 0.5, y: y ?? 0.5);
  }

  return read(focal != null && focal.trim().isNotEmpty ? focal : fallback);
}

/// JavaScript parseFloat: the leading number of a word ("25%" gives 25).
double? _parseFloat(String text) {
  final m = RegExp(r'^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?').firstMatch(text.trim());
  return m == null ? null : double.tryParse(m.group(0)!);
}

/// A picture that covers its box and keeps the merchant's focal point in view,
/// the way CSS object-fit: cover with object-position does on the website:
/// the overflow is split by the focal point, so at "50% 25%" a quarter of what
/// does not fit is cut from the top and three quarters from the bottom.
///
/// It fills the box it is given (RN: an absolute-fill view).
// PORT NOTE: React Native measures the picture with Image.getSize and places
// it by hand; Flutter's BoxFit.cover with an Alignment of (2x-1, 2y-1) is the
// same arithmetic, done by the image painter once the picture's size is known.
class FocalImage extends StatelessWidget {
  final String uri;
  final String? focal;
  final String fallback;
  const FocalImage({super.key, required this.uri, this.focal, this.fallback = '50% 50%'});

  @override
  Widget build(BuildContext context) {
    final p = focalPoint(focal, fallback);
    return SizedBox.expand(
      child: ClipRect(
        child: NetImage(
          uri,
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
          alignment: Alignment(p.x * 2 - 1, p.y * 2 - 1),
        ),
      ),
    );
  }
}

Widget? momentsSection(SectionCtx c) {
  final items = c.settings.l('items').where((i) => i.s('imageUrl').isNotEmpty || i.s('label').isNotEmpty).toList();
  if (items.isEmpty) return null;
  return _Moments(settings: c.settings, items: items, links: c.links);
}

class _Moments extends StatelessWidget {
  final J settings;
  final List<J> items;
  final LinkHandlers links;
  const _Moments({required this.settings, required this.items, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    double pos(String k, double fb) {
      final v = s.n(k);
      return v > 0 ? v : fb;
    }

    final w = pos('cardWidth', 150);
    final h = pos('cardHeight', 210);
    final r = pos('radius', 14);
    final word = css(s.s('labelColor'), const Color(0xFFFFFFFF));
    // How many fit across before anyone has to scroll.
    final pr = s.n('perRow');
    final across = pr > 0 ? pr.truncate() : 5;
    final grid = across >= 2;
    // Five across leaves about sixty pixels a card, and a word set at thirteen
    // would not fit in it. The shade over the picture shrinks with the card too.
    final tight = across >= 5;
    // Two thirds of the item gap, as in the editor.
    final between = gap.item * 0.67;

    Widget card(J m, {double? width, double? height}) {
      Widget body = Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: colors.line, borderRadius: BorderRadius.circular(r)),
        child: Stack(fit: StackFit.expand, children: [
          if (m.s('imageUrl').isNotEmpty)
            FocalImage(uri: m.s('imageUrl'), focal: m.s('focal'), fallback: '50% 30%')
          else
            Container(color: colors.line),
          Align(
            alignment: Alignment.bottomCenter,
            child: FractionallySizedBox(
              widthFactor: 1,
              heightFactor: tight ? 0.42 : 0.5,
              child: Fade(
                angle: 0,
                colors: tight
                    ? const [Color.fromRGBO(0, 0, 0, 0.68), Color.fromRGBO(0, 0, 0, 0.26), Color.fromRGBO(0, 0, 0, 0)]
                    : const [Color.fromRGBO(0, 0, 0, 0.58), Color.fromRGBO(0, 0, 0, 0.22), Color.fromRGBO(0, 0, 0, 0)],
                locations: tight ? const [0, 0.55, 1] : const [0, 0.45, 1],
              ),
            ),
          ),
          if (m.s('label').isNotEmpty)
            Positioned(
              left: tight ? 6 : 12,
              right: tight ? 6 : 12,
              bottom: tight ? 6 : 10,
              child: Text(
                m.s('label'),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: tight ? ts(9, w: 600, lh: 13.5, c: word) : ts(13, w: 600, lh: 19.5, c: word),
              ),
            ),
        ]),
      );
      body = width != null && height != null
          ? SizedBox(width: width, height: height, child: body)
          : SizedBox(width: width, child: AspectRatio(aspectRatio: w / h, child: body));
      return Tap(onTap: () => openLink(m, links), child: body);
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (s.s('title').isNotEmpty) SectionHeading(title: s.s('title')),
        if (s.s('subtitle').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(s.s('subtitle'),
                maxLines: 2, overflow: TextOverflow.ellipsis, style: ts(11, lh: 15.1, c: const Color(0xFF64748B))),
          ),
        Padding(
          padding: const EdgeInsets.only(top: Spacing.sm),
          child: grid
              // The grid's columns are measured out the way CSS grid measures
              // them: equal, with the gap between, wrapping onto a new line.
              ? LayoutBuilder(builder: (context, box) {
                  final rowWidth = box.maxWidth;
                  // Rounded down a hair, so the last column never wraps over a rounding error.
                  final column = math.max(0.0, ((rowWidth - between * (across - 1)) / across * 100).floorToDouble() / 100);
                  return Wrap(
                    spacing: between,
                    runSpacing: between,
                    children: [for (final m in items) card(m, width: column)],
                  );
                })
              : Bleed(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.fromLTRB(Spacing.lg, 0, Spacing.lg, Spacing.xs),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (var n = 0; n < items.length; n++) ...[
                          if (n > 0) SizedBox(width: between),
                          card(items[n], width: w, height: h),
                        ],
                      ],
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}
