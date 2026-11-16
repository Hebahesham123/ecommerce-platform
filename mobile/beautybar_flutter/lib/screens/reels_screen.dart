/// Reels: every live that was kept, one after another, each with what was sold
/// in it. Generated from the dashboard — App → App theme. Port of ReelsScreen.tsx.
///
/// Played by the phone's own video player (ExoPlayer, AVPlayer) straight from
/// the streaming service, a few seconds at a time at whatever quality the
/// connection can carry. Only the reel on screen and its neighbours are loaded,
/// so the next one is already buffered by the time she swipes to it, and the
/// cover shows the instant a reel arrives rather than a black frame.
library;

import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart' show CircularProgressIndicator, InputDecoration, TextField;
import 'package:flutter/services.dart';
import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../core/api.dart';
import '../core/json.dart';
import '../core/prefs.dart';
import '../core/style.dart';
import '../widgets/fade.dart';
import '../widgets/pieces.dart';
import '../widgets/svg.dart';

const _likedKey = 'reel_like_';

/// Whether a reel is open full screen. The app's back handler leaves the back
/// press to this screen while it is, so back closes the reel and nothing else.
bool reelIsOpen = false;

/// Reels already counted as watched since the app opened.
final Set<String> _counted = {};

const _white = Color(0xFFFFFFFF);
const _ink = Color(0xFF0F172A);
const _slate = Color(0xFF64748B);

/// Port of ReelsScreen.tsx.
class ReelsScreen extends StatefulWidget {
  /// Open on this reel rather than the newest.
  final String? startId;
  /// True while something is opened on top of the feed: video pauses.
  final bool paused;
  final int cartCount;
  final VoidCallback onClose;
  final void Function(String id) onOpenProduct;
  final void Function(String itemId) onAdd;
  final VoidCallback onCheckout;
  /// One of the website's pages, inside the app (the review form).
  final void Function(String path) onOpenPage;
  const ReelsScreen({super.key, this.startId, required this.paused, required this.cartCount, required this.onClose, required this.onOpenProduct, required this.onAdd, required this.onCheckout, required this.onOpenPage});
  @override
  State<ReelsScreen> createState() => _ReelsScreenState();
}

/* ---- icons, as the website draws them ---------------------------------- */
Widget _icon(String name, {bool filled = false}) {
  const common = 'stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  final small = name == 'close' || name == 'share' || name == 'sound';
  final String body;
  switch (name) {
    case 'heart':
      body = '<path $common fill="${filled ? '#ffffff' : 'none'}" d="M12 20s-7.2-4.5-9.1-8.4C1.3 8.3 3.1 5 6.4 5c2 0 3.3 1.1 4.1 2.2l1.5 2 1.5-2C14.3 6.1 15.6 5 17.6 5c3.3 0 5.1 3.3 3.5 6.6C19.2 15.5 12 20 12 20Z"/>';
    case 'bag':
      body = '<path $common d="M5.5 8h13l-1 11.5a1 1 0 0 1-1 .9H7.5a1 1 0 0 1-1-.9L5.5 8Z"/>'
          '<path $common d="M9 8V6.5a3 3 0 0 1 6 0V8"/>';
    case 'tote':
      body = '<rect $common x="3.2" y="6.4" width="17.6" height="13.2" rx="3"/>'
          '<path $common d="M9 10.2a3 3 0 0 0 6 0"/>';
    case 'star':
      body = '<path $common d="m12 4 2.3 4.9 5.2.7-3.8 3.7 1 5.3-4.7-2.6-4.7 2.6 1-5.3L4.5 9.6l5.2-.7L12 4Z"/>';
    case 'share':
      body = '<path $common d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/>'
          '<path $common d="M12 3v13M8 7l4-4 4 4"/>';
    case 'sound':
      body = '<path $common d="M4 9v6h4l5 4V5L8 9H4Z"/>'
          '<path $common d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7 7 0 0 1 0 10"/>';
    default:
      body = '<path stroke="#ffffff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"/>';
  }
  return Svg(body, size: small ? 20 : 24, rootAttrs: 'fill="none"');
}

class _Action extends StatelessWidget {
  final Widget icon;
  final String label;
  final VoidCallback onPress;
  final bool active;
  final bool highlight;
  const _Action({required this.icon, this.label = '', required this.onPress, this.active = false, this.highlight = false});
  @override
  Widget build(BuildContext context) {
    return Tap(
      onTap: onPress,
      child: SizedBox(
        width: 48,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 44,
            height: 44,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: highlight
                  ? const Color(0xFFE11D48)
                  : active
                      ? const Color.fromRGBO(225, 29, 72, 0.9)
                      : const Color.fromRGBO(0, 0, 0, 0.4),
            ),
            child: icon,
          ),
          if (label.isNotEmpty)
            Padding(padding: const EdgeInsets.only(top: 4), child: Text(label, style: ts(10, w: 700, c: _white))),
        ]),
      ),
    );
  }
}

