import { useNavigation } from '@react-navigation/native';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { useSelector } from 'react-redux';
import Icon from 'src/assets/icons/index';
import { RootState } from 'src/store';
import { BrandColors } from 'src/theme/colors';

const ProfileSettingsScreen = () => {
  const navigation = useNavigation();
  const { userProfile, phoneNumber, role } = useSelector(
    (state: RootState) => state.auth,
  );
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#22c55e" />
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.profileSection}>
            <View style={styles.profileImageContainer}>
              <View style={styles.profileImage}>
                <Icon
                  name="person"
                  size={40}
                  color="#6b7280"
                  type="fontistoIcon"
                />
              </View>
            </View>

            <Text style={styles.passengerName}>{userProfile?.fullName}</Text>

            <View style={styles.ratingContainer}>
              <Icon
                name="star"
                size={20}
                color="#fbbf24"
                style={styles.starIcon}
                type="antDesignIcon"
              />
              <Icon
                name="star"
                size={20}
                color="#fbbf24"
                style={styles.starIcon}
                type="antDesignIcon"
              />
              <Icon
                name="star"
                size={20}
                color="#fbbf24"
                style={styles.starIcon}
                type="antDesignIcon"
              />
              <Icon
                name="star"
                size={20}
                color="#fbbf24"
                style={styles.starIcon}
                type="antDesignIcon"
              />
            </View>
          </View>
        </View>

        {/* Settings Options */}
        <View style={styles.optionsContainer}>
          <TouchableOpacity style={styles.optionItem}>
            <View style={styles.optionInfo}>
              <Icon
                name="creditcard"
                size={20}
                color={BrandColors.primary}
                type="antDesignIcon"
              />
              <Text style={styles.optionText}>My Wallet</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={20}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionItem, styles.borderTop]}>
            <View style={styles.optionInfo}>
              <Icon
                name="clockcircleo"
                size={20}
                color={BrandColors.primary}
                type="antDesignIcon"
              />
              <Text style={styles.optionText}>History</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={20}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.optionItem, styles.borderTop]}
            onPress={() => navigation.navigate('PassengerPofile')}
          >
            <View style={styles.optionInfo}>
              <Icon
                name="user"
                size={20}
                color={BrandColors.primary}
                type="antDesignIcon"
              />
              <Text style={styles.optionText}>Profile Settings</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={25}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionItem, styles.borderTop]}>
            <View style={styles.optionInfo}>
              <Icon
                name="filetext1"
                size={20}
                color={BrandColors.primary}
                type="antDesignIcon"
              />
              <Text style={styles.optionText}>Subscription</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={25}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionItem, styles.borderTop]}>
            <View style={styles.optionInfo}>
              <Icon
                name="adduser"
                size={20}
                color={BrandColors.primary}
                type="antDesignIcon"
              />
              <Text style={styles.optionText}>Invite Friends</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={25}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.optionItem, styles.borderTop]}>
            <View style={styles.optionInfo}>
              <Icon
                name="logout"
                size={20}
                color="#ef4444"
                type="antDesignIcon"
              />
              <Text style={[styles.optionText, styles.logoutText]}>Logout</Text>
            </View>
            <Icon
              name="chevron-small-right"
              size={25}
              color="#9ca3af"
              type={'entypoIcon'}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: BrandColors.primary,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  profileSection: {
    alignItems: 'center',
  },
  profileImageContainer: {
    marginBottom: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  passengerName: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 15,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  starIcon: {
    marginHorizontal: 2,
  },
  cashContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 25,
  },
  cashLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  cashAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  optionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 18,
  },
  optionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginLeft: 15,
  },
  logoutText: {
    color: '#ef4444',
  },
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  bottomPadding: {
    height: 40,
  },
});

export default ProfileSettingsScreen;
