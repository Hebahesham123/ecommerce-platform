/// Loose JSON, read the way the React Native app reads it.
///
/// Everything the dashboard sends (the theme, each section's settings, the
/// screens' wording) arrives as untyped JSON that the merchant may have saved
/// before a field existed. [J] wraps one JSON object and answers with a
/// default instead of throwing, so a missing or mistyped value draws the
/// section "as usual" rather than crashing the app.
library;

class J {
  final Map<String, dynamic> raw;
  const J(this.raw);

  static const J empty = J(<String, dynamic>{});

  /// Wrap anything: a map becomes a [J], anything else becomes [J.empty].
  factory J.from(dynamic v) {
    if (v is J) return v;
    if (v is Map<String, dynamic>) return J(v);
    if (v is Map) return J(v.map((k, val) => MapEntry(k.toString(), val)));
    return J.empty;
  }

  bool has(String key) => raw.containsKey(key) && raw[key] != null;
  dynamic operator [](String key) => raw[key];

  /// A string. Numbers and booleans are stringified, like JS `String(v ?? "")`.
  String s(String key, [String fallback = '']) {
    final v = raw[key];
    if (v == null) return fallback;
    if (v is String) return v;
    if (v is num || v is bool) return v.toString();
    return fallback;
  }

  /// A string, or [fallback] when the value is missing *or empty* (JS `v || fallback`).
  String sOr(String key, String fallback) {
    final v = s(key);
    return v.isEmpty ? fallback : v;
  }

  /// A number. Numeric strings are parsed; anything else gives [fallback].
  double n(String key, [double fallback = 0]) {
    final v = raw[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v.trim()) ?? fallback;
    return fallback;
  }

  /// A number or null when absent / unparseable (JS `v === undefined ? ... `).
  double? nOrNull(String key) {
    final v = raw[key];
    if (v is num) return v.toDouble();
    if (v is String) return double.tryParse(v.trim());
    return null;
  }

  int i(String key, [int fallback = 0]) {
    final v = nOrNull(key);
    return v == null || !v.isFinite ? fallback : v.truncate();
  }

  /// A boolean. Missing gives [fallback]; otherwise JS truthiness.
  bool b(String key, [bool fallback = false]) {
    if (!raw.containsKey(key) || raw[key] == null) return fallback;
    return truthy(raw[key]);
  }

  /// A nested object (empty when absent).
  J o(String key) => J.from(raw[key]);

  /// A list of objects (non-objects are dropped).
  List<J> l(String key) {
    final v = raw[key];
    if (v is! List) return const [];
    return v.whereType<Map>().map(J.from).toList();
  }

  /// A list of strings.
  List<String> ls(String key) {
    final v = raw[key];
    if (v is! List) return const [];
    return v.where((e) => e != null).map((e) => e.toString()).toList();
  }

  /// A list of anything.
  List<dynamic> list(String key) {
    final v = raw[key];
    return v is List ? v : const [];
  }

  /// A copy with [other]'s keys laid over this one's (JS `{...a, ...b}`).
  J merge(J other) => J({...raw, ...other.raw});

  @override
  String toString() => raw.toString();
}

/// JavaScript truthiness for a JSON value.
bool truthy(dynamic v) {
  if (v == null) return false;
  if (v is bool) return v;
  if (v is num) return v != 0 && !v.isNaN;
  if (v is String) return v.isNotEmpty;
  return true;
}
