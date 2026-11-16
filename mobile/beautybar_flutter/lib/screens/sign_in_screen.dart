import 'package:flutter/material.dart';

import '../core/api.dart';
import '../core/style.dart';
import '../core/theme.dart';
import '../widgets/pieces.dart';

/// Signing in with a phone number. Port of SignInScreen.tsx.
///
/// The number is asked first and checked before anything is sent, because a
/// shopper the shop already knows should not be made to wait for a code to be
/// told so. Only an unknown number is offered SMS or WhatsApp — and it is the
/// shopper who picks, since the one that reaches them is the one they use.
class SignInScreen extends StatefulWidget {
  final void Function(String token, String phone) onSignedIn;
  const SignInScreen({super.key, required this.onSignedIn});
  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

/// "phone" | "choose" | "code"
enum _Stage { phone, choose, code }

class _SignInScreenState extends State<SignInScreen> {
  _Stage _stage = _Stage.phone;
  final _phone = TextEditingController();
  final _name = TextEditingController();
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _run(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await fn();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _check() => _run(() async {
        tap('Sign in');
        final res = await checkPhone(_phone.text);
        _phone.text = res.s('phone');
        if (res.s('status') == 'already_verified') {
          final t = await loginVerified(res.s('phone'));
          widget.onSignedIn(t.s('token'), t.s('phone'));
        } else {
          if (mounted) setState(() => _stage = _Stage.choose);
        }
      });

  void _send(String channel) => _run(() async {
        tap(channel == 'whatsapp' ? 'Send code by WhatsApp' : 'Send code by SMS');
        await requestCode(_phone.text, channel);
        if (mounted) setState(() => _stage = _Stage.code);
      });

  void _verify() => _run(() async {
        tap('Verify sign-in code');
        final t = await verifyCode(_phone.text, _code.text, _name.text.isNotEmpty ? _name.text : null);
        widget.onSignedIn(t.s('token'), t.s('phone'));
      });

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[
      Text('Sign in', style: ts(20, w: 700, c: colors.ink)),
      if (_stage == _Stage.phone) ...[
        Text('Your phone number is your account.', style: ts(13, c: colors.inkMuted)),
        _Input(controller: _phone, keyboard: TextInputType.phone, placeholder: '01xxxxxxxxx'),
        _Cta(label: 'Continue', busy: _busy, onPress: _check),
      ],
      if (_stage == _Stage.choose) ...[
        Text('Where should we send your code?', style: ts(13, c: colors.inkMuted)),
        Row(
          children: [
            Expanded(child: _Choice(label: 'WhatsApp', onPress: () => _send('whatsapp'))),
            const SizedBox(width: Spacing.sm),
            Expanded(child: _Choice(label: 'SMS', onPress: () => _send('sms'))),
          ],
        ),
        if (_busy)
          Center(
            child: SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(color: colors.accent, strokeWidth: 2),
            ),
          ),
      ],
      if (_stage == _Stage.code) ...[
        Text('Enter the code we sent to ${_phone.text}.', style: ts(13, c: colors.inkMuted)),
        _Input(controller: _code, keyboard: TextInputType.number, placeholder: '000000'),
        _Input(controller: _name, placeholder: 'Your name'),
        _Cta(label: 'Sign in', busy: _busy, onPress: _verify),
        Tap(
          onTap: () => setState(() => _stage = _Stage.choose),
          child: Text('Send it again', textAlign: TextAlign.center, style: ts(12, c: colors.accent)),
        ),
      ],
      if (_error != null) Text(_error!, style: ts(12, c: const Color(0xFFE11D48))),
    ];
    return Container(
      color: colors.page,
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
}

class _Input extends StatelessWidget {
  final TextEditingController controller;
  final TextInputType? keyboard;
  final String placeholder;
  const _Input({required this.controller, this.keyboard, required this.placeholder});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 46,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      alignment: Alignment.centerLeft,
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(Radii.md),
        border: Border.all(color: colors.line),
      ),
      child: TextField(
        controller: controller,
        keyboardType: keyboard,
        style: ts(15, c: colors.ink),
        decoration: InputDecoration.collapsed(hintText: placeholder, hintStyle: ts(15, c: colors.inkSoft)),
      ),
    );
  }
}

class _Choice extends StatelessWidget {
  final String label;
  final VoidCallback onPress;
  const _Choice({required this.label, required this.onPress});

  @override
  Widget build(BuildContext context) {
    return Tap(
      onTap: onPress,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 13),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(Radii.md),
          border: Border.all(color: colors.line),
        ),
        child: Text(label, style: ts(14, w: 600, c: colors.ink)),
      ),
    );
  }
}

class _Cta extends StatelessWidget {
  final String label;
  final bool busy;
  final VoidCallback onPress;
  const _Cta({required this.label, required this.busy, required this.onPress});

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: busy ? 0.5 : 1,
      child: Tap(
        onTap: busy ? null : onPress,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 13),
          alignment: Alignment.center,
          decoration: BoxDecoration(color: colors.accent, borderRadius: BorderRadius.circular(Radii.md)),
          child: Text(busy ? '…' : label, style: ts(15, w: 700, c: Colors.white)),
        ),
      ),
    );
  }
}
