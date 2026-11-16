/// Price drop. Port of PriceDrop.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? priceDropSection(SectionCtx c) {
  final s = c.settings;
  if (s.s('title').isEmpty && s.s('subtitle').isEmpty) return null;
  return _PriceDrop(settings: s, links: c.links);
}

class _PriceDrop extends StatelessWidget {
  final J settings;
  final LinkHandlers links;
  const _PriceDrop({required this.settings, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    void go() => openLink(s, links);
    final radius = s.n('radius');
    final r = radius > 0 ? radius : 14.0;
    final thumbs = s.l('items').where((i) => i.s('imageUrl').isNotEmpty).take(3).toList();
    final title = s.s('title');
    final subtitle = s.s('subtitle');
    final label = s.s('buttonLabel');

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: css(s.s('cardBg'), colors.surface),
        borderRadius: BorderRadius.circular(r),
        border: Border.all(color: colors.line),
      ),
      child: Row(children: [
        if (thumbs.isNotEmpty) ...[
          // Each thumb is 30 wide with a -8 right margin, so they overlap and
          // the row takes 22 per thumb (the last one runs 8 into the gap).
          SizedBox(
            width: 22.0 * thumbs.length,
            height: 30,
            child: Stack(clipBehavior: Clip.none, children: [
              for (var i = 0; i < thumbs.length; i++)
                Positioned(
                  left: 22.0 * i,
                  top: 0,
                  width: 30,
                  height: 30,
                  child: Container(
                    decoration: BoxDecoration(color: colors.page, borderRadius: BorderRadius.circular(8)),
                    foregroundDecoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: colors.surface, width: 2),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: NetImage(thumbs[i].s('imageUrl'), fit: BoxFit.cover, width: 30, height: 30),
                  ),
                ),
            ]),
          ),
          const SizedBox(width: Spacing.md),
        ],
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            if (title.isNotEmpty)
              Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(12, w: 700, c: colors.ink)),
            if (subtitle.isNotEmpty)
              Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, c: colors.inkSoft)),
          ]),
        ),
        if (label.isNotEmpty) ...[
          const SizedBox(width: Spacing.md),
          Tap(
            onTap: go,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(999)),
              child: Text(label, style: ts(11, w: 600, c: const Color(0xFFFFFFFF))),
            ),
          ),
        ],
      ]),
    );
  }
}
