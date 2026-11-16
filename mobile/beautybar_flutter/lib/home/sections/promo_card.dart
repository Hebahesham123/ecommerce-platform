/// Promo card. Port of PromoCard.tsx.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/widgets.dart';

import '../../core/api.dart' show sizedImage;
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';

/// React Native's Easing.inOut(Easing.ease).
class _RnEaseInOut extends Curve {
  const _RnEaseInOut();
  @override
  double transformInternal(double t) {
    const ease = Curves.easeIn; // Easing.ease = bezier(0.42, 0, 1, 1)
    if (t < 0.5) return ease.transform(t * 2) / 2;
    return 1 - ease.transform((1 - t) * 2) / 2;
  }
}

Widget? promoCardSection(SectionCtx c) {
  final s = c.settings;
  if (s.s('title').isEmpty && s.s('body').isEmpty) return null;
  void go() => openLink(s, c.links);
  if (s.s('style') == 'banner') return _MysteryBanner(settings: s, onOpen: go);
  return _PlainCard(settings: s, onOpen: go);
}

class _PlainCard extends StatelessWidget {
  final J settings;
  final VoidCallback onOpen;
  const _PlainCard({required this.settings, required this.onOpen});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    final rad = s.n('radius');
    final r = rad > 0 ? rad : 16.0;
    final bg = css(s.s('bg'), colors.accent);
    final ink = css(s.sOr('textColor', '#ffffff'), const Color(0xFFFFFFFF));
    final title = s.s('title');
    final body = s.s('body');
    final label = s.s('buttonLabel');
    return Container(
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(r)),
      clipBehavior: Clip.antiAlias,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (s.s('imageUrl').isNotEmpty) NetImage(s.s('imageUrl'), fit: BoxFit.cover, height: 112, background: colors.page),
        Padding(
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            if (title.isNotEmpty) Text(title, style: ts(15, w: 700, lh: 20.6, c: ink)),
            if (body.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Opacity(opacity: 0.8, child: Text(body, style: ts(11, lh: 17.9, c: ink))),
              ),
            if (label.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: Spacing.md),
                child: Tap(
                  onTap: onOpen,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(12)),
                    child: Text(label, style: ts(12, w: 700, lh: 18, c: bg)),
                  ),
                ),
              ),
          ]),
        ),
      ]),
    );
  }
}

/// A soft patch of light, drawn the way a CSS blur draws a filled shape: solid
/// in the middle, half strength at the shape's own edge and gone two blur
/// widths past it. The falloff is a radial gradient with the same profile.
/// The box given is the shape's, before the blur spreads it.
Widget _glow({
  required String id,
  required double w,
  required double h,
  required double blur,
  required Color color,
  required double opacity,
  double? left,
  double? top,
  double? right,
  double? bottom,
}) {
  final spread = blur * 2;
  final rr = (w + h) / 4;
  final out = rr + spread;
  double at(double d) => math.max(0, math.min(1, d / out));
  final c = sc(color.withValues(alpha: 1));
  final ww = w + spread * 2, hh = h + spread * 2;
  String stop(double off, double op) => '<stop offset="$off" stop-color="$c" stop-opacity="$op"/>';
  final svg = '<defs><radialGradient id="$id" cx="50%" cy="50%" r="50%">'
      '${stop(at(math.max(0, rr - blur * 2)), opacity * 0.98)}'
      '${stop(at(math.max(0, rr - blur)), opacity * 0.84)}'
      '${stop(at(rr), opacity * 0.5)}'
      '${stop(at(rr + blur), opacity * 0.16)}'
      '${stop(1, 0)}'
      '</radialGradient></defs>'
      '<rect x="0" y="0" width="$ww" height="$hh" fill="url(#$id)"/>';
  return Positioned(
    left: left == null ? null : left - spread,
    top: top == null ? null : top - spread,
    right: right == null ? null : right - spread,
    bottom: bottom == null ? null : bottom - spread,
    width: ww,
    height: hh,
    child: IgnorePointer(child: Svg(svg, width: ww, height: hh, viewBox: '0 0 $ww $hh')),
  );
}

/// One wedge of a circle, clockwise from twelve o'clock, as fractions of a turn.
String _wedge(int c, int r, double from, double to) {
  String pt(double f) {
    final a = f * math.pi * 2;
    return '${(c + r * math.sin(a)).toStringAsFixed(2)} ${(c - r * math.cos(a)).toStringAsFixed(2)}';
  }

  return 'M$c $c L${pt(from)} A$r $r 0 0 1 ${pt(to)} Z';
}

