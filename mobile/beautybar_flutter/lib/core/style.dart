/// React Native style values, in Flutter terms.
library;

import 'package:flutter/widgets.dart';

/// A TextStyle from React Native's text props.
///
///   ts(11, w: 500, c: ink, lh: 14)        // fontSize 11, fontWeight "500", lineHeight 14
///   ts(10, w: 700, ls: 1.8, c: accent)    // letterSpacing 1.8
///
/// [lh] is React Native's absolute lineHeight in px (converted to Flutter's
/// multiplier). [w] is the CSS weight number (400 normal, 700 bold, 800...).
TextStyle ts(
  double size, {
  int w = 400,
  Color? c,
  double? lh,
  double? ls,
  String? family,
  bool italic = false,
  TextDecoration? deco,
  Color? decoColor,
  List<Shadow>? shadows,
}) {
  return TextStyle(
    fontSize: size,
    fontWeight: fw(w),
    color: c ?? const Color(0xFF000000),
    height: lh != null ? lh / size : null,
    letterSpacing: ls,
    fontFamily: family,
    fontStyle: italic ? FontStyle.italic : FontStyle.normal,
    decoration: deco,
    decorationColor: decoColor ?? c,
    shadows: shadows,
    leadingDistribution: lh != null ? TextLeadingDistribution.even : null,
  );
}

FontWeight fw(int w) {
  if (w <= 100) return FontWeight.w100;
  if (w <= 200) return FontWeight.w200;
  if (w <= 300) return FontWeight.w300;
  if (w <= 400) return FontWeight.w400;
  if (w <= 500) return FontWeight.w500;
  if (w <= 600) return FontWeight.w600;
  if (w <= 700) return FontWeight.w700;
  if (w <= 800) return FontWeight.w800;
  return FontWeight.w900;
}

/// Tailwind's shadow-sm: 0 1px 2px rgba(0,0,0,0.05) — the `lift` in Pieces.tsx.
const List<BoxShadow> lift = [BoxShadow(color: Color(0x0D000000), blurRadius: 2, offset: Offset(0, 1))];

/// A React Native shadow (shadowColor/Opacity/Radius/Offset) as a BoxShadow.
BoxShadow rnShadow({Color color = const Color(0xFF000000), double opacity = 0.1, double radius = 4, Offset offset = Offset.zero}) =>
    BoxShadow(color: color.withValues(alpha: opacity), blurRadius: radius * 2, offset: offset);
