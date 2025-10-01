import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';

type RideItem = {
  id: string;
  date: string;
  from: string;
  to: string;
  fare: string;
  status: 'completed' | 'cancelled';
};

const SAMPLE_RIDES: RideItem[] = [
  { id: '1', date: 'Sep 28, 2025 • 5:30 PM', from: 'Iqbal Town', to: 'Liberty Market', fare: '₨ 520', status: 'completed' },
  { id: '2', date: 'Sep 26, 2025 • 9:10 AM', from: 'Wapda Town', to: 'Model Town', fare: '₨ 320', status: 'completed' },
  { id: '3', date: 'Sep 24, 2025 • 8:00 PM', from: 'Johar Town', to: 'DHA Phase 5', fare: '₨ 880', status: 'cancelled' },
];

const RideHistoryScreen = () => {
  const navigation = useNavigation();

  const renderItem = ({ item }: { item: RideItem }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.date}>{item.date}</Text>
        <Text style={[styles.status, item.status === 'completed' ? styles.completed : styles.cancelled]}>
          {item.status === 'completed' ? 'Completed' : 'Cancelled'}
        </Text>
      </View>
      <View style={styles.row}>
        <Icon name="enviromento" size={16} color={BrandColors.primary} type={'antDesignIcon'} />
        <Text style={styles.place} numberOfLines={1}>{item.from}</Text>
      </View>
      <View style={styles.separator} />
      <View style={styles.row}>
        <Icon name="flag" size={16} color={BrandColors.primary} type={'antDesignIcon'} />
        <Text style={styles.place} numberOfLines={1}>{item.to}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.fare}>{item.fare}</Text>
        <TouchableOpacity style={styles.detailsBtn}>
          <Text style={styles.detailsText}>Details</Text>
          <Icon name="right" size={14} color="#fff" type={'antDesignIcon'} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="left" size={20} color="#111827" type={'antDesignIcon'} />
        </TouchableOpacity>
        <Text style={styles.title}>Ride History</Text>
        <View style={styles.backButton} />
      </View>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={SAMPLE_RIDES}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  date: {
    color: '#6b7280',
    fontSize: 12,
  },
  status: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  completed: {
    backgroundColor: 'rgba(16,185,129,0.12)',
    color: '#065f46',
  },
  cancelled: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    color: '#7f1d1d',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  place: {
    flex: 1,
    color: '#111827',
    fontSize: 14,
    marginLeft: 8,
  },
  separator: {
    height: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  fare: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: BrandColors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  detailsText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default RideHistoryScreen;



