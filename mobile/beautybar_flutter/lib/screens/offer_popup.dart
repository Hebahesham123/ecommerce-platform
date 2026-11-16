/// The app's popup. Generated from the dashboard — App → App theme.
/// Port of OfferPopup.tsx.
///
/// The shop decides which offer this shopper should see on this screen — one
/// made for her by name, or the campaign that fits her and what she is looking
/// at (Dashboard → Smart popups). This waits the time the campaign set, then
/// shows it. A code the shop makes for each shopper is fetched only when she
/// asks for it, and "Apply" puts it straight on her basket.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/json.dart';
import '../core/prefs.dart';
import '../core/style.dart';
import '../widgets/pieces.dart' show NetImage, Tap;

const String _seenAt = 'offer_seen_at';

/// Shown this many times since the app opened.
int _seenThisVisit = 0;

final math.Random _random = math.Random();

J _pickSegment(List<J> segments) {
  double w(J s) => math.max(0, s.n('weight'));
  final total = segments.fold<double>(0, (n, s) => n + w(s));
  if (total <= 0) return segments[_random.nextInt(segments.length)];
  var r = _random.nextDouble() * total;
  for (final s in segments) {
    r -= w(s);
    if (r < 0) return s;
  }
  return segments.last;
}

/// Port of OfferPopup.tsx. Rendered inside the app's root Stack (fill it while showing).
///
/// PORT NOTE: RN draws the card in a `<Modal animationType="fade">`, which sits
/// above everything (even the splash) and closes on Android's back button. The
/// closest Flutter equivalent is a dialog route with a fade, so that is what is
/// shown; the widget itself takes no room in the Stack.
class OfferPopup extends StatefulWidget {
  final OfferContext context;
  final int cartCount;
  final void Function(String code) onApplyCode;
  const OfferPopup({super.key, required this.context, required this.cartCount, required this.onApplyCode});
  @override
  State<OfferPopup> createState() => _OfferPopupState();
}

class _OfferPopupState extends State<OfferPopup> {
  J? _offer;
  bool _visible = false;
  String? _code;
  String? _prize;
  bool _busy = false;
  bool _failed = false;

  /// One per screen asked about; an answer for an older screen is dropped.
  int _run = 0;
  Timer? _timer;

  /// Redraws the open dialog when anything it shows changes.
  final ValueNotifier<int> _tick = ValueNotifier(0);
  NavigatorState? _dialogNav;
  bool _dialogOpen = false;

  String _key(OfferContext c) => '${c.pageType}|${c.productKey ?? ''}|${c.collectionHandle ?? ''}';

  @override
  void initState() {
    super.initState();
    _ask();
  }