/// JS number → string (no trailing ".0").
String _jsNum(num v) => v.isFinite && v == v.truncate() ? v.truncate().toString() : v.toString();

String _compact(num n) => n >= 1000000
    ? '${_jsNum((n / 100000).round() / 10)}M'
    : n >= 1000
        ? '${_jsNum((n / 100).round() / 10)}K'
        : _jsNum(n);

/// The picture on a reel's tile: a frame from the reel's own video, the way a
/// feed of videos looks, and the live's cover only while the video is still
/// being converted and has no frames to give.
String? _thumbOf(J r) {
  final u = r.s('recordingUrl');
  final at = u.indexOf('/manifest/');
  if (u.contains('cloudflarestream.com') && at > 0) return '${u.substring(0, at)}/thumbnails/thumbnail.jpg?time=2s&height=480';
  return r.s('coverUrl').isNotEmpty ? r.s('coverUrl') : null;
}

/// A player for a reel's stream (HLS when it is one), looping and silent.
VideoPlayerController _playerFor(String url) {
  final c = VideoPlayerController.networkUrl(
    Uri.parse(url),
    formatHint: url.contains('.m3u8') ? VideoFormat.hls : null,
  );
  c.setLooping(true);
  c.setVolume(0);
  return c;
}

/// expo-video `contentFit="cover"`.
class _CoverVideo extends StatelessWidget {
  final VideoPlayerController controller;
  const _CoverVideo(this.controller);
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<VideoPlayerValue>(
      valueListenable: controller,
      builder: (context, v, _) {
        if (!v.isInitialized || v.size.width <= 0 || v.size.height <= 0) return const SizedBox.expand();
        return SizedBox.expand(
          child: FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(width: v.size.width, height: v.size.height, child: VideoPlayer(controller)),
          ),
        );
      },
    );
  }
}

/// RN `<ActivityIndicator>` (small).
Widget _spinner(Color c) =>
    SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: c));

/// Whether a player is really moving: started, and past its first frame
/// (expo-video's "playingChange").
class _Moving {
  bool started = false;
  bool read(VideoPlayerValue v) {
    if (v.isInitialized && v.isPlaying && v.position > Duration.zero) started = true;
    return v.isInitialized && v.isPlaying && started;
  }
}

/// One tile. The frame shows at once; when it is this tile's turn the reel
/// itself plays over it, silently, and fades back to the frame when the turn
/// passes on.
class _GridTile extends StatefulWidget {
  final J reel;
  final double width;
  final double height;
  final bool playing;
  final VoidCallback onPress;
  final List<Widget> children;
  const _GridTile({super.key, required this.reel, required this.width, required this.height, required this.playing, required this.onPress, required this.children});
  @override
  State<_GridTile> createState() => _GridTileState();
}

class _GridTileState extends State<_GridTile> {
  VideoPlayerController? _player;
  final _Moving _mv = _Moving();
  bool _moving = false;

  @override
  void initState() {
    super.initState();
    _sync();
  }

  @override
  void didUpdateWidget(covariant _GridTile old) {
    super.didUpdateWidget(old);
    if (old.playing != widget.playing || old.reel.s('recordingUrl') != widget.reel.s('recordingUrl')) _sync();
  }

  /// The player only has a source while it is this tile's turn.
  void _sync() {
    final url = widget.reel.s('recordingUrl');
    final want = widget.playing && url.isNotEmpty;
    if (!want) {
      _drop();
      _moving = false;
      return;
    }
    if (_player != null && _player!.dataSource == url) {
      _player!.play();
      return;
    }
    _drop();
    final c = _playerFor(url);
    _player = c;
    _mv.started = false;
    c.addListener(_onPlayer);
    c.initialize().then((_) {
      if (_player == c && widget.playing) c.play();
    }).catchError((_) {});
  }

  void _onPlayer() {
    final c = _player;
    if (c == null) return;
    final now = _mv.read(c.value);
    if (now != _moving && mounted) setState(() => _moving = now);
  }

  void _drop() {
    final c = _player;
    _player = null;
    if (c != null) {
      c.removeListener(_onPlayer);
      c.dispose();
    }
  }

