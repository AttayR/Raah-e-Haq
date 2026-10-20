/**
 * T-505: the after-ride rating sheet (both roles) and the prompt that opens it.
 * - tags follow the star band and stop at max_tags; labels come from GET /rating-tags
 * - Submit sends stars as a number, the chosen tags and a trimmed comment, once (double-submit guard)
 * - 409 ALREADY_RATED closes quietly after re-reading the ride; other failures show inline + retry
 * - Skip closes it and the same ride does not prompt again this session
 * - ride details show "Rate this trip" while can_rate, and "Your rating" once rated
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import { RateRideSheet } from '../../../src/features/rating/components/RateRideSheet';
import { DriverRideRatingPrompt } from '../../../src/features/rating/components/RideRatingPrompt';
import { RideRatingSection } from '../../../src/features/rating/components/RideRatingSection';
import { resetRatingSessionState } from '../../../src/features/rating/hooks';
import activeRideReducer, { initialActiveRideState } from '../../../src/features/active-ride/slice';
import driverRideReducer, { initialDriverRideState } from '../../../src/features/driver-ride/slice';
import type { RideResource } from '../../../src/services/rideService';

const TAGS = {
  window_days: 7,
  max_tags: 2,
  max_comment_length: 500,
  positive_min_stars: 4,
  negative_max_stars: 4,
  tags: {
    passenger: {
      positive: [
        { key: 'clean_car', label: 'Clean car' },
        { key: 'safe_driving', label: 'Safe driving' },
        { key: 'friendly', label: 'Friendly' },
      ],
      negative: [
        { key: 'rude', label: 'Rude' },
        { key: 'late', label: 'Late' },
      ],
    },
    driver: {
      positive: [{ key: 'polite', label: 'Polite' }],
      negative: [{ key: 'kept_waiting', label: 'Kept me waiting' }],
    },
  },
};

const RATED = { stars: 5, tags: ['clean_car'], comment: 'Great ride', created_at: '2026-10-13T12:00:00Z' };

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mock.onGet('/rating-tags').reply(200, { success: true, data: TAGS });
  resetRatingSessionState();
});

afterEach(() => {
  mock.restore();
});

const flush = async () => {
  await act(async () => {
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 0));
  });
};

/** Picks `n` stars on the kit RatingInput (five 48pt targets in a 240pt row). */
const rate = (n: number) => {
  const row = screen.getByTestId('rate-ride-stars-row');
  fireEvent(row, 'layout', { nativeEvent: { layout: { width: 240, height: 48 } } });
  act(() => {
    fireEvent(row, 'responderGrant', { nativeEvent: { locationX: n * 48 - 10 } });
  });
};

const press = async (testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
  await flush();
};

const renderSheet = async (overrides: Partial<React.ComponentProps<typeof RateRideSheet>> = {}) => {
  const props = {
    visible: true,
    rideId: 12,
    role: 'passenger' as const,
    personName: 'Bilal',
    onRated: jest.fn(),
    onStale: jest.fn(),
    onSkip: jest.fn(),
    ...overrides,
  };
  render(
    <ThemeProvider>
      <RateRideSheet {...props} />
    </ThemeProvider>,
  );
  await flush();
  return props;
};