  @override
  void didUpdateWidget(OfferPopup old) {
    super.didUpdateWidget(old);
    // A new screen: ask again, and forget whatever the last one was waiting for.
    // (After this frame: the open dialog is redrawn or closed outside the build.)
    final changed = _key(old.context) != _key(widget.context);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (changed) _ask();
      _tick.value++;
    });
  }

  @override
  void dispose() {
    _run++;
    _timer?.cancel();
    if (_dialogOpen) _dialogNav?.pop();
    _tick.dispose();
    super.dispose();
  }

  /// Nothing is drawn in the Stack itself; the dialog listens to [_tick].
  void _set(VoidCallback f) {
    if (!mounted) return;
    f();
    _tick.value++;
  }

  Future<void> _ask() async {
    final run = ++_run;
    _timer?.cancel();
    _timer = null;
    _set(() => _offer = null);
    _syncDialog();
    // Never in the way of someone paying.
    if (widget.context.pageType == 'checkout') return;
    try {
      final o = await decideOffer(widget.context, widget.cartCount);
      bool alive() => mounted && run == _run;
      if (!alive() || o == null) return;
      final maxPer = o.nOrNull('maxPerSession');
      if (maxPer != null && _seenThisVisit >= maxPer) return;
      final cooldown = o.n('cooldownHours');
      if (cooldown > 0) {
        double last = 0;
        try {
          last = double.tryParse(prefs.getString(_seenAt) ?? '') ?? 0;
        } catch (_) {}
        if (last != 0 && DateTime.now().millisecondsSinceEpoch - last < cooldown * 3600 * 1000) return;
      }
      if (o.b('skipIfCartEmpty') && widget.cartCount == 0) return;
      if (!alive()) return;
      _set(() => _offer = o);
      // Time on this screen, and time with something in the basket.
      final dwell = o.n('dwell') != 0 ? o.n('dwell') : o.n('idle');
      final cart = o.n('cart');
      var onScreen = 0;
      var withCart = 0;
      _timer = Timer.periodic(const Duration(seconds: 1), (t) {
        onScreen += 1;
        withCart = widget.cartCount > 0 ? withCart + 1 : 0;
        final fire = dwell != 0 ? (onScreen >= dwell ? 'dwell' : null) : null;
        final cartFire = cart != 0 && withCart >= cart ? 'cart' : null;
        final why = fire ?? cartFire;
        if (why == null) return;
        t.cancel();
        if (_timer == t) _timer = null;
        if (!alive()) return;
        _seenThisVisit += 1;
        prefs.setString(_seenAt, DateTime.now().millisecondsSinceEpoch.toString()).catchError((Object _) => false);
        final segments = o.l('segments');
        final style = o.s('style');
        final segment = (style == 'wheel' || style == 'scratch') && segments.isNotEmpty ? _pickSegment(segments) : null;
        String? orNull(String v) => v.isEmpty ? null : v;
        _set(() {
          _prize = segment?.s('label');
          _code = o.b('unique') ? null : (segment != null ? orNull(segment.s('code')) : orNull(o.s('code')));
          _failed = false;
          _visible = true;
        });
        _syncDialog();
        offerEvent('shown', o.s('id'), trigger: why);
      });
    } catch (_) {}
  }

  void _close(bool dismissed) {
    final offer = _offer;
    _set(() => _visible = false);
    _syncDialog();
    if (dismissed && offer != null) offerEvent('dismissed', offer.s('id'));
  }

  Future<void> _getMine() async {
    final offer = _offer;
    if (offer == null) return;
    _set(() {
      _busy = true;
      _failed = false;
    });
    try {
      final c = await claimOffer(offer.s('id'));
      _set(() => _code = c.isEmpty ? null : c);
    } catch (_) {
      _set(() => _failed = true);
    } finally {
      _set(() => _busy = false);
    }
  }

  void _apply() {
    final offer = _offer;
    final code = _code;
    if (offer == null || code == null) return;
    if (!offer.b('unique')) offerEvent('claimed', offer.s('id'), code: code);
    _close(false);
    widget.onApplyCode(code);
  }

  /// The Modal is shown while there is an offer and it is visible.
  void _syncDialog() {
    final want = _offer != null && _visible;
    if (want && !_dialogOpen) {
      _dialogOpen = true;
      _dialogNav = Navigator.of(context, rootNavigator: true);
      showGeneralDialog<void>(
        context: context,
        useRootNavigator: true,
        barrierDismissible: false,
        barrierColor: const Color(0x00000000),
        transitionDuration: const Duration(milliseconds: 300),
        transitionBuilder: (context, a, _, child) => FadeTransition(opacity: a, child: child),
        pageBuilder: (ctx, _, _) => ValueListenableBuilder<int>(
          valueListenable: _tick,
          builder: (context, _, _) => _offer == null ? const SizedBox.shrink() : _card(_offer!),
        ),
      ).then((_) {
        _dialogOpen = false;
        // Android's back button (onRequestClose): dismissed.
        if (mounted && _visible) _close(true);
      });
    } else if (!want && _dialogOpen) {
      _dialogOpen = false;
      _dialogNav?.pop();
    }
  }

  Widget _card(J offer) {
    final fg = css(offer.s('fg'), const Color(0xFF000000));
    final accent = css(offer.s('accent'), const Color(0xFF000000));
    final bg = css(offer.sOr('bg', '#ffffff'), const Color(0xFFFFFFFF));
    final code = _code;
    final image = offer.s('image');
    final body = offer.s('body');
    final dismiss = offer.s('dismiss');
    final button = offer.s('button');

    Widget btn(String label, VoidCallback? onTap, {double opacity = 1}) => Tap(
          onTap: onTap,
          child: Opacity(
            opacity: opacity,
            child: Container(
              margin: const EdgeInsets.only(top: 14),
              padding: const EdgeInsets.symmetric(vertical: 13),
              decoration: BoxDecoration(color: accent, borderRadius: BorderRadius.circular(12)),
              alignment: Alignment.center,
              child: Text(label, style: ts(15, w: 700, c: const Color(0xFFFFFFFF))),
            ),
          ),
        );

    final List<Widget> action;
    if (code != null) {
      action = [
        // The code, in a dashed frame.
        Padding(
          padding: const EdgeInsets.only(top: 16),
          child: CustomPaint(
            painter: _DashedRRect(color: accent, width: 1.5, radius: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12),
              alignment: Alignment.center,
              child: SelectableText(code, style: ts(19, w: 800, ls: 1.5, c: fg)),
            ),
          ),
        ),
        btn(widget.cartCount > 0 ? 'Apply to my cart' : (button.isNotEmpty ? button : 'Use my code'), _apply),
      ];
    } else if (offer.b('unique')) {
      action = [
        btn(_busy ? '…' : (_failed ? 'Try again' : (button.isNotEmpty ? button : 'Get my code')), _busy ? null : _getMine,
            opacity: _busy ? 0.6 : 1),
      ];
    } else {
      action = [btn(button.isNotEmpty ? button : 'OK', () => _close(false))];
    }

    return Material(
      type: MaterialType.transparency,
      child: GestureDetector(
        onTap: () => _close(true),
        behavior: HitTestBehavior.opaque,
        child: Container(
          color: const Color.fromRGBO(15, 23, 42, 0.45),
          padding: const EdgeInsets.all(20),
          alignment: Alignment.center,
          child: GestureDetector(
            onTap: () {},
            behavior: HitTestBehavior.opaque,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Container(
                width: double.infinity,
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(18)),
                padding: const EdgeInsets.fromLTRB(22, 26, 22, 18),
                child: Stack(clipBehavior: Clip.none, children: [
                  Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                    if (image.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 14),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(12),
                          child: NetImage(image, fit: BoxFit.cover, height: 132),
                        ),
                      ),
                    Text(offer.s('headline'), textAlign: TextAlign.center, style: ts(20, w: 800, lh: 25, c: fg)),
                    if (body.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Opacity(
                          opacity: 0.78,
                          child: Text(body, textAlign: TextAlign.center, style: ts(14.5, lh: 22, c: fg)),
                        ),
                      ),
                    if (_prize != null && _prize!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Text(_prize!, textAlign: TextAlign.center, style: ts(16, w: 700, c: accent)),
                      ),
                    ...action,
                    if (dismiss.isNotEmpty)
                      Tap(
                        onTap: () => _close(true),
                        child: Padding(
                          padding: const EdgeInsets.only(top: 10),
                          child: Opacity(
                            opacity: 0.6,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(vertical: 4),
                              child: Text(dismiss, textAlign: TextAlign.center, style: ts(13.5, c: fg)),
                            ),
                          ),
                        ),
                      ),
                  ]),
                  // The × sits at top 8 / right 10 of the card, outside its padding.
                  Positioned(
                    top: 8 - 26,
                    right: 10 - 22,
                    child: Tap(
                      onTap: () => _close(true),
                      child: SizedBox(
                        width: 30,
                        height: 30,
                        child: Center(
                          child: Opacity(opacity: 0.45, child: Text('×', style: ts(22, c: fg))),
                        ),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => const SizedBox.shrink();
}

/// A dashed rounded border (RN borderStyle: "dashed").
class _DashedRRect extends CustomPainter {
  final Color color;
  final double width;
  final double radius;
  const _DashedRRect({required this.color, required this.width, required this.radius});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width;
    final r = RRect.fromRectAndRadius(
      Rect.fromLTWH(width / 2, width / 2, size.width - width, size.height - width),
      Radius.circular(radius - width / 2),
    );
    final path = Path()..addRRect(r);
    // Android draws dashes about three strokes long with equal gaps.
    final dash = width * 3, gap = width * 3;
    for (final m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + dash, m.length)), paint);
        d += dash + gap;
      }
    }
  }

  @override
  bool shouldRepaint(_DashedRRect old) => old.color != color || old.width != width || old.radius != radius;
}
