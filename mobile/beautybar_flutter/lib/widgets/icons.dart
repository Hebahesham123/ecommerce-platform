/// The editor's own icons, drawn the same way here. Port of Icons.tsx.
library;

import 'package:flutter/widgets.dart';
import 'svg.dart';

/// "shop" | "live" | "reels" | "cart" | "orders" | "account"
typedef TabKey = String;

class TabIcon extends StatelessWidget {
  final TabKey tab;
  final bool on;
  final Color color;
  final double size;
  const TabIcon({super.key, required this.tab, this.on = false, required this.color, this.size = 21});

  @override
  Widget build(BuildContext context) {
    final c = sc(color);
    String tint(double o) => on ? 'fill="$c" fill-opacity="$o"' : '';
    final String body;
    switch (tab) {
      case 'live':
        body = '<circle cx="12" cy="12" r="3.1" fill="${on ? c : 'none'}"/>'
            '<path d="M7.8 7.8a5.9 5.9 0 0 0 0 8.4M16.2 16.2a5.9 5.9 0 0 0 0-8.4"/>'
            '<path d="M5 5a9.9 9.9 0 0 0 0 14M19 19a9.9 9.9 0 0 0 0-14" opacity="0.55"/>';
      case 'reels':
        body = '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3.2" ${tint(0.12)}/>'
            '<path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="$c"/>';
      case 'cart':
        body = '<path d="M5.4 8.4h13.2l-1 11.1a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5Z" ${tint(0.14)}/>'
            '<path d="M8.9 10.4V7.2a3.1 3.1 0 0 1 6.2 0v3.2"/>';
      case 'orders':
        body = '<path d="M6 3.6h12v15.8l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3Z" ${tint(0.12)}/>'
            '<path d="M9 8h6M9 11.6h6M9 15.2h3.5"/>';
      case 'account':
        body = '<circle cx="12" cy="8.4" r="3.4" ${tint(0.18)}/>'
            '<path d="M4.9 20.1a7.6 7.6 0 0 1 14.2 0"/>';
      default:
        body = '<path d="M3.6 9.2 5 4.8h14l1.4 4.4"/>'
            '<path d="M3.6 9.2a2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0 2.2 2.2 0 0 0 4.2 0"/>'
            '<path d="M5 11.4V19h14v-7.6" ${tint(0.14)}/>'
            '<path d="M10 19v-4.2h4V19"/>';
    }
    return Svg(body,
        size: size,
        rootAttrs: 'fill="none" stroke="$c" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"');
  }
}

/// "search" | "heart" | "bag" | "back" | "menu" | "plus" | "close"
class HeaderIcon extends StatelessWidget {
  final String name;
  final Color color;
  final double size;
  const HeaderIcon({super.key, required this.name, required this.color, this.size = 18});

  @override
  Widget build(BuildContext context) {
    final String body;
    switch (name) {
      case 'search':
        body = '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>';
      case 'heart':
        body = '<path d="M12 20s-7-4.4-7-9.3A3.9 3.9 0 0 1 12 8a3.9 3.9 0 0 1 7 2.7C19 15.6 12 20 12 20Z"/>';
      case 'bag':
        body = '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8a3 3 0 0 1 6 0"/>';
      case 'menu':
        body = '<path d="M4 7h16M4 12h16M4 17h16"/>';
      case 'plus':
        body = '<path d="M12 5v14M5 12h14"/>';
      case 'close':
        body = '<path d="M6 6l12 12M18 6 6 18"/>';
      default:
        body = '<path d="M15 5l-7 7 7 7"/>';
    }
    return Svg(body,
        size: size,
        rootAttrs:
            'fill="none" stroke="${sc(color)}" stroke-width="${name == 'search' ? 2 : 1.8}" stroke-linecap="round" stroke-linejoin="round"');
  }
}
