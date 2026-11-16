import 'package:flutter/widgets.dart';

import '../../core/style.dart';
import '../../core/theme.dart';
import '../section.dart';

/// Trust badges. Generated from the dashboard — App → App theme. (Port of TrustBadges.tsx.)
Widget? trustBadgesSection(SectionCtx c) {
  final badges = c.settings.l('items');
  if (badges.isEmpty) return null;
  return SingleChildScrollView(
    scrollDirection: Axis.horizontal,
    padding: const EdgeInsets.symmetric(vertical: Spacing.sm),
    // The row stretches its cards to the tallest, as a React Native row does.
    child: IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < badges.length; i++) ...[
            if (i > 0) SizedBox(width: gap.itemTight),
            _Badge(
              key: ValueKey('${badges[i].s('id')}#$i'),
              emoji: badges[i].s('emoji'),
              title: badges[i].s('title'),
              subtitle: badges[i].s('subtitle'),
            ),
          ],
        ],
      ),
    ),
  );
}

class _Badge extends StatelessWidget {
  final String emoji;
  final String title;
  final String subtitle;
  const _Badge({super.key, required this.emoji, required this.title, required this.subtitle});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 112,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: colors.line),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(emoji.isNotEmpty ? emoji : '•', style: ts(18)),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(title,
                maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: ts(11, w: 600, c: colors.ink)),
          ),
          Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: ts(10, c: colors.inkSoft)),
        ],
      ),
    );
  }
}
