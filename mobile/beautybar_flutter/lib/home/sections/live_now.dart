/// Live now. Generated from the dashboard — App → App theme. Port of LiveNow.tsx.
library;

import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' show FontFeature, PathMetric;

import 'package:flutter/widgets.dart';
import 'package:video_player/video_player.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/prefs.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/fade.dart';
import '../../widgets/pieces.dart';
import '../../widgets/svg.dart';
import '../section.dart';

Widget? liveNowSection(SectionCtx c) {
  final settings = c.settings;
  final people = _peopleOf(settings, c.data.lives);
  // PORT NOTE: the RN component decides with the signed-in name in hand. The
  // name arrives later, so here a title that is only "{name}" still counts as
  // an offer; the widget draws nothing if it turns out empty.
  final title = settings.s('offerTitle');
  final mayOffer = settings['offerEnabled'] != false &&
      (_personalise(title, null).isNotEmpty || title.contains('{name}') || settings.s('offerText').isNotEmpty);
  if (people.isEmpty && !mayOffer) return null;
  return _LiveNow(settings: settings, people: people, collections: c.data.collections, links: c.links);
}

/// Whoever is genuinely on air comes first, with the cover chosen when the
/// live was created. Behind them stand the recordings the merchant keeps in
/// this section, so the row is never empty between shows.
List<J> _peopleOf(J settings, List<J> lives) {
  final onAir = lives.where((l) => l.s('status') == 'live');
  return [
    for (final l in onAir)
      J({
        'id': l.s('id'),
        if (l.s('coverUrl').isNotEmpty) 'imageUrl': l.s('coverUrl'),
        'name': l.sOr('hostName', l.s('title')),
        if (truthy(l['peakViewers'])) 'viewers': _jsStr(l['peakViewers']),
        'url': l.s('href'),
        'onAir': true,
        'likes': l.i('likes', 0),
        'pieces': l.i('pieces', 0),
      }),
    for (final i in settings.l('items'))
      if (i.s('videoUrl').isNotEmpty || i.s('imageUrl').isNotEmpty || i.s('name').isNotEmpty) i.merge(const J({'onAir': false})),
  ];
}

/// JS `String(v)` for a JSON value (whole numbers without ".0").
String _jsStr(dynamic v) {
  if (v is num) return _jsNum(v);
  return v?.toString() ?? '';
}

String _jsNum(num v) => v == v.truncate() && v.isFinite ? v.truncate().toString() : v.toString();

/// Put the shopper name into the line the merchant wrote, or take the token out.
/// A literal "{name}" on screen is worse than no personalisation, so when nobody
/// is signed in the token and the comma after it go, and the line starts later.
String _personalise(String template, String? name) {
  final first = (name ?? '').trim().split(' ').first;
  if (first.isNotEmpty) return template.split('{name}').join(first);
  var out = template.split('{name}').join('').trim();
  // A possessive reads as "'s profile" once the name is gone, so the
  // apostrophe leaves with it rather than dangling at the front of the line.
  if (out.startsWith("'s ") || out.startsWith('’s ')) out = out.substring(3).trim();
  if (out == "'s" || out == '’s') out = '';
  while (out.startsWith(',') || out.startsWith('،')) {
    out = out.substring(1).trim();
  }
  return out.isNotEmpty ? out[0].toUpperCase() + out.substring(1) : '';
}

String _pad(int n) => n < 10 ? '0$n' : '$n';

/// The live a replay link points at, when it is one of ours.
///
/// A replay circle here is something the merchant set up by hand, so its own
/// id is the editor's, not the live's. What she pasted into it is usually the
/// live's link from the dashboard - `/store/live/<id>` - or a shared reel
/// link with `?reel=<id>`, and that is where the real id is.
String? _reelIdOf(String url) {
  if (url.isEmpty) return null;
  final m = RegExp(r'/store/live/([^/?#]+)').firstMatch(url) ?? RegExp(r'[?&]reel=([^&#]+)').firstMatch(url);
  if (m == null) return null;
  try {
    return Uri.decodeComponent(m.group(1)!);
  } catch (_) {
    return m.group(1);
  }
}

class _LiveNow extends StatefulWidget {
  final J settings;
  final List<J> people;
  final List<CollectionInfo> collections;
  final LinkHandlers links;
  const _LiveNow({required this.settings, required this.people, required this.collections, required this.links});
  @override
  State<_LiveNow> createState() => _LiveNowState();
}

