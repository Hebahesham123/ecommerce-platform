/// Free shipping banner. Port of FreeShipping.tsx.
library;

import 'dart:math' as math;
import 'dart:ui' show PathMetric;

import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

const _white = Color(0xFFFFFFFF);

Widget? freeShippingSection(SectionCtx c) {
  final s = c.settings;
  if (s.s('title').isEmpty && s.s('subtitle').isEmpty) return null;
  return _FreeShipping(settings: s, links: c.links);
}

class _FreeShipping extends StatelessWidget {
  final J settings;
  final LinkHandlers links;
  const _FreeShipping({required this.settings, required this.links});

  @override
  Widget build(BuildContext context) {
    final s = settings;
    final look = s.sOr('style', 'ribbon');
    final paper = css(s.sOr('bg', '#fffaf3'));
    final ink = css(s.sOr('inkColor', '#2b1b10'));
    final air = css(s.s('dashColor'), colors.accent);
    final air2 = css(s.sOr('bg2', '#2b1b10'));
    final rv = s.n('radius');
    final r = rv != 0 && rv >= 0 ? rv : 18.0;
    final hv = s.n('height');
    final minH = hv > 0 ? hv : null;
    final opens = s.s('handle').isNotEmpty || s.s('url').isNotEmpty || s.s('productId').isNotEmpty || s.s('screen').isNotEmpty;
    final VoidCallback? go = opens ? () => openLink(s, links) : null;
    final title = s.s('title'), subtitle = s.s('subtitle'), kicker = s.s('kicker');
    final button = s.s('buttonLabel'), note = s.s('note');

    // A ticket, torn off.
    //
    // A banner is a rectangle with words in it and the eye has learned to slide
    // off rectangles. A ticket is an object - a stub, a perforation and a face
    // value - and the eye stops on objects. The notches do the work: two circles
    // in the page's own colour sitting half outside the card at each end of the
    // tear, which is what turns a dashed line into something that was torn.
    if (look == 'ticket') {
      final big = s.sOr('bigWord', 'FREE');
      final small = s.sOr('smallWord', 'Delivery');
      final was = s.s('wasPrice');
      final bgStr = s.sOr('bg', '#2b1b10');
      final bg2Str = s.s('bg2').isNotEmpty ? s.s('bg2') : toHex(colors.accent);
      return Tap(
        onTap: go,
        child: Container(
          constraints: BoxConstraints(minHeight: minH ?? 0),
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: css(bgStr), borderRadius: BorderRadius.circular(r)),
          child: Stack(fit: StackFit.passthrough, children: [
            Positioned.fill(child: Fade(angle: 115, colors: [css(bgStr), css(mix(bgStr, bg2Str, 1 / 1.4))])),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (kicker.isNotEmpty) Text(kicker.toUpperCase(), style: ts(9, w: 800, ls: 2, c: air)),
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(big, style: ts(30, w: 700, c: _white, family: titleFont)),
                                const SizedBox(width: 8),
                                Flexible(
                                  child: Padding(
                                    padding: const EdgeInsets.only(bottom: 3),
                                    child: Text(small.toUpperCase(),
                                        style: ts(12, w: 800, ls: 1.6, c: const Color.fromRGBO(255, 255, 255, 0.9))),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (subtitle.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 6),
                              child: Text(subtitle, style: ts(11, c: const Color.fromRGBO(255, 255, 255, 0.7))),
                            ),
                        ],
                      ),
                    ),
                  ),
                  if (was.isNotEmpty)
                    SizedBox(
                      width: 92,
                      child: Stack(clipBehavior: Clip.none, children: [
                        // React Native has no dashed border on one side, so the tear is a hairline.
                        Positioned(
                          left: 0,
                          top: 8,
                          bottom: 8,
                          width: 1,
                          child: Container(color: const Color.fromRGBO(255, 255, 255, 0.45)),
                        ),
                        Positioned(left: -8, top: -8, child: _notch()),
                        Positioned(left: -8, bottom: -8, child: _notch()),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Text(s.sOr('wasLabel', 'was').toUpperCase(),
                                  textAlign: TextAlign.center,
                                  style: ts(8, w: 800, ls: 1.6, c: const Color.fromRGBO(255, 255, 255, 0.55))),
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(was,
                                    textAlign: TextAlign.center,
                                    style: ts(16, w: 700, c: _white, deco: TextDecoration.lineThrough)),
                              ),
                            ],
                          ),
                        ),
                      ]),
                    ),
                ],
              ),
            ),
          ]),
        ),
      );
    }

    // Priced, not described: the word, and what delivery would have cost.
    if (look == 'bold') {
      final big = s.sOr('bigWord', 'FREE');
      final small = s.sOr('smallWord', 'Delivery');
      final was = s.s('wasPrice');
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Tap(
            onTap: go,
            child: Container(
              constraints: BoxConstraints(minHeight: minH ?? 0),
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(borderRadius: BorderRadius.circular(r)),
              child: Stack(fit: StackFit.passthrough, children: [
                Positioned.fill(
                  child: Fade(angle: 120, colors: [css(s.sOr('bg', '#2b1b10')), css(s.s('bg2'), colors.accent)]),
                ),
                const Positioned.fill(child: _Shine()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  child: Row(
                    children: [
                      Expanded(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            // The editor's numbers, line heights included: a web page sets
                            // text at one and a half times its size.
                            Text(big,
                                style: ts(42,
                                    w: 700, lh: 42, c: _white, family: titleFont, ls: titleFont != null ? -0.42 : 0)),
                            const SizedBox(width: 10),
                            Flexible(
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(small.toUpperCase(), style: ts(13, w: 700, lh: 19.5, ls: 2.34, c: _white)),
                                    if (subtitle.isNotEmpty)
                                      Padding(
                                        padding: const EdgeInsets.only(top: 2),
                                        child: Text(subtitle,
                                            style: ts(11, lh: 16.5, c: const Color.fromRGBO(255, 255, 255, 0.8))),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (was.isNotEmpty) ...[
                        const SizedBox(width: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color.fromRGBO(20, 12, 7, 0.28),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(s.sOr('wasLabel', 'was').toUpperCase(),
                                  style: ts(9, w: 700, lh: 13.5, ls: 1.26, c: air)),
                              Padding(
                                padding: const EdgeInsets.only(top: 2),
                                child: Text(was,
                                    style: ts(15,
                                        w: 700, lh: 22.5, c: _white, deco: TextDecoration.lineThrough, decoColor: air)),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ]),
            ),
          ),
          if (note.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(note, textAlign: TextAlign.center, style: ts(10, lh: 15, c: const Color(0xFF64748B))),
            ),
        ],
      );
    }

    // A line between two hairlines - a fact, not a banner.
    if (look == 'rule') {
      final hair = BorderSide(color: hexA(ink, '1f'));
      return Tap(
        onTap: go,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(border: Border(top: hair, bottom: hair)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('✦', style: ts(10, c: air)),
                  const SizedBox(width: 10),
                  Flexible(child: Text(title.toUpperCase(), style: ts(10, w: 700, ls: 1.6, c: ink))),
                  const SizedBox(width: 10),
                  Text('✦', style: ts(10, c: air)),
                ],
              ),
              if (subtitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Opacity(
                    opacity: 0.55,
                    child: Text(subtitle.toUpperCase(), style: ts(9, w: 600, ls: 1.3, c: ink)),
                  ),
                ),
            ],
          ),
        ),
      );
    }

    // One line of type crossing the screen.
    if (look == 'ribbon') {
      final joined = [title, subtitle].where((t) => t.isNotEmpty).join(' ');
      final run = joined.isNotEmpty ? joined : kicker;
      return Bleed(
        child: Tap(
          onTap: go,
          child: Container(
            color: air,
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: _Ribbon(text: run, color: paper),
          ),
        ),
      );
    }

    // The editorial line: no ornament at all.
    if (look == 'editorial') {
      final hairColor = hexA(ink, '33');
      return Tap(
        onTap: go,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
          decoration: BoxDecoration(color: paper, borderRadius: BorderRadius.circular(r)),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (kicker.isNotEmpty)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(width: 32, height: 1, color: hairColor),
                    const SizedBox(width: 10),
                    Flexible(child: Text(kicker.toUpperCase(), style: ts(9, w: 700, ls: 2, c: air))),
                    const SizedBox(width: 10),
                    Container(width: 32, height: 1, color: hairColor),
                  ],
                ),
              if (title.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(title, textAlign: TextAlign.center, style: ts(27, w: 700, c: ink, family: titleFont)),
                ),
              if (subtitle.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Opacity(
                    opacity: 0.6,
                    child: Text(subtitle.toUpperCase(),
                        textAlign: TextAlign.center, style: ts(10, w: 600, ls: 1.8, c: ink)),
                  ),
                ),
              if (button.isNotEmpty)
                Container(
                  margin: const EdgeInsets.only(top: 12),
                  padding: const EdgeInsets.only(bottom: 2),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: air))),
                  child: Text('${button.toUpperCase()} →', style: ts(11, w: 700, ls: 1.5, c: ink)),
                ),
            ],
          ),
        ),
      );
    }

    // The promise over a photograph: the shape everything else in this shop
    // takes, because the shop is a photographed one.
    if (look == 'photo') {
      final img = s.s('imageUrl');
      return Bleed(
        child: Tap(
          onTap: go,
          child: SizedBox(
            height: minH ?? 168,
            child: ClipRect(
              child: Stack(fit: StackFit.expand, children: [
                if (img.isNotEmpty) NetImage(img, fit: BoxFit.cover) else Container(color: air),
                const Fade(
                  angle: 0,
                  colors: [Color.fromRGBO(20, 12, 7, 0.78), Color.fromRGBO(20, 12, 7, 0.35), Color.fromRGBO(20, 12, 7, 0)],
                  locations: [0, 0.45, 0.78],
                ),
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (kicker.isNotEmpty)
                                Text(kicker.toUpperCase(), style: ts(9, w: 700, ls: 1.9, c: const Color(0xFFE7C9A9))),
                              if (title.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 4),
                                  child: Text(title, style: ts(24, w: 700, c: _white, family: titleFont)),
                                ),
                              if (subtitle.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Text(subtitle, style: ts(12, c: const Color.fromRGBO(255, 255, 255, 0.85))),
                                ),
                            ],
                          ),
                        ),
                        if (button.isNotEmpty) ...[
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                            decoration: BoxDecoration(
                              color: const Color.fromRGBO(255, 255, 255, 0.95),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(button.toUpperCase(),
                                style: ts(11, w: 700, ls: 1, c: const Color(0xFF2B1B10))),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ]),
            ),
          ),
        ),
      );
    }

    if (look == 'strip') {
      return Tap(
        onTap: go,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(color: paper, borderRadius: BorderRadius.circular(r), border: Border.all(color: air)),
          child: Row(
            children: [
              Container(
                width: 6,
                height: 24,
                decoration: BoxDecoration(color: air, borderRadius: BorderRadius.circular(999)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(12, w: 700, c: ink)),
                    if (subtitle.isNotEmpty)
                      Opacity(
                        opacity: 0.7,
                        child: Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, c: ink)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      );
    }

    // The stamped envelope (any other style).
    final stampTop = s.s('stampTop'), stampBig = s.s('stampBig'), stampBottom = s.s('stampBottom');
    final stamped = stampTop.isNotEmpty || stampBig.isNotEmpty || stampBottom.isNotEmpty;

    return Tap(
      onTap: go,
      child: Container(
        constraints: BoxConstraints(minHeight: minH ?? 0),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(color: paper, borderRadius: BorderRadius.circular(r)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            _Stripes(air: air, air2: air2),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (kicker.isNotEmpty) Text('✦ ${kicker.toUpperCase()}', style: ts(9, w: 700, ls: 1.9, c: air)),
                        if (title.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(title, style: ts(26, w: 700, c: ink, family: titleFont)),
                          ),
                        if (subtitle.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: Opacity(opacity: 0.72, child: Text(subtitle, style: ts(12, c: ink))),
                          ),
                        Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              if (button.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                  decoration: BoxDecoration(color: ink, borderRadius: BorderRadius.circular(999)),
                                  child: Text(button, style: ts(12, w: 700, c: paper)),
                                ),
                              if (note.isNotEmpty) Opacity(opacity: 0.55, child: Text(note, style: ts(10, c: ink))),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (stamped) ...[
                    const SizedBox(width: 12),
                    Transform.rotate(
                      angle: -3 * math.pi / 180,
                      child: CustomPaint(
                        foregroundPainter: _DashedRRect(color: air, radius: 6, width: 2),
                        child: Container(
                          width: 62,
                          height: 78,
                          padding: const EdgeInsets.symmetric(horizontal: 6), // 4 + the 2px border
                          alignment: Alignment.center,
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (stampTop.isNotEmpty)
                                Text(stampTop, textAlign: TextAlign.center, style: ts(8, w: 700, ls: 1, c: air)),
                              if (stampBig.isNotEmpty)
                                Text(stampBig,
                                    textAlign: TextAlign.center, style: ts(19, w: 700, c: ink, family: titleFont)),
                              if (stampBottom.isNotEmpty)
                                Padding(
                                  padding: const EdgeInsets.only(top: 2),
                                  child: Opacity(
                                    opacity: 0.6,
                                    child: Text(stampBottom,
                                        textAlign: TextAlign.center, style: ts(7, w: 700, ls: 0.8, c: ink)),
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            _Stripes(air: air, air2: air2),
          ],
        ),
      ),
    );
  }

  /// A notch in the page's own colour, half outside the ticket.
  Widget _notch() => Container(
        width: 16,
        height: 16,
        decoration: BoxDecoration(color: colors.page, shape: BoxShape.circle),
      );
}

/// The barber-pole border, drawn as leaning blocks because the phone has no
/// repeating gradient to make one out of. The stripes travel one full repeat
/// (44px) and start again, so the border reads as an envelope going somewhere
/// rather than a line that ends.
class _Stripes extends StatefulWidget {
  final Color air;
  final Color air2;
  const _Stripes({required this.air, required this.air2});
  @override
  State<_Stripes> createState() => _StripesState();
}

class _StripesState extends State<_Stripes> with SingleTickerProviderStateMixin {
  late final AnimationController _shift =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 3400))..repeat();

  @override
  void dispose() {
    _shift.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final row = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var i = 0; i < 40; i++)
          Transform.rotate(
            angle: 25 * math.pi / 180,
            child: Container(width: 11, height: 20, color: i.isEven ? widget.air : widget.air2),
          ),
      ],
    );
    return SizedBox(
      height: 7,
      child: ClipRect(
        child: AnimatedBuilder(
          animation: _shift,
          builder: (context, child) => Stack(clipBehavior: Clip.none, children: [
            Positioned(left: -44 + 44 * _shift.value, top: -6, child: child!),
          ]),
          child: row,
        ),
      ),
    );
  }
}

/// The ribbon's line, twice over, so the second copy is already on screen
/// when the first leaves and the line never seems to end.
class _Ribbon extends StatefulWidget {
  final String text;
  final Color color;
  const _Ribbon({required this.text, required this.color});
  @override
  State<_Ribbon> createState() => _RibbonState();
}

class _RibbonState extends State<_Ribbon> with SingleTickerProviderStateMixin {
  final _first = GlobalKey();
  double _half = 0;
  late final AnimationController _move = AnimationController(vsync: this, duration: const Duration(milliseconds: 18000));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  @override
  void didUpdateWidget(covariant _Ribbon old) {
    super.didUpdateWidget(old);
    if (old.text != widget.text) WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  void _measure() {
    if (!mounted) return;
    final w = _first.currentContext?.size?.width ?? 0;
    if (w == _half) return;
    setState(() => _half = w);
    if (w > 0) {
      _move.repeat();
    } else {
      _move.stop();
    }
  }

  @override
  void dispose() {
    _move.dispose();
    super.dispose();
  }

  Widget _copy(Key? key) => Row(
        key: key,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 4; i++) ...[
            Text(widget.text.toUpperCase(), style: ts(13, w: 700, ls: 1.8, c: widget.color)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Opacity(opacity: 0.7, child: Text('✦', style: ts(11, c: widget.color))),
            ),
          ],
        ],
      );

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const NeverScrollableScrollPhysics(),
      child: AnimatedBuilder(
        animation: _move,
        builder: (context, child) => Transform.translate(offset: Offset(-_half * _move.value, 0), child: child),
        child: Row(mainAxisSize: MainAxisSize.min, children: [_copy(_first), _copy(null)]),
      ),
    );
  }
}

