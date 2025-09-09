import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  Image,
} from 'react-native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';

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
  const navigation = useNavigation?.();
  const route = useRoute<MessagesScreenRouteProp>();
  const chatData = route?.params?.chatData || {};

  return (
    <SafeAreaView style={styles?.container}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={BrandColors?.primary}
      />
      <View style={styles?.header}>
        <View style={styles?.headerContent}>
          <TouchableOpacity
            style={styles?.backButton}
            onPress={() => navigation?.goBack?.()}
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
                uri:
                  chatData?.avatar ||
                  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
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
      <View style={styles.comingSoonContainer}>
        <Text style={styles.comingSoonText}>Coming Soon</Text>
        <Text style={styles.comingSoonSubtext}>
          Chat functionality will be available soon
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
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
  chatInfo: {
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
  nameContainer: {
    flex: 1,
  },
  headerName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  onlineStatus: {
    color: '#e5e7eb',
    fontSize: 12,
    marginTop: 2,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 20,
  },
  comingSoonText: {
    fontSize: 24,
    fontWeight: '600',
    color: BrandColors.primary,
    marginBottom: 10,
  },
  comingSoonSubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default MessagesScreen;
