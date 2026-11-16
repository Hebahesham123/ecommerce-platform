/// Prices and names, written the way the React Native app writes them (Pieces.tsx).
library;

import 'package:intl/intl.dart';
import 'theme.dart';

final NumberFormat _whole = NumberFormat('#,##0', 'en_US');

/// "1,049 EGP" — or "—" when there is no price.
String money(num? v) => v == null ? '—' : '${_whole.format(v.round())} EGP';

/// "EGP 1,049": the currency in front, so the digits line up across a grid.
String moneyFirst(num? v) => v == null ? '—' : 'EGP ${_whole.format(v.round())}';

/// Just the digits, for the price it was.
String plainNumber(num? v) => v == null ? '' : _whole.format(v.round());

/// "1,627" — Intl.NumberFormat("en-US").format(n).
String grouped(num v) => NumberFormat('#,##0.###', 'en_US').format(v);

/// The first few words of a name, and a sign that there were more.
///
/// NB: the generated React Native code splits on the regex `/s+/` (a literal
/// "s", a generator escaping slip), so in practice it rarely trims. This port
/// splits on whitespace, which is what the editor preview does.
String shortName(String name, [int? words]) {
  final w = words ?? theme.o('card').i('nameWords', 3);
  final parts = name.trim().split(RegExp(r'\s+')).where((p) => p.isNotEmpty).toList();
  if (parts.length <= w) return parts.join(' ');
  return '${parts.take(w).join(' ')}…';
}

/// The name, minus the brand that is already printed above it.
String withoutVendor(String name, String? vendor) {
  final v = (vendor ?? '').trim();
  final n = name.trim();
  if (v.isEmpty || !n.toLowerCase().startsWith(v.toLowerCase())) return n;
  final rest = n.substring(v.length).trim();
  return rest.isEmpty ? n : rest;
}
