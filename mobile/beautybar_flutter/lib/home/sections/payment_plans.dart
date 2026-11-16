/// Pay your way. Port of PaymentPlans.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? paymentPlansSection(SectionCtx c) {
  final s = c.settings;
  final items = s.l('items').where((i) => i.s('name').isNotEmpty || i.s('headline').isNotEmpty).toList();
  if (items.isEmpty) return null;
  void go(J to) => openLink(to, c.links);
  final rv = s.n('radius');
  final r = rv > 0 ? rv : 14.0;

  return Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    mainAxisSize: MainAxisSize.min,
    children: [
      Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (s.s('title').isNotEmpty)
                  Text(s.s('title'),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
                if (s.s('subtitle').isNotEmpty)
                  Text(s.s('subtitle'),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: const Color(0xFF64748B))),
              ],
            ),
          ),
          if (s.s('seeAllLabel').isNotEmpty) ...[
            const SizedBox(width: Spacing.sm),
            Tap(
              onTap: () => go(J({
                'url': s['seeAllUrl'],
                'handle': s['seeAllHandle'],
                'productId': s['seeAllProductId'],
                'screen': s['seeAllScreen'],
              })),
              child: Text('${s.s('seeAllLabel')} ›', style: ts(12, w: 600, lh: 16, c: colors.accent)),
            ),
          ],
        ],
      ),
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Bleed(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(Spacing.lg, 0, Spacing.lg, 4),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var n = 0; n < items.length; n++) ...[
                    if (n > 0) SizedBox(width: gap.item),
                    Tap(
                      onTap: () => go(items[n]),
                      child: Container(
                        width: 152,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: css(items[n].s('color'), colors.accent),
                          borderRadius: BorderRadius.circular(r),
                        ),
                        child: _PlanBody(items[n]),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    ],
  );
}

class _PlanBody extends StatelessWidget {
  final J i;
  const _PlanBody(this.i);

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (i.s('name').isNotEmpty) Text(i.s('name'), style: ts(11, w: 600, lh: 16, c: const Color(0xCCFFFFFF))),
        if (i.s('headline').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(i.s('headline'), style: ts(15, w: 700, lh: 19, c: const Color(0xFFFFFFFF))),
          ),
        if (i.s('note').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(i.s('note'), style: ts(10, lh: 14, c: const Color(0xBFFFFFFF))),
          ),
      ],
    );
  }
}
