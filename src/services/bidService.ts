import { db } from './firebase';
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from '@react-native-firebase/firestore';

export interface RideBidDoc {
  id?: string;
  rideId: string;
  driverId: string;
  driverName?: string;
  price: number;
  createdAt: any;
}

export const submitBid = async (
  rideId: string,
  driverId: string,
  price: number,
  driverName?: string
): Promise<string> => {
  const ref = await addDoc(collection(db, 'rideBids'), {
    rideId,
    driverId,
    driverName: driverName || null,
    price,
    createdAt: serverTimestamp(),
  } as RideBidDoc);
  return ref.id;
};

export const listenRideBids = (
  rideId: string,
  cb: (bids: RideBidDoc[]) => void
) => {
  const q = query(
    collection(db, 'rideBids'),
    where('rideId', '==', rideId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    const results: RideBidDoc[] = [];
    snap.forEach((d) => results.push({ id: d.id, ...(d.data() as any) }));
    cb(results);
  });
};


