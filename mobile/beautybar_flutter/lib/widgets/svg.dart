/// Inline SVG, so the React Native `<Svg>` drawings port as markup unchanged.
///
///   Svg('<path d="M12 5v14M5 12h14" fill="none" stroke="${sc(color)}" stroke-width="2.5" stroke-linecap="round"/>', size: 14)
///
/// Attribute names are the SVG ones (stroke-width, not strokeWidth). Colours
/// go in through [sc], which writes any Flutter [Color] (alpha included) in a
/// form flutter_svg reads.
library;

import 'package:flutter/widgets.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// A colour as SVG text: `#rrggbb`, or `rgba(...)` when it is see-through.
String sc(Color c) {
  final argb = c.toARGB32();
  final a = (argb >> 24) & 0xFF;
  final r = (argb >> 16) & 0xFF, g = (argb >> 8) & 0xFF, b = argb & 0xFF;
  if (a == 0xFF) return '#${(argb & 0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
  return 'rgba($r,$g,$b,${(a / 255).toStringAsFixed(3)})';
}

class Svg extends StatelessWidget {
  /// The inside of the `<svg>` element.
  final String body;
  final double? size;
  final double? width;
  final double? height;
  final String viewBox;
  /// Extra attributes on the root `<svg>` (e.g. 'fill="none" stroke="#000"').
  final String rootAttrs;
  final BoxFit fit;

  const Svg(this.body, {super.key, this.size, this.width, this.height, this.viewBox = '0 0 24 24', this.rootAttrs = '', this.fit = BoxFit.contain});

  @override
  Widget build(BuildContext context) {
    final w = width ?? size;
    final h = height ?? size;
    return SvgPicture.string(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="$viewBox" $rootAttrs>$body</svg>',
      width: w,
      height: h,
      fit: fit,
    );
  }
}
