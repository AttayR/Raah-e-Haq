import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, StatusBar, SafeAreaView } from 'react-native';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'ride' | 'promo' | 'system' | 'wallet';
  read: boolean;
};

const PassengerNotificationsScreen = () => {
  const { theme } = useAppTheme();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<'all' | 'unread' | 'promo' | 'ride' | 'wallet' | 'system'>('all');
  const [items, setItems] = useState<NotificationItem[]>([
    { id: '1', title: 'Driver Arriving Soon', message: 'Your driver is 2 minutes away.', time: '2m ago', type: 'ride', read: false },
    { id: '2', title: '20% Off This Weekend', message: 'Use code WEEKEND20 on your next ride.', time: '1h ago', type: 'promo', read: false },
    { id: '3', title: 'Wallet Top-up Successful', message: '₨ 1,000 added to your wallet.', time: 'Yesterday', type: 'wallet', read: true },
    { id: '4', title: 'New App Update', message: 'We have improved performance and fixed bugs.', time: '2d ago', type: 'system', read: true },
  ]);

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter(i => !i.read);
    return items.filter(i => i.type === filter);
  }, [filter, items]);

  const markAllAsRead = () => {
    setItems(prev => prev.map(i => ({ ...i, read: true })));
  };

  const toggleRead = (id: string) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, read: !i.read } : i)));
  };

  const renderIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'ride':
        return <Icon name="local-taxi" size={18} color={theme.colors.primary} />;
      case 'promo':
        return <Icon name="local-offer" size={18} color="#F59E0B" />;
      case 'wallet':
        return <Icon name="account-balance-wallet" size={18} color="#10B981" />;
      default:
        return <Icon name="info" size={18} color={theme.colors.mutedText} />;
    }
  };

  const renderItem = ({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface, opacity: item.read ? 0.75 : 1 }]}
      activeOpacity={0.8}
      onPress={() => toggleRead(item.id)}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconWrap, { backgroundColor: theme.colors.primary + '1A' }]}>
          {renderIcon(item.type)}
        </View>
      </View>
      <View style={styles.cardCenter}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {item.title}
          </Text>
          {!item.read && <View style={styles.unreadDot} />}
        </View>
        <Text style={[styles.message, { color: theme.colors.mutedText }]} numberOfLines={2} ellipsizeMode="tail">
          {item.message}
        </Text>
        <Text style={[styles.time, { color: theme.colors.mutedText }]}>
          {item.time}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <Icon name="chevron-right" size={22} color={theme.colors.mutedText} />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}> 
      <StatusBar barStyle={theme.mode === 'dark' ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
          <Icon name="arrow-back" size={22} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Notifications</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={markAllAsRead}>
          <Text style={[styles.headerAction, { color: theme.colors.primary }]}>Mark all</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {(['all', 'unread', 'promo', 'ride', 'wallet', 'system'] as const).map(key => (
          <TouchableOpacity
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.filterChip, filter === key && [styles.filterChipActive, { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '12' }]]}
          >
            <Text style={[styles.filterText, { color: filter === key ? theme.colors.primary : theme.colors.mutedText }]}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={renderItem}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Icon name="notifications-off" size={40} color={theme.colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No notifications</Text>
            <Text style={[styles.emptyText, { color: theme.colors.mutedText }]}>You are all caught up for now.</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerAction: {
    fontSize: 13,
    fontWeight: '700',
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    borderWidth: 1.5,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  separator: {
    height: 12,
  },
  card: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardLeft: {
    marginRight: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginLeft: 8,
  },
  message: {
    fontSize: 13,
    marginTop: 2,
  },
  time: {
    fontSize: 11,
    marginTop: 8,
  },
  cardRight: {
    marginLeft: 12,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    fontSize: 13,
  },
});

export default PassengerNotificationsScreen;