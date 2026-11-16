/// The app's look, and where it comes from. Port of theme.ts + screens.ts.
///
/// The theme bundled in assets/bundled_pack.json is the one this build
/// starts from when it has nothing newer. Each time the app opens it asks the
/// shop for the current theme (boot.dart) and [applyPack] brings everything
/// below up to date before any screen is drawn — so a change saved in the
/// dashboard editor reaches phones that already have the app, with no new
/// build.
///
/// Usage from any widget (same names as the React Native code):
///   theme.s('storeName'), theme.o('card').s('look'), colors.accent,
///   gap.section, Spacing.lg, Radii.pill, layout.home, screens.o('product'),
///   say(chosen, fallback), titleFont
library;

import 'dart:convert';
import 'package:flutter/painting.dart';
import 'json.dart';
import 'color.dart';

/// The shape of theme this build reads. A newer shape is ignored rather than half-read.
const int packFormat = 1;

/// One section: what kind, what the merchant set on it, the line above it and its band.
class PackBlock {
  final String id;
  final String type;
  final J settings;
  final String kicker;
  final String band;
  const PackBlock({required this.id, required this.type, required this.settings, required this.kicker, required this.band});

  factory PackBlock.from(J j) => PackBlock(
        id: j.s('id'),
        type: j.s('type'),
        settings: j.o('settings'),
        kicker: j.s('kicker'),
        band: j.s('band'),
      );
}

class ShopColors {
  Color accent = const Color(0xFF9D6540);
  final Color ink = const Color(0xFF0F172A);
  final Color inkMuted = const Color(0xFF475569);
  final Color inkSoft = const Color(0xFF94A3B8);
  final Color surface = const Color(0xFFFFFFFF);
  /// What every screen sits on. Set in the dashboard next to the accent.
  Color page = const Color(0xFFF3EDE5);
  final Color line = const Color(0xFFE2E8F0);
}

/// spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
class Spacing {
  static const double xs = 4, sm = 8, md = 12, lg = 16, xl = 24;
}

/// radius = { sm: 8, md: 12, lg: 16, pill: 999 }
class Radii {
  static const double sm = 8, md = 12, lg = 16, pill = 999;
}

/// How much air the home screen leaves.
class Gap {
  double section = 6, item = 12, itemTight = 8;
}

class Layout {
  List<J> tabs = const [];
  List<PackBlock> home = const [];
  List<PackBlock> product = const [];
  List<PackBlock> cart = const [];
}

/// theme (ThemeData in theme.ts): storeName, titleFont, logoUrl, accent,
/// background, menuHandle, pages, splash, showSearch, announcement, header,
/// live, card, strip.
J theme = J.empty;
final ShopColors colors = ShopColors();
final Gap gap = Gap();
final Layout layout = Layout();

/// Wording and options for every screen below home (screens.ts):
/// screens.o('collection'), .o('product'), .o('cart'), .o('checkout'), ...
J screens = J.empty;

/// Section titles: 'serif' for the editor's serif titles, null for the platform's own face.
String? titleFont;

/// The merchant's word when they chose one, otherwise the app's.
String say(String chosen, String fallback) => chosen.isNotEmpty ? chosen : fallback;

late J _bundled;
String _applied = '';

String? _face(String f) => f == 'serif' ? 'serif' : null;

/// Called once at start with the pack bundled into the build.
void initBundled(String jsonText) {
  _bundled = J.from(jsonDecode(jsonText));
  screens = J.empty;
  _apply(_bundled);
}

void _apply(J p) {
  theme = _bundled.o('theme').merge(p.o('theme'));
  titleFont = _face(theme.s('titleFont'));
  colors.accent = css(theme.s('accent'), const Color(0xFF9D6540));
  colors.page = css(theme.s('background'), const Color(0xFFF3EDE5));
  final g = p.o('gap');
  gap.section = g.n('section', 6);
  gap.item = g.n('item', 12);
  gap.itemTight = g.n('itemTight', 8);
  layout.tabs = p.l('tabs');
  layout.home = p.l('home').map(PackBlock.from).toList();
  layout.product = p.l('product').map(PackBlock.from).toList();
  layout.cart = p.l('cart').map(PackBlock.from).toList();
  final merged = <String, dynamic>{...screens.raw};
  final incoming = p.o('screens');
  for (final key in {..._bundled.o('screens').raw.keys, ...incoming.raw.keys}) {
    merged[key] = {
      ...screens.o(key).raw,
      ..._bundled.o('screens').o(key).raw,
      ...incoming.o(key).raw,
    };
  }
  screens = J(merged);
  _applied = jsonEncode(p.raw);
}

/// Bring everything up to date with a theme from the shop.
///
/// Returns false, changing nothing, for anything that is not a theme this
/// build understands: a bad answer from the network must not take the app's
/// look with it.
bool applyPack(dynamic input) {
  final p = J.from(input);
  if (p.raw.isEmpty ||
      p.i('format', -1) != packFormat ||
      !p.has('theme') ||
      !p.has('gap') ||
      p['tabs'] is! List ||
      p['home'] is! List) {
    return false;
  }
  _apply(p);
  return true;
}

/// Whether a theme is the one already on screen.
bool isApplied(dynamic input) => jsonEncode(J.from(input).raw) == _applied;

/// Whether a theme can be put on screen while the app is open (only words,
/// pictures and sections changed — colours and spacing wait for next start).
bool canApplyLive(dynamic input) {
  final p = J.from(input);
  if (!p.has('theme') || !p.has('gap')) return false;
  final t = p.o('theme');
  final g = p.o('gap');
  return t.s('accent') == theme.s('accent') &&
      t.s('background') == theme.s('background') &&
      _face(t.s('titleFont')) == titleFont &&
      g.n('section') == gap.section &&
      g.n('item') == gap.item &&
      g.n('itemTight') == gap.itemTight;
}
