/// The picture the app opens on. Port of Splash.tsx.
///
/// It holds for the merchant's few seconds and then leaves the way they chose,
/// and a tap sends it early - so it is the first thing a shopper sees and never
/// the thing in the way. The app behind it has already started loading while it
/// was up, which is the other half of why it is worth having.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../core/color.dart';
import '../core/json.dart';
import '../core/links.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/pieces.dart' show NetImage;

/// Port of Splash.tsx: the picture the app opens on, over everything, gone by itself.
/// Rendered as the last child of the app's root Stack (fill it while showing).
class Splash extends StatefulWidget {
  final void Function(String handle)? onOpenCollection;
  final void Function(String id)? onOpenProduct;
  final void Function(String screen)? onOpenScreen;
  const Splash({super.key, this.onOpenCollection, this.onOpenProduct, this.onOpenScreen});
  @override
  State<Splash> createState() => _SplashState();
}

class _SplashState extends State<Splash> with SingleTickerProviderStateMixin {
  final J _s = theme.o('splash');
  late bool _gone = !_s.b('enabled') || _s.s('imageUrl').isEmpty;
  late final AnimationController _go = AnimationController(vsync: this, duration: const Duration(milliseconds: 620));
  late final Animation<double> _t = CurvedAnimation(parent: _go, curve: const Cubic(0.65, 0, 0.35, 1));
  bool _leaving = false;
  Timer? _hold;

  @override
  void initState() {
    super.initState();
    if (_gone) return;
    _hold = Timer(Duration(milliseconds: math.max(500, (_s.n('seconds') * 1000).round())), () => _leave());
  }

  @override
  void dispose() {
    _hold?.cancel();
    _go.dispose();
    super.dispose();
  }

  void _leave([VoidCallback? then]) {
    if (_leaving) return;
    _leaving = true;
    _go.forward().whenComplete(() {
      if (!mounted) return;
      setState(() => _gone = true);
      then?.call();
    });
  }

  bool get _opens => _s.s('handle').isNotEmpty || _s.s('url').isNotEmpty || _s.s('productId').isNotEmpty || _s.s('screen').isNotEmpty;

  void _take() => _leave(() {
        if (_opens) {
          openLink(
            _s,
            LinkHandlers(
              onOpenCollection: widget.onOpenCollection,
              onOpenProduct: widget.onOpenProduct,
              onOpenScreen: widget.onOpenScreen,
            ),
          );
        }
      });

  @override
  Widget build(BuildContext context) {
    if (_gone) return const SizedBox.shrink();

    final screen = MediaQuery.sizeOf(context);
    final url = _s.s('imageUrl');
    final fit = _s.s('fit') == 'contain' ? BoxFit.contain : BoxFit.cover;
    final exit = _s.s('exit');
    final half = screen.height / 2;

    Widget image() => NetImage(url, fit: fit, width: screen.width, height: screen.height);

    Widget picture;
    if (exit == 'curtain') {
      picture = AnimatedBuilder(
        animation: _t,
        builder: (context, _) => Stack(children: [
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            height: half,
            child: Transform.translate(
              offset: Offset(0, -half * _t.value),
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.topCenter,
                  minHeight: screen.height,
                  maxHeight: screen.height,
                  child: image(),
                ),
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: half,
            height: half,
            child: Transform.translate(
              offset: Offset(0, half * _t.value),
              child: ClipRect(
                child: OverflowBox(
                  alignment: Alignment.bottomCenter,
                  minHeight: screen.height,
                  maxHeight: screen.height,
                  child: image(),
                ),
              ),
            ),
          ),
        ]),
      );
    } else {
      final img = image();
      picture = AnimatedBuilder(
        animation: _t,
        child: img,
        builder: (context, child) {
          final v = _t.value;
          Widget out;
          if (exit == 'up') {
            out = Transform.translate(offset: Offset(0, -screen.height * v), child: child);
          } else if (exit == 'zoom') {
            out = Opacity(opacity: 1 - v, child: Transform.scale(scale: 1 + 0.18 * v, child: child));
          } else {
            out = Opacity(opacity: 1 - v, child: child);
          }
          return Stack(children: [Positioned(left: 0, right: 0, top: 0, height: screen.height, child: out)]);
        },
      );
    }

    final skip = _s.s('skipLabel');
    return Positioned.fill(
      child: GestureDetector(
        onTap: _take,
        behavior: HitTestBehavior.opaque,
        child: ClipRect(
          child: ColoredBox(
            color: css(_s.s('bg')),
            child: Stack(children: [
              Positioned.fill(child: picture),
              if (skip.isNotEmpty)
                Positioned(
                  right: 14,
                  top: 44,
                  child: GestureDetector(
                    onTap: () => _leave(),
                    behavior: HitTestBehavior.opaque,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color.fromRGBO(0, 0, 0, 0.35),
                        borderRadius: BorderRadius.circular(Radii.pill),
                      ),
                      child: Text(skip, style: ts(11, w: 600, c: const Color(0xFFFFFFFF))),
                    ),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}
