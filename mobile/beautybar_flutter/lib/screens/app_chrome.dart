/// What sits above every screen, in the editor's order: the announcement, the
/// header, and the row of shortcuts under it. Generated from the dashboard —
/// App → App theme. Port of AppChrome.tsx.
library;

import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/color.dart';
import '../core/json.dart';
import '../core/links.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/icons.dart';
import '../widgets/pieces.dart' show NetImage, Tap;

const double _logoHeight = 22;

const Color _line = Color(0xFFE2E8F0);

/// One shape for everything that floats here, so the cards read as a set.
final BoxDecoration _card = BoxDecoration(
  borderRadius: BorderRadius.circular(22),
  border: Border.all(color: const Color.fromRGBO(255, 255, 255, 0.7), width: 1),
  color: const Color.fromRGBO(255, 255, 255, 0.88),
  boxShadow: [rnShadow(color: const Color(0xFF140F0A), opacity: 0.16, radius: 14, offset: const Offset(0, 6))],
);

// ------------------------------------------------------------------ menu --

/// The shop's menu as /menus answers it, kept for the visit once loaded.
/// A menu item is J { title, target: { type, handle?, url? }, children: [] }.
class _MenuStore extends ChangeNotifier {
  J? menu;
  bool failed = false;
  int _run = 0;

  /// Opening the sheet: ask for the menu unless it is already here.
  void open() {
    if (menu != null) return;
    final run = ++_run;
    failed = false;
    notifyListeners();
    api('/menus').then((r) {
      if (run != _run) return;
      final all = J.from(r).l('menus');
      menu = all.where((m) => m.s('handle') == theme.s('menuHandle')).firstOrNull ??
          all.firstOrNull ??
          const J({'handle': '', 'title': '', 'items': <dynamic>[]});
      notifyListeners();
    }).catchError((Object _) {
      if (run != _run) return;
      failed = true;
      notifyListeners();
    });
  }

  /// Closing it: an answer still on its way is no longer wanted.
  void close() => _run++;
}

/// The shop's menu, as the editor's header opens it: a sheet from the bottom,
/// one level per screen, a plus to walk into an item that has children and the
/// item's own name still a link in its own right.
class _MenuSheet extends StatefulWidget {
  final _MenuStore store;
  final VoidCallback onClose;
  final void Function(J target) onPick;
  const _MenuSheet({required this.store, required this.onClose, required this.onPick});
  @override
  State<_MenuSheet> createState() => _MenuSheetState();
}