  @override
  void dispose() {
    _drop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final thumb = _thumbOf(widget.reel);
    final p = _player;
    return Tap(
      onTap: widget.onPress,
      child: Container(
        width: widget.width,
        height: widget.height,
        color: const Color(0xFFE2E8F0),
        child: Stack(children: [
          if (thumb != null) Positioned.fill(child: NetImage(thumb, fit: BoxFit.cover)),
          if (widget.playing && p != null) Positioned.fill(child: Opacity(opacity: _moving ? 1 : 0, child: _CoverVideo(p))),
          ...widget.children,
        ]),
      ),
    );
  }
}

/// How many tiles play at once, and how long each turn lasts.
const _atOnce = 2;
const _turnMs = 6000;
const double _gridGap = 2;

/// The grid: every reel at a glance, a search above it, like Explore.
class _ReelGrid extends StatefulWidget {
  final List<J> reels;
  final double width;
  /// The whole screen's height, so four reels fill it exactly.
  final double height;
  final TextEditingController query;
  final ValueChanged<String> onQuery;
  final ValueChanged<int> onOpen;
  const _ReelGrid({required this.reels, required this.width, required this.height, required this.query, required this.onQuery, required this.onOpen});
  @override
  State<_ReelGrid> createState() => _ReelGridState();
}

class _ReelGridState extends State<_ReelGrid> {
  final ScrollController _scroll = ScrollController();
  // Which tiles are on screen, and whose turn it is to play.
  List<int> _visible = [];
  int _turn = 0;
  Timer? _timer;

  // Two across and two down: four reels to a screen, big enough to watch,
  // and the rest below on scrolling. The search box takes 60 points.
  double get _tile => (widget.width - _gridGap) / 2;
  double get _tileH => math.max((_tile * 1.2).roundToDouble(), ((widget.height - 60 - _gridGap) / 2).floorToDouble());

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: _turnMs), (_) {
      if (mounted) setState(() => _turn++);
    });
    _scroll.addListener(_measure);
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  @override
  void didUpdateWidget(covariant _ReelGrid old) {
    super.didUpdateWidget(old);
    WidgetsBinding.instance.addPostFrameCallback((_) => _measure());
  }

  /// FlatList's viewability, 70% of a tile in view.
  void _measure() {
    if (!mounted) return;
    final n = widget.reels.length;
    final viewport = widget.height - 60;
    final top = _scroll.hasClients ? _scroll.offset : 0.0;
    final bottom = top + viewport;
    final rowH = _tileH + _gridGap;
    final next = <int>[];
    for (var i = 0; i < n; i++) {
      final y = (i ~/ 2) * rowH;
      final seen = math.max(0.0, math.min(bottom, y + _tileH) - math.max(top, y));
      if (_tileH > 0 && seen / _tileH >= 0.7) next.add(i);
    }
    if (next.length != _visible.length || !Iterable.generate(next.length).every((k) => next[k] == _visible[k])) {
      setState(() => _visible = next);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scroll.dispose();
    super.dispose();
  }

  Widget _countPill(Widget svg, num n) => Positioned(
        left: 6,
        bottom: 6,
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          svg,
          const SizedBox(width: 4),
          Text(_compact(n),
              style: ts(13, w: 700, c: _white, shadows: const [Shadow(color: Color.fromRGBO(0, 0, 0, 0.6), blurRadius: 3)])),
        ]),
      );

  Widget _tileFor(int index, Set<int> playingNow) {
    final item = widget.reels[index];
    final views = item.n('views', 0);
    final likes = item.n('likes', 0);
    return _GridTile(
      key: ValueKey(item.s('id')),
      reel: item,
      width: _tile,
      height: _tileH,
      playing: playingNow.contains(index),
      onPress: () => widget.onOpen(index),
      children: [
        // A reel, not a photo: the mark Instagram puts in the corner.
        const Positioned(
          top: 6,
          right: 6,
          child: IgnorePointer(
            child: Svg(
              '<rect x="3.4" y="4.6" width="17.2" height="14.8" rx="3.2" stroke="#ffffff" stroke-width="1.8"/>'
              '<path d="M10.4 9.6 15 12l-4.6 2.4Z" fill="#ffffff"/>',
              size: 18,
              rootAttrs: 'fill="none"',
            ),
          ),
        ),
        if (views > 0)
          _countPill(
            const Svg(
              '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="#ffffff" stroke-width="1.8"/>'
              '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#ffffff" stroke-width="1.8"/>',
              size: 15,
              rootAttrs: 'fill="none"',
            ),
            views,
          )
        else if (likes > 0)
          _countPill(
            const Svg(
              '<path d="M12 20s-7.2-4.5-9.1-8.4C1.3 8.3 3.1 5 6.4 5c2 0 3.3 1.1 4.1 2.2l1.5 2 1.5-2C14.3 6.1 15.6 5 17.6 5c3.3 0 5.1 3.3 3.5 6.6C19.2 15.5 12 20 12 20Z"/>',
              size: 14,
              rootAttrs: 'fill="#ffffff"',
            ),
            likes,
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final reels = widget.reels;
    final playingNow = <int>{};
    if (_visible.isNotEmpty) {
      for (var k = 0; k < math.min(_atOnce, _visible.length); k++) {
        playingNow.add(_visible[(_turn * _atOnce + k) % _visible.length]);
      }
    }
    final rows = (reels.length + 1) ~/ 2;
    return Container(
      color: _white,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          height: 40,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: const Color(0xFFEFEFEF), borderRadius: BorderRadius.circular(12)),
          child: Row(children: [
            const Svg(
              '<path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.2-3.2" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>',
              size: 18,
              rootAttrs: 'fill="none"',
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: widget.query,
                onChanged: widget.onQuery,
                textInputAction: TextInputAction.search,
                style: ts(16, c: _ink),
                decoration: InputDecoration.collapsed(hintText: 'Search', hintStyle: ts(16, c: _slate)),
              ),
            ),
          ]),
        ),
        if (reels.isEmpty)
          Padding(
            padding: const EdgeInsets.all(32),
            child: Text(widget.query.text.isNotEmpty ? 'No reels match your search.' : 'Nothing to watch yet.',
                textAlign: TextAlign.center, style: ts(14, c: _slate)),
          )
        else
          Expanded(
            child: ListView.separated(
              controller: _scroll,
              padding: const EdgeInsets.only(bottom: 12),
              itemCount: rows,
              separatorBuilder: (_, _) => const SizedBox(height: _gridGap),
              itemBuilder: (context, r) {
                final a = r * 2;
                return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  _tileFor(a, playingNow),
                  if (a + 1 < reels.length) ...[const SizedBox(width: _gridGap), _tileFor(a + 1, playingNow)],
                ]);
              },
            ),
          ),
      ]),
    );
  }
}

