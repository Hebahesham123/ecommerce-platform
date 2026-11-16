/// Hero. Port of Hero.tsx.
library;

import 'dart:async';

import 'package:flutter/widgets.dart';

import '../../core/api.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

/// A carousel of picture slides that moves on by itself, with dots under it.
Widget? heroSection(SectionCtx c) {
  final slides = c.settings.l('items');
  if (slides.isEmpty) return null;
  return _Hero(settings: c.settings, slides: slides, collections: c.data.collections, links: c.links);
}

/// The editor's reading: a number that is not above nought means "as usual".
int _pos(dynamic v, int d) {
  double x;
  if (v is num) {
    x = v.toDouble();
  } else if (v is bool) {
    x = v ? 1 : 0;
  } else if (v is String) {
    x = v.trim().isEmpty ? 0 : (double.tryParse(v.trim()) ?? double.nan);
  } else {
    x = double.nan;
  }
  return x.isFinite && x > 0 ? x.truncate() : d;
}

class _Hero extends StatefulWidget {
  final J settings;
  final List<J> slides;
  final List<CollectionInfo> collections;
  final LinkHandlers links;
  const _Hero({required this.settings, required this.slides, required this.collections, required this.links});
  @override
  State<_Hero> createState() => _HeroState();
}

class _HeroState extends State<_Hero> {
  final ScrollController _rail = ScrollController();
  int _at = 0;
  double _seen = 0;
  double _step = 0;
  Timer? _timer;
  String _timerKey = '';

  @override
  void initState() {
    super.initState();
    _rail.addListener(_onScroll);
  }

  @override
  void dispose() {
    _timer?.cancel();
    _rail.dispose();
    super.dispose();
  }

  void _onScroll() {
    _seen = _rail.offset;
    if (_step > 0) {
      final i = (_seen / _step).round().clamp(0, widget.slides.length - 1);
      if (i != _at) setState(() => _at = i);
    }
  }

  /// How far the rail can scroll (RN: content width less the rail's own).
  double get _far => _rail.hasClients ? _rail.position.maxScrollExtent : 0;