class _MenuSheetState extends State<_MenuSheet> {
  List<J> _trail = [];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(listenable: widget.store, builder: (context, _) => _sheet(context));
  }

  Widget _sheet(BuildContext context) {
    final menu = widget.store.menu;
    final parent = _trail.isNotEmpty ? _trail.last : null;
    final items = parent != null ? parent.l('children') : (menu != null ? menu.l('items') : const <J>[]);
    final title = parent != null ? parent.s('title') : (menu != null ? menu.s('title') : '');
    final under = _trail.length > 1 ? _trail[_trail.length - 2].s('title') : (menu != null ? menu.s('title') : '');
    final h = MediaQuery.sizeOf(context).height;

    Widget empty(String text) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 16),
          child: Text(text, textAlign: TextAlign.center, style: ts(14, c: const Color(0xFF94A3B8))),
        );

    Widget body;
    if (menu == null) {
      body = empty(widget.store.failed ? 'The menu could not be loaded.' : 'Loading...');
    } else if (items.isEmpty) {
      body = empty('This menu is empty');
    } else {
      final showAll = parent != null && parent.o('target').s('type') != 'home';
      final rows = <Widget>[
        if (showAll)
          Tap(
            onTap: () => widget.onPick(parent.o('target')),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minHeight: 48),
              child: Row(children: [
                Flexible(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    child: Text('All ${parent.s('title')}',
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(13, w: 600, c: const Color(0xFF0F172A))),
                  ),
                ),
              ]),
            ),
          ),
        for (var i = 0; i < items.length; i++) _row(items[i], lined: !(i == 0 && !showAll)),
      ];
      body = Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
        if (parent != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Tap(
              onTap: () => setState(() => _trail = _trail.sublist(0, _trail.length - 1)),
              child: Row(children: [
                const HeaderIcon(name: 'back', color: Color(0xFF64748B), size: 14),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(under.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: ts(11, w: 700, ls: 1.3, c: const Color(0xFF64748B))),
                ),
              ]),
            ),
          ),
        // menuList: marginHorizontal -16 against the body's 16, so its lines run edge to edge.
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: const BoxDecoration(border: Border(top: BorderSide(color: _line), bottom: BorderSide(color: _line))),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
        ),
      ]);
    }

    return Material(
      type: MaterialType.transparency,
      child: Stack(children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: widget.onClose,
            behavior: HitTestBehavior.opaque,
            child: const ColoredBox(color: Color.fromRGBO(15, 23, 42, 0.4)),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: h * 0.85),
            child: ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
              child: ColoredBox(
                color: const Color(0xFFFFFFFF),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: _line))),
                    child: Row(children: [
                      Expanded(
                        child: Text(title,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(14, w: 700, c: const Color(0xFF0F172A))),
                      ),
                      Tap(
                        onTap: widget.onClose,
                        child: const SizedBox(
                          width: 32,
                          height: 32,
                          child: Center(child: HeaderIcon(name: 'close', color: Color(0xFF94A3B8), size: 16)),
                        ),
                      ),
                    ]),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.only(top: 16, bottom: 32),
                      child: body,
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _row(J item, {required bool lined}) {
    final target = item.o('target');
    final children = item.l('children');
    return Container(
      constraints: const BoxConstraints(minHeight: 48),
      decoration: lined ? const BoxDecoration(border: Border(top: BorderSide(color: _line))) : null,
      child: Row(children: [
        Expanded(
          child: Tap(
            onTap: () => widget.onPick(target),
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 14),
              child: Row(children: [
                Flexible(
                  child: Text(item.s('title'),
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(13, c: const Color(0xFF1E293B))),
                ),
                if (target.s('type') == 'url') ...[
                  const SizedBox(width: 8),
                  Text('external link', style: ts(10, w: 500, c: const Color(0xFF94A3B8))),
                ],
              ]),
            ),
          ),
        ),
        if (children.isNotEmpty) ...[
          const SizedBox(width: 8),
          Tap(
            onTap: () => setState(() => _trail = [..._trail, item]),
            child: Container(
              width: 36,
              height: 36,
              margin: const EdgeInsets.symmetric(vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: _line),
                color: const Color(0xFFF8FAFC),
              ),
              alignment: Alignment.center,
              child: const HeaderIcon(name: 'plus', color: Color(0xFF475569), size: 16),
            ),
          ),
        ],
      ]),
    );
  }
}

// ---------------------------------------------------------------- chrome --

/// Port of AppChrome.tsx (+ its MenuSheet): announcement, tinted header with logo,
/// wishlist, bag, search field with rotating hint, menu sheet, shortcut strip.
class AppChrome extends StatefulWidget {
  final List<String> suggest;
  final String query;
  final void Function(String v) onQuery;
  final int cartCount;
  final VoidCallback? onHome;
  final VoidCallback? onBag;
  final VoidCallback? onWishlist;
  final void Function(String handle)? onOpenCollection;
  final void Function(String id)? onOpenProduct;
  final void Function(String screen)? onOpenScreen;
  const AppChrome({super.key, required this.suggest, required this.query, required this.onQuery, required this.cartCount, this.onHome, this.onBag, this.onWishlist, this.onOpenCollection, this.onOpenProduct, this.onOpenScreen});
  @override
  State<AppChrome> createState() => _AppChromeState();
}

class _AppChromeState extends State<AppChrome> with SingleTickerProviderStateMixin {
  final _MenuStore _menu = _MenuStore();
  bool _menuOpen = false;

  late final TextEditingController _search = TextEditingController(text: widget.query);
  final FocusNode _focus = FocusNode();

  int _hintAt = 0;
  Timer? _hintTimer;
  String? _hintDeps;

  double _logoRatio = 4.5;
  ImageStream? _logoStream;
  ImageStreamListener? _logoListener;

  int _stripOn = 0;
  bool _stripHeld = false;
  Timer? _heldTimer;
  double _far = 0;
  final ScrollController _strip = ScrollController();
  final GlobalKey _stripContent = GlobalKey();
  late final AnimationController _drift = AnimationController(vsync: this);

  J get _header => theme.o('header');
  Color get _ink => css(_header.sOr('ink', '#191614'), const Color(0xFF191614));
  Color get _bg => css(_header.sOr('bg', '#ffffff'), const Color(0xFFFFFFFF));

  @override
  void initState() {
    super.initState();
    _focus.addListener(() {
      if (mounted) setState(() {});
    });
    _syncHintTimer();
    _loadLogoRatio();
  }