/* ---- the products under a reel: a ring that drifts while there are several -- */
const double _card = 84;
const double _gap = 8;

class _ProductRing extends StatefulWidget {
  final List<J> products;
  final String? added;
  final ValueChanged<J> onOpen;
  final ValueChanged<J> onAdd;
  const _ProductRing({required this.products, required this.added, required this.onOpen, required this.onAdd});
  @override
  State<_ProductRing> createState() => _ProductRingState();
}

class _ProductRingState extends State<_ProductRing> with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(vsync: this);
  final ScrollController _row = ScrollController();
  bool _held = false;

  bool get _many => widget.products.length > 1;
  double get _half => widget.products.length * (_card + _gap);

  @override
  void initState() {
    super.initState();
    _run();
  }

  @override
  void didUpdateWidget(covariant _ProductRing old) {
    super.didUpdateWidget(old);
    if (old.products.length != widget.products.length) _run();
  }

  void _run() {
    _drift.stop();
    if (!_many || _held) return;
    _drift.value = 0;
    _drift.duration = Duration(milliseconds: (_half * 45).round());
    _drift.repeat();
  }

  // A thumb on the row stops the drift exactly where it is and hands the row
  // over to her, rather than snapping it back to the start.
  void _hold() {
    if (_held) return;
    final at = -_half * _drift.value;
    _drift.stop();
    _drift.value = 0;
    if (_row.hasClients) _row.jumpTo((-at).clamp(0.0, _row.position.maxScrollExtent));
    setState(() => _held = true);
  }

  @override
  void dispose() {
    _drift.dispose();
    _row.dispose();
    super.dispose();
  }

  Widget _cardFor(J p, int i) {
    final soldOut = p.n('available', 0) <= 0;
    final on = widget.added == p.s('id');
    return SizedBox(
      key: ValueKey('${p.s('id')}-$i'),
      width: _card,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Tap(
          onTap: () => widget.onOpen(p),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: _card,
              height: _card,
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: const Color.fromRGBO(255, 255, 255, 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color.fromRGBO(255, 255, 255, 0.25)),
              ),
              child: p.s('imageUrl').isNotEmpty
                  ? Opacity(opacity: soldOut ? 0.45 : 1, child: NetImage(p.s('imageUrl'), fit: BoxFit.cover))
                  : null,
            ),
            const SizedBox(height: 4),
            SizedBox(
              width: _card,
              child: Text(p.s('productName'),
                  maxLines: 1, overflow: TextOverflow.ellipsis, textAlign: TextAlign.center, style: ts(10, w: 500, c: _white)),
            ),
            const SizedBox(height: 1),
            Text(p.nOrNull('price') != null ? money(p.nOrNull('price')) : '',
                textAlign: TextAlign.center, style: ts(10, w: 700, c: _white)),
          ]),
        ),
        Tap(
          onTap: soldOut ? null : () => widget.onAdd(p),
          child: Container(
            margin: const EdgeInsets.only(top: 4),
            width: _card,
            padding: const EdgeInsets.symmetric(vertical: 6),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8),
              color: soldOut
                  ? const Color.fromRGBO(255, 255, 255, 0.25)
                  : on
                      ? const Color(0xFF059669)
                      : const Color(0xFF8A5A2B),
            ),
            child: Text(soldOut ? 'SOLD OUT' : on ? 'ADDED' : 'ADD TO CART',
                maxLines: 1, overflow: TextOverflow.clip, softWrap: false, style: ts(8, w: 800, ls: 0.6, c: _white)),
          ),
        ),
      ]),
    );
  }

  List<Widget> _spaced(List<J> list) {
    final out = <Widget>[];
    for (var i = 0; i < list.length; i++) {
      if (i > 0) out.add(const SizedBox(width: _gap));
      out.add(_cardFor(list[i], i));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final products = widget.products;
    if (!_many) {
      return Align(
        alignment: Alignment.centerLeft,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 260),
          child: Row(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: _spaced(products)),
        ),
      );
    }
    // Laid end to end twice, so the second copy is already arriving as the
    // first leaves and the row never visibly jumps back to the start.
    final ring = [...products, ...products];
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 260),
        child: Listener(
          onPointerDown: (_) => _hold(),
          child: SingleChildScrollView(
            controller: _row,
            scrollDirection: Axis.horizontal,
            child: AnimatedBuilder(
              animation: _drift,
              builder: (context, child) => Transform.translate(offset: Offset(-_half * _drift.value, 0), child: child),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: _spaced(ring)),
            ),
          ),
        ),
      ),
    );
  }
}

/* ---- one reel ---------------------------------------------------------- */
class _ReelItem extends StatefulWidget {
  final J reel;
  final double height;
  final bool active;
  final bool near;
  final bool muted;
  final int cartCount;
  final VoidCallback onToggleSound;
  final VoidCallback onClose;
  final ValueChanged<J> onOpenProduct;
  final ValueChanged<J> onAdd;
  final VoidCallback onCheckout;
  final ValueChanged<J?> onReview;
  final VoidCallback onShowProducts;
  const _ReelItem({
    super.key,
    required this.reel,
    required this.height,
    required this.active,
    required this.near,
    required this.muted,
    required this.cartCount,
    required this.onToggleSound,
    required this.onClose,
    required this.onOpenProduct,
    required this.onAdd,
    required this.onCheckout,
    required this.onReview,
    required this.onShowProducts,
  });
  @override
  State<_ReelItem> createState() => _ReelItemState();
}

class _ReelItemState extends State<_ReelItem> {
  VideoPlayerController? _player;
  final _Moving _mv = _Moving();
  bool _playing = false;
  late int _likes = widget.reel.i('likes', 0);
  bool _liked = false;
  String? _added;
  Timer? _addedTimer;
  Timer? _viewTimer;
  bool _copied = false;
  Timer? _copiedTimer;
  late List<J> _ordered = _order(widget.reel);

  String get _id => widget.reel.s('id');

  static List<J> _order(J reel) {
    final list = reel.l('products').toList();
    list.sort((a, b) {
      final p = (b.b('pinned') ? 1 : 0) - (a.b('pinned') ? 1 : 0);
      return p != 0 ? p : a.n('sortOrder', 0).compareTo(b.n('sortOrder', 0));
    });
    return list;
  }

  @override
  void initState() {
    super.initState();
    _readLiked();
    _source();
  }

  @override
  void didUpdateWidget(covariant _ReelItem old) {
    super.didUpdateWidget(old);
    if (old.reel.s('id') != _id) _readLiked();
    if (old.reel != widget.reel) _ordered = _order(widget.reel);
    if (old.near != widget.near || old.reel.s('recordingUrl') != widget.reel.s('recordingUrl')) _source();
    final p = _player;
    if (p != null) {
      if (old.muted != widget.muted) p.setVolume(widget.muted ? 0 : 1);
      if (old.active != widget.active && p.value.isInitialized) widget.active ? p.play() : p.pause();
    }
    _syncView();
  }

  void _readLiked() {
    try {
      _liked = prefs.getString(_likedKey + _id) == '1';
    } catch (_) {}
  }

