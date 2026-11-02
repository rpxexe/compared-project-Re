import { createNavigationContainerRef } from "@react-navigation/native";

// The app's NavigationContainer ref, for code that lives outside the navigator (context
// providers, toasts) and still needs to open a screen.
export const navigationRef = createNavigationContainerRef();
