import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, SafeAreaView, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'src/assets/icons/index';
import { BrandColors } from 'src/theme/colors';

type Txn = {
  id: string;
  title: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string;
};

const initialTxns: Txn[] = [
  { id: 't1', title: 'Ride to Liberty', amount: -520, type: 'debit', date: 'Sep 28, 6:00 PM' },
  { id: 't2', title: 'Wallet Top-up', amount: 1000, type: 'credit', date: 'Sep 26, 10:00 AM' },
  { id: 't3', title: 'Ride to DHA', amount: -880, type: 'debit', date: 'Sep 24, 8:45 PM' },
];

const WalletScreen = () => {
  const navigation = useNavigation();
  const [balance, setBalance] = useState(1200);

  const addFunds = () => setBalance(balance + 500);

  const renderItem = ({ item }: { item: Txn }) => (
    <View style={styles.txnRow}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Icon name={item.type === 'credit' ? 'arrowdown' : 'arrowup'} size={16} color={item.type === 'credit' ? '#059669' : '#dc2626'} type={'antDesignIcon'} />
        <View style={{ marginLeft: 10 }}>
          <Text style={styles.txnTitle}>{item.title}</Text>
          <Text style={styles.txnDate}>{item.date}</Text>
        </View>
      </View>
      <Text style={[styles.amount, item.type === 'credit' ? styles.credit : styles.debit]}>
        {item.type === 'credit' ? '+' : '-'}₨ {Math.abs(item.amount)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="left" size={20} color="#111827" type={'antDesignIcon'} />
        </TouchableOpacity>
        <Text style={styles.title}>Wallet</Text>
        <View style={styles.backButton} />
      </View>
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Available Balance</Text>
        <Text style={styles.balance}>₨ {balance}</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={addFunds}>
            <Icon name="plus" size={16} color="#fff" type={'antDesignIcon'} />
            <Text style={styles.primaryText}>Add Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { flex: 1 }]}> 
            <Icon name="creditcard" size={16} color={BrandColors.primary} type={'antDesignIcon'} />
            <Text style={styles.secondaryText}>Payment Methods</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity>
          <Text style={styles.viewAll}>View all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        data={initialTxns}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
  balanceCard: {
    margin: 16,
    backgroundColor: BrandColors.primary,
    borderRadius: 16,
    padding: 16,
  },
  balanceLabel: {
    color: '#dbeafe',
  },
  balance: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 4,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 14,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryText: {
    color: BrandColors.primary,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  viewAll: {
    color: BrandColors.primary,
    fontWeight: '700',
  },
  txnRow: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  txnTitle: {
    color: '#111827',
    fontWeight: '700',
  },
  txnDate: {
    color: '#6b7280',
    fontSize: 12,
  },
  amount: {
    fontWeight: '800',
  },
  credit: {
    color: '#059669',
  },
  debit: {
    color: '#dc2626',
  },
});

export default WalletScreen;



