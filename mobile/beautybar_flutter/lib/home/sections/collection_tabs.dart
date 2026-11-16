/// Product tabs. Port of CollectionTabs.tsx.
library;

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// Pills naming collections; the chosen one's products in a row underneath.
Widget? collectionTabsSection(SectionCtx c) {
  final tabs = c.settings.l('items').where((t) => t.s('handle').isNotEmpty).toList();
  if (tabs.isEmpty) return null;
  return _CollectionTabs(settings: c.settings, tabs: tabs, c: c);
}

class _CollectionTabs extends StatefulWidget {
  final J settings;
  final List<J> tabs;
  final SectionCtx c;
  const _CollectionTabs({required this.settings, required this.tabs, required this.c});
  @override
  State<_CollectionTabs> createState() => _CollectionTabsState();
}

class _CollectionTabsState extends State<_CollectionTabs> {
  int _at = 0;

  Widget _tab(J t, int i, {required bool grow}) {
    final on = i == _at;
    final emoji = t.s('emoji');
    final text = (emoji.isNotEmpty ? '$emoji ' : '') + t.sOr('label', t.s('handle'));
    final style = ts(12, lh: 16, w: 500, c: on ? const Color(0xFFFFFFFF) : const Color(0xFF475569));
    return Tap(
      onTap: () => setState(() => _at = i),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        alignment: grow ? Alignment.center : null,
        decoration: BoxDecoration(
          color: on ? colors.accent : colors.surface,
          borderRadius: BorderRadius.circular(Radii.pill),
          border: on ? null : Border.all(color: const Color(0xFFCBD5E1)),
        ),
        child: grow ? Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: style) : Text(text, style: style),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final tabs = widget.tabs;
    final c = widget.c;
    final active = tabs[_at < tabs.length ? _at : tabs.length - 1];
    final lim = s.nOrNull('limit');
    final limit = lim != null && lim > 0 ? lim.truncate() : 8;
    final products = (c.data.rows[active.s('handle')] ?? const <ProductCard>[]).take(limit).toList();
    final stretch = s['stretchTabs'] == true;
    // The editor's card in a row: 148 wide in the market look, 160 otherwise.
    final tileWidth = theme.o('card').s('look') == 'market' ? 148.0 : 160.0;
    final half = gap.item * 0.5;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        SectionHeading(
          title: s.s('title'),
          onSeeAll: s['showLink'] == false ? null : () => c.onOpenCollection?.call(active.s('handle')),
        ),
        if (stretch)
          Padding(
            padding: const EdgeInsets.only(top: Spacing.sm, bottom: Spacing.xs),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < tabs.length; i++) ...[
                    if (i > 0) SizedBox(width: half),
                    Expanded(child: _tab(tabs[i], i, grow: true)),
                  ],
                ],
              ),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.only(top: Spacing.sm),
            child: Bleed(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xs),
                child: IntrinsicHeight(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      for (var i = 0; i < tabs.length; i++) ...[
                        if (i > 0) SizedBox(width: half),
                        _tab(tabs[i], i, grow: false),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        if (products.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: Spacing.sm),
            child: Bleed(
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(left: Spacing.lg, right: Spacing.lg, bottom: Spacing.xs),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var n = 0; n < products.length; n++) ...[
                      if (n > 0) SizedBox(width: gap.item),
                      ProductTile(
                        key: ValueKey(products[n].id),
                        card: products[n],
                        width: tileWidth,
                        shape: s.sOr('imageShape', 'square'),
                        fit: s.sOr('imageFit', 'cover'),
                        onPress: c.onOpenProduct,
                        onAdd: c.onAdd,
                      ),
                    ],
                  ],
                ),
              ),
            ),
          )
        else
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'Nothing in this tab',
              textAlign: TextAlign.center,
              style: ts(11, lh: 16.5, c: const Color(0xFF94A3B8)),
            ),
          ),
      ],
    );
  }
}
