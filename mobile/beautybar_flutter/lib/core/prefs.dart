/// What the phone keeps between starts (AsyncStorage in the React Native app).
library;

import 'package:shared_preferences/shared_preferences.dart';

late SharedPreferences prefs;

Future<void> initPrefs() async {
  prefs = await SharedPreferences.getInstance();
}