class _LiveNowState extends State<_LiveNow> {
  String? _name;
  Map<String, J> _reels = {};
  String _reelsKey = '';
  late int _total;
  late int _left;
  Timer? _tick;
  bool _alive = true;

  int get _totalNow {
    final m = widget.settings.nOrNull('offerMinutes') ?? 10;
    return m.isFinite ? math.max(0, (m * 60).truncate()) : 0;
  }

  @override
  void initState() {
    super.initState();
    // The offer is addressed by name, so ask who is signed in. Signed out this
    // rejects, and the greeting simply loses the name — never a blocked screen.
    fetchAccount().then((a) {
      if (_alive) setState(() => _name = a['name'] is String ? a['name'] as String : null);
    }).catchError((_) {});
    _loadReels();
    _total = _totalNow;
    _left = _total;
    _schedule();
  }

  @override
  void didUpdateWidget(covariant _LiveNow old) {
    super.didUpdateWidget(old);
    _loadReels();
    final t = _totalNow;
    if (t != _total) {
      _total = t;
      _left = t;
      _schedule();
    }
  }

  /// What each replay tile can play and say: its stream, its likes and how
  /// many things were sold in it — asked once for the whole row.
  void _loadReels() {
    final key = widget.people.map((p) => p.s('videoUrl')).join('|');
    if (key == _reelsKey) return;
    _reelsKey = key;
    if (!widget.people.any((p) => _reelIdOf(p.s('videoUrl')) != null)) return;
    fetchReels().then((list) {
      if (!_alive || key != _reelsKey) return;
      final byId = <String, J>{};
      for (final r in list) {
        byId[r.s('id')] = r;
      }
      setState(() => _reels = byId);
    }).catchError((_) {});
  }

  void _schedule() {
    _tick?.cancel();
    if (_left <= 0) return;
    _tick = Timer(const Duration(seconds: 1), () {
      if (!mounted) return;
      setState(() => _left = _left > 0 ? _left - 1 : 0);
      _schedule();
    });
  }

