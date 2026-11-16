import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/pieces.dart';

/// Cash on delivery. Wording comes from screens.o('checkout') — App → App theme.
/// Port of CheckoutScreen.tsx. The Address type lives in core/api.dart.
///
/// Name, phone, governorate, city and address are always asked: an order
/// cannot be delivered without them and the server refuses an incomplete one.
/// The phone is the signed-in account's and cannot be edited — the server
/// refuses any other.
class CheckoutScreen extends StatefulWidget {
  final String phone;
  final bool busy;
  final void Function(Address address) onPlace;
  const CheckoutScreen({super.key, required this.phone, required this.busy, required this.onPlace});
  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  // What the shop accepts. A checkout that cannot reach the list still takes
  // cash at the door, so this never blocks the screen.
  List<J> _methods = const [];
  String _method = '';

  final _name = TextEditingController();
  final _governorate = TextEditingController();
  final _city = TextEditingController();
  final _address = TextEditingController();
  final _email = TextEditingController();
  final _note = TextEditingController();
  late final _phone = TextEditingController(text: widget.phone);

  @override
  void initState() {
    super.initState();
    for (final c in [_name, _governorate, _city, _address]) {
      c.addListener(_changed);
    }
    fetchPayments().then((list) {
      if (!mounted) return;
      setState(() {
        _methods = list;
        J? first;
        for (final m in list) {
          if (m.s('kind') == 'cod') {
            first = m;
            break;
          }
        }
        first ??= list.isNotEmpty ? list.first : null;
        if (first != null) _method = first.s('id');
      });
    }).catchError((_) {});
  }

  @override
  void didUpdateWidget(covariant CheckoutScreen old) {
    super.didUpdateWidget(old);
    if (old.phone != widget.phone) _phone.text = widget.phone;
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    for (final c in [_name, _governorate, _city, _address, _email, _note, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  bool get _ready => _name.text.isNotEmpty && _governorate.text.isNotEmpty && _city.text.isNotEmpty && _address.text.isNotEmpty;

  void _place() {
    widget.onPlace(Address(
      customerName: _name.text,
      governorate: _governorate.text,
      city: _city.text,
      address: _address.text,
      email: _email.text,
      note: _note.text,
      paymentMethod: _method.isNotEmpty ? _method : null,
    ));
  }

  @override
  Widget build(BuildContext context) {
    final c = screens.o('checkout');
    final off = !_ready || widget.busy;
    final children = <Widget>[
      Text(say(c.s('title'), 'Cash on delivery'), style: ts(16, w: 700, c: colors.ink, family: titleFont)),
      if (c.s('note').isNotEmpty) Text(c.s('note'), style: ts(12, c: colors.inkSoft)),
      _Field(label: 'Name', controller: _name),
      _Field(label: 'Phone', controller: _phone, editable: false),
      if (c.b('askEmail')) _Field(label: 'Email', controller: _email),
      _Field(label: 'Governorate', controller: _governorate),
      _Field(label: 'City', controller: _city),
      _Field(label: 'Address', controller: _address),
      if (c.b('askNote')) _Field(label: 'Order note', controller: _note),
      if (_methods.isNotEmpty) _payments(),
      Padding(
        padding: const EdgeInsets.only(top: Spacing.sm),
        child: Opacity(
          opacity: off ? 0.5 : 1,
          child: Tap(
            onTap: off ? null : _place,
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 13),
              alignment: Alignment.center,
              decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.md)),
              child: Text(say(c.s('placeLabel'), 'Place the order'), style: ts(14, w: 700, c: Colors.white)),
            ),
          ),
        ),
      ),
    ];
    return SingleChildScrollView(
      padding: const EdgeInsets.all(Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) const SizedBox(height: Spacing.md),
            children[i],
          ],
        ],
      ),
    );
  }

  Widget _payments() {
    return Padding(
      padding: const EdgeInsets.only(top: Spacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Text('Payment', style: ts(11, w: 600, c: colors.inkMuted)),
          ),
          Container(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(Radii.md),
              border: Border.all(color: colors.line),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < _methods.length; i++) _payRow(_methods[i], i),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _payRow(J m, int i) {
    final on = m.s('id') == _method;
    final logo = m.s('logo');
    return Container(
      key: ValueKey('${m.s('id')}#$i'),
      decoration: i > 0 ? BoxDecoration(border: Border(top: BorderSide(color: colors.line))) : null,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Tap(
            onTap: () => setState(() => _method = m.s('id')),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
              child: Row(
                children: [
                  Container(
                    width: 16,
                    height: 16,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: on ? colors.accent : colors.line),
                    ),
                    child: on
                        ? Container(width: 8, height: 8, decoration: BoxDecoration(color: colors.accent, shape: BoxShape.circle))
                        : null,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(m.s('name'), maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(13, w: 500, c: colors.ink)),
                  ),
                  if (logo.isNotEmpty) ...[
                    const SizedBox(width: 8),
                    NetImage(logo, width: 44, height: 16, fit: BoxFit.contain),
                  ] else if (m.s('kind') != 'cod') ...[
                    const SizedBox(width: 8),
                    Text('INSTALMENTS', style: ts(10, w: 600, ls: 0.6, c: colors.inkSoft)),
                  ],
                ],
              ),
            ),
          ),
          if (on && m.s('note').isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 10),
              child: Text(m.s('note'), style: ts(11, lh: 16, c: colors.inkMuted)),
            ),
        ],
      ),
    );
  }
}

class _Field extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final bool editable;
  const _Field({required this.label, required this.controller, this.editable = true});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label, style: ts(11, w: 500, c: colors.inkMuted)),
        Container(
          margin: const EdgeInsets.only(top: 4),
          height: 44,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          alignment: Alignment.centerLeft,
          decoration: BoxDecoration(
            color: editable ? colors.surface : colors.page,
            borderRadius: BorderRadius.circular(Radii.md),
            border: Border.all(color: colors.line),
          ),
          child: TextField(
            controller: controller,
            readOnly: !editable,
            enableInteractiveSelection: editable,
            style: ts(14, c: editable ? colors.ink : colors.inkMuted),
            decoration: const InputDecoration.collapsed(hintText: null),
          ),
        ),
      ],
    );
  }
}