/// The light that crosses the bold card every few seconds, the way a shop
/// window catches the sun: a third of the card wide, leaning, sweeping from
/// just off the left edge to well past the right, then resting off the card.
class _Shine extends StatefulWidget {
  const _Shine();
  @override
  State<_Shine> createState() => _ShineState();
}

class _ShineState extends State<_Shine> with SingleTickerProviderStateMixin {
  static const _sweep = 2475, _rest = 2025;
  late final AnimationController _run =
      AnimationController(vsync: this, duration: const Duration(milliseconds: _sweep + _rest))..repeat();

  @override
  void dispose() {
    _run.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: LayoutBuilder(builder: (context, box) {
        final wide = box.maxWidth;
        if (!(wide > 0) || !wide.isFinite) return const SizedBox.shrink();
        final band = wide / 3;
        return Stack(clipBehavior: Clip.none, children: [
          AnimatedBuilder(
            animation: _run,
            builder: (context, child) {
              final t = _run.value * (_sweep + _rest) / _sweep;
              final p = t >= 1 ? 1.0 : Curves.easeInOut.transform(t);
              final dx = -1.4 * band + (3.2 * band + 1.4 * band) * p;
              return Positioned(
                left: -band,
                top: 0,
                bottom: 0,
                width: band,
                child: Transform.translate(
                  offset: Offset(dx, 0),
                  child: Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.skewX(-18 * math.pi / 180),
                    child: child,
                  ),
                ),
              );
            },
            child: const Fade(
              angle: 90,
              colors: [Color.fromRGBO(255, 255, 255, 0), Color.fromRGBO(255, 255, 255, 0.22), Color.fromRGBO(255, 255, 255, 0)],
              locations: [0, 0.5, 1],
            ),
          ),
        ]);
      }),
    );
  }
}

/// A dashed rounded border (RN `borderStyle: "dashed"`), drawn over its child.
class _DashedRRect extends CustomPainter {
  final Color color;
  final double radius;
  final double width;
  const _DashedRRect({required this.color, required this.radius, required this.width});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    final rect = (Offset.zero & size).deflate(width / 2);
    final rr = (radius - width / 2).clamp(0.0, 9999.0);
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(rr)));
    final dash = 3 * width;
    for (final PathMetric m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, d + dash), paint);
        d += dash * 2;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedRRect old) => old.color != color || old.radius != radius || old.width != width;
}
