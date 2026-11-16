/// The bar along the bottom. Port of TabBar.tsx.
library;

import 'package:flutter/widgets.dart';

import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import 'icons.dart';

const List<String> _keys = ['shop', 'reels', 'cart', 'orders', 'account'];

/// Order, wording and which appear are the merchant's; the keys are the app's.
/// Each is J { key, label }.
List<J> visibleTabs() => layout.tabs.where((t) => _keys.contains(t.s('key'))).toList();

class TabBar0 extends StatelessWidget {
  final TabKey active;
  final int cartCount;
  final void Function(TabKey key) onSelect;
  const TabBar0({super.key, required this.active, this.cartCount = 0, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(color: colors.surface, border: Border(top: BorderSide(color: colors.line))),
      child: Row(
        children: [
          for (final t in visibleTabs())
            Expanded(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => onSelect(t.s('key')),
                child: LayoutBuilder(builder: (context, box) {
                  final on = t.s('key') == active;
                  return Stack(clipBehavior: Clip.none, children: [
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        TabIcon(tab: t.s('key'), on: on, color: on ? colors.accent : colors.inkMuted),
                        const SizedBox(height: 2),
                        Text(t.s('label'), style: ts(11, w: 600, c: on ? colors.accent : colors.inkMuted)),
                      ]),
                    ),
                    if (t.s('key') == 'cart' && cartCount > 0)
                      Positioned(
                        top: 4,
                        right: box.maxWidth * 0.26,
                        child: Container(
                          constraints: const BoxConstraints(minWidth: 16),
                          height: 16,
                          padding: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.pill)),
                          alignment: Alignment.center,
                          child: Text('$cartCount', style: ts(10, w: 700, c: const Color(0xFFFFFFFF))),
                        ),
                      ),
                  ]);
                }),
              ),
            ),
        ],
      ),
    );
  }
}
