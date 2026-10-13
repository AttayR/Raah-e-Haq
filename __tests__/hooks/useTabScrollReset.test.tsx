/**
 * T-514: tab-root scroll screens (Account) open at the top. Switching to another tab resets
 * the offset the mounted ScrollView kept; a stack screen pushed over the tabs (Account →
 * Profile) keeps it, so Back returns to the same place and nothing jumps during the push.
 * Real navigators: the blur from a push and from a tab switch must be told apart.
 */
import React from 'react';
import { Button, Text } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useTabScrollReset } from '../../src/hooks/useTabScrollReset';

const scrollTo = jest.fn();
const scrollRef = { current: { scrollTo } };

function AccountTab() {
  useTabScrollReset(scrollRef);
  const navigation = useNavigation<{ navigate: (name: string) => void }>();
  return <Button title="Open profile" onPress={() => navigation.navigate('Profile')} />;
}

const OtherTab = () => <Text>Other tab</Text>;
const ProfileScreen = () => <Text>Profile screen</Text>;

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function TabsScreen() {
  return (
    <Tabs.Navigator>
      <Tabs.Screen name="Account" component={AccountTab} />
      <Tabs.Screen name="Other" component={OtherTab} />
    </Tabs.Navigator>
  );
}

const renderApp = async () => {
  render(
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabsScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  );
  await act(async () => undefined);
};

beforeEach(() => scrollTo.mockClear());

describe('useTabScrollReset', () => {
  it('a stack screen pushed over the tab keeps the scroll offset', async () => {
    await renderApp();
    fireEvent.press(screen.getByText('Open profile'));
    await act(async () => undefined);
    expect(screen.getByText('Profile screen')).toBeTruthy();
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('switching to another tab puts the list back at the top, without animation', async () => {
    await renderApp();
    fireEvent.press(screen.getByRole('button', { name: /Other/ }));
    await act(async () => undefined);
    expect(screen.getByText('Other tab')).toBeTruthy();
    expect(scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  });
});
