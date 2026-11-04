import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import BottomNav from "../components/BottomNav";
import { useCompare } from "../context/CompareContext";
import { useAuth } from "../context/AuthContext";
import { colors } from "../theme";

import GetStartedScreen from "../screens/GetStartedScreen";
import LoginScreen from "../screens/LoginScreen";
import OtpScreen from "../screens/OtpScreen";
import AuthWelcomeScreen from "../screens/AuthWelcomeScreen";
import HomeScreen from "../screens/HomeScreen";
import CompareScreen from "../screens/CompareScreen";
import NewProjectScreen from "../screens/NewProjectScreen";
import SearchScreen from "../screens/SearchScreen";
import SearchFiltersScreen from "../screens/SearchFiltersScreen";
import PropertyDetailsScreen from "../screens/PropertyDetailsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NotificationScreen from "../screens/NotificationScreen";
import LocationScreen from "../screens/LocationScreen";
import PostPropertyFormScreen from "../screens/PostPropertyFormScreen";
import {
  SavedScreen,
  MyPropertiesScreen,
  MyEnquiriesScreen,
  RecentSearchesScreen,
  ViewedPropertiesScreen,
} from "../screens/ListScreens";
import PrePostPropertyTypeScreen from "../screens/PrePostPropertyTypeScreen";
import SignUpScreen from "../screens/SignUp";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Developers only post properties (for sale) and manage their own listings: no browsing,
// searching, comparing or saving, so their stacks hold just these screens.
const DEVELOPER_SCREENS = ["PostPropertyForm", "MyProperties", "PropertyDetails", "Settings", "Notification"];

// Screens reachable from every tab. Each tab runs its own stack that includes them, so they open
// inside the tab and the bottom bar stays visible (the auth screens below stay outside the tabs).
// `only` limits the stack to those screens.
function sharedScreens(except, only) {
  const screens = [
    ["Search", SearchScreen],
    ["SearchFilters", SearchFiltersScreen, { animation: "slide_from_bottom" }],
    ["NewProject", NewProjectScreen],
    ["Notification", NotificationScreen],
    // Rises a little while fading in, so the gradient header settles in place instead of sliding the
    // whole sheet up from the bottom.
    ["Location", LocationScreen, { animation: "fade_from_bottom" }],
    ["PrePostPropertyType", PrePostPropertyTypeScreen],
    ["PostPropertyForm", PostPropertyFormScreen],
    ["PropertyDetails", PropertyDetailsScreen, { animation: "slide_from_bottom" }],
    ["Settings", SettingsScreen],
    ["Saved", SavedScreen],
    ["MyProperties", MyPropertiesScreen],
    ["MyEnquiries", MyEnquiriesScreen],
    ["RecentSearches", RecentSearchesScreen],
    ["ViewedProperties", ViewedPropertiesScreen],
  ];
  return screens
    .filter(([name]) => name !== except && (!only || only.includes(name)))
    .map(([name, component, options]) => <Stack.Screen key={name} name={name} component={component} options={options} />);
}

// One stack per tab, starting at that tab's own screen.
function tabStack(rootName, RootComponent, only) {
  return function TabStack() {
    return (
      <Stack.Navigator screenOptions={base}>
        <Stack.Screen name={rootName} component={RootComponent} />
        {sharedScreens(rootName, only)}
      </Stack.Navigator>
    );
  };
}

const HomeStack = tabStack("HomeMain", HomeScreen);
const SearchStack = tabStack("SearchFilters", SearchFiltersScreen);
const PostStack = tabStack("PostPropertyForm", PostPropertyFormScreen);
const CompareStack = tabStack("CompareMain", CompareScreen);
const ProfileStack = tabStack("ProfileMain", ProfileScreen);

const DevPostStack = tabStack("PostPropertyForm", PostPropertyFormScreen, DEVELOPER_SCREENS);
const DevListingsStack = tabStack("MyProperties", MyPropertiesScreen, DEVELOPER_SCREENS);
const DevProfileStack = tabStack("ProfileMain", ProfileScreen, DEVELOPER_SCREENS);

function DeveloperTabs() {
  return (
    <Tab.Navigator
      initialRouteName="Post"
      tabBar={(props) => <BottomNav {...props} />}
      screenOptions={{ headerShown: false, lazy: true, animation: "fade" }}
    >
      <Tab.Screen name="Post" component={DevPostStack} />
      <Tab.Screen name="Listings" component={DevListingsStack} />
      <Tab.Screen name="Profile" component={DevProfileStack} />
    </Tab.Navigator>
  );
}

function Tabs() {
  const { count } = useCompare();
  const { isDeveloper } = useAuth();
  if (isDeveloper) return <DeveloperTabs />;
  return (
    <Tab.Navigator
      initialRouteName="Home"
      tabBar={(props) => (
        <BottomNav
          {...props}
          badges={{ Compare: count ? String(count) : "" }}
        />
      )}
      screenOptions={{ headerShown: false, lazy: true, animation: "fade" }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Explore" component={SearchStack} />
      <Tab.Screen name="Post" component={PostStack} />
      <Tab.Screen name="Compare" component={CompareStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

const base = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.ivory },
  animation: "slide_from_right",
};

export default function AppNavigator({ hasStarted = true }) {
  const { token, isGuest } = useAuth();
  const authenticated = !!token || isGuest;
  // Splash → Welcome (first launch only) → Login → Otp → Tabs
  const initialRouteName = authenticated ? "Tabs" : hasStarted ? "Login" : "Welcome";

  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={base}>
      <Stack.Screen
        name="Tabs"
        component={Tabs}
        options={{ animation: "fade" }}
      />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen
        name="Welcome"
        component={GetStartedScreen}
        options={{ animation: "fade" }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen
        name="Otp"
        component={OtpScreen}
        options={{ gestureEnabled: true }}
      />
      <Stack.Screen
        name="AuthWelcome"
        component={AuthWelcomeScreen}
        options={{ gestureEnabled: false, animation: "fade" }}
      />
    </Stack.Navigator>
  );
}
