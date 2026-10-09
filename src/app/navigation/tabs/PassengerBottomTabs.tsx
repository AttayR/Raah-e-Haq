import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import PassengerHomeScreen from 'src/screens/Passenger/PassengerHomeScreen';
import PassengerNotificationsScreen from 'src/screens/Passenger/PassengerNotificationsScreen';
import PassengerChatScreen from 'src/screens/Passenger/chat/PassengerChatScreen';
import PassengerSettingsScreen from 'src/screens/Passenger/PassengerSettingsScreen';

export type PassengerTabParamList = {
  Home: undefined;
  Notifications: undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<PassengerTabParamList>();

// No Map tab: booking is the PassengerMap stack route, opened from Home (T-301, PAX-10;
// DESIGN_SYSTEM §8 IA). A second mount had its own copy of the ride state.

const PassengerBottomTabs = () => {
  const { theme } = useAppTheme();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.text + '80',
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
        },
        headerStyle: {
          backgroundColor: theme.colors.surface,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerShown: false
      }}
    >
      <Tab.Screen
  name="Home"
  component={PassengerHomeScreen}
  options={{
    headerShown: false, // 👈 This hides the header for Home screen
    tabBarIcon: ({ color, size }) => (
      <Icon name="home" color={color} size={size} />
    ),
  }}
/>

      <Tab.Screen
        name="Notifications"
        component={PassengerNotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="notifications" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={PassengerChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="chat" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Settings"
        component={PassengerSettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default PassengerBottomTabs;
