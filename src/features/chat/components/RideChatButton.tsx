import React, { useContext } from 'react';
import { NavigationContext } from '@react-navigation/native';
import { Button } from '../../../components/ui';
import { CHAT_COPY } from '../copy';
import { openRideChat, type RideChatNavigator } from '../navigation';

type Props = {
  rideId: number;
  /** The other party's name, for the screen-reader label. */
  name?: string | null;
  /** Overrides the default (open this ride's thread in the current stack). */
  onPress?: () => void;
  testID?: string;
};

/**
 * "Message" on an active ride (T-510): opens the ride's chat thread. It reads the navigator
 * from context (not useNavigation, which throws outside one), so a panel rendered without a
 * navigator simply shows no button.
 */
export const RideChatButton: React.FC<Props> = ({ rideId, name, onPress, testID = 'ride-chat-button' }) => {
  const navigation: RideChatNavigator | undefined = useContext(NavigationContext);
  if (!onPress && !navigation) return null;
  const open = onPress ?? (() => navigation && openRideChat(navigation, rideId));
  return (
    <Button
      label={CHAT_COPY.message}
      onPress={open}
      variant="secondary"
      leadingIcon="chat"
      accessibilityLabel={name ? CHAT_COPY.messageA11y(name) : CHAT_COPY.message}
      testID={testID}
    />
  );
};