  @override
  void didUpdateWidget(AppChrome old) {
    super.didUpdateWidget(old);
    if (widget.query != _search.text) {
      _search.value = TextEditingValue(text: widget.query, selection: TextSelection.collapsed(offset: widget.query.length));
    }
    _syncHintTimer();
  }

  @override
  void dispose() {
    _hintTimer?.cancel();
    _heldTimer?.cancel();
    if (_logoListener != null) _logoStream?.removeListener(_logoListener!);
    _drift.dispose();
    _strip.dispose();
    _search.dispose();
    _focus.dispose();
    _menu.close();
    super.dispose();
  }

  // --- menu ---

  void _openMenu() {
    if (_menuOpen) return;
    _menuOpen = true;
    _menu.open();
    showGeneralDialog<J>(
      context: context,
      barrierDismissible: false,
      barrierColor: const Color(0x00000000),
      transitionDuration: const Duration(milliseconds: 300),
      // RN Modal animationType="slide": the whole modal, shade and all, comes up from below.
      transitionBuilder: (context, a, _, child) => SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero)
            .animate(CurvedAnimation(parent: a, curve: Curves.easeOut, reverseCurve: Curves.easeIn)),
        child: child,
      ),
      pageBuilder: (ctx, _, _) => _MenuSheet(
        store: _menu,
        onClose: () => Navigator.of(ctx).pop(),
        onPick: (t) => Navigator.of(ctx).pop(t),
      ),
    ).then((target) {
      _menuOpen = false;
      _menu.close();
      if (target != null && mounted) _pick(target);
    });
  }

  void _pick(J target) {
    switch (target.s('type')) {
      case 'collection':
        widget.onOpenCollection?.call(target.s('handle'));
      case 'product':
        widget.onOpenProduct?.call(target.s('handle'));
      case 'page':
        widget.onOpenScreen?.call(target.s('handle'));
      case 'url':
        openUrl(target.s('url'));
      default:
        widget.onOpenScreen?.call(target.s('type'));
    }
  }

  // --- search hint ---

  /// What the box offers while it is empty.
  ///
  /// The shop's own wording first, then its collections - so it can never name
  /// something the shop does not sell. It changes only while the box is empty:
  /// a hint that moves under a cursor has become an obstacle.
  List<String> _hints() {
    final out = <String>[];
    for (final h in [_header.s('searchPlaceholder'), ...widget.suggest]) {
      final t = h.trim();
      if (t.isNotEmpty && t.length <= 34 && !out.contains(t)) out.add(t);
    }
    return out.take(8).toList();
  }

  void _syncHintTimer() {
    final n = _hints().length;
    final deps = '$n|${widget.query}';
    if (deps == _hintDeps) return;
    _hintDeps = deps;
    _hintTimer?.cancel();
    _hintTimer = null;
    if (n < 2 || widget.query.isNotEmpty) return;
    _hintTimer = Timer.periodic(const Duration(milliseconds: 2600), (_) {
      if (!mounted) return;
      setState(() => _hintAt = (_hintAt + 1) % n);
    });
  }

  // --- logo ---

  /// The logo keeps its own proportions at the header's height, as it does in
  /// the editor, rather than being squeezed into a fixed box.
  void _loadLogoRatio() {
    final url = theme.s('logoUrl');
    if (url.isEmpty) return;
    final stream = CachedNetworkImageProvider(url).resolve(ImageConfiguration.empty);
    final listener = ImageStreamListener((info, _) {
      final w = info.image.width, h = info.image.height;
      if (w > 0 && h > 0 && mounted) setState(() => _logoRatio = w / h);
    }, onError: (_, _) {});
    stream.addListener(listener);
    _logoStream = stream;
    _logoListener = listener;
  }

  // --- shortcut strip ---
  //
  // The shortcut row travels one way and never arrives. Turning round at the
  // end trades a row that looks finished for a row that visibly bounces off a
  // wall, so the shortcuts are laid down twice and the travel resets at the
  // seam: the second copy is the first, so the join cannot be seen. It yields
  // to a thumb and picks up again a couple of seconds after it lifts.

  /// Half the content, because by then the row is holding two copies of
  /// itself: one copy's width is exactly how far it can travel before the
  /// second copy is standing where the first was.
  void _measure() {
    final box = _stripContent.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.hasSize) return;
    final far = box.size.width / 2;
    if (far != _far) {
      setState(() => _far = far);
      _syncDrift();
    }
  }

  void _syncDrift() {
    _drift.stop();
    if (_stripHeld || _far <= 1) return;
    // The editor's pace: about twenty-five points a second.
    _drift.duration = Duration(microseconds: (_far / 25 * 1000000).round());
    _drift.value = 0;
    _drift.repeat();
  }

  /// Hand the row to the thumb exactly where the drift left it.
  void _hold() {
    if (_stripHeld) return;
    final at = -_far * _drift.value;
    _drift.stop();
    _drift.value = 0;
    if (_strip.hasClients) {
      final pos = _strip.position;
      _strip.jumpTo((-at).clamp(pos.minScrollExtent, pos.maxScrollExtent));
    }
    setState(() => _stripHeld = true);
    // Stopping for good would leave the shortcuts past the fold unseen for the
    // rest of the visit, so the row picks itself up again.
    _heldTimer?.cancel();
    _heldTimer = Timer(const Duration(milliseconds: 2000), () {
      if (!mounted) return;
      setState(() => _stripHeld = false);
      _syncDrift();
    });
  }

  Widget _stripRow() {
    final items = theme.o('strip').l('items');
    final links = LinkHandlers(
      onOpenCollection: widget.onOpenCollection,
      onOpenProduct: widget.onOpenProduct,
      onOpenScreen: widget.onOpenScreen,
    );
    final doubled = [...items, ...items];
    final children = <Widget>[];
    for (var i = 0; i < doubled.length; i++) {
      final item = doubled[i];
      final which = i % items.length;
      final on = which == _stripOn;
      if (i > 0) children.add(const SizedBox(width: 16));
      children.add(Tap(
        key: ValueKey(item.s('id') + (i >= items.length ? '-again' : '')),
        onTap: () {
          setState(() => _stripOn = which);
          openLink(item, links);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: on ? colors.accent : const Color(0x00000000), width: 2)),
          ),
          child: Text(item.s('label'), style: ts(12, w: 600, c: on ? colors.accent : const Color(0xFF64748B))),
        ),
      ));
    }
    // onLayout / onContentSizeChange: measure once the row is laid out.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _measure();
    });
    return Listener(
      onPointerDown: (_) => _hold(),
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFFFFFFFF),
          border: Border(bottom: BorderSide(color: _line)),
        ),
        child: SingleChildScrollView(
          controller: _strip,
          scrollDirection: Axis.horizontal,
          child: Padding(
            key: _stripContent,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: AnimatedBuilder(
              animation: _drift,
              builder: (context, child) => Transform.translate(offset: Offset(-_far * _drift.value, 0), child: child),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: children),
            ),
          ),
        ),
      ),
    );
  }

  // --- drawing ---

  Widget _round({required Widget child, Color color = const Color(0xFFFFFFFF), VoidCallback? onTap}) => Tap(
        onTap: onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
          alignment: Alignment.center,
          child: child,
        ),
      );

  Widget _logo(Color ink) {
    final logoUrl = theme.s('logoUrl');
    final wordmark = _header.sOr('logoText', theme.s('storeName'));
    final accentText = _header.s('logoAccentText');
    if (logoUrl.isNotEmpty) {
      final w = _logoHeight * _logoRatio < 160 ? _logoHeight * _logoRatio : 160.0;
      return Align(
        alignment: Alignment.centerLeft,
        child: NetImage(logoUrl, fit: BoxFit.contain, width: w, height: _logoHeight),
      );
    }
    if (wordmark.isEmpty && accentText.isEmpty) return const SizedBox.shrink();
    // textTransform: "uppercase" covers the accent part too.
    return Text.rich(
      TextSpan(text: wordmark.toUpperCase(), children: [
        if (accentText.isNotEmpty) TextSpan(text: accentText.toUpperCase(), style: TextStyle(color: colors.accent)),
      ]),
      style: ts(15, w: 800, ls: 0.9, c: ink),
    );
  }

  Widget _topRow(Color ink) {
    final count = widget.cartCount;
    final children = <Widget>[
      Expanded(
        child: Tap(onTap: widget.onHome, child: _logo(ink)),
      ),
      if (_header.b('showWishlist'))
        _round(onTap: widget.onWishlist, child: HeaderIcon(name: 'heart', color: ink, size: 18)),
      // Filled rather than drawn: it is the one thing up here that is the
      // end of a journey rather than the start of one.
      if (_header.b('showBag'))
        Stack(clipBehavior: Clip.none, children: [
          _round(onTap: widget.onBag, color: ink, child: const HeaderIcon(name: 'bag', color: Color(0xFFFFFFFF), size: 18)),
          if (count > 0)
            Positioned(
              top: -4,
              right: -4,
              child: IgnorePointer(
                child: Container(
                  constraints: const BoxConstraints(minWidth: 16),
                  height: 16,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.pill)),
                  alignment: Alignment.center,
                  child: Text(count > 99 ? '99+' : '$count', style: ts(9, w: 700, c: const Color(0xFFFFFFFF))),
                ),
              ),
            ),
        ]),
      // With no search there is no second row, so the menu stays up here.
      // (marginRight: -4 — it takes 32 of the row and hangs 4 past its edge.)
      if (!theme.b('showSearch'))
        SizedBox(
          width: 32,
          height: 36,
          child: OverflowBox(
            alignment: Alignment.centerLeft,
            minWidth: 36,
            maxWidth: 36,
            child: _round(onTap: _openMenu, child: HeaderIcon(name: 'menu', color: ink, size: 18)),
          ),
        ),
    ];
    final spaced = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      if (i > 0) spaced.add(const SizedBox(width: 8));
      spaced.add(children[i]);
    }
    return Container(
      decoration: _card,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(children: spaced),
    );
  }

  /// The whole of the second line, which is the only way a placeholder
  /// gets to say anything longer than two words. Searching and browsing
  /// the menu are the two ways of finding something, so they share it.
  Widget _searchRow(Color ink) {
    final hints = _hints();
    final hint = hints.isNotEmpty ? hints[_hintAt % hints.length] : _header.s('searchPlaceholder');
    // clearButtonMode="while-editing" is drawn by iOS only.
    final showClear = defaultTargetPlatform == TargetPlatform.iOS && _focus.hasFocus && _search.text.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(children: [
        Expanded(
          child: Container(
            height: 44,
            decoration: _card,
            child: Stack(alignment: Alignment.centerLeft, children: [
              Positioned(
                left: 16,
                top: 0,
                bottom: 0,
                child: IgnorePointer(child: Center(child: HeaderIcon(name: 'search', color: hexA(ink, '80'), size: 16))),
              ),
              Padding(
                padding: EdgeInsets.only(left: 44, right: showClear ? 4 : 16),
                child: Row(children: [
                  Expanded(
                    child: TextField(
                      controller: _search,
                      focusNode: _focus,
                      onChanged: (v) {
                        widget.onQuery(v);
                        setState(() {});
                      },
                      textInputAction: TextInputAction.search,
                      style: ts(12.5, c: ink),
                      maxLines: 1,
                      decoration: InputDecoration.collapsed(
                        hintText: hint,
                        hintStyle: ts(12.5, c: hexA(ink, '70')),
                      ),
                    ),
                  ),
                  if (showClear)
                    Tap(
                      onTap: () {
                        _search.clear();
                        widget.onQuery('');
                        setState(() {});
                      },
                      child: Container(
                        width: 28,
                        height: 28,
                        alignment: Alignment.center,
                        child: Container(
                          width: 16,
                          height: 16,
                          decoration: const BoxDecoration(color: Color(0xFFB4B4B9), shape: BoxShape.circle),
                          alignment: Alignment.center,
                          child: const HeaderIcon(name: 'close', color: Color(0xFFFFFFFF), size: 10),
                        ),
                      ),
                    ),
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(width: 8),
        Tap(
          onTap: _openMenu,
          child: Container(
            width: 44,
            height: 44,
            decoration: _card,
            alignment: Alignment.center,
            child: HeaderIcon(name: 'menu', color: ink, size: 18),
          ),
        ),
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ink = _ink;
    final bg = _bg;
    final ann = theme.o('announcement');
    final strip = theme.o('strip');
    final hasStrip = strip.b('enabled') && strip.l('items').isNotEmpty;

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (ann.b('enabled') && ann.s('text').isNotEmpty)
          Container(
            color: colors.accent,
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
            child: Text(ann.s('text'), textAlign: TextAlign.center, style: ts(11, w: 500, c: const Color(0xFFFFFFFF))),
          ),
        // The tinted ground under the header cards and the shortcut strip.
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [hexA(colors.accent, '2b'), bg, bg],
              stops: const [0, 0.55, 1],
            ),
          ),
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _topRow(ink),
              if (theme.b('showSearch')) _searchRow(ink),
              if (hasStrip) _stripRow(),
            ],
          ),
        ),
      ],
    );
  }
}
