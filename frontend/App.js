import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { navigationRef } from './src/navigation/navigationRef';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ToastProvider } from './src/context/ToastContext';
import { SavedProvider } from './src/context/SavedContext';
import { CompareProvider } from './src/context/CompareContext';
import { LocationAccessProvider } from './src/context/LocationAccessContext';
import AppNavigator from './src/navigation/AppNavigator';
import SplashScreen from './src/screens/SplashScreen';
import LoginRequiredDialog from './src/components/LoginRequiredDialog';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { FONT_FILES } from './src/components/AppText';
import { colors } from './src/theme';


const theme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.ivory, card: colors.white, text: colors.ink, primary: colors.primary, border: colors.line } };

// Upper bound on how long start-up can keep the app behind the splash.
const STARTUP_TIMEOUT = 6000;

// If the intro animation ever throws, drop it and show the app instead of blocking it.
class SplashBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail?.(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function Root() {
  const { ready } = useAuth();
  const [splash, setSplash] = useState(true);
  // null = still reading storage; the splash stays up until we know.
  const [hasStarted, setHasStarted] = useState(null);
  const [timedOut, setTimedOut] = useState(false);
  // App font. A load error falls back to the system font rather than blocking start-up.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);

  useEffect(() => {
    AsyncStorage.getItem('cp_has_started')
      .then((v) => setHasStarted(v === 'true'))
      .catch(() => setHasStarted(false));
  }, []);

  // Watchdog: if storage or auth restore hangs, continue with what we have instead of
  // leaving the user on an endless loading screen.
  useEffect(() => {
    const h = setTimeout(() => setTimedOut(true), STARTUP_TIMEOUT);
    return () => clearTimeout(h);
  }, []);

  const appReady = (ready && hasStarted !== null && (fontsLoaded || !!fontError)) || timedOut;

  return (
    <View style={{ flex: 1, backgroundColor: colors.ivory }}>
      {appReady ? (
        <NavigationContainer ref={navigationRef} theme={theme}>
          <StatusBar style="dark" />
          <AppNavigator hasStarted={!!hasStarted} />
          <LoginRequiredDialog navigationRef={navigationRef} />
        </NavigationContainer>
      ) : null}
      <NavBarStrip />
      {splash ? (
        <SplashBoundary onFail={() => setSplash(false)}>
          <SplashScreen ready={appReady} onFinish={() => setSplash(false)} />
        </SplashBoundary>
      ) : null}
    </View>
  );
}

// Android draws the app edge-to-edge (Expo SDK 54), so the system navigation bar is transparent
// and can't be given a colour. This strip fills the area behind it so the bar looks solid. It sits
// under the splash screen and modals, and never takes touches.
function NavBarStrip() {
  const { bottom } = useSafeAreaInsets();
  if (Platform.OS !== 'android' || !bottom) return null;
  return <View pointerEvents="none" style={[styles.navStrip, { height: bottom }]} />;
}

const styles = StyleSheet.create({
  navStrip: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <SavedProvider>
            <CompareProvider>
              <LocationAccessProvider>
                <Root />
              </LocationAccessProvider>
            </CompareProvider>
          </SavedProvider>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