  @override
  void dispose() {
    _alive = false;
    _tick?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.settings;
    final people = widget.people;
    final showReplays = s['showReplays'] != false;
    final liveLabel = s.sOr('liveLabel', 'LIVE');

    // An empty colour means "follow the brand", so the section keeps up with the
    // accent instead of stranding a hex somebody typed once and forgot.
    Color col(String key, Color fallback) => s.s(key).isNotEmpty ? css(s.s(key), fallback) : fallback;
    final badgeBg = col('badgeBg', const Color(0xFFE11D48));
    final badgeFg = col('badgeTextColor', const Color(0xFFFFFFFF));
    final offerBg = col('offerBg', colors.accent);
    final offerFg = col('offerTextColor', const Color(0xFFFFFFFF));
    final timerBg = col('timerBg', const Color.fromRGBO(255, 255, 255, 0.22));
    final timerFg = col('timerTextColor', const Color(0xFFFFFFFF));

    double pos(String key, double fallback) {
      final v = s.n(key, 0);
      return v > 0 ? v : fallback;
    }

    final size = pos('avatarSize', 64);
    final shape = s.sOr('avatarShape', 'circle');
    final double photoRadius =
        shape == 'square' ? 4 : shape == 'rounded' ? (size * 0.28).roundToDouble() : (size / 2).roundToDouble();
    final nameSize = pos('nameSize', 10);
    final viewersSize = pos('viewersSize', 9);
    final bannerRadius = pos('bannerRadius', Radii.lg);
    final og = s['offerGap'];
    final double offerGap = og is num && og >= 0 ? og.toDouble() : Spacing.md;
    final oh = s['offerHeight'];
    final double? offerHeight = oh is num && oh > 0 ? oh.toDouble() : null;
    final offerTitleSize = pos('offerTitleSize', 13);
    final offerTextSize = pos('offerTextSize', 11);
    // A card, not a face in a circle: the portrait shape a phone video is. It
    // takes its width from the size the merchant set, but never less than a
    // name and a pill need.
    final double tileW = math.max((size * 1.25).roundToDouble(), 80);
    final double tileH = (tileW * 1.38).roundToDouble();
    final double tileR = shape == 'square' ? 6 : 14;
    final autoplay = s['autoplayReplays'] != false;
    // ringWidth, ringColor and replayBadge are read by the editor only (void in RN).

    final offerTitle = _personalise(s.s('offerTitle'), _name);
    final offerText = s.s('offerText');
    final hasOffer = s['offerEnabled'] != false && (offerTitle.isNotEmpty || offerText.isNotEmpty);
    if (people.isEmpty && !hasOffer) return const SizedBox.shrink();

    /// A typed link wins over a collection: it is the more specific thing to set.
    void go(J to) => openLink(to, widget.links);
    final onOpenScreen = widget.links.onOpenScreen;
    final title = s.s('title');

    final tiles = <Widget>[];
    for (var i = 0; i < people.length; i++) {
      final p = people[i];
      final borrowed = inherit(p, widget.collections);
      final photo = p.s('imageUrl').isNotEmpty ? p.s('imageUrl') : borrowed.image;
      final onAirNow = p['onAir'] != false;
      final reelId = _reelIdOf(p.s('videoUrl'));
      final reel = reelId != null ? _reels[reelId] : null;
      final liveId = onAirNow ? p.s('id') : reel?.s('id');
      final likes = onAirNow ? p.i('likes', 0) : (reel != null ? reel.i('likes', 0) : 0);
      final pieces = onAirNow ? p.i('pieces', 0) : (reel != null ? reel.list('products').length : 0);
      final rec = reel?.s('recordingUrl') ?? '';
      if (tiles.isNotEmpty) tiles.add(SizedBox(width: gap.item));
      tiles.add(_LiveTile(
        key: ValueKey(p.s('id')),
        width: tileW,
        height: tileH,
        radius: tileR,
        photo: photo != null && photo.isNotEmpty ? photo : null,
        // Only the first few tiles play at once; a long row would
        // otherwise be a dozen videos nobody can see.
        video: autoplay && i < 4 && reel != null && rec.isNotEmpty ? rec : null,
        name: p.s('name').isNotEmpty ? p.s('name') : borrowed.title,
        viewers: p.s('viewers'),
        onAir: onAirNow,
        liveLabel: liveLabel,
        badgeBg: badgeBg,
        badgeFg: badgeFg,
        nameSize: nameSize,
        viewersSize: viewersSize,
        pieces: pieces,
        liveId: liveId,
        likes: likes,
        onPress: () {
          // A live on air now is a broadcast, not a reel: it keeps the
          // way in it always had.
          if (p['onAir'] == true) return onOpenScreen?.call('live:${p.s('id')}');
          // A recording opens in the app's own reels feed, on the reel
          // it is - not a bare video file in the system browser.
          if (reelId != null) return onOpenScreen?.call('reel:$reelId');
          if (p.s('videoUrl').isNotEmpty) return onOpenScreen?.call('reels');
          go(p);
        },
      ));
    }

    if (showReplays) {
      if (tiles.isNotEmpty) tiles.add(SizedBox(width: gap.item));
      tiles.add(Tap(
        onTap: () {
          if (s.s('replaysUrl').isNotEmpty ||
              s.s('replaysHandle').isNotEmpty ||
              s.s('replaysProductId').isNotEmpty ||
              s.s('replaysScreen').isNotEmpty) {
            go(J({
              'url': s.s('replaysUrl'),
              'handle': s.s('replaysHandle'),
              'productId': s.s('replaysProductId'),
              'screen': s.s('replaysScreen'),
            }));
          } else {
            onOpenScreen?.call('reels');
          }
        },
        child: SizedBox(
          width: math.max(size + 12, 56),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            CustomPaint(
              painter: _DashedBorder(color: const Color(0xFFCBD5E1), radius: photoRadius),
              child: Container(
                width: size,
                height: size,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(photoRadius),
                ),
                child: Text('▶', style: ts((size / 3.5).roundToDouble(), c: const Color(0xFF94A3B8))),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: Text(s.sOr('replaysLabel', 'Replays'),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: ts(nameSize, w: 600, c: colors.inkSoft)),
            ),
          ]),
        ),
      ));
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      if (title.isNotEmpty) SectionHeading(title: title),
      if (people.isNotEmpty)
        Padding(
          padding: EdgeInsets.only(top: title.isNotEmpty ? 6 : 0),
          // The row runs to the screen's edges and gives the gutter back inside, as
          // the editor's does, so the last tile slides off the edge rather than
          // stopping short of it.
          child: Bleed(
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.only(left: 16, right: 16, bottom: 2),
              child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: tiles),
            ),
          ),
        ),
      if (hasOffer)
        Padding(
          padding: EdgeInsets.only(top: offerGap),
          child: Tap(
            onTap: () => go(J({
              'url': s.s('offerUrl'),
              'handle': s.s('offerHandle'),
              'productId': s.s('offerProductId'),
              'screen': s.s('offerScreen'),
            })),
            child: Container(
              constraints: BoxConstraints(minHeight: offerHeight ?? 0),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(color: offerBg, borderRadius: BorderRadius.circular(bannerRadius)),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                    if (offerTitle.isNotEmpty)
                      Text(offerTitle,
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(offerTitleSize, w: 700, c: offerFg)),
                    if (offerText.isNotEmpty)
                      Opacity(
                        opacity: 0.85,
                        child: Text(offerText,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(offerTextSize, c: offerFg)),
                      ),
                  ]),
                ),
                const SizedBox(width: 10),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                      color: timerBg, borderRadius: BorderRadius.circular(math.min(bannerRadius, 10))),
                  child: Text(
                    '${_pad(_left ~/ 60)}:${_pad(_left % 60)}',
                    style: ts(offerTitleSize, w: 700, c: timerFg, family: 'monospace')
                        .copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                  ),
                ),
              ]),
            ),
          ),
        ),
    ]);
  }
}

