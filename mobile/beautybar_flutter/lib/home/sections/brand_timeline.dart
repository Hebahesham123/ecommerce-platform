/// Shop by brand. Port of BrandTimeline.tsx.
library;

import 'dart:async';
import 'dart:ui' show lerpDouble;

import 'package:flutter/foundation.dart' show TargetPlatform, defaultTargetPlatform;
import 'package:flutter/widgets.dart';

import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';
import 'moments.dart' show FocalImage;

/// The section is set in a serif whatever the app's own titles use, as on the website.
String get _serif => defaultTargetPlatform == TargetPlatform.iOS ? 'Georgia' : 'serif';

/// Fast at first and settling softly, as the website slides.
const Cubic _settle = Cubic(0.19, 1, 0.22, 1);

Widget? brandTimelineSection(SectionCtx c) {
  final items = c.settings
      .l('items')
      .where((i) => i.s('label').isNotEmpty || i.s('title').isNotEmpty || i.s('imageUrl').isNotEmpty)
      .toList();
  if (items.isEmpty) return null;
  return _BrandTimeline(settings: c.settings, items: items, links: c.links);
}

/// Shop by brand: round logo marks over one wide photo card at a time. The
/// cards slide on their own with a bar filling underneath; a swipe or a tap on
/// a mark takes over, and tapping the card opens the brand.
class _BrandTimeline extends StatefulWidget {
  final J settings;
  final List<J> items;
  final LinkHandlers links;
  const _BrandTimeline({required this.settings, required this.items, required this.links});
  @override
  State<_BrandTimeline> createState() => _BrandTimelineState();
}

class _BrandTimelineState extends State<_BrandTimeline> with TickerProviderStateMixin {
  int _on = 0;
  // Once the shopper takes hold, the cards stop moving on their own.
  bool _held = false;
  double _width = 0;

  // Where the row of cards sits: minus one card width per card already passed.
  late final AnimationController _slide = AnimationController(vsync: this, duration: const Duration(milliseconds: 500));
  double _slideFrom = 0, _slideTo = 0;
  // The finger's pull while a swipe is under way, added on top of the slide.
  late final AnimationController _pullBack = AnimationController(vsync: this);
  double _pull = 0;
  double _pullFrom = 0;
  Curve _pullCurve = _settle;
  double _dragDx = 0;
  // The current card's bar.
  late final AnimationController _bar = AnimationController(vsync: this);
  Timer? _next;

  int get _count => widget.items.length;
  int get _current => _on.clamp(0, (_count - 1).clamp(0, 1 << 30));
  double get _seconds {
    final v = widget.settings['autoplay'];
    return v is num && v.isFinite ? v.toDouble() : 3;
  }

  double get _slideValue => lerpDouble(_slideFrom, _slideTo, _settle.transform(_slide.value))!;
  double get _pullValue =>
      _pullBack.isAnimating ? _pullFrom * (1 - _pullCurve.transform(_pullBack.value)) : _pull;

  @override
  void initState() {
    super.initState();
    _runBar();
  }

  @override
  void didUpdateWidget(covariant _BrandTimeline old) {
    super.didUpdateWidget(old);
    final oldAuto = old.settings['autoplay'];
    if (old.items.length != widget.items.length || oldAuto != widget.settings['autoplay']) {
      _runBar();
      _slideToCurrent();
    }
  }

  @override
  void dispose() {
    _next?.cancel();
    _slide.dispose();
    _pullBack.dispose();
    _bar.dispose();
    super.dispose();
  }

  /// Slide to the card that is showing the way the website does: half a second.
  void _slideToCurrent() {
    _slideFrom = _slideValue;
    _slideTo = -_current * _width;
    _slide.forward(from: 0);
  }

  /// Run the current card's bar, then move on.
  void _runBar() {
    _next?.cancel();
    _bar.stop();
    final seconds = _seconds;
    if (!(seconds > 0) || _count < 2 || _held) return;
    final ms = (seconds * 1000).round();
    _bar.duration = Duration(milliseconds: ms);
    _bar.forward(from: 0);
    _next = Timer(Duration(milliseconds: ms), () {
      if (!mounted) return;
      _setOn((_on + 1) % _count);
    });
  }

  void _setOn(int i) {
    final before = _current;
    setState(() => _on = i);
    if (_current != before) _slideToCurrent();
    _runBar();
  }