describe('RateRideSheet', () => {
  it('shows the person, then the tags of the chosen star band (labels from the server)', async () => {
    await renderSheet();
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Bilal');
    expect(screen.queryByTestId('rate-ride-tags')).toBeNull();
    expect(screen.getByTestId('rate-ride-submit').props.accessibilityState).toMatchObject({ disabled: true });

    rate(5);
    expect(screen.getByText('Clean car')).toBeTruthy();
    expect(screen.queryByText('Rude')).toBeNull();
    expect(screen.getByText('What went well?')).toBeTruthy();

    rate(4);
    expect(screen.getByText('Clean car')).toBeTruthy();
    expect(screen.getByText('Rude')).toBeTruthy();

    rate(2);
    expect(screen.queryByText('Clean car')).toBeNull();
    expect(screen.getByText('Late')).toBeTruthy();
    expect(screen.getByText('What could be better?')).toBeTruthy();
  });

  it('a driver gets the driver tag list', async () => {
    await renderSheet({ role: 'driver', personName: null });
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Your passenger');
    rate(5);
    expect(screen.getByText('Polite')).toBeTruthy();
    expect(screen.queryByText('Clean car')).toBeNull();
  });

  it('stops at max_tags, keeps tags across a band change, and submits stars as a number once', async () => {
    mock.onPost('/rides/12/rate').reply(201, { success: true, data: { my_rating: { ...RATED, stars: 4, tags: ['clean_car', 'rude'] }, can_rate: false } });
    const props = await renderSheet();
    rate(5);
    await press('rate-ride-tag-clean_car');
    await press('rate-ride-tag-safe_driving');
    // max_tags 2: the third chip is disabled and pressing it adds nothing.
    expect(screen.getByTestId('rate-ride-tag-friendly').props.accessibilityState).toMatchObject({ disabled: true });
    // 4 stars still offers both positives (kept); then a negative replaces safe_driving.
    rate(4);
    await press('rate-ride-tag-safe_driving');
    await press('rate-ride-tag-rude');
    fireEvent.changeText(screen.getByTestId('rate-ride-comment'), '  Great ride  ');

    await act(async () => {
      fireEvent.press(screen.getByTestId('rate-ride-submit'));
      // A second tap while the first is in flight is ignored.
      fireEvent.press(screen.getByTestId('rate-ride-submit'));
    });
    await flush();

    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].data).toBe('{"stars":4,"tags":["clean_car","rude"],"comment":"Great ride"}');
    expect(props.onRated).toHaveBeenCalledWith({ myRating: expect.objectContaining({ stars: 4 }), canRate: false });
    expect(props.onStale).not.toHaveBeenCalled();
  });

  it('409 ALREADY_RATED: re-reads the ride and closes quietly (no error)', async () => {
    mock.onPost('/rides/12/rate').reply(409, { success: false, message: 'Already rated', error: { code: 'ALREADY_RATED' } });
    mock.onGet('/rides/12').reply(200, { success: true, data: { id: 12, status: 'completed', my_rating: RATED, can_rate: false } });
    const props = await renderSheet();
    rate(5);
    await press('rate-ride-submit');
    expect(props.onStale).toHaveBeenCalledWith({ myRating: expect.objectContaining({ stars: 5 }), canRate: false });
    expect(props.onRated).not.toHaveBeenCalled();
    expect(screen.queryByTestId('rate-ride-error')).toBeNull();
  });

  it('422 RATING_WINDOW_CLOSED is quiet too, even when the re-read fails', async () => {
    mock.onPost('/rides/12/rate').reply(422, { success: false, message: 'Closed', error: { code: 'RATING_WINDOW_CLOSED' } });
    mock.onGet('/rides/12').networkError();
    const props = await renderSheet();
    rate(3);
    await press('rate-ride-submit');
    expect(props.onStale).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('rate-ride-error')).toBeNull();
  });

  it('other failures show inline; Submit becomes Try again and retries', async () => {
    mock.onPost('/rides/12/rate').replyOnce(500, { message: 'boom' }).onPost('/rides/12/rate').reply(201, {
      success: true,
      data: { my_rating: RATED, can_rate: false },
    });
    const props = await renderSheet();
    rate(5);
    await press('rate-ride-submit');
    expect(screen.getByTestId('rate-ride-error').props.children).toBe('Something went wrong on our side. Please try again.');
    expect(screen.getByText('Try again')).toBeTruthy();
    expect(props.onRated).not.toHaveBeenCalled();

    await press('rate-ride-submit');
    expect(mock.history.post).toHaveLength(2);
    expect(props.onRated).toHaveBeenCalled();
  });

  it('Skip closes without a request', async () => {
    const props = await renderSheet();
    await press('rate-ride-skip');
    expect(props.onSkip).toHaveBeenCalled();
    expect(mock.history.post).toHaveLength(0);
  });

  it('[T-519] with the keyboard up: compact header, the sheet grows, the comment is scrolled into view', async () => {
    type KeyboardHandler = (e: { endCoordinates: { height: number } }) => void;
    const handlers: Record<string, KeyboardHandler[]> = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, handler: KeyboardHandler) => {
      (handlers[event] ??= []).push(handler);
      return { remove: () => undefined };
    }) as unknown as typeof Keyboard.addListener);
    const emit = (event: string, height: number) =>
      act(() => (handlers[event] ?? []).forEach((handler) => handler({ endCoordinates: { height } })));
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    const layout = (testID: string, height: number) =>
      act(() => {
        fireEvent(screen.getByTestId(testID), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height } } });
      });

    await renderSheet({ role: 'driver', personName: 'Test' });
    rate(5);
    act(() => {
      fireEvent(screen.getByTestId('rate-ride-sheet').parent!.parent!, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 874 } } });
    });
    layout('rate-ride-sheet-header', 150);
    layout('rate-ride-sheet-footer', 132);
    layout('rate-ride-sheet-body', 420);
    // Keyboard down: the full header (avatar, "Your passenger", name, question).
    expect(screen.getByTestId('rate-ride-avatar')).toBeTruthy();
    expect(screen.queryByTestId('rate-ride-header-compact')).toBeNull();

    fireEvent(screen.getByTestId('rate-ride-comment'), 'focus');
    emit('keyboardWillShow', 336);
    // Keyboard up: the header is the name only, so the body keeps room for the comment.
    expect(screen.getByTestId('rate-ride-header-compact')).toBeTruthy();
    expect(screen.queryByTestId('rate-ride-avatar')).toBeNull();
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Test');
    expect(screen.getByTestId('rate-ride-comment')).toBeTruthy();
    expect(screen.getByTestId('rate-ride-submit')).toBeTruthy();
    expect(screen.getByTestId('rate-ride-skip')).toBeTruthy();
    layout('rate-ride-sheet-header', 50);

    // Once it is up, the focused comment box is scrolled into the visible part of the body.
    const field = { measureLayout: (_: unknown, ok: (x: number, y: number, w: number, h: number) => void) => ok(0, 260, 358, 140) };
    jest.spyOn(TextInput.State, 'currentlyFocusedInput').mockReturnValue(field as unknown as ReturnType<typeof TextInput.State.currentlyFocusedInput>);
    emit('keyboardDidShow', 336);
    // Sheet at full (866): visible body = 866 − 24 handle − 50 header − 132 footer − 336 keyboard
    // = 324, so the box (y 260, 140 tall) and its 20 pt counter line (UI-R12) end 8 above the
    // footer at y = 260 + 140 + 20 + 8 − 324.
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ y: 104 }));

    emit('keyboardWillHide', 0);
    expect(screen.getByTestId('rate-ride-avatar')).toBeTruthy();
    jest.restoreAllMocks();
  });

  it('loads no tags while hidden', async () => {
    await renderSheet({ visible: false });
    expect(mock.history.get).toHaveLength(0);
  });
});

