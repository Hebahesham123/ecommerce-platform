import 'dart:ui';

/// CSS colour strings, read the way React Native reads them.
///
/// The dashboard stores colours as text: `#rgb`, `#rrggbb`, `#rrggbbaa`
/// (alpha LAST, as in CSS — not Flutter's ARGB), `rgb()`, `rgba()`,
/// `transparent` and a few names. The React Native code also builds colours
/// by appending two hex digits of alpha to an accent (`accent + "12"`); use
/// [hexA] for that.
Color css(String? value, [Color fallback = const Color(0x00000000)]) {
  final c = tryCss(value);
  return c ?? fallback;
}

Color? tryCss(String? value) {
  if (value == null) return null;
  final v = value.trim().toLowerCase();
  if (v.isEmpty) return null;
  if (v == 'transparent') return const Color(0x00000000);
  final named = _named[v];
  if (named != null) return named;
  if (v.startsWith('#')) {
    var h = v.substring(1);
    if (h.length == 3 || h.length == 4) {
      h = h.split('').map((c) => '$c$c').join();
    }
    if (h.length == 6) {
      final n = int.tryParse(h, radix: 16);
      return n == null ? null : Color(0xFF000000 | n);
    }
    if (h.length == 8) {
      final rgb = int.tryParse(h.substring(0, 6), radix: 16);
      final a = int.tryParse(h.substring(6, 8), radix: 16);
      if (rgb == null || a == null) return null;
      return Color((a << 24) | rgb);
    }
    return null;
  }
  final m = RegExp(r'^rgba?\(([^)]*)\)$').firstMatch(v);
  if (m != null) {
    final parts = m.group(1)!.split(RegExp(r'[,\s/]+')).where((p) => p.isNotEmpty).toList();
    if (parts.length < 3) return null;
    int ch(String p) {
      if (p.endsWith('%')) return ((double.tryParse(p.substring(0, p.length - 1)) ?? 0) * 2.55).round().clamp(0, 255);
      return (double.tryParse(p) ?? 0).round().clamp(0, 255);
    }
    double alpha = 1;
    if (parts.length >= 4) {
      final p = parts[3];
      alpha = p.endsWith('%') ? (double.tryParse(p.substring(0, p.length - 1)) ?? 100) / 100 : (double.tryParse(p) ?? 1);
    }
    return Color.fromARGB((alpha.clamp(0, 1) * 255).round(), ch(parts[0]), ch(parts[1]), ch(parts[2]));
  }
  return null;
}

/// `accent + "12"` from the React Native code: the colour with a CSS hex alpha.
Color hexA(Color c, String alphaHex) {
  final a = int.tryParse(alphaHex, radix: 16) ?? 255;
  return c.withAlpha(a);
}

/// `hex + "80"` where the source is a string that may already be any CSS colour.
Color cssA(String value, String alphaHex, [Color fallback = const Color(0x00000000)]) =>
    hexA(css(value, fallback), alphaHex);

/// A colour back to `#rrggbb`, for code that does string arithmetic on colours.
String toHex(Color c) {
  final argb = c.toARGB32();
  return '#${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
}

/// A hex colour part of the way to another - for a CSS stop past 100%.
/// (Fade.tsx `mix`.)
String mix(String from, String to, double t) {
  final a = tryCss(from);
  final b = tryCss(to);
  if (a == null || b == null) return to;
  int part(int x, int y) => (x + (y - x) * t).round().clamp(0, 255);
  final r = part((a.r * 255).round(), (b.r * 255).round());
  final g = part((a.g * 255).round(), (b.g * 255).round());
  final bl = part((a.b * 255).round(), (b.b * 255).round());
  String h(int n) => n.toRadixString(16).padLeft(2, '0');
  return '#${h(r)}${h(g)}${h(bl)}';
}

const _named = <String, Color>{
  'white': Color(0xFFFFFFFF),
  'black': Color(0xFF000000),
  'red': Color(0xFFFF0000),
  'green': Color(0xFF008000),
  'blue': Color(0xFF0000FF),
  'gray': Color(0xFF808080),
  'grey': Color(0xFF808080),
  'orange': Color(0xFFFFA500),
  'gold': Color(0xFFFFD700),
  'pink': Color(0xFFFFC0CB),
  'purple': Color(0xFF800080),
  'yellow': Color(0xFFFFFF00),
};
