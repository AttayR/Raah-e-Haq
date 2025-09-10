import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  FlatList,
  Image,
  ImageBackground,
} from 'react-native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';

type RootStackParamList = {
  MessagesScreen: {
    chatData: {
      id: string;
      name: string;
      avatar: string;
      lastMessage: string;
      time: string;
      unreadCount: number;
      isDriver: boolean;
    };
  };
};

const dummyChats = [
  {
    id: '1',
    name: 'Ahmed Khan',
    lastMessage: 'Thanks for the ride! See you next time.',
    time: '2:30 PM',
    unreadCount: 0,
    avatar:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    isDriver: true,
  },

  {
    id: '3',
    name: 'Muhammad Hassan',
    lastMessage: 'Arrived at your location',
    time: '11:20 AM',
    unreadCount: 1,
    avatar:
      'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    isDriver: true,
  },
  {
    id: '4',
    name: 'Fatima Sheikh',
    lastMessage: 'Have a safe trip!',
    time: 'Yesterday',
    unreadCount: 0,
    avatar:
      'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    isDriver: true,
  },
  {
    id: '5',
    name: 'Maryam',
    lastMessage: 'Your ride has been completed',
    time: 'Yesterday',
    unreadCount: 0,
    avatar:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    isDriver: true,
  },
];

const PassengerChatScreen = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const handleChatPress = (chat: any) => {
    navigation.navigate('MessagesScreen', { chatData: chat });
  };

  const renderChatItem = (chat: any) => (
    <TouchableOpacity
      key={chat.id}
      style={styles.chatItem}
      onPress={() => handleChatPress(chat)}
      activeOpacity={0.7}
    >
      <View style={styles.chatContent}>
        <View style={styles.avatarContainer}>
          <Image source={{ uri: chat.avatar }} style={styles.avatar} />
          {chat.isDriver && (
            <View style={styles.driverBadge}>
              <Icon
                name="car"
                size={8}
                color="#ffffff"
                type={'fontAwesome6Icon'}
              />
            </View>
          )}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{chat.name}</Text>
            <Text style={styles.chatTime}>{chat.time}</Text>
          </View>
          <View style={styles.messageRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {chat.lastMessage}
            </Text>
            {chat.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{chat.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <ImageBackground
      source={require('../../../assets/images/BackgroundRaaheHaq.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dull/Blur Overlay */}
      <View style={styles.overlay} />
      <View style={styles.overlay2} />
      
      <SafeAreaView style={styles.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={BrandColors.primary}
        />
        <View style={styles.header}>
          {/* Decorative Circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Messages</Text>
          </View>
        </View>
        <FlatList
          data={dummyChats}
          keyExtractor={item => item.id}
          renderItem={({ item }) => renderChatItem(item)}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.flatListContent}
        />
      </SafeAreaView>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    zIndex: 1,
  },
  overlay2: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    zIndex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
    zIndex: 2,
  },
  flatListContent: {
    paddingHorizontal: 20,
  },
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    marginBottom: 15,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -30,
    right: -30,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: 20,
    left: -20,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    bottom: 10,
    right: 50,
  },
  decorativeCircle4: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.25)',
    top: 60,
    right: 80,
  },
  decorativeCircle5: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -20,
    left: 30,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  searchButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatItem: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  chatContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e5e7eb',
  },
  driverBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  chatTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    flex: 1,
    marginRight: 10,
  },
  unreadBadge: {
    backgroundColor: BrandColors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default PassengerChatScreen;