  /// Only the reels about to be seen are given a source; the rest cost nothing.
  void _source() {
    final url = widget.reel.s('recordingUrl');
    final want = widget.near && url.isNotEmpty;
    if (!want) {
      _drop();
      _playing = false;
      return;
    }
    if (_player != null && _player!.dataSource == url) return;
    _drop();
    final c = _playerFor(url);
    _player = c;
    _mv.started = false;
    _playing = false;
    c.setVolume(widget.muted ? 0 : 1);
    c.addListener(_onPlayer);
    c.initialize().then((_) {
      if (_player != c || !mounted) return;
      if (widget.active) c.play();
      setState(() {});
    }).catchError((_) {});
  }

  void _onPlayer() {
    final c = _player;
    if (c == null) return;
    final now = _mv.read(c.value);
    if (now != _playing && mounted) {
      setState(() => _playing = now);
      _syncView();
    }
  }

  void _drop() {
    final c = _player;
    _player = null;
    if (c != null) {
      c.removeListener(_onPlayer);
      c.dispose();
    }
  }

  /// A view, once it has actually been watched for two seconds.
  void _syncView() {
    final want = widget.active && _playing && !_counted.contains(_id);
    if (!want) {
      _viewTimer?.cancel();
      _viewTimer = null;
      return;
    }
    if (_viewTimer != null) return;
    final id = _id;
    _viewTimer = Timer(const Duration(seconds: 2), () {
      _viewTimer = null;
      _counted.add(id);
      viewReel(id);
    });
  }

  // The heart fills at once; the shop is told afterwards, and taking it back
  // is the same tap.
  void _like() {
    final next = !_liked;
    final id = _id;
    setState(() {
      _liked = next;
      _likes = math.max(0, _likes + (next ? 1 : -1));
    });
    try {
      next ? prefs.setString(_likedKey + id, '1') : prefs.remove(_likedKey + id);
    } catch (_) {}
    likeReel(id, next).then((n) {
      if (mounted) setState(() => _likes = n);
    }).catchError((_) {});
  }

  // PORT NOTE: RN opens the system share sheet (Share.share). No share package
  // is available here, so the link is copied to the clipboard with a short note.
  void _share() {
    final url = '$siteOrigin/store/reels?reel=${Uri.encodeComponent(_id)}';
    Clipboard.setData(ClipboardData(text: url)).catchError((_) {});
    setState(() => _copied = true);
    _copiedTimer?.cancel();
    _copiedTimer = Timer(const Duration(milliseconds: 1600), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  void _add(J p) {
    widget.onAdd(p);
    final id = p.s('id');
    setState(() => _added = id);
    _addedTimer?.cancel();
    _addedTimer = Timer(const Duration(milliseconds: 1800), () {
      if (mounted && _added == id) setState(() => _added = null);
    });
  }

  @override
  void dispose() {
    _viewTimer?.cancel();
    _addedTimer?.cancel();
    _copiedTimer?.cancel();
    _drop();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final reel = widget.reel;
    final cover = reel.s('coverUrl');
    final player = _player;
    final ordered = _ordered;
    J? reviewed;
    for (final p in ordered) {
      if (p.b('pinned')) {
        reviewed = p;
        break;
      }
    }
    reviewed ??= ordered.isNotEmpty ? ordered.first : null;

    return Container(
      height: widget.height,
      width: double.infinity,
      color: const Color(0xFF000000),
      clipBehavior: Clip.hardEdge,
      child: Stack(children: [
        Positioned.fill(
          child: Tap(
            onTap: widget.onToggleSound,
            child: Stack(children: [
              if (widget.near && player != null) Positioned.fill(child: _CoverVideo(player)),
              // The cover until the first frame, never a black screen.
              if (!_playing && cover.isNotEmpty) Positioned.fill(child: NetImage(cover, fit: BoxFit.cover)),
              if (!_playing && widget.active && reel.s('recordingUrl').isNotEmpty)
                Positioned.fill(child: IgnorePointer(child: Center(child: _spinner(_white)))),
            ]),
          ),
        ),

        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: widget.height * 0.55,
          child: const Fade(
            angle: 0,
            colors: [Color.fromRGBO(0, 0, 0, 0.8), Color.fromRGBO(0, 0, 0, 0), Color.fromRGBO(0, 0, 0, 0)],
            locations: [0, 0.45, 1],
          ),
        ),

        Positioned(
          top: 14,
          left: 14,
          child: Tap(
            onTap: widget.onClose,
            child: Container(
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: const BoxDecoration(shape: BoxShape.circle, color: Color.fromRGBO(0, 0, 0, 0.4)),
              child: _icon('close'),
            ),
          ),
        ),

        if (widget.muted && _playing)
          Positioned(
            left: 0,
            right: 0,
            top: widget.height * 0.45,
            child: Center(
              child: Tap(
                onTap: widget.onToggleSound,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                  decoration: BoxDecoration(
                    color: const Color.fromRGBO(0, 0, 0, 0.55),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    _icon('sound'),
                    const SizedBox(width: 8),
                    Text('Tap for sound', style: ts(14, w: 700, c: _white)),
                  ]),
                ),
              ),
            ),
          ),

        if (_copied)
          Positioned(
            left: 0,
            right: 0,
            top: 24,
            child: IgnorePointer(
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color.fromRGBO(0, 0, 0, 0.55),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text('Link copied', style: ts(13, w: 700, c: _white)),
                ),
              ),
            ),
          ),

        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 16),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: ordered.isNotEmpty
                    ? _ProductRing(products: ordered, added: _added, onOpen: widget.onOpenProduct, onAdd: _add)
                    : const SizedBox.shrink(),
              ),
              const SizedBox(width: 12),
              Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  _Action(
                      icon: _icon('heart', filled: _liked),
                      label: _likes > 0 ? _compact(_likes) : '',
                      onPress: _like,
                      active: _liked),
                  if (ordered.isNotEmpty) ...[
                    const SizedBox(height: 14),
                    _Action(icon: _icon('bag'), label: '${ordered.length}', onPress: widget.onShowProducts),
                  ],
                  if (widget.cartCount > 0) ...[
                    const SizedBox(height: 14),
                    _Action(icon: _icon('tote'), label: '${widget.cartCount}', onPress: widget.onCheckout, highlight: true),
                  ],
                  const SizedBox(height: 14),
                  _Action(icon: _icon('star'), label: 'Review', onPress: () => widget.onReview(reviewed)),
                  const SizedBox(height: 14),
                  _Action(icon: _icon('share'), onPress: _share),
                ]),
              ),
            ]),
          ),
        ),
      ]),
    );
  }
}

