import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/json.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../home/home_screen.dart';
import '../widgets/pieces.dart';

/// The basket. Wording comes from screens.o('cart') — App → App theme.
/// Port of CartScreen.tsx. Draws CartSections (home/home_screen.dart) where the
/// React Native one draws `<CartSections .../>`.
class CartScreen extends StatefulWidget {
  final List<PricedLine> lines;
  final double subtotal;
  final double discount;
  /// Rewards she can spend on this basket. Empty for a guest.
  final List<Gift> gifts;
  /// What she is closest to, when none of them is hers yet.
  final String? giftNote;
  final String? giftBusy;
  final void Function(Gift g) onUseGift;
  final void Function(String itemId, int quantity) onChangeQuantity;
  /// Null when the merchant turned the coupon field off.
  final Future<void> Function(String code)? onApplyCoupon;
  final VoidCallback onCheckout;
  /// Where a section placed on the basket can send her.
  final void Function(String handle) onOpenCollection;
  final void Function(String id) onOpenProduct;
  final void Function(String screen) onOpenScreen;
  /// A section placed here that fills the basket itself, like a bundle.
  final void Function(String variantId) onAddBundle;
  final bool signedIn;
  const CartScreen({super.key, required this.lines, required this.subtotal, required this.discount, required this.gifts, this.giftNote, this.giftBusy, required this.onUseGift, required this.onChangeQuantity, this.onApplyCoupon, required this.onCheckout, required this.onOpenCollection, required this.onOpenProduct, required this.onOpenScreen, required this.onAddBundle, this.signedIn = false});
  @override
  State<CartScreen> createState() => _CartScreenState();
}

/// A number the way JavaScript writes it: 100 not "100.0".
String _js(double v) => v.isFinite && v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

class _CartScreenState extends State<CartScreen> {
  final _code = TextEditingController();

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = screens.o('cart');
    final total = (widget.subtotal - widget.discount).clamp(0.0, double.infinity);

