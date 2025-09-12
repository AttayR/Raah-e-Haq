import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import DriverHomeScreen from 'src/screens/Driver/DriverHomeScreen';
import DriverMapScreen from 'src/screens/Driver/DriverMapScreen';
import DriverNotificationsScreen from 'src/screens/Driver/DriverNotificationsScreen';
import DriverChatScreen from 'src/screens/Driver/DriverChatScreen'
import DriverSettingsScreen from 'src/screens/Driver/DriverSettingsScreen';

export type DriverTabParamList = {
  Home: undefined;
  Map: undefined;
  Notifications: undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();

const DriverBottomTabs = () => {
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
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DriverHomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="home" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={DriverMapScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="map" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Notifications"
        component={DriverNotificationsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="notifications" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={DriverChatScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="chat" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={DriverSettingsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Icon name="settings" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
};

export default DriverBottomTabs;