/// RN `borderStyle: "dashed"`, 1px, on a rounded box.
class _DashedBorder extends CustomPainter {
  final Color color;
  final double radius;
  const _DashedBorder({required this.color, required this.radius});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    final rect = (Offset.zero & size).deflate(0.5);
    final path = Path()..addRRect(RRect.fromRectAndRadius(rect, Radius.circular(math.max(0, radius - 0.5))));
    for (final PathMetric m in path.computeMetrics()) {
      var d = 0.0;
      while (d < m.length) {
        canvas.drawPath(m.extractPath(d, math.min(d + 3, m.length)), paint);
        d += 6;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorder old) => old.color != color || old.radius != radius;
}

/* ---- one tile: the video, what is written on it, and the cheer ------------ */
const _cheer = ['❤️', '🔥', '😍', '👏', '✨', '💖'];
int _faceIds = 0;

class _Face {
  final int id;
  final String face;
  final double lean;
  final double size;
  final AnimationController rise;
  Timer? delay;
  _Face(this.id, this.face, this.lean, this.size, this.rise);
}

class _LiveTile extends StatefulWidget {
  final double width;
  final double height;
  final double radius;
  final String? photo;
  final String? video;
  final String name;
  final String viewers;
  final bool onAir;
  final String liveLabel;
  final Color badgeBg;
  final Color badgeFg;
  final double nameSize;
  final double viewersSize;
  final int pieces;
  final String? liveId;
  final int likes;
  final VoidCallback onPress;
  const _LiveTile({
    super.key,
    required this.width,
    required this.height,
    required this.radius,
    required this.photo,
    required this.video,
    required this.name,
    required this.viewers,
    required this.onAir,
    required this.liveLabel,
    required this.badgeBg,
    required this.badgeFg,
    required this.nameSize,
    required this.viewersSize,
    required this.pieces,
    required this.liveId,
    required this.likes,
    required this.onPress,
  });
  @override
  State<_LiveTile> createState() => _LiveTileState();
}

class _LiveTileState extends State<_LiveTile> with TickerProviderStateMixin {
  final _rnd = math.Random();
  VideoPlayerController? _player;
  bool _playing = false;
  late int _count = widget.likes;
  bool _mine = false;
  final List<_Face> _faces = [];
  Timer? _beat;

  @override
  void initState() {
    super.initState();
    _setVideo();
    _readMine();
    _startBeat();
  }

  @override
  void didUpdateWidget(covariant _LiveTile old) {
    super.didUpdateWidget(old);
    if (old.video != widget.video) _setVideo();
    if (old.likes != widget.likes) _count = widget.likes;
    if (old.liveId != widget.liveId) {
      _readMine();
      _startBeat();
    }
  }

