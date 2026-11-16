/// Full-bleed image. Port of Showcase.tsx.
library;

import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? showcaseSection(SectionCtx c) {
  final s = c.settings;
  CollectionInfo? target;
  if (s.has('handle')) {
    for (final col in c.data.collections) {
      if (col.handle == s.s('handle')) {
        target = col;
        break;
      }
    }
  }
  final image = s.s('imageUrl').isNotEmpty ? s.s('imageUrl') : (target?.image ?? '');
  if (s.s('imageUrl').isEmpty && s.s('heading').isEmpty && s.s('handle').isEmpty) return null;
  return _Showcase(settings: s, image: image, links: c.links);
}

class _Showcase extends StatelessWidget {
  final J settings;
  final String image;
  final LinkHandlers links;
  const _Showcase({required this.settings, required this.image, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    final h = s.n('height');
    final height = h > 0 ? h : 360.0;
    final o = s.n('overlay');
    final overlay = o > 0 ? math.min(100.0, o) : 45.0;
    final ink = css(s.sOr('textColor', '#ffffff'), const Color(0xFFFFFFFF));
    final centred = s.s('align') == 'center';
    void go() => openLink(s, links);
    final heading = s.s('heading');
    final sub = s.s('subheading');
    final label = s.s('buttonLabel');
    final a = overlay / 100;

    final body = Column(
      mainAxisAlignment: centred ? MainAxisAlignment.center : MainAxisAlignment.end,
      crossAxisAlignment: centred ? CrossAxisAlignment.center : CrossAxisAlignment.stretch,
      children: [
        if (heading.isNotEmpty)
          Text(heading,
              textAlign: centred ? TextAlign.center : TextAlign.start,
              style: ts(26, w: 700, lh: 32.5, c: ink, family: titleFont, ls: titleFont != null ? -0.26 : 0)),
        if (sub.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Opacity(
              opacity: 0.85,
              child: Text(sub, textAlign: centred ? TextAlign.center : TextAlign.start, style: ts(12, lh: 19.5, c: ink)),
            ),
          ),
        if (label.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Align(
              alignment: centred ? Alignment.center : Alignment.centerLeft,
              child: Tap(
                onTap: go,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(999)),
                  child: Text(label,
                      style: ts(12,
                          w: 700, lh: 18, c: s.s('imageUrl').isNotEmpty ? const Color(0xFF191614) : colors.accent)),
                ),
              ),
            ),
          ),
      ],
    );

    return Bleed(
      child: SizedBox(
        height: height,
        child: ClipRect(
          child: Stack(fit: StackFit.expand, children: [
            image.isNotEmpty ? NetImage(image, fit: BoxFit.cover) : Container(color: const Color(0xFFE2E8F0)),
            Fade(
              angle: 0,
              colors: [
                Color.fromRGBO(0, 0, 0, a),
                Color.fromRGBO(0, 0, 0, a * 0.35),
                const Color(0x00000000),
              ],
              locations: const [0, 0.45, 0.8],
            ),
            Padding(padding: const EdgeInsets.only(left: 20, right: 20, bottom: 28), child: body),
          ]),
        ),
      ),
    );
  }
}