  void _hold() {
    if (_held) return;
    setState(() => _held = true);
    _runBar();
  }

  void _onWidth(double w) {
    if (w == _width) return;
    _width = w;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _slideToCurrent();
      setState(() {});
    });
  }

  void _dragStart(DragStartDetails _) {
    _hold();
    _pullBack.stop();
    _dragDx = 0;
    _pull = 0;
  }

  void _dragUpdate(DragUpdateDetails d) {
    _dragDx += d.delta.dx;
    setState(() => _pull = _dragDx);
  }

  void _dragEnd(DragEndDetails _) {
    final n = _count;
    final dx = _dragDx;
    if (dx.abs() > 40 && n > 0) _setOn((_on + (dx < 0 ? 1 : -1) + n) % n);
    _releasePull(500, _settle);
  }

  void _dragCancel() => _releasePull(300, Curves.easeInOut);

  void _releasePull(int ms, Curve curve) {
    _pullFrom = _pull;
    _pull = 0;
    _pullCurve = curve;
    _pullBack.duration = Duration(milliseconds: ms);
    _pullBack.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final items = widget.items;
    final count = _count;
    final current = _current;
    final caramel = css(s.s('accentColor'), const Color(0xFF9D6540));
    final brown = css(s.s('brownColor'), const Color(0xFF684329));
    final ink = css(s.s('inkColor'), const Color(0xFF211A15));
    final line = css(s.sOr('lineColor', 'rgba(69,46,31,0.16)'));
    final rv = s.n('radius');
    final r = rv > 0 ? rv : 20.0;
    final hv = s.n('cardHeight');
    final h = hv > 0 ? hv : 150.0;
    final ov = s['overlay'];
    final shade = (ov is num ? ov.toDouble() : 72.0).clamp(0.0, 100.0) / 100;
    final seconds = _seconds;
    final linkLabel = s.s('linkLabel');

    final marks = Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Stack(children: [
        Positioned.fill(
          child: FractionallySizedBox(
            widthFactor: 0.8,
            alignment: Alignment.topCenter,
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 20),
                child: Container(height: 1, color: line),
              ),
            ),
          ),
        ),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < count; i++)
              Expanded(
                child: _Mark(
                  brand: items[i],
                  active: i == current,
                  caramel: caramel,
                  brown: brown,
                  ink: ink,
                  line: line,
                  onPress: () {
                    _hold();
                    _setOn(i);
                  },
                ),
              ),
          ],
        ),
      ]),
    );

    Widget card(J b) {
      return Tap(
        onTap: () => openLink(b, widget.links),
        child: Container(
          width: _width > 0 ? _width : 1,
          height: h,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(color: const Color(0xFFB89D82), borderRadius: BorderRadius.circular(r)),
          child: Stack(fit: StackFit.expand, children: [
            if (b.s('imageUrl').isNotEmpty) FocalImage(uri: b.s('imageUrl'), focal: b.s('focal'), fallback: '50% 50%'),
            Fade(
              angle: 90,
              colors: [
                Color.fromRGBO(28, 18, 12, shade),
                Color.fromRGBO(28, 18, 12, shade * 0.47),
                const Color.fromRGBO(28, 18, 12, 0.02),
              ],
              locations: const [0, 0.46, 0.74],
            ),
            Positioned(
              left: 20,
              top: 0,
              bottom: 0,
              child: ConstrainedBox(
                constraints: BoxConstraints(maxWidth: (_width > 0 ? _width : 1) * 0.78),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(b.sOr('title', b.s('label')),
                        style: ts(22, w: 600, lh: 22, c: const Color(0xFFFFFFFF), family: _serif)),
                    if (b.s('description').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Opacity(
                          opacity: 0.95,
                          child: Text(b.s('description'), style: ts(11.5, lh: 15.8, c: const Color(0xFFFFFFFF))),
                        ),
                      ),
                    if (linkLabel.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Stack(children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 4),
                            child: Row(mainAxisSize: MainAxisSize.min, children: [
                              Text(linkLabel.toUpperCase(),
                                  style: ts(11.5, w: 600, lh: 17.25, ls: 1.61, c: const Color(0xFFFFFFFF))),
                              const SizedBox(width: 8),
                              const Svg('<path d="M5 12h14M13 6l6 6-6 6"/>',
                                  size: 14,
                                  rootAttrs:
                                      'fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"'),
                            ]),
                          ),
                          Positioned(
                            left: 0,
                            bottom: 0,
                            child: Container(width: 40, height: 1, color: const Color.fromRGBO(255, 255, 255, 0.65)),
                          ),
                        ]),
                      ),
                  ],
                ),
              ),
            ),
          ]),
        ),
      );
    }

    final cards = Padding(
      padding: const EdgeInsets.only(top: 16),
      child: LayoutBuilder(builder: (context, box) {
        _onWidth(box.maxWidth);
        final w = _width > 0 ? _width : 1.0;
        return GestureDetector(
          onHorizontalDragStart: _dragStart,
          onHorizontalDragUpdate: _dragUpdate,
          onHorizontalDragEnd: _dragEnd,
          onHorizontalDragCancel: _dragCancel,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(r),
            child: SizedBox(
              height: h,
              child: Stack(children: [
                AnimatedBuilder(
                  animation: Listenable.merge([_slide, _pullBack]),
                  builder: (context, child) => Transform.translate(
                    offset: Offset(_slideValue + _pullValue, 0),
                    child: child,
                  ),
                  child: OverflowBox(
                    alignment: Alignment.topLeft,
                    minWidth: w * count,
                    maxWidth: w * count,
                    child: Row(children: [for (final b in items) card(b)]),
                  ),
                ),
                if (seconds > 0 && count > 1 && !_held && _width > 0)
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 3,
                    child: Container(
                      color: const Color.fromRGBO(0, 0, 0, 0.15),
                      alignment: Alignment.centerLeft,
                      // Grows from the left edge, like the website's scaleX bar.
                      child: AnimatedBuilder(
                        key: ValueKey(current),
                        animation: _bar,
                        builder: (context, _) => FractionallySizedBox(
                          widthFactor: _bar.value.clamp(0.001, 1.0),
                          heightFactor: 1,
                          child: Container(color: caramel),
                        ),
                      ),
                    ),
                  ),
              ]),
            ),
          ),
        );
      }),
    );

    final body = Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        if (s.s('eyebrow').isNotEmpty)
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(width: 40, height: 1, color: caramel),
              const SizedBox(width: 12),
              Flexible(
                child: Text(s.s('eyebrow').toUpperCase(), style: ts(11, w: 600, lh: 16.5, ls: 2.64, c: brown)),
              ),
            ],
          ),
        if (s.s('heading').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(s.s('heading'),
                textAlign: TextAlign.center, style: ts(24, w: 600, lh: 24, c: ink, family: _serif)),
          ),
        if (s.s('intro').isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 300),
                child: Text(s.s('intro'),
                    textAlign: TextAlign.center, style: ts(11.5, lh: 18.7, c: const Color(0xFF64748B))),
              ),
            ),
          ),
        marks,
        cards,
      ],
    );

    if (s.s('bg').isEmpty) return body;
    return Bleed(
      child: Container(
        color: css(s.s('bg')),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 20),
        child: body,
      ),
    );
  }
}

/// One round mark on the line: it swells a little when its brand is showing.
class _Mark extends StatelessWidget {
  final J brand;
  final bool active;
  final Color caramel, brown, ink, line;
  final VoidCallback onPress;
  const _Mark({
    required this.brand,
    required this.active,
    required this.caramel,
    required this.brown,
    required this.ink,
    required this.line,
    required this.onPress,
  });

  @override
  Widget build(BuildContext context) {
    return Tap(
      onTap: onPress,
      child: Column(
        children: [
          AnimatedScale(
            scale: active ? 1.06 : 1,
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeInOut,
            child: Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: active ? caramel : const Color(0xFFFFFDFA),
                shape: BoxShape.circle,
                border: Border.all(color: active ? caramel : line),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: Text(
                  brand.s('logoText'),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: ts(12, w: 600, lh: 12, c: active ? const Color(0xFFFFFFFF) : brown, family: _serif),
                ),
              ),
            ),
          ),
          const SizedBox(height: 6),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 2),
            child: Text(
              brand.sOr('label', brand.s('title')).toUpperCase(),
              textAlign: TextAlign.center,
              style: ts(8, w: 600, lh: 10, ls: 0.96, c: active ? brown : ink),
            ),
          ),
        ],
      ),
    );
  }
}
