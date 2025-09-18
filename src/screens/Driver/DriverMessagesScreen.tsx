import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  FlatList,
  TextInput,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

type RootStackParamList = {
  DriverMessagesScreen: {
    chatData: {
      id: string;
      name: string;
      avatar: string;
      lastMessage: string;
      time: string;
      unreadCount: number;
      isPassenger: boolean;
    };
  };
};

type DriverMessagesScreenRouteProp = RouteProp<RootStackParamList, 'DriverMessagesScreen'>;

const dummyMessages = [
  {
    id: '1',
    text: 'Hello! I\'m your driver. I\'ll be there in 5 minutes.',
    time: '2:30 PM',
    isDriver: true,
  },
  {
    id: '2',
    text: 'Thank you! I\'m waiting at the main entrance.',
    time: '2:31 PM',
    isDriver: false,
  },
  {
    id: '3',
    text: 'Perfect! I can see you. I\'m in the blue car.',
    time: '2:32 PM',
    isDriver: true,
  },
  {
    id: '4',
    text: 'Great! I\'m coming out now.',
    time: '2:33 PM',
    isDriver: false,
  },
  {
    id: '5',
    text: 'Thank you for the smooth ride!',
    time: '2:45 PM',
    isDriver: false,
  },
  {
    id: '6',
    text: 'You\'re welcome! Have a great day!',
    time: '2:46 PM',
    isDriver: true,
  },
];

const DriverMessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<DriverMessagesScreenRouteProp>();
  const { chatData } = route.params;
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState(dummyMessages);

  const handleSendMessage = () => {
    if (message.trim()) {
      const newMessage = {
        id: Date.now().toString(),
        text: message.trim(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isDriver: true,
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View style={[
      styles.messageContainer,
      item.isDriver ? styles.driverMessage : styles.passengerMessage
    ]}>
      <Text style={[
        styles.messageText,
        item.isDriver ? styles.driverMessageText : styles.passengerMessageText
      ]}>
        {item.text}
      </Text>
      <Text style={[
        styles.messageTime,
        item.isDriver ? styles.driverMessageTime : styles.passengerMessageTime
      ]}>
        {item.time}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BrandColors.primary}
        translucent={false}
      />
      <ImageBackground
        source={require('../../assets/images/background_raahe_haq.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        {/* Dull/Blur Overlay */}
        <View style={styles.overlay} />
        <View style={styles.overlay2} />
        
        <View style={styles.container}>
        
        <View style={styles.header}>
          {/* Decorative Circles */}
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />
          <View style={styles.decorativeCircle4} />
          <View style={styles.decorativeCircle5} />
          
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Icon
                name="left"
                size={20}
                color="#ffffff"
                type="antDesignIcon"
              />
            </TouchableOpacity>
            
            <View style={styles.userInfo}>
              <Image source={{ uri: chatData.avatar }} style={styles.headerAvatar} />
              <View style={styles.userDetails}>
                <Text style={styles.userName}>{chatData.name}</Text>
                <Text style={styles.userStatus}>Online</Text>
              </View>
            </View>
            
            <TouchableOpacity style={styles.moreButton}>
              <Icon
                name="more"
                size={20}
                color="#ffffff"
                type="antDesignIcon"
              />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView 
          style={styles.chatContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            style={styles.messagesList}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          />
          
          <View style={styles.inputContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={message}
                onChangeText={setMessage}
                placeholder="Type a message..."
                placeholderTextColor="#9ca3af"
                multiline
                maxLength={500}
              />
              <TouchableOpacity style={styles.attachButton}>
                <Icon
                  name="paperclip"
                  size={20}
                  color={BrandColors.primary}
                  type="antDesignIcon"
                />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.sendButton, message.trim() ? styles.sendButtonActive : null]}
                onPress={handleSendMessage}
                disabled={!message.trim()}
              >
                <Icon
                  name="send"
                  size={20}
                  color={message.trim() ? "#ffffff" : "#9ca3af"}
                  type="antDesignIcon"
                />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: BrandColors.primary,
  },
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
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    position: 'relative',
    overflow: 'hidden',
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.15)',
    top: -20,
    right: -20,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.2)',
    top: 10,
    left: -15,
  },
  decorativeCircle3: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    bottom: 5,
    right: 30,
  },
  decorativeCircle4: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.25)',
    top: 40,
    right: 60,
  },
  decorativeCircle5: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.08)',
    bottom: -10,
    left: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  userStatus: {
    color: '#e5e7eb',
    fontSize: 14,
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  messageContainer: {
    marginBottom: 15,
    maxWidth: '80%',
  },
  driverMessage: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  passengerMessage: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  driverMessageText: {
    backgroundColor: BrandColors.primary,
    color: '#ffffff',
    borderBottomRightRadius: 5,
  },
  passengerMessageText: {
    backgroundColor: '#f3f4f6',
    color: '#1f2937',
    borderBottomLeftRadius: 5,
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  driverMessageTime: {
    color: '#6b7280',
    textAlign: 'right',
  },
  passengerMessageTime: {
    color: '#6b7280',
    textAlign: 'left',
  },
  inputContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    minHeight: 50,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    maxHeight: 100,
    paddingVertical: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonActive: {
    backgroundColor: BrandColors.primary,
  },
});

export default DriverMessagesScreen;
