import React, { useCallback, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAppTheme } from '../../providers/ThemeProvider';
import DriverHomeScreen from 'src/screens/Driver/DriverHomeScreen';
import DriverMapScreen from 'src/screens/Driver/DriverMapScreen';
import DriverNotificationsScreen from 'src/screens/Driver/DriverNotificationsScreen';
import DriverChatScreen from 'src/screens/Driver/DriverChatScreen'
import DriverSettingsScreen from 'src/screens/Driver/DriverSettingsScreen';
import { RideRequestHost } from '../../../components/driver/RideRequestHost';
import { rideRequestBottomOffset } from '../../../components/driver/rideRequestLayout';

export type DriverTabParamList = {
  Home: undefined;
  Map: undefined;
  Notifications: undefined;
  Chat: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();

/** The default iOS tab bar height, used until the real bar has been measured. */
const DEFAULT_TAB_BAR_HEIGHT = 49;

const DriverBottomTabs = () => {
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  // Ride requests (T-408) sit above the tab bar on every tab: its measured height, and the open
  // tab (the Map tab also shows the feed's loading and empty states).
  const [tabBarHeight, setTabBarHeight] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<keyof DriverTabParamList>('Home');

  const onTabBarLayout = useCallback((event: LayoutChangeEvent) => {
    setTabBarHeight(event.nativeEvent.layout.height);
  }, []);
  const renderTabBar = useCallback(
    (props: BottomTabBarProps) => (
      <View onLayout={onTabBarLayout}>
        <BottomTabBar {...props} />
      </View>
    ),
    [onTabBarLayout],
  );

  return (
    <View style={styles.container}>
      <Tab.Navigator
        tabBar={renderTabBar}
        screenListeners={({ route }) => ({
          focus: () => setActiveTab(route.name),
        })}
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
      <RideRequestHost
        bottomOffset={rideRequestBottomOffset(
          tabBarHeight ?? DEFAULT_TAB_BAR_HEIGHT + insets.bottom,
          activeTab,
        )}
        showIdleStates={activeTab === 'Map'}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default DriverBottomTabs;