    if (widget.lines.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.xl),
          child: Text(say(c.s('emptyText'), 'The basket is empty'), style: ts(14, c: colors.inkSoft)),
        ),
      );
    }

    final giftNote = widget.giftNote ?? '';
    final showGifts = (widget.gifts.isNotEmpty || giftNote.isNotEmpty) && widget.discount == 0;
    final showCoupon = c.b('showCoupon') && widget.onApplyCoupon != null;

    final children = <Widget>[
      for (final l in widget.lines) _line(l),
      // What the merchant put beside the basket.
      // PORT NOTE: React Native renders null (so no gap) while nothing is placed;
      // here the gap is skipped when the basket has no sections at all. The RN
      // code passes signedIn as always true; this passes the real state, which
      // only spares a guest a recommendations request that would fail anyway.
      if (layout.cart.isNotEmpty)
        // The placed sections bring their own 16px gutter; the list already has one.
        Bleed(
          child: CartSections(
            handlers: HomeHandlers(
              links: LinkHandlers(
                onOpenCollection: widget.onOpenCollection,
                onOpenProduct: widget.onOpenProduct,
                onOpenScreen: widget.onOpenScreen,
              ),
              onAdd: (v, _) => widget.onAddBundle(v),
              signedIn: widget.signedIn,
            ),
          ),
        ),
      if (showGifts) _gifts(giftNote),
      if (showCoupon) _coupon(c),
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(Spacing.lg),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < children.length; i++) ...[
                  if (i > 0) const SizedBox(height: Spacing.sm),
                  children[i],
                ],
              ],
            ),
          ),
        ),
        Container(
          padding: const EdgeInsets.all(Spacing.lg),
          decoration: BoxDecoration(
            color: colors.surface,
            border: Border(top: BorderSide(color: colors.line)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(say(c.s('totalLabel'), 'Total'), style: ts(13, c: colors.inkMuted)),
                  Text(money(total), style: ts(18, w: 700, c: colors.ink)),
                ],
              ),
              Tap(
                onTap: widget.onCheckout,
                child: Container(
                  margin: const EdgeInsets.only(top: Spacing.md),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.md)),
                  child: Text(say(c.s('checkoutLabel'), 'Checkout'), style: ts(14, w: 700, c: Colors.white)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _line(PricedLine l) {
    final atMost = l.quantity >= l.maxAvailable;
    Widget step(String sign, bool off, VoidCallback onTap) => Opacity(
          opacity: off ? 0.4 : 1,
          child: Tap(
            onTap: off ? null : onTap,
            child: Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(Radii.sm),
                border: Border.all(color: colors.line),
              ),
              child: Text(sign, style: ts(14, c: colors.inkMuted)),
            ),
          ),
        );
    return Container(
      key: ValueKey(l.itemId),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: colors.line),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(Radii.md),
            child: NetImage(l.imageUrl, width: 56, height: 56, background: colors.page),
          ),
          const SizedBox(width: Spacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(l.productName, maxLines: 2, overflow: TextOverflow.ellipsis, style: ts(12, c: colors.ink)),
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(money(l.price), style: ts(14, w: 700, c: colors.ink)),
                ),
              ],
            ),
          ),
          const SizedBox(width: Spacing.md),
          Row(
            children: [
              step('−', false, () => widget.onChangeQuantity(l.itemId, l.quantity - 1)),
              const SizedBox(width: 6),
              SizedBox(
                width: 20,
                child: Text('${l.quantity}', textAlign: TextAlign.center, style: ts(14, w: 600, c: colors.ink)),
              ),
              const SizedBox(width: 6),
              step('+', atMost, () => widget.onChangeQuantity(l.itemId, l.quantity + 1)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _gifts(String giftNote) {
    final busy = (widget.giftBusy ?? '').isNotEmpty;
    final rows = <Widget>[
      Text('YOUR REWARDS', style: ts(10, w: 800, ls: 1, c: colors.accent)),
      for (final g in widget.gifts)
        Tap(
          key: ValueKey(g.id),
          onTap: busy ? null : () => widget.onUseGift(g),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(Radii.sm),
              border: Border.all(color: colors.line),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(g.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(13, w: 700, c: colors.ink)),
                      Text(g.detail + (g.cost > 0 ? ' · ${_js(g.cost)} signatures' : ''),
                          maxLines: 1, overflow: TextOverflow.ellipsis, style: ts(11, c: colors.inkSoft)),
                    ],
                  ),
                ),
                const SizedBox(width: Spacing.sm),
                Text(widget.giftBusy == g.id ? '…' : (g.ready ? 'Use' : 'Redeem'),
                    style: ts(12, w: 800, c: colors.accent)),
              ],
            ),
          ),
        ),
      if (widget.gifts.isEmpty && giftNote.isNotEmpty) Text(giftNote, style: ts(11, c: colors.inkSoft)),
    ];
    return Container(
      margin: const EdgeInsets.only(bottom: Spacing.sm),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: colors.accent),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < rows.length; i++) ...[
            if (i > 0) const SizedBox(height: 6),
            rows[i],
          ],
        ],
      ),
    );
  }

  Widget _coupon(J c) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(Radii.lg),
        border: Border.all(color: colors.line),
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              height: 36,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              alignment: Alignment.centerLeft,
              child: TextField(
                controller: _code,
                textCapitalization: TextCapitalization.characters,
                style: ts(13, c: colors.ink),
                decoration: InputDecoration.collapsed(
                  hintText: say(c.s('couponLabel'), 'Discount code'),
                  hintStyle: ts(13, c: colors.inkSoft),
                ),
              ),
            ),
          ),
          const SizedBox(width: Spacing.sm),
          Tap(
            onTap: () => widget.onApplyCoupon?.call(_code.text.trim()),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.sm)),
              child: Text('Apply', style: ts(12, w: 700, c: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }
}