  /// The slides move on by themselves.
  ///
  /// A second slide nobody swipes to is a second slide nobody sees, and the
  /// dots underneath are too small to read as an invitation. Picking one
  /// restarts the wait from that choice rather than yanking the carousel out
  /// from under a thumb. (The wait restarts whenever the slide shown changes,
  /// as the RN effect re-runs on `at`.)
  void _arm(int every) {
    final key = '$every|${widget.slides.length}|$_step|$_at';
    if (key == _timerKey) return;
    _timerKey = key;
    _timer?.cancel();
    _timer = null;
    if (every <= 0 || widget.slides.length < 2 || _step <= 0) return;
    _timer = Timer.periodic(Duration(milliseconds: every * 1000), (_) {
      if (!mounted) return;
      final far = _far;
      // Back to the start only once it is actually at the end: wrapping as
      // soon as one more slide would overshoot leaves a rail whose last step
      // is a short one sitting still for ever.
      final next = _seen >= far - 2 ? 0.0 : (_seen + _step < far ? _seen + _step : far);
      _seen = next;
      if (_rail.hasClients) {
        _rail.animateTo(next, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
      }
      final i = _step > 0 ? (next / _step).round() : 0;
      if (i != _at) setState(() => _at = i);
    });
  }

  void _pick(int i) {
    setState(() => _at = i);
    _seen = i * _step;
    if (_rail.hasClients) {
      final to = _seen.clamp(0.0, _far);
      _rail.animateTo(to, duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final slides = widget.slides;
    final every = _pos(s['autoplaySeconds'], 5);
    final tall = _pos(s['height'], 240).toDouble();
    final span = _pos(s['width'], 86).clamp(50, 100);

    return LayoutBuilder(
      builder: (context, box) {
        // The page's width inside its gutter: a slide's share is a share of this,
        // while the rail itself runs to the screen's edges so the next slide peeks.
        final wide = box.maxWidth.isFinite ? box.maxWidth : 0.0;
        final card = wide > 0 ? (span >= 98 ? wide : (wide * span / 100).roundToDouble()) : 0.0;
        _step = card > 0 ? card + 8 : 0;
        _arm(every);

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            Bleed(
              child: SingleChildScrollView(
                controller: _rail,
                scrollDirection: Axis.horizontal,
                physics: _step > 0 ? _SnapPhysics(step: _step) : null,
                padding: const EdgeInsets.only(left: 16, right: 16, bottom: 2),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (var n = 0; n < slides.length; n++) ...[
                      if (n > 0) const SizedBox(width: 8),
                      _Slide(
                        key: ValueKey(slides[n].s('id')),
                        sl: slides[n],
                        width: card > 0 ? card : null,
                        height: tall,
                        hero: widget,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (slides.length > 1)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < slides.length; i++) ...[
                      if (i > 0) const SizedBox(width: 6),
                      Tap(
                        onTap: () => _pick(i),
                        child: Container(
                          height: 6,
                          width: i == _at ? 16 : 6,
                          decoration: BoxDecoration(
                            color: i == _at ? colors.accent : const Color(0xFFCBD5E1),
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _Slide extends StatelessWidget {
  final J sl;
  final double? width;
  final double height;
  final _Hero hero;
  const _Slide({super.key, required this.sl, required this.width, required this.height, required this.hero});

  @override
  Widget build(BuildContext context) {
    // A slide with no picture of its own borrows the collection's.
    var image = sl.s('imageUrl');
    if (image.isEmpty) {
      final handle = sl.s('handle');
      for (final col in hero.collections) {
        if (col.handle == handle) {
          image = col.image ?? '';
          break;
        }
      }
    }
    final kicker = sl.s('kicker');
    final heading = sl.s('heading');
    final sub = sl.s('subheading');
    return Tap(
      onTap: () => openLink(sl, hero.links),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(Radii.lg),
        child: Container(
          width: width,
          height: height,
          color: const Color(0xFFF1F5F9),
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              if (image.isNotEmpty) Positioned.fill(child: NetImage(image, fit: BoxFit.cover)),
              Positioned.fill(
                child: Fade(
                  angle: 0,
                  colors: const [Color(0x99000000), Color(0x00000000)],
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (kicker.isNotEmpty)
                        Text(kicker.toUpperCase(), style: ts(10, ls: 1, c: const Color(0xCCFFFFFF))),
                      if (heading.isNotEmpty) Text(heading, style: ts(18, lh: 28, w: 700, c: const Color(0xFFFFFFFF))),
                      if (sub.isNotEmpty) Text(sub, style: ts(11, lh: 16, c: const Color(0xD9FFFFFF))),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// RN `snapToInterval={step}` with `decelerationRate="fast"`: a fling settles
/// on a multiple of the step (or the end of the rail).
class _SnapPhysics extends ScrollPhysics {
  final double step;
  const _SnapPhysics({required this.step, super.parent});

  @override
  _SnapPhysics applyTo(ScrollPhysics? ancestor) => _SnapPhysics(step: step, parent: buildParent(ancestor));

  double _target(ScrollMetrics position, Tolerance tolerance, double velocity) {
    var page = position.pixels / step;
    if (velocity < -tolerance.velocity) {
      page -= 0.5;
    } else if (velocity > tolerance.velocity) {
      page += 0.5;
    }
    final to = page.roundToDouble() * step;
    return to.clamp(position.minScrollExtent, position.maxScrollExtent);
  }

  @override
  Simulation? createBallisticSimulation(ScrollMetrics position, double velocity) {
    if ((velocity <= 0.0 && position.pixels <= position.minScrollExtent) ||
        (velocity >= 0.0 && position.pixels >= position.maxScrollExtent)) {
      return super.createBallisticSimulation(position, velocity);
    }
    final tolerance = toleranceFor(position);
    final target = _target(position, tolerance, velocity);
    if ((target - position.pixels).abs() < tolerance.distance) return null;
    return ScrollSpringSimulation(spring, position.pixels, target, velocity, tolerance: tolerance);
  }

  @override
  bool get allowImplicitScrolling => false;
}
