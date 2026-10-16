import { t } from '../../i18n';
import type { ParcelView } from './types';

/** What the receiver line says: the name and the masked number, whichever the server sent. */
export const receiverLine = (receiver: ParcelView['receiver']): string | null => {
  if (!receiver) return null;
  if (receiver.name && receiver.phoneMasked) return t('parcel.receiverLine', { name: receiver.name, phone: receiver.phoneMasked });
  return receiver.name ?? receiver.phoneMasked;
};

/** "Documents · Small (fits in a bag)". */
export const itemLine = (parcel: Pick<ParcelView, 'itemCategoryLabel' | 'sizeLabel'>): string | null =>
  parcel.itemCategoryLabel && parcel.sizeLabel
    ? t('parcel.requestItem', { item: parcel.itemCategoryLabel, size: parcel.sizeLabel })
    : parcel.itemCategoryLabel ?? parcel.sizeLabel;