/* ---- the feed ------------------------------------------------------------ */
class _ReelsScreenState extends State<ReelsScreen> {
  List<J>? _reels;
  bool _failed = false;
  int _index = 0;
  bool _muted = true;
  // The grid first; a reel opens full screen on top of it. A replay tapped
  // somewhere else in the app opens straight onto that reel.
  bool _open = false;
  final TextEditingController _query = TextEditingController();
  PageController? _pages;
  bool _sheetUp = false;
  int _load = 0;

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  @override
  void didUpdateWidget(covariant ReelsScreen old) {
    super.didUpdateWidget(old);
    if (old.startId != widget.startId) _fetch();
  }

  void _fetch() {
    final n = ++_load;
    final startId = widget.startId;
    fetchReels().then((list) {
      if (!mounted || n != _load) return;
      final playable = list.where((r) => r.s('recordingUrl').isNotEmpty).toList();
      setState(() {
        _reels = playable;
        final at = startId != null && startId.isNotEmpty ? playable.indexWhere((r) => r.s('id') == startId) : -1;
        if (at >= 0) _openAt(at);
      });
    }).catchError((_) {
      if (mounted && n == _load) setState(() => _failed = true);
    });
  }

  void _openAt(int i) {
    _index = i;
    _open = true;
    reelIsOpen = true;
    _pages?.dispose();
    _pages = PageController(initialPage: i);
  }

  void _closeReel() => setState(() {
        _open = false;
        reelIsOpen = false;
      });

  @override
  void dispose() {
    _pages?.dispose();
    _query.dispose();
    super.dispose();
  }

  /// What the search matches: the reel, its host, and what was sold in it.
  List<J> get _shown {
    final reels = _reels;
    final q = _query.text.trim().toLowerCase();
    if (reels == null || q.isEmpty) return reels ?? const [];
    return reels
        .where((r) => [r.s('title'), r.s('hostName'), ...r.l('products').map((p) => p.s('productName'))]
            .join(' ')
            .toLowerCase()
            .contains(q))
        .toList();
  }

  void _openProduct(J p) {
    final id = p.s('itemId');
    if (id.isNotEmpty) widget.onOpenProduct(id);
  }

  void _add(J p) {
    final id = p.s('itemId');
    if (id.isNotEmpty) widget.onAdd(id);
  }

  void _review(J? p) {
    widget.onOpenPage(p != null && p.s('itemId').isNotEmpty
        ? '/shop/reviews?product=${Uri.encodeComponent(p.s('itemId'))}'
        : '/shop/reviews');
  }