  /// The recording plays inside the tile, silently, from the stream.
  void _setVideo() {
    final old = _player;
    _player = null;
    _playing = false;
    if (old != null) {
      old.removeListener(_onPlayer);
      old.dispose();
    }
    final url = widget.video;
    if (url == null || url.isEmpty) return;
    final c = VideoPlayerController.networkUrl(
      Uri.parse(url),
      formatHint: url.contains('.m3u8') ? VideoFormat.hls : null,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    _player = c;
    c.addListener(_onPlayer);
    c.setLooping(true);
    c.setVolume(0);
    c.initialize().then((_) {
      if (_player == c) c.play();
    }).catchError((_) {});
  }

  void _onPlayer() {
    final v = _player?.value;
    final now = v != null && v.isInitialized && v.isPlaying && !v.isBuffering;
    if (now != _playing && mounted) setState(() => _playing = now);
  }

  void _readMine() {
    final id = widget.liveId;
    if (id == null) return;
    try {
      _mine = prefs.getString('reel_like_$id') == '1';
    } catch (_) {}
  }

  /// A live tile with nothing moving reads as a photograph; a face drifts up
  /// every second or so on its own.
  void _startBeat() {
    _beat?.cancel();
    _beat = null;
    if (widget.liveId == null) return;
    void beat() {
      if (!mounted) return;
      _release(2 + (_rnd.nextDouble() * 2).round());
      _beat = Timer(Duration(milliseconds: (420 + _rnd.nextDouble() * 620).round()), beat);
    }

    _beat = Timer(Duration(milliseconds: (_rnd.nextDouble() * 1200).round()), beat);
  }

  /// Faces let go and rise the height of the tile, each leaning its own way.
  /// Decoration only: they say nothing about how many are watching.
  void _release(int many) {
    final born = <_Face>[];
    for (var i = 0; i < many; i++) {
      final f = _Face(
        _faceIds++,
        _cheer[_rnd.nextInt(_cheer.length)],
        ((_rnd.nextDouble() - 0.5) * 34).roundToDouble(),
        11 + (_rnd.nextDouble() * 7).roundToDouble(),
        AnimationController(vsync: this, duration: const Duration(milliseconds: 1800)),
      );
      born.add(f);
      final delay = (i * 55 + _rnd.nextDouble() * 240).round();
      f.delay = Timer(Duration(milliseconds: delay), () {
        f.rise.forward().whenComplete(() {
          if (!mounted || !_faces.contains(f)) return;
          setState(() => _faces.remove(f));
          f.rise.dispose();
        });
      });
    }
    setState(() {
      _faces.addAll(born);
      // Keep the last 24.
      while (_faces.length > 24) {
        final gone = _faces.removeAt(0);
        gone.delay?.cancel();
        gone.rise.dispose();
      }
    });
  }

  void _tap() {
    final id = widget.liveId;
    if (id == null) return;
    final on = !_mine;
    setState(() {
      _mine = on;
      _count = math.max(0, _count + (on ? 1 : -1));
    });
    try {
      on ? prefs.setString('reel_like_$id', '1') : prefs.remove('reel_like_$id');
    } catch (_) {}
    _release(9);
    likeReel(id, on).then((n) {
      if (mounted) setState(() => _count = n);
    }).catchError((_) {});
  }

  @override
  void dispose() {
    _beat?.cancel();
    for (final f in _faces) {
      f.delay?.cancel();
      f.rise.dispose();
    }
    _faces.clear();
    final p = _player;
    _player = null;
    if (p != null) {
      p.removeListener(_onPlayer);
      p.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final w = widget;
    final player = _player;
    const white = Color(0xFFFFFFFF);
    return SizedBox(
      width: w.width,
      height: w.height,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(w.radius),
        child: Container(
          color: const Color(0xFF17120F),
          child: Stack(clipBehavior: Clip.none, children: [
            Positioned.fill(
              child: Tap(
                onTap: w.onPress,
                child: Stack(children: [
                  if (w.photo != null) Positioned.fill(child: NetImage(w.photo, fit: BoxFit.cover)),
                  if (w.video != null && player != null)
                    Positioned.fill(child: Opacity(opacity: _playing ? 1 : 0, child: _CoverVideo(player))),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: w.height * 0.64,
                    child: const Fade(
                      angle: 0,
                      colors: [Color.fromRGBO(0, 0, 0, 0.88), Color.fromRGBO(0, 0, 0, 0.55), Color.fromRGBO(0, 0, 0, 0)],
                      locations: [0, 0.38, 1],
                    ),
                  ),
                  if (w.onAir && w.liveLabel.isNotEmpty)
                    Positioned(
                      top: 6,
                      left: 6,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: w.badgeBg, borderRadius: BorderRadius.circular(4)),
                        child: Row(mainAxisSize: MainAxisSize.min, children: [
                          Container(
                              width: 4,
                              height: 4,
                              decoration: BoxDecoration(color: w.badgeFg, borderRadius: BorderRadius.circular(2))),
                          const SizedBox(width: 4),
                          Text(w.liveLabel.toUpperCase(), style: ts(8, w: 700, ls: 0.2, c: w.badgeFg)),
                        ]),
                      ),
                    ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Padding(
                      padding: const EdgeInsets.only(left: 6, right: 6, bottom: 6),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                        if (w.name.isNotEmpty)
                          Text(w.name,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: ts(w.nameSize + 1,
                                  w: 700, c: white, lh: ((w.nameSize + 1) * 1.25).roundToDouble())),
                        if (w.viewers.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 1),
                            child: Text(w.viewers,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: ts(w.viewersSize,
                                    c: const Color.fromRGBO(255, 255, 255, 0.75),
                                    lh: (w.viewersSize * 1.25).roundToDouble())),
                          ),
                        if (w.pieces > 0)
                          Container(
                            margin: const EdgeInsets.only(top: 4),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color.fromRGBO(255, 255, 255, 0.2),
                              borderRadius: BorderRadius.circular(999),
                            ),
                            child: Text(
                              w.onAir
                                  ? 'Shop ${w.pieces} piece${w.pieces == 1 ? '' : 's'}'
                                  : '+${w.pieces}${w.pieces == 1 ? ' piece' : ' pieces'}',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: ts(math.max(8, w.viewersSize), w: 600, c: white),
                            ),
                          ),
                      ]),
                    ),
                  ),
                ]),
              ),
            ),