const completedRide = (overrides: Partial<RideResource> = {}): RideResource =>
  ({
    id: 12,
    status: 'completed',
    driver: { id: 4, name: 'Bilal Ahmed', profile_image_url: null, rating: null },
    passenger: { id: 2, name: 'Sara Khan', phone: '', rating: null },
    my_rating: null,
    can_rate: true,
    ...overrides,
  }) as RideResource;

const makeStore = (ride: RideResource) =>
  configureStore({
    reducer: { activeRide: activeRideReducer, driverRide: driverRideReducer },
    preloadedState: {
      activeRide: { ...initialActiveRideState, ride },
      driverRide: { ...initialDriverRideState, ride },
    },
  });

const renderPrompt = async (store: ReturnType<typeof makeStore>, element: React.ReactElement) => {
  const view = render(
    <Provider store={store}>
      <ThemeProvider>{element}</ThemeProvider>
    </Provider>,
  );
  await flush();
  return view;
};

describe('after-ride prompt', () => {
  // UI-R12: the passenger rates inline in the trip receipt (activeRide/tripSheetUIR12.test.tsx);
  // this prompt sheet now opens only on the driver's ride screen.
  it('driver: stays closed while inactive, without can_rate, or before completion', async () => {
    const store = makeStore(completedRide());
    const view = await renderPrompt(store, <DriverRideRatingPrompt active={false} />);
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
    view.unmount();
    await renderPrompt(makeStore(completedRide({ can_rate: false })), <DriverRideRatingPrompt active />);
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
    await renderPrompt(makeStore(completedRide({ status: 'started', can_rate: false })), <DriverRideRatingPrompt active />);
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
  });

  it('driver: Skip closes it and the same ride does not prompt again this session', async () => {
    const store = makeStore(completedRide());
    const view = await renderPrompt(store, <DriverRideRatingPrompt active />);
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Sara');
    await press('rate-ride-skip');
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
    view.unmount();
    await renderPrompt(store, <DriverRideRatingPrompt active />);
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });
});

