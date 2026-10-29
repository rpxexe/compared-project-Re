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
import PropertyDetailsScreen from "../screens/PropertyDetailsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SettingsScreen from "../screens/SettingsScreen";
import NotificationScreen from "../screens/NotificationScreen";
import LocationScreen from "../screens/LocationScreen";
import PostPropertyFormScreen from "../screens/PostPropertyFormScreen";
import PostPropertyScreen from "../screens/PostPropertyScreen";
import {
  SavedScreen,
  MyPropertiesScreen,
  MyEnquiriesScreen,
} from "../screens/ListScreens";
import {
  AdminDashboard,
  AdminProperties,
  AdminEnquiries,
  AdminUsers,
} from "../screens/AdminScreens";
import PrePostPropertyTypeScreen from "../screens/PrePostPropertyTypeScreen";
import SignUpScreen from "../screens/SignUp";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function Tabs() {
  const { count } = useCompare();
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
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={SearchScreen} />
      <Tab.Screen name="Post" component={PostPropertyScreen} />
      <Tab.Screen name="Compare" component={CompareScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const base = {
  headerShown: false,
  contentStyle: { backgroundColor: colors.ivory },
  animation: "slide_from_right",
};

export default function AppNavigator({ hasStarted = true }) {
  const { token, isGuest, isStaff } = useAuth();
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
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="NewProject" component={NewProjectScreen} />
      <Stack.Screen name="Notification" component={NotificationScreen} />
      <Stack.Screen
        name="Location"
        component={LocationScreen}
        options={{ animation: "slide_from_bottom" }}
      />

      <Stack.Screen
        name="PrePostPropertyType"
        component={PrePostPropertyTypeScreen}
      />
      <Stack.Screen
        name="PostPropertyForm"
        component={PostPropertyFormScreen}
      />

      <Stack.Screen
        name="PropertyDetails"
        component={PropertyDetailsScreen}
        options={{ animation: "slide_from_bottom" }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Saved" component={SavedScreen} />
      <Stack.Screen name="MyProperties" component={MyPropertiesScreen} />
      <Stack.Screen name="MyEnquiries" component={MyEnquiriesScreen} />
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
      {isStaff ? (
        <>
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="AdminProperties" component={AdminProperties} />
          <Stack.Screen name="AdminEnquiries" component={AdminEnquiries} />
          <Stack.Screen name="AdminUsers" component={AdminUsers} />
        </>
      ) : null}
    </Stack.Navigator>
  );
}
