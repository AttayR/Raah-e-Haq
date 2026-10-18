import { t } from '../../i18n';
import type { ParcelView } from './types';

/** What the receiver line says: the name and the masked number, whichever the server sent. */
export const receiverLine = (receiver: ParcelView['receiver']): string | null => {
  if (!receiver) return null;
  const phone = shortMaskedPhone(receiver.phoneMasked);
  if (receiver.name && phone) return t('parcel.receiverLine', { name: receiver.name, phone });
  return receiver.name ?? phone;
};

/**
 * UI-R15: the server's masked number ("+92300*****67", "**********09") shown as "•••• 67": only
 * the last two digits, which is all the server reveals at the end anyway. Null without digits.
 */
export const shortMaskedPhone = (masked: string | null): string | null => {
  if (!masked) return null;
  const tail = /(\d{2})\D*$/.exec(masked);
  return tail ? `•••• ${tail[1]}` : null;
};

/** "Documents · Small (fits in a bag)". */
export const itemLine = (parcel: Pick<ParcelView, 'itemCategoryLabel' | 'sizeLabel'>): string | null =>
  parcel.itemCategoryLabel && parcel.sizeLabel
    ? t('parcel.requestItem', { item: parcel.itemCategoryLabel, size: parcel.sizeLabel })
    : parcel.itemCategoryLabel ?? parcel.sizeLabel;