  /// Everything that was sold in this reel.
  void _showSheet(J reel) {
    if (_sheetUp) return;
    _sheetUp = true;
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: false,
      barrierColor: const Color(0x00000000),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (ctx, _, _) => _Sheet(
        reel: reel,
        onClose: () => Navigator.of(ctx).pop(),
        onOpen: (p) {
          Navigator.of(ctx).pop();
          _openProduct(p);
        },
        onAdd: _add,
      ),
      // animationType="slide": the whole modal rises from the bottom.
      transitionBuilder: (ctx, a, _, child) => SlideTransition(
        position: Tween(begin: const Offset(0, 1), end: Offset.zero).animate(CurvedAnimation(parent: a, curve: Curves.easeOut)),
        child: child,
      ),
    ).whenComplete(() => _sheetUp = false);
  }

  @override
  Widget build(BuildContext context) {
    final grabbing = _open && !widget.paused;
    // The phone's back button closes the reel before it leaves the tab.
    // app.dart's own PopScope also hears this back press; it stands aside while
    // reelIsOpen is true.
    return PopScope(
      canPop: !grabbing,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop && _open && !widget.paused) _closeReel();
      },
      child: LayoutBuilder(builder: (context, box) {
        final width = box.maxWidth;
        final height = box.maxHeight;
        final reels = _reels;
        Widget body;
        if (reels == null || height <= 0 || !height.isFinite) {
          body = Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: _failed
                  ? Opacity(
                      opacity: 0.8,
                      child: Text('Reels could not be loaded.', style: ts(14, c: _open ? _white : _ink)),
                    )
                  : _spinner(_open ? _white : const Color(0xFF94A3B8)),
            ),
          );
        } else if (!_open) {
          body = _ReelGrid(
            reels: _shown,
            width: width,
            height: height,
            query: _query,
            onQuery: (_) => setState(() {}),
            onOpen: (i) => setState(() => _openAt(i)),
          );
        } else {
          final shown = _shown;
          body = PageView.builder(
            controller: _pages,
            scrollDirection: Axis.vertical,
            itemCount: shown.length,
            onPageChanged: (i) => setState(() => _index = i),
            itemBuilder: (context, i) {
              final item = shown[i];
              return _ReelItem(
                key: ValueKey(item.s('id')),
                reel: item,
                height: height,
                active: !widget.paused && _open && i == _index,
                near: (i - _index).abs() <= 1,
                muted: _muted,
                cartCount: widget.cartCount,
                onToggleSound: () => setState(() => _muted = !_muted),
                onClose: _closeReel,
                onOpenProduct: _openProduct,
                onAdd: _add,
                onCheckout: widget.onCheckout,
                onReview: _review,
                onShowProducts: () => _showSheet(item),
              );
            },
          );
        }
        return Container(color: _open ? const Color(0xFF000000) : _white, child: body);
      }),
    );
  }
}

/// The sheet of everything sold in a reel (the RN `<Modal>`).
class _Sheet extends StatelessWidget {
  final J reel;
  final VoidCallback onClose;
  final ValueChanged<J> onOpen;
  final ValueChanged<J> onAdd;
  const _Sheet({required this.reel, required this.onClose, required this.onOpen, required this.onAdd});

  @override
  Widget build(BuildContext context) {
    final products = reel.l('products');
    return Tap(
      onTap: onClose,
      child: Container(
        color: const Color.fromRGBO(0, 0, 0, 0.5),
        alignment: Alignment.bottomCenter,
        child: Tap(
          onTap: () {},
          child: Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 28),
            decoration: const BoxDecoration(
              color: _white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(2)),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text('In this live', style: ts(16, w: 700, c: _ink)),
              ),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 420),
                child: SingleChildScrollView(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                    for (final p in products) _row(p),
                  ]),
                ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _row(J p) {
    final soldOut = p.n('available', 0) <= 0;
    return Padding(
      key: ValueKey(p.s('id')),
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(children: [
        Expanded(
          child: Tap(
            onTap: () => onOpen(p),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 56,
                  height: 56,
                  color: const Color(0xFFF1F5F9),
                  child: p.s('imageUrl').isNotEmpty ? NetImage(p.s('imageUrl'), fit: BoxFit.cover) : null,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(p.s('productName'), maxLines: 2, overflow: TextOverflow.ellipsis, style: ts(13, c: _ink)),
                  const SizedBox(height: 2),
                  Text(p.nOrNull('price') != null ? money(p.nOrNull('price')) : '', style: ts(13, w: 700, c: _ink)),
                ]),
              ),
            ]),
          ),
        ),
        const SizedBox(width: 10),
        Tap(
          onTap: soldOut ? null : () => onAdd(p),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(10),
              color: soldOut ? const Color.fromRGBO(255, 255, 255, 0.25) : const Color(0xFF8A5A2B),
            ),
            child: Text(soldOut ? 'SOLD OUT' : 'ADD', style: ts(8, w: 800, ls: 0.6, c: _white)),
          ),
        ),
      ]),
    );
  }
}
