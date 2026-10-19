import React, { useEffect } from 'react';
import { View } from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppTheme } from '../../app/providers/ThemeProvider';
import { layout } from '../../theme';
import { AppText, Button, Header, Icon, KeyboardAwareScrollView, Screen } from '../../components/ui';
import { confirm } from '../../core/dialog';
import { formatCountdown } from '../../services/otpService';
import { REGISTRATION_COPY as COPY } from '../../features/auth/copy/registration';
import { FieldAnchorContext } from '../../features/auth/registration/fieldAnchors';
import { pageProgress, registrationPages, type RegistrationPage } from '../../features/auth/registration/pages';
import type { RegistrationRole } from '../../features/auth/registration/registrationForm';
import { hasFormInput, useRegistrationWizard } from '../../features/auth/registration/useRegistrationWizard';
import RegistrationPhoneStep from '../../features/auth/components/RegistrationPhoneStep';
import type { AuthStackParamList } from '../../app/navigation/stacks/AuthStack';
import RegistrationHeader from './RegistrationHeader';
import { styles } from './RegistrationScreen.styles';
import RoleStep from './steps/RoleStep';
import PersonalInfoStep from './steps/PersonalInfoStep';
import VehicleInfoStep from './steps/VehicleInfoStep';
import DocumentsStep from './steps/DocumentsStep';
import PayoutStep from './steps/PayoutStep';
import ReviewStep from './steps/ReviewStep';

const pageCopy = (page: RegistrationPage, role: RegistrationRole) => {
  if (page === 'documents') return role === 'driver' ? COPY.pages.documentsDriver : COPY.pages.documentsPassenger;
  return COPY.pages[page];
};

type Props = {
  /** Preselects the role card (Signup route param); the role page still opens first. */
  initialRole?: RegistrationRole;
};

/**
 * Registration wizard (T-201/T-202, refreshed in UI-R7 per spec auth-registration): role page,
 * then per-role pages (passenger: About you · Identity · Review; driver: About you · Vehicle &
 * licence · Documents · Payout · Review), a sticky Continue / Create account bar, and the phone
 * code step after the BE-38 201. Back goes to the previous page; leaving with details typed asks
 * first (Dialog). The focused field stays above the keyboard and the action bar (T-545).
 */
export default function RegistrationScreen({ initialRole }: Props = {}) {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const { theme } = useAppTheme();
  const w = useRegistrationWizard(initialRole);
  const { page, formData, phoneStep } = w;

  // A backend from before BE-35 created the account outright: back to sign in.
  useEffect(() => {
    if (w.finished) navigation.popTo('Login');
  }, [w.finished, navigation]);

  // Back steps through the pages; on the first page, leaving with details typed asks first.
  const guard = !phoneStep && !w.finished && (w.submitting || w.pageIndex > 0 || hasFormInput(formData));
  // The iOS swipe cannot be stopped from JS (the screen would leave natively while the JS stack
  // kept it), so it is off while guarded. The phone step sets its own (T-201); effects of the
  // step run before this one, so this stays out of its way.
  useEffect(() => {
    if (phoneStep) return;
    navigation.setOptions({ gestureEnabled: !guard });
  }, [guard, phoneStep, navigation]);

  usePreventRemove(guard, ({ data }) => {
    // Create account is uploading: stay put (leaving would drop the phone step that follows).
    if (w.submitting) return;
    const isBack = data.action.type === 'GO_BACK' || data.action.type === 'POP';
    if (isBack && w.handleBack()) return;
    if (!hasFormInput(formData)) {
      navigation.dispatch(data.action);
      return;
    }
    confirm({
      title: COPY.leave.title,
      body: COPY.leave.body,
      confirmLabel: COPY.leave.confirm,
      cancelLabel: COPY.leave.cancel,
      destructive: true,
    }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // Sticky bar: 8 above the home indicator, at least 16 from the edge without one (DS §3.2).
  const insets = useSafeAreaInsets();
  const footerEdge = {
    paddingBottom: insets.bottom > 0 ? layout.bottomActionOffset : layout.bottomActionMinOffset,
    borderTopWidth: theme.borderWidth.hairline,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  };

  const renderPage = () => {
    const stepProps = { data: formData, onDataChange: w.updateFormData, errors: w.errors };
    switch (page) {
      case 'role':
        return <RoleStep value={w.roleChosen ? formData.role : null} onChange={w.chooseRole} />;
      case 'personal':
        return <PersonalInfoStep {...stepProps} />;
      case 'vehicle':
        return <VehicleInfoStep {...stepProps} />;
      case 'documents':
        return <DocumentsStep {...stepProps} />;
      case 'payout':
        return <PayoutStep {...stepProps} />;
      case 'review':
        return <ReviewStep data={formData} onEdit={w.goTo} />;
      default:
        return null;
    }
  };

  const renderFormErrors = () =>
    w.formErrors.length > 0 ? (
      <View style={[styles.formErrors, { backgroundColor: theme.colors.dangerSoft }]} accessibilityRole="alert">
        <Icon name="warning" size={20} color="danger" />
        <View style={styles.formErrorList}>
          {w.formErrors.map((message) => (
            <AppText key={message} variant="bodySmall" color="danger">
              {message}
            </AppText>
          ))}
        </View>
      </View>
    ) : null;

  const renderAction = () => {
    if (page === 'review') {
      return (
        <Button
          label={w.submitWait > 0 ? COPY.form.createIn(formatCountdown(w.submitWait)) : COPY.form.create}
          onPress={w.handleSubmit}
          loading={w.submitting}
          disabled={w.submitWait > 0}
          accessibilityLabel={w.submitting ? COPY.form.creating : undefined}
          haptic="impactLight"
          testID="registration-submit"
        />
      );
    }
    return (
      <Button
        label={COPY.form.continue}
        onPress={w.handleNext}
        disabled={page === 'role' && !w.roleChosen}
        trailingIcon="arrowForward"
        testID="registration-continue"
      />
    );
  };

  const copy = phoneStep ? null : pageCopy(page, formData.role);

  return (
    <Screen keyboardAvoiding edges={['top', 'bottom']} testID="registration">
      <Header
        tone="background"
        title={phoneStep ? COPY.verify.headerTitle : undefined}
        // Inside the wizard Back is the previous page; on the first page it leaves (guarded above).
        onBack={() => {
          if (w.submitting) return;
          if (phoneStep || !w.handleBack()) navigation.goBack();
        }}
        backLabel={phoneStep ? COPY.verify.backA11y : COPY.form.back}
        testID="registration-header"
      />
      <KeyboardAwareScrollView
        ref={w.scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="registration-scroll"
      >
        <View
          ref={w.containerRef}
          style={styles.container}
          onLayout={(event) => {
            w.containerY.current = event.nativeEvent.layout.y;
          }}
        >
          {phoneStep ? (
            <RegistrationPhoneStep
              pending={phoneStep.pending}
              role={phoneStep.role}
              onGoToSignIn={() => navigation.popTo('Login')}
            />
          ) : (
            <FieldAnchorContext.Provider value={w.anchor}>
              {copy ? (
                <RegistrationHeader
                  title={copy.title}
                  description={copy.description}
                  progress={pageProgress(page, formData.role)}
                  brandBar={registrationPages(formData.role)[0] === page}
                />
              ) : null}
              {renderPage()}
              {renderFormErrors()}
            </FieldAnchorContext.Provider>
          )}
        </View>
      </KeyboardAwareScrollView>
      {phoneStep ? null : (
        <View style={[styles.footer, footerEdge]} testID="registration-footer">
          {renderAction()}
        </View>
      )}
    </Screen>
  );
}
