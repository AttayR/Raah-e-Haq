import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import PassengerHomeScreen from 'src/screens/Passenger/PassengerHomeScreen';
import PassengerMapScreen from 'src/screens/Passenger/PassengerMapScreen';
import PassengerNotificationsScreen from 'src/screens/Passenger/PassengerNotificationsScreen';
import PassengerChatScreen from 'src/screens/Passenger/chat/PassengerChatScreen';
import PassengerSettingsScreen from 'src/screens/Passenger/PassengerSettingsScreen';

export type PassengerTabParamList = {
  Home: undefined;
  Map: undefined;
  Notifications: undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<PassengerTabParamList>();

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
          tabBarIcon: ({ color, size }) => (
            <Icon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Map"
        component={PassengerMapScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name="map" color={color} size={size} />
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
