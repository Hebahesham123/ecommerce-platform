/// One of the website's pages inside the app. Port of WebPage.tsx.
library;

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../core/api.dart';
import '../core/theme.dart';

/// Port of WebPage.tsx: one of the website's pages (siteOrigin + path) inside the app.
///
/// PORT NOTE: RN's `sharedCookiesEnabled` / `thirdPartyCookiesEnabled` /
/// `allowsBackForwardNavigationGestures` are platform switches that
/// webview_flutter only exposes through its per-platform packages, which this
/// project does not depend on. The platform WebView keeps its cookies between
/// opens by default, so she stays signed in as the RN comment intends.
class WebPage extends StatefulWidget {
  /// Where on the site this opens, e.g. "/store/reels".
  final String path;

  /// Fired when the page itself asks to be closed — the reels feed's own X
  /// button, posted across the bridge rather than left to try to navigate a
  /// browser history that a native tab does not have.
  final VoidCallback? onClose;

  /// Fired when the page asks the app to open a product — the reels feed,
  /// where a product tapped under a video should open the app's own product
  /// screen, not the website's product page inside this one. `back` is the
  /// page to come back to, so she lands on the reel she left.
  final void Function(String id, String back)? onProduct;

  /// Covered by a product opened from it: its video stops until it is uncovered.
  final bool paused;

  const WebPage({super.key, required this.path, this.onClose, this.onProduct, this.paused = false});
  @override
  State<WebPage> createState() => _WebPageState();
}

class _WebPageState extends State<WebPage> {
  bool _loading = true;
  late final WebViewController _view;

  // Stamped once per opening, so the phone asks the shop for the page again
  // rather than showing a copy it kept from before the shop last changed it.
  final int _opened = DateTime.now().millisecondsSinceEpoch;

  String get _fresh => '$siteOrigin${widget.path}${widget.path.contains('?') ? '&' : '?'}app=$_opened';

  @override
  void initState() {
    super.initState();
    _view = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(colors.page)
      // The site talks to the app through `window.ReactNativeWebView.postMessage`.
      ..addJavaScriptChannel('ReactNativeWebView', onMessageReceived: (m) => _onMessage(m.message))
      ..setNavigationDelegate(NavigationDelegate(
        // onLoadEnd: fires whether the page loaded or failed.
        onPageFinished: (_) => _loaded(),
        onWebResourceError: (e) {
          if (e.isForMainFrame ?? true) _loaded();
        },
      ))
      ..loadRequest(Uri.parse(_fresh));
  }

  void _loaded() {
    if (mounted && _loading) setState(() => _loading = false);
  }

  @override
  void didUpdateWidget(WebPage old) {
    super.didUpdateWidget(old);
    if (old.paused == widget.paused) return;
    _view
        .runJavaScript(widget.paused
            ? "document.querySelectorAll('video').forEach(function (v) { v.pause(); }); true;"
            : "(function () { var h = window.innerHeight / 2; document.querySelectorAll('video').forEach(function (v) { var r = v.getBoundingClientRect(); if (r.top < h && r.bottom > h) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } }); })(); true;")
        .catchError((Object _) {});
  }

  void _onMessage(String raw) {
    try {
      final data = jsonDecode(raw);
      if (data is! Map || data['source'] != 'beautybar-app') return;
      if (data['action'] == 'close') widget.onClose?.call();
      if (data['action'] == 'product' && data['id'] is String) {
        widget.onProduct?.call(data['id'] as String, data['back'] is String ? data['back'] as String : widget.path);
      }
    } catch (_) {
      // A message that is not ours to read. Every page on this site may one
      // day post one of its own; only this one shape means anything here.
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: colors.page,
      child: Stack(children: [
        Positioned.fill(child: WebViewWidget(controller: _view)),
        if (_loading)
          Positioned.fill(
            child: IgnorePointer(
              child: ColoredBox(
                color: colors.page,
                child: Center(
                  // RN ActivityIndicator, small (20).
                  child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2.5, color: colors.accent)),
                ),
              ),
            ),
          ),
      ]),
    );
  }
}
