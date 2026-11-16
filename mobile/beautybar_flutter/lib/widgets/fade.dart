/// A linear gradient given the way the editor gives one: a CSS angle and its
/// stops. Port of Fade.tsx. (For `mix`, see core/color.dart.)
library;

import 'dart:math' as math;
import 'package:flutter/widgets.dart';

/// The gradient itself, for use inside a BoxDecoration.
LinearGradient fadeGradient({double angle = 180, required List<Color> colors, List<double>? stops}) {
  final a = angle * math.pi / 180;
  final dx = math.sin(a) / 2;
  final dy = -math.cos(a) / 2;
  // expo-linear-gradient points are 0..1 of the box; Alignment is -1..1.
  return LinearGradient(
    begin: Alignment((0.5 - dx) * 2 - 1, (0.5 - dy) * 2 - 1),
    end: Alignment((0.5 + dx) * 2 - 1, (0.5 + dy) * 2 - 1),
    colors: colors.length == 1 ? [colors[0], colors[0]] : colors,
    stops: stops != null && stops.length == colors.length ? stops : null,
  );
}

class Fade extends StatelessWidget {
  /// CSS degrees: 0 runs bottom to top, 90 left to right, 180 top to bottom.
  final double angle;
  final List<Color> colors;
  final List<double>? locations;
  final BorderRadius? borderRadius;
  final EdgeInsetsGeometry? padding;
  final double? width;
  final double? height;
  final Widget? child;

  const Fade({
    super.key,
    this.angle = 180,
    required this.colors,
    this.locations,
    this.borderRadius,
    this.padding,
    this.width,
    this.height,
    this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      padding: padding,
      decoration: BoxDecoration(
        gradient: fadeGradient(angle: angle, colors: colors, stops: locations),
        borderRadius: borderRadius,
      ),
      clipBehavior: borderRadius != null ? Clip.antiAlias : Clip.none,
      child: child,
    );
  }
}
