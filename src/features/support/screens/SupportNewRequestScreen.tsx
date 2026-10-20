import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation, usePreventRemove, useRoute, type RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../app/providers/ThemeProvider';
import { AppText, Banner, Button, FieldLabel, Header, KeyboardAwareScrollView, Screen, TextField } from '../../../components/ui';
import { firstFieldMessages, toApiError } from '../../../core/api/errors';
import { confirm } from '../../../core/dialog';
import { haptics } from '../../../core/haptics';
import { toast } from '../../../core/toast';
import { t } from '../../../i18n';
import { componentTokens, layout, space } from '../../../theme';
import { DESCRIPTION_MIN, MESSAGE_MAX, SUBJECT_MAX, supportApi } from '../api';
import { RequestTripCard } from '../components/RequestTripCard';
import { TopicChips } from '../components/TopicChips';
import { retryMinutes } from '../format';
import { useSupportCategories } from '../hooks';
import type { SupportNavigator, SupportRoutes } from '../navigation';

type Errors = { category?: string; subject?: string; description?: string; ride?: string; banner?: string; wait?: number };

/** Server 422 per field; 429 → a wait Banner; anything else → the danger Banner with Try again. */
const errorsOf = (cause: unknown): Errors => {
  const minutes = retryMinutes(cause);
  if (minutes !== null) return { wait: minutes };
  const error = toApiError(cause);
  if (error.kind === 'validation') {
    const fields = firstFieldMessages(error.fieldErrors);
    const mapped: Errors = { category: fields.category, subject: fields.subject, description: fields.description, ride: fields.ride_id };
    if (Object.values(mapped).some(Boolean)) return mapped;
  }
  return { banner: t('support.sendFailed') };
};

/**
 * New request (shared-support-invite §H4, Form): topic chips (preselected from the opener), the
 * trip when opened from one (removable; sent as `ride_id`), a subject (≤120) and what happened
 * (10..2000, with a counter). "Send request" stays disabled until valid; on success the thread
 * replaces this screen with a toast. Leaving with anything typed asks first.
 */
export default function SupportNewRequestScreen() {
  const navigation = useNavigation<SupportNavigator>();
  const { params } = useRoute<RouteProp<SupportRoutes, 'SupportNewRequest'>>();
  const { theme } = useAppTheme();
  const insets = useSafeAreaInsets();
  const categories = useSupportCategories();

  const [category, setCategory] = useState<string | null>(params?.category ?? null);
  const [trip, setTrip] = useState(params?.trip ?? null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const sent = useRef(false);

  const topics = categories.data ?? [];
  // A topic the server does not offer this role is dropped (e.g. a stale param).
  useEffect(() => {
    if (category && categories.data && !categories.data.some((c) => c.slug === category)) setCategory(null);
  }, [category, categories.data]);

  const needsTopic = topics.length > 0;
  const valid =
    (!needsTopic || category !== null) && subject.trim().length > 0 && description.trim().length >= DESCRIPTION_MIN;
  const dirty = subject.trim().length > 0 || description.trim().length > 0;

  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [dirty, navigation]);

  usePreventRemove(dirty, ({ data }) => {
    if (sent.current) {
      navigation.dispatch(data.action);
      return;
    }
    confirm({
      title: t('support.discardTitle'),
      confirmLabel: t('support.discard'),
      cancelLabel: t('support.keepWriting'),
      destructive: true,
    }).then((yes) => {
      if (yes) navigation.dispatch(data.action);
    });
  });

  const onSend = async () => {
    if (!valid || sending) return;
    setSending(true);
    setErrors({});
    try {
      const ticket = await supportApi.create({
        category: category ?? 'general',
        subject,
        description,
        rideId: trip?.id ?? null,
      });
      sent.current = true;
      haptics.notificationSuccess();
      toast.success(t('support.sent'));
      navigation.replace('SupportTicket', { id: ticket.id });
    } catch (cause: unknown) {
      setErrors(errorsOf(cause));
    } finally {
      setSending(false);
    }
  };

  const descriptionShort = description.trim().length > 0 && description.trim().length < DESCRIPTION_MIN;

  return (
    <Screen testID="support-new-screen" keyboardAvoiding>
      <Header
        tone="background"
        title={t('support.newTitle')}
        backLabel={t('support.back')}
        onBack={() => navigation.goBack()}
        testID="support-new-header"
      />
      <KeyboardAwareScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {topics.length > 0 ? (
          <View style={styles.field}>
            <FieldLabel required>{t('support.topicLabel')}</FieldLabel>
            <TopicChips
              topics={topics}
              selected={category}
              onSelect={(slug) => {
                setCategory(slug);
                setErrors((e) => ({ ...e, category: undefined }));
              }}
            />
            {errors.category ? (
              <AppText variant="bodySmall" color="danger" accessibilityRole="alert">
                {errors.category}
              </AppText>
            ) : null}
          </View>
        ) : null}

        {trip ? (
          <View style={styles.field}>
            <FieldLabel>{t('support.tripLabel')}</FieldLabel>
            <RequestTripCard trip={trip} onRemove={() => setTrip(null)} testID="support-new-trip" />
            {errors.ride ? (
              <AppText variant="bodySmall" color="danger" accessibilityRole="alert">
                {errors.ride}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <View>
          <TextField
            label={t('support.subjectLabel')}
            required
            value={subject}
            onChangeText={(text) => {
              setSubject(text);
              setErrors((e) => ({ ...e, subject: undefined }));
            }}
            maxLength={SUBJECT_MAX}
            returnKeyType="next"
            error={errors.subject ?? null}
            testID="support-new-subject"
          />
          {subject.length >= componentTokens.support.subjectCounterFrom ? (
            <AppText variant="caption" color="textMuted" style={styles.counter} testID="support-new-subject-counter">
              {t('common.counter', { count: subject.length, max: SUBJECT_MAX })}
            </AppText>
          ) : null}
        </View>

        <View>
          <TextField
            label={t('support.descriptionLabel')}
            required
            placeholder={t('support.descriptionPlaceholder')}
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setErrors((e) => ({ ...e, description: undefined }));
            }}
            multiline
            doneBar
            maxLength={MESSAGE_MAX}
            helper={descriptionShort ? t('support.descriptionTooShort', { min: DESCRIPTION_MIN }) : undefined}
            error={errors.description ?? null}
            testID="support-new-description"
          />
          <AppText variant="caption" color="textMuted" style={styles.counter} testID="support-new-description-counter">
            {t('common.counter', { count: description.length, max: MESSAGE_MAX })}
          </AppText>
        </View>

        {errors.wait ? (
          <Banner tone="warning" text={t('support.rateLimited', { minutes: errors.wait })} testID="support-new-wait" />
        ) : null}
        {errors.banner ? (
          <Banner
            tone="danger"
            text={errors.banner}
            actionPlacement="below"
            action={{ label: t('support.tryAgain'), onPress: onSend, testID: 'support-new-retry' }}
            testID="support-new-error"
          />
        ) : null}
      </KeyboardAwareScrollView>
      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom + layout.bottomActionOffset, layout.bottomActionMinOffset),
            borderTopColor: theme.colors.border,
            borderTopWidth: theme.borderWidth.hairline,
            backgroundColor: theme.colors.background,
          },
        ]}
      >
        <Button label={t('support.send')} size="lg" onPress={onSend} disabled={!valid} loading={sending} testID="support-new-send" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
    gap: space[4],
  },
  field: { gap: space[2] },
  counter: { alignSelf: 'flex-end', marginTop: space[1] },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
  },
});
