/// Coming up live. Generated from the dashboard — App → App theme.
/// Port of ComingUpLive.tsx.
library;

import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart';

import '../../core/api.dart';
import '../../core/color.dart';
import '../../core/json.dart';
import '../../core/style.dart';
import '../../core/theme.dart';
import '../../widgets/pieces.dart';
import '../section.dart';

Widget? comingUpLiveSection(SectionCtx c) {
  final items = _sessions(c.data.lives);
  if (items.isEmpty) return null;
  return _ComingUpLive(settings: c.settings, items: items, collections: c.data.collections, links: c.links);
}

/// The lives actually scheduled, soonest first.
List<J> _sessions(List<J> lives) {
  final upcoming = lives.where((l) => l.s('status') == 'scheduled').toList();
  upcoming.sort((a, b) => a.s('scheduledAt').compareTo(b.s('scheduledAt')));
  return upcoming.map((l) {
    final at = l.s('scheduledAt');
    final m = <String, dynamic>{'id': l.s('id'), 'title': l.s('title'), 'url': l.s('href')};
    if (l.s('coverUrl').isNotEmpty) m['imageUrl'] = l.s('coverUrl');
    if (at.isNotEmpty) {
      final d = DateTime.tryParse(at);
      // toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short",
      // hour: "2-digit", minute: "2-digit" }) → "Tue 11 Nov, 14:30".
      m['when'] = d == null ? 'Invalid Date' : DateFormat('EEE d MMM, HH:mm').format(d.toLocal());
    }
    return J(m);
  }).toList();
}

class _ComingUpLive extends StatefulWidget {
  final J settings;
  final List<J> items;
  final List<CollectionInfo> collections;
  final LinkHandlers links;
  const _ComingUpLive({required this.settings, required this.items, required this.collections, required this.links});
  @override
  State<_ComingUpLive> createState() => _ComingUpLiveState();
}

class _ComingUpLiveState extends State<_ComingUpLive> {
  // Remind me sets a reminder and stays put; the session itself opens its collection.
  final List<String> _reminded = [];

  @override
  Widget build(BuildContext context) {
    final settings = widget.settings;
    final rv = settings.n('radius', 0);
    final r = rv > 0 ? rv : Radii.lg;
    final bg = settings.s('cardBg').isNotEmpty ? css(settings.s('cardBg'), colors.surface) : colors.surface;
    final remind = settings.sOr('remindLabel', 'Remind me');
    final title = settings.s('title');

    final rows = <Widget>[];
    for (final i in widget.items) {
      if (rows.isNotEmpty) rows.add(SizedBox(height: gap.item));
      final borrowed = inherit(i, widget.collections);
      final photo = i.s('imageUrl').isNotEmpty ? i.s('imageUrl') : borrowed.image;
      final on = _reminded.contains(i.s('id'));
      rows.add(Row(children: [
        Expanded(
          child: Tap(
            // A typed link wins over a collection: it is the more specific thing to set.
            onTap: () => openLink(i, widget.links),
            child: Row(children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: photo != null && photo.isNotEmpty
                    ? NetImage(photo, width: 48, height: 48, background: const Color(0xFFF1F5F9))
                    : Container(width: 48, height: 48, color: const Color(0xFFF1F5F9)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(i.s('title').isNotEmpty ? i.s('title') : borrowed.title,
                      maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(12, w: 700, lh: 18, c: colors.ink)),
                  if (i.s('when').isNotEmpty)
                    Text(i.s('when'),
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, lh: 16, c: const Color(0xFF64748B))),
                ]),
              ),
            ]),
          ),
        ),
        if (remind.isNotEmpty) ...[
          const SizedBox(width: 12),
          Tap(
            onTap: () => setState(() {
              final id = i.s('id');
              if (_reminded.contains(id)) {
                _reminded.remove(id);
              } else {
                _reminded.add(id);
              }
            }),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Radii.pill),
                border: Border.all(color: colors.accent),
                color: on ? colors.surface : colors.accent,
              ),
              child: Text(
                on ? '✓ ${settings.sOr('remindedLabel', 'Reminder set')}' : remind,
                style: ts(11, w: 600, lh: 16, c: on ? colors.accent : const Color(0xFFFFFFFF)),
              ),
            ),
          ),
        ],
      ]));
    }

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      if (title.isNotEmpty)
        Text(title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: ts(16, w: 700, lh: 24, c: colors.ink, family: titleFont, ls: titleFont != null ? -0.16 : -0.4)),
      Container(
        margin: const EdgeInsets.only(top: Spacing.sm),
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          color: bg,
          borderRadius: BorderRadius.circular(r),
          border: Border.all(color: colors.line),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: rows),
      ),
    ]);
  }
}