/// The four little stars around the box, each twinkling on its own beat.
const _sparks = [
  (top: 10.56, left: 12.4, size: 14.0, delay: 0),
  (top: 29.04, left: 101.68, size: 10.0, delay: 600),
  (top: 81.84, left: 4.96, size: 9.0, delay: 1100),
  (top: 5.28, left: 71.92, size: 8.0, delay: 1600),
];

class _Spark extends StatefulWidget {
  final double top;
  final double left;
  final double size;
  final int delay;
  final Color color;
  const _Spark({required this.top, required this.left, required this.size, required this.delay, required this.color});
  @override
  State<_Spark> createState() => _SparkState();
}

class _SparkState extends State<_Spark> with SingleTickerProviderStateMixin {
  late final AnimationController _v = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
  late final Animation<double> _eased = CurvedAnimation(parent: _v, curve: const _RnEaseInOut());
  Timer? _t;

  @override
  void initState() {
    super.initState();
    _t = Timer(Duration(milliseconds: widget.delay), () {
      if (mounted) _v.repeat(reverse: true);
    });
  }

  @override
  void dispose() {
    _t?.cancel();
    _v.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      top: widget.top,
      left: widget.left,
      child: AnimatedBuilder(
        animation: _eased,
        builder: (_, child) => Opacity(
          opacity: 0.25 + 0.75 * _eased.value,
          child: Transform.scale(scale: 0.7 + 0.4 * _eased.value, child: child),
        ),
        child: Text('✦', style: ts(widget.size, lh: widget.size * 1.5, c: widget.color)),
      ),
    );
  }
}

/// Starlight: a faint dot every fourteen points.
class _Dots extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()..color = const Color(0xFFFFFFFF).withValues(alpha: 0.084);
    for (double y = 7; y - 1 < size.height; y += 14) {
      for (double x = 7; x - 1 < size.width; x += 14) {
        canvas.drawCircle(Offset(x, y), 1, p);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _Dots old) => false;
}

/// The bow on the lid: a 28x12 box with a 4-wide border on all sides but the
/// bottom and its top corners rounded (14, scaled to fit the 12 height).
class _Bow extends CustomPainter {
  final Color color;
  _Bow(this.color);
  @override
  void paint(Canvas canvas, Size size) {
    const r = 12.0, b = 4.0;
    final outer = RRect.fromLTRBAndCorners(0, 0, size.width, size.height,
        topLeft: const Radius.circular(r), topRight: const Radius.circular(r));
    final inner = RRect.fromLTRBAndCorners(b, b, size.width - b, size.height,
        topLeft: const Radius.circular(r - b), topRight: const Radius.circular(r - b));
    canvas.drawDRRect(outer, inner, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _Bow old) => old.color != color;
}

/// The mystery box as a banner: a night gradient and a glowing gift box.
class _MysteryBanner extends StatefulWidget {
  final J settings;
  final VoidCallback onOpen;
  const _MysteryBanner({required this.settings, required this.onOpen});
  @override
  State<_MysteryBanner> createState() => _MysteryBannerState();
}

class _MysteryBannerState extends State<_MysteryBanner> with TickerProviderStateMixin {
  // The question mark floats, the lid lifts and tips, the light turns.
  late final AnimationController _bob = AnimationController(vsync: this, duration: const Duration(milliseconds: 1300))
    ..repeat(reverse: true);
  late final Animation<double> _bobE = CurvedAnimation(parent: _bob, curve: const _RnEaseInOut());
  late final AnimationController _spin = AnimationController(vsync: this, duration: const Duration(milliseconds: 14000))
    ..repeat();

