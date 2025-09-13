import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Image,
  ImageBackground,
  TextInput,
  ScrollView,
} from 'react-native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
// Simple chat interface without external dependencies
type Message = {
  id: string;
  text: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    avatar?: string;
  };
};

type MessagesScreenRouteProp = RouteProp<
  {
    MessagesScreen: {
      chatData?: {
        name?: string;
        avatar?: string;
        id?: string;
      };
    };
  },
  'MessagesScreen'
>;

const MessagesScreen = () => {
  const navigation = useNavigation();
  const route = useRoute<MessagesScreenRouteProp>();
  const chatData = route?.params?.chatData || {};
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');

  useEffect(() => {
    setMessages([
      {
        id: '1',
        text: 'Hello developer',
        createdAt: new Date(),
        user: {
          id: '2',
          name: 'React Native',
          avatar: 'https://placeimg.com/140/140/any',
        },
      },
    ]);
  }, []);

  const onSend = useCallback(() => {
    if (inputText.trim()) {
      const newMessage: Message = {
        id: Date.now().toString(),
        text: inputText.trim(),
        createdAt: new Date(),
        user: {
          id: '1',
          name: 'You',
        },
      };
      setMessages(previousMessages => [...previousMessages, newMessage]);
      setInputText('');
    }
  }, [inputText]);
  return (
    <ImageBackground
      source={require('../../../assets/images/BackgroundRaaheHaq.png')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <View style={styles.overlay2} />

      <SafeAreaView style={styles?.container}>
        <StatusBar
          barStyle="light-content"
          backgroundColor={BrandColors?.primary}
        />
        <View style={styles?.header}>
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />
          <View style={styles.decorativeCircle3} />

          <View style={styles?.headerContent}>
            <TouchableOpacity
              style={styles?.backButton}
              onPress={() => navigation.goBack()}
            >
              {Icon && (
                <Icon
                  name="arrow-left"
                  size={20}
                  color="#ffffff"
                  type={'fontAwesome6Icon'}
                />
              )}
            </TouchableOpacity>

            <View style={styles?.chatInfo}>
              <Image
                source={{
                  uri: chatData?.avatar,
                }}
                style={styles?.headerAvatar}
              />
              <View style={styles?.nameContainer}>
                <Text style={styles?.headerName}>
                  {chatData?.name || 'Driver'}
                </Text>
                <Text style={styles?.onlineStatus}>Online</Text>
              </View>
            </View>

            <TouchableOpacity style={styles?.callButton}>
              {Icon && (
                <Icon
                  name="phone"
                  size={18}
                  color="#ffffff"
                  type={'fontAwesome6Icon'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.chatContainer}>
          <ScrollView style={styles.messagesList}>
            {messages.map((message) => (
              <View
                key={message.id}
                style={[
                  styles.messageContainer,
                  message.user.id === '1' ? styles.myMessage : styles.otherMessage,
                ]}
              >
                <View style={[
                  styles.messageBubble,
                  message.user.id === '1' ? styles.myMessageBubble : styles.otherMessageBubble,
                ]}>
                  <Text style={[
                    styles.messageText,
                    message.user.id === '1' ? styles.myMessageText : styles.otherMessageText,
                  ]}>
                    {message.text}
                  </Text>
                </View>
              </View>
            ))}
          </ScrollView>
          
          <View style={styles.inputContainer}>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder="Type a message..."
                placeholderTextColor="#999"
                multiline
              />
            </View>
            <TouchableOpacity style={styles.sendButton} onPress={onSend}>
              <Icon
                type={'materialIcon'}
                name="send"
                size={20}
                color={'white'}
              />
            </TouchableOpacity>
          </View>
        </View>
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
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
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
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  backButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 7,
  },
  chatInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 15,
  },
  headerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  nameContainer: {
    flex: 1,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  onlineStatus: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
  callButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 10,
  },
  messageContainer: {
    marginVertical: 4,
    paddingHorizontal: 8,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    marginHorizontal: 8,
    maxWidth: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  myMessageBubble: {
    backgroundColor: BrandColors.primary,
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  otherMessageText: {
    color: '#1B1B1B',
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 8,
    margin: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  textInputContainer: {
    flex: 1,
    marginRight: 10,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 20,
    color: '#1B1B1B',
    paddingVertical: 8,
    paddingHorizontal: 0,
    margin: 0,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  leftBubble: {
    backgroundColor: BrandColors.primary,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderBottomLeftRadius: 0,
    paddingHorizontal: 5,
    marginVertical: 2,
  },
  rightBubble: {
    backgroundColor: 'white',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 15,
    borderBottomLeftRadius: 10,
    paddingHorizontal: 5,
    marginVertical: 2,
  },
});

export default MessagesScreen;