            // The cheer rises from behind the heart; it is weather, not a control.
            Positioned(
              right: 28,
              bottom: 32,
              width: 0,
              height: 0,
              child: IgnorePointer(
                child: Stack(clipBehavior: Clip.none, children: [
                  for (final f in _faces)
                    Positioned(
                      key: ValueKey(f.id),
                      left: 0,
                      top: 0,
                      child: AnimatedBuilder(
                        animation: f.rise,
                        builder: (context, child) {
                          final t = Curves.easeOutQuad.transform(f.rise.value);
                          final o = t <= 0.75 ? 1 - (t / 0.75) * 0.1 : 0.9 * (1 - (t - 0.75) / 0.25);
                          return Opacity(
                            opacity: o.clamp(0.0, 1.0),
                            child: Transform.translate(offset: Offset(f.lean * t, -w.height * 0.78 * t), child: child),
                          );
                        },
                        child: Text(f.face, softWrap: false, style: ts(f.size, c: white)),
                      ),
                    ),
                ]),
              ),
            ),

            if (w.liveId != null)
              Positioned(
                // hitSlop 8 round a 22pt pill at top 6 / right 6.
                top: -2,
                right: -2,
                child: Tap(
                  onTap: _tap,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Container(
                      constraints: const BoxConstraints(minWidth: 22),
                      height: 22,
                      padding: const EdgeInsets.symmetric(horizontal: 5),
                      decoration: BoxDecoration(
                        color: const Color.fromRGBO(0, 0, 0, 0.35),
                        borderRadius: BorderRadius.circular(11),
                      ),
                      child: Row(mainAxisSize: MainAxisSize.min, mainAxisAlignment: MainAxisAlignment.center, children: [
                        Svg(
                          '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1Z" '
                          'fill="${sc(_mine ? colors.accent : const Color.fromRGBO(255, 255, 255, 0.25))}" '
                          'stroke="${sc(_mine ? colors.accent : white)}" stroke-width="2.5" '
                          'stroke-linecap="round" stroke-linejoin="round"/>',
                          size: 12,
                        ),
                        if (_count > 0) ...[
                          const SizedBox(width: 2),
                          Text(_count > 999 ? '${_jsNum((_count / 100).round() / 10)}k' : '$_count',
                              style: ts(9, w: 700, c: white)),
                        ],
                      ]),
                    ),
                  ),
                ),
              ),
          ]),
        ),
      ),
    );
  }
}

/// expo-video `contentFit="cover"`: the frame fills the box, cropped.
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