  @override
  void dispose() {
    _bob.dispose();
    _spin.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final bgS = s.sOr('bg', '#2b1b10');
    final bg = css(bgS, const Color(0xFF2B1B10));
    final bg2 = css(s.s('bg2'), colors.accent);
    final glow = css(s.sOr('glow', '#e0b877'), const Color(0xFFE0B877));
    final ink = css(s.sOr('textColor', '#ffffff'), const Color(0xFFFFFFFF));
    final rad = s.n('radius');
    final r = rad > 0 ? rad : 20.0;
    final hN = s.n('height');
    final h = hN > 0 ? hN : 196.0;
    final label = s.s('buttonLabel');
    // The arrow follows the label's own script, not the app's.
    final arrow = RegExp(r'[؀-ۿ]').hasMatch(label) ? '←' : '→';
    final kicker = s.s('kicker');
    final title = s.s('title');
    final body = s.s('body');
    final price = s.s('price');
    final worth = s.s('worth');
    final stock = s.s('stockNote');
    final imageUrl = s.s('imageUrl');

    final copy = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      for (final w in <Widget>[
        if (kicker.isNotEmpty)
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: hexA(glow, '1f'),
                border: Border.all(color: hexA(glow, '66')),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('✦ ${kicker.toUpperCase()}', style: ts(9, w: 700, lh: 13.5, ls: 1.26, c: glow)),
            ),
          ),
        if (title.isNotEmpty) Text(title, style: ts(22, w: 800, lh: 27.5, c: ink)),
        if (body.isNotEmpty)
          Opacity(
            opacity: 0.78,
            child: Text(body, maxLines: 3, overflow: TextOverflow.ellipsis, style: ts(11, lh: 17.9, c: ink)),
          ),
        if (price.isNotEmpty || worth.isNotEmpty)
          // PORT NOTE: a wrapping baseline row is one paragraph here, so the
          // two lines sit on a shared baseline (Flutter's Wrap has no baseline).
          Text.rich(TextSpan(children: [
            if (price.isNotEmpty) TextSpan(text: price, style: ts(15, w: 800, lh: 22.5, c: glow)),
            if (price.isNotEmpty && worth.isNotEmpty) const WidgetSpan(child: SizedBox(width: 8)),
            if (worth.isNotEmpty) TextSpan(text: worth, style: ts(10, lh: 15, c: ink.withValues(alpha: ink.a * 0.72))),
          ])),
        if (label.isNotEmpty || stock.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
              if (label.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: glow,
                    borderRadius: BorderRadius.circular(999),
                    boxShadow: [rnShadow(color: glow, opacity: 0.33, radius: 9, offset: const Offset(0, 6))],
                  ),
                  child: Text('$label $arrow', style: ts(12, w: 700, lh: 18, c: bg)),
                ),
              if (stock.isNotEmpty)
                Opacity(opacity: 0.8, child: Text(stock, style: ts(10, w: 600, lh: 15, c: ink))),
            ]),
          ),
      ].indexed) ...[
        if (w.$1 > 0) const SizedBox(height: 6),
        w.$2,
      ],
    ]);

    final Widget art;
    if (imageUrl.isNotEmpty) {
      // PORT NOTE: iOS draws the picture's shadow from its own outline; this
      // lays a blurred, glow-tinted copy under it (offset 0,10, 40%, radius 11).
      Widget pic({Color? tint}) => CachedNetworkImage(
            imageUrl: sizedImage(imageUrl, MediaQuery.sizeOf(context).width, MediaQuery.devicePixelRatioOf(context)),
            fit: BoxFit.contain,
            height: 150,
            width: double.infinity,
            color: tint,
            colorBlendMode: tint != null ? BlendMode.srcIn : null,
            errorWidget: (_, _, _) => const SizedBox.shrink(),
            placeholder: (_, _) => const SizedBox.shrink(),
          );
      art = SizedBox(
        height: 150,
        width: double.infinity,
        child: Stack(clipBehavior: Clip.none, children: [
          Positioned.fill(
            top: 10,
            bottom: -10,
            child: ImageFiltered(
              imageFilter: ImageFilter.blur(sigmaX: 5.5, sigmaY: 5.5),
              child: pic(tint: glow.withValues(alpha: 0.4)),
            ),
          ),
          Positioned.fill(child: pic()),
        ]),
      );
    } else {
      art = _stage(glow: glow, bg2: bg2);
    }

    return Tap(
      onTap: widget.onOpen,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(r),
        child: LayoutBuilder(builder: (context, cons) {
          final artW = cons.maxWidth * 0.44;
          return Container(
            color: bg,
            child: Stack(children: [
              Positioned.fill(child: Fade(angle: 135, colors: [bg, bg, bg2], locations: const [0, 0.4, 1])),
              Positioned.fill(child: CustomPaint(painter: _Dots())),
              _glow(id: 'mysteryGlowEnd', w: 224, h: 224, blur: 40, color: glow, opacity: 0.22, right: -40, bottom: -64),
              _glow(id: 'mysteryGlowStart', w: 160, h: 160, blur: 40, color: bg2, opacity: 0.5, left: -48, top: -64),
              // Both halves are at least the banner's height and centred
              // against each other: the row's stretch, with each centring its own.
              Row(children: [
                Expanded(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: h),
                    child: Padding(
                      padding: const EdgeInsets.only(top: Spacing.lg, bottom: Spacing.lg, left: Spacing.lg, right: Spacing.sm),
                      child: Align(alignment: Alignment.centerLeft, child: copy),
                    ),
                  ),
                ),
                SizedBox(
                  width: artW,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: h),
                    child: Padding(
                      padding: const EdgeInsets.only(top: Spacing.md, bottom: Spacing.md, right: 4),
                      child: Align(alignment: Alignment.center, child: art),
                    ),
                  ),
                ),
              ]),
            ]),
          );
        }),
      ),
    );
  }

  Widget _stage({required Color glow, required Color bg2}) {
    Widget ribbon(double width) => Positioned(top: 0, bottom: 0, left: width / 2 - 7, width: 14, child: Container(color: bg2));
    const boxRadius = BorderRadius.only(
      topLeft: Radius.circular(2),
      topRight: Radius.circular(2),
      bottomLeft: Radius.circular(8),
      bottomRight: Radius.circular(8),
    );
    return SizedBox(
      width: 124,
      height: 132,
      child: Stack(clipBehavior: Clip.none, children: [
        _glow(id: 'mysteryHalo', w: 100, h: 108, blur: 24, color: glow, opacity: 0.45, left: 12, top: 12),
        // Light escaping the box, turning slowly.
        Positioned(
          top: 4,
          left: 10,
          width: 104,
          height: 104,
          child: IgnorePointer(
            child: RotationTransition(
              turns: _spin,
              child: ClipOval(
                child: Svg(
                  '<defs><radialGradient id="mysteryRays" cx="52" cy="52" r="73.5" gradientUnits="userSpaceOnUse">'
                  '<stop offset="0" stop-color="${sc(glow)}" stop-opacity="0.4"/>'
                  '<stop offset="0.2" stop-color="${sc(glow)}" stop-opacity="0.4"/>'
                  '<stop offset="0.7" stop-color="${sc(glow)}" stop-opacity="0"/>'
                  '</radialGradient></defs>'
                  '${[
                    [0.1, 0.13],
                    [0.35, 0.38],
                    [0.6, 0.63],
                    [0.85, 0.88],
                  ].map((p) => '<path d="${_wedge(52, 52, p[0], p[1])}" fill="url(#mysteryRays)"/>').join()}',
                  size: 104,
                  viewBox: '0 0 104 104',
                ),
              ),
            ),
          ),
        ),
        for (final p in _sparks) _Spark(top: p.top, left: p.left, size: p.size, delay: p.delay, color: glow),
        // The question mark rising out of the box.
        Positioned(
          top: 14,
          left: 50,
          width: 24,
          child: AnimatedBuilder(
            animation: _bobE,
            builder: (_, child) => Transform.translate(offset: Offset(0, -5 * _bobE.value), child: child),
            child: Text('?',
                textAlign: TextAlign.center,
                style: ts(36, w: 900, lh: 36, c: const Color(0xFFFFFFFF), shadows: [Shadow(color: glow, blurRadius: 14)])),
          ),
        ),
        // The lid, lifted and tilted.
        Positioned(
          bottom: 62,
          left: 14,
          width: 96,
          height: 18,
          child: AnimatedBuilder(
            animation: _bobE,
            builder: (_, child) => Transform(
              alignment: Alignment.center,
              transform: Matrix4.translationValues(0, -4 * _bobE.value, 0)..rotateZ(-3 * _bobE.value * math.pi / 180),
              child: child,
            ),
            child: Transform.rotate(
              angle: -9 * math.pi / 180,
              child: Container(
                width: 96,
                height: 18,
                decoration: BoxDecoration(
                  color: glow,
                  borderRadius: BorderRadius.circular(6),
                  boxShadow: [rnShadow(opacity: 0.25, radius: 6, offset: const Offset(0, 6))],
                ),
                child: Stack(clipBehavior: Clip.none, children: [
                  Positioned.fill(
                    child: Fade(
                      colors: const [Color(0x59FFFFFF), Color(0x2E000000)],
                      borderRadius: BorderRadius.circular(6),
                    ),
                  ),
                  ribbon(96),
                  Positioned(top: -10, left: 34, width: 28, height: 12, child: CustomPaint(painter: _Bow(bg2))),
                ]),
              ),
            ),
          ),
        ),
        // The box.
        Positioned(
          bottom: 8,
          left: 20,
          width: 84,
          height: 56,
          child: Container(
            decoration: BoxDecoration(
              color: glow,
              borderRadius: boxRadius,
              boxShadow: [rnShadow(opacity: 0.35, radius: 12, offset: const Offset(0, 12))],
            ),
            child: ClipRRect(
              borderRadius: boxRadius,
              child: Stack(children: [
                const Positioned.fill(child: Fade(angle: 160, colors: [Color(0x4DFFFFFF), Color(0x47000000)])),
                Positioned(left: 0, right: 0, bottom: 0, height: 8, child: Container(color: const Color(0x1F000000))),
                ribbon(84),
                Positioned(left: 0, right: 0, top: 0, height: 6, child: Container(color: const Color(0x40000000))),
              ]),
            ),
          ),
        ),
      ]),
    );
  }
}