describe('ride details rating section', () => {
  const renderSection = async (props: Partial<React.ComponentProps<typeof RideRatingSection>>) => {
    const onChange = jest.fn();
    render(
      <ThemeProvider>
        <RideRatingSection rideId={12} role="passenger" myRating={null} canRate={false} personName="Bilal" onChange={onChange} {...props} />
      </ThemeProvider>,
    );
    await flush();
    return onChange;
  };

  it('shows "Your rating" with stars, tag labels and the comment', async () => {
    await renderSection({ myRating: { stars: 4, tags: ['clean_car', 'gone'], comment: 'Nice', createdAt: null } });
    expect(screen.getByTestId('ride-rating-stars').props.accessibilityLabel).toBe('You rated this trip 4 out of 5');
    expect(screen.getByText('Clean car')).toBeTruthy();
    expect(screen.getByTestId('ride-rating-comment').props.children).toBe('Nice');
    expect(screen.queryByTestId('ride-details-rate-button')).toBeNull();
  });

  it('offers "Rate this trip" while can_rate, which opens the sheet; nothing otherwise', async () => {
    mock.onPost('/rides/12/rate').reply(201, { success: true, data: { my_rating: RATED, can_rate: false } });
    const onChange = await renderSection({ canRate: true });
    expect(screen.queryByTestId('rate-ride-submit')).toBeNull();
    await press('ride-details-rate-button');
    rate(5);
    await press('rate-ride-submit');
    expect(onChange).toHaveBeenCalledWith({ myRating: expect.objectContaining({ stars: 5 }), canRate: false });
  });

  it('renders nothing for a ride that cannot be rated and has no rating', async () => {
    await renderSection({});
    expect(screen.queryByTestId('ride-details-rate')).toBeNull();
    expect(screen.queryByTestId('ride-details-rating')).toBeNull();
  });
});

describe('BE-107 parcel rides (T-569)', () => {
  const PARCEL_TAGS = {
    passenger: {
      positive: [{ key: 'careful_handling', label: 'Handled with care' }],
      negative: [{ key: 'item_damaged', label: 'Item damaged' }],
    },
    driver: {
      positive: [{ key: 'ready_at_pickup', label: 'Ready at pickup' }],
      negative: [{ key: 'poorly_packed', label: 'Poorly packed' }],
    },
  };
  const serveParcelTags = () => {
    mock.onGet('/rating-tags').reply(200, { success: true, data: { ...TAGS, parcel_tags: PARCEL_TAGS } });
  };

  it('the sender rates the rider with the parcel tags and sends only parcel keys', async () => {
    serveParcelTags();
    mock.onPost('/rides/12/rate').reply(201, { success: true, data: { my_rating: { ...RATED, tags: ['careful_handling'] }, can_rate: false } });
    await renderSheet({ parcel: true, personName: null });
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Your rider');
    expect(screen.getByText('How was the delivery?')).toBeTruthy();
    rate(5);
    expect(screen.getByText('Handled with care')).toBeTruthy();
    expect(screen.queryByText('Clean car')).toBeNull();
    await press('rate-ride-tag-careful_handling');
    await press('rate-ride-submit');
    expect(mock.history.post[0].data).toBe('{"stars":5,"tags":["careful_handling"]}');
  });

  it('the rider rates the sender with the rider list; "Your sender" as the fallback', async () => {
    serveParcelTags();
    await renderSheet({ parcel: true, role: 'driver', personName: null });
    expect(screen.getByTestId('rate-ride-name').props.children).toBe('Your sender');
    rate(2);
    expect(screen.getByText('Poorly packed')).toBeTruthy();
    expect(screen.queryByText('Kept me waiting')).toBeNull();
  });

  it('an older server without parcel_tags: the parcel sheet offers the ride tags', async () => {
    await renderSheet({ parcel: true });
    rate(5);
    expect(screen.getByText('Clean car')).toBeTruthy();
  });

  it('the driver prompt on a parcel ride (vehicle_type parcel) uses the parcel tags', async () => {
    serveParcelTags();
    await renderPrompt(makeStore(completedRide({ vehicle_type: 'parcel' })), <DriverRideRatingPrompt active />);
    rate(5);
    expect(screen.getByText('Ready at pickup')).toBeTruthy();
    expect(screen.queryByText('Polite')).toBeNull();
  });

  it('ride details label a parcel rating from the parcel lists', async () => {
    serveParcelTags();
    render(
      <ThemeProvider>
        <RideRatingSection
          rideId={12}
          role="passenger"
          parcel
          myRating={{ stars: 5, tags: ['careful_handling'], comment: null, createdAt: null }}
          canRate={false}
          personName="Bilal"
          onChange={jest.fn()}
        />
      </ThemeProvider>,
    );
    await flush();
    expect(screen.getByText('Handled with care')).toBeTruthy();
  });
});
