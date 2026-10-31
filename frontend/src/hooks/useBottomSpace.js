import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Height covered at the bottom of the screen: the floating tab bar when the screen is shown
// inside the tabs (its height already includes the system navigation bar), else the system
// navigation bar alone. Keep fixed footers and the end of scroll content above it.
export function useBottomSpace() {
  const insets = useSafeAreaInsets();
  const tabBar = useContext(BottomTabBarHeightContext) || 0;
  return { bottom: Math.max(insets.bottom, tabBar), tabBar, inset: insets.bottom };
}
