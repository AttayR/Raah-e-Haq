/**
 * UI-R9: passenger Home sheet content and the booking place search. Recent destinations come only
 * from the passenger's finished rides; the chip row adds them after the saved places and says
 * "Add home" while no Home is saved; recent rides have skeleton and "Try again" states; the search
 * lists saved and recent places while the field being filled has no typed text; the place search
 * reuses Home's recent rides read instead of asking again.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { apiClient } from '../../../src/services/api';
import { clearQueryCache } from '../../../src/core/api/queryCache';
import { useRecentRides } from '../../../src/features/ride-history/hooks';
import { toRide } from '../../../src/features/ride-history/api';
import type { Ride } from '../../../src/features/ride-history/types';
import type { SavedPlace } from '../../../src/features/saved-places/types';
import { recentDestinations, splitAddress } from '../../../src/features/passenger-home/recentDestinations';
import { SavedPlaceChips } from '../../../src/features/saved-places/components/SavedPlaceChips';
import { HomeRidesSection } from '../../../src/features/passenger-home/components/HomeRidesSection';
import { PlaceShortcutList } from '../../../src/features/ride-booking/components/PlaceShortcuts';
import { ErrorState } from '../../../src/components/ui/ErrorState';
import { Keyboard } from 'react-native';
import { ChooseOnMapButton } from '../../../src/features/ride-booking/components/MapPick';
import DualLocationPicker from '../../../src/components/passenger/DualLocationPicker';
import { BOOKING_COPY } from '../../../src/features/ride-booking/copy';
import { makeRide, page } from '../../../test-utils/rideFixtures';

const place = (over: Partial<SavedPlace>): SavedPlace => ({
  id: 1,
  label: 'home',
  name: null,
  address: 'House 1, DHA Phase 5, Lahore',
  lat: 31.46,
  lng: 74.4,
  placeId: null,
  sortOrder: 0,
  updatedAt: null,
  ...over,
});

const ride = (id: number, over: Record<string, unknown> = {}): Ride =>
  toRide(makeRide({ id, status: 'completed', ...over })) as Ride;

jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: jest.requireActual('../../../src/theme').LightTheme, scheme: 'system', setScheme: jest.fn() }),
}));
const ThemeProvider = ({ children }: { children: React.ReactNode }) => <>{children}</>;
const withTheme = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('recentDestinations', () => {
  it('lists completed drop-offs newest first, one per address, capped', () => {
    const rides = [
      ride(1, { dropoff_address: 'Liberty Market, Gulberg III, Lahore', dropoff_latitude: 31.51, dropoff_longitude: 74.34 }),
      ride(2, { dropoff_address: 'liberty market,  Gulberg III, Lahore', dropoff_latitude: 31.51, dropoff_longitude: 74.34 }),
      ride(3, { status: 'cancelled', dropoff_address: 'Packages Mall, Lahore' }),
      ride(4, { dropoff_address: 'Emporium Mall, Johar Town, Lahore', dropoff_latitude: 31.46, dropoff_longitude: 74.26 }),
      ride(5, { dropoff_address: 'Airport, Lahore', dropoff_latitude: 31.52, dropoff_longitude: 74.4 }),
    ];
    const out = recentDestinations(rides, [], 2);
    expect(out.map(r => r.title)).toEqual(['Liberty Market', 'Emporium Mall']);
    expect(out[0]).toMatchObject({
      subtitle: 'Gulberg III, Lahore',
      place: { latitude: 31.51, longitude: 74.34, address: 'Liberty Market, Gulberg III, Lahore' },
    });
  });

  it('leaves out saved places (same address or within about 75 m) and rides without a point', () => {
    const rides = [
      ride(1, { dropoff_address: 'House 1, DHA Phase 5, Lahore', dropoff_latitude: 31.2, dropoff_longitude: 74.2 }),
      ride(2, { dropoff_address: 'Gate 2, DHA Phase 5, Lahore', dropoff_latitude: 31.4603, dropoff_longitude: 74.4004 }),
      ride(3, { dropoff_address: 'Somewhere, Lahore', dropoff_latitude: null, dropoff_longitude: null }),
    ];
    expect(recentDestinations(rides, [place({})], 5)).toEqual([]);
    expect(recentDestinations([], [], 5)).toEqual([]);
  });

  it('splits an address at the first comma', () => {
    expect(splitAddress(' Emporium Mall, Johar Town, Lahore ')).toEqual({ title: 'Emporium Mall', subtitle: 'Johar Town, Lahore' });
    expect(splitAddress('Lahore')).toEqual({ title: 'Lahore', subtitle: '' });
  });
});

describe('Home chip row', () => {
  const recents = recentDestinations(
    [ride(9, { dropoff_address: 'Emporium Mall, Johar Town, Lahore', dropoff_latitude: 31.46, dropoff_longitude: 74.26 })],
    [],
    3,
  );

  it('recent destinations follow the saved places; a tap hands the place over', () => {
    const onRecent = jest.fn();
    const onAdd = jest.fn();
    withTheme(
      <SavedPlaceChips places={[place({})]} recents={recents} onRecent={onRecent} onPlace={jest.fn()} onAdd={onAdd} onOpenAll={jest.fn()} />,
    );
    const row = screen.getByTestId('home-saved-places-row');
    expect(within(row).getByTestId('home-recent-place-0')).toHaveTextContent(/Emporium Mall/);
    fireEvent.press(screen.getByLabelText('Recent place, Emporium Mall, Johar Town, Lahore'));
    expect(onRecent).toHaveBeenCalledWith(recents[0]);
    // Home is saved: the generic "+ Add".
    expect(screen.getByTestId('home-saved-place-add')).toHaveTextContent(/Add/);
    fireEvent.press(screen.getByTestId('home-saved-place-add'));
    expect(onAdd).toHaveBeenCalledWith();
  });

  it('without a saved Home the add chip says "Add home" and starts on that label', () => {
    const onAdd = jest.fn();
    withTheme(<SavedPlaceChips places={[place({ id: 2, label: 'work' })]} onPlace={jest.fn()} onAdd={onAdd} onOpenAll={jest.fn()} />);
    expect(screen.getByTestId('home-saved-place-add')).toHaveTextContent(/Add home$/);
    fireEvent.press(screen.getByLabelText('Add your home address'));
    expect(onAdd).toHaveBeenCalledWith('home');
  });

  it('at most 2 place chips, Home and Work first; an other fills a free slot', () => {
    const { rerender } = withTheme(
      <SavedPlaceChips
        places={[place({ id: 5, label: 'other', name: 'Gym' }), place({ id: 2, label: 'work' }), place({ id: 1 })]}
        onPlace={jest.fn()}
        onAdd={jest.fn()}
        onOpenAll={jest.fn()}
      />,
    );
    expect(screen.getByTestId('home-saved-place-1')).toBeTruthy();
    expect(screen.getByTestId('home-saved-place-2')).toBeTruthy();
    expect(screen.queryByTestId('home-saved-place-5')).toBeNull();
    rerender(
      <ThemeProvider>
        <SavedPlaceChips places={[place({ id: 5, label: 'other', name: 'Gym' }), place({ id: 1 })]} onPlace={jest.fn()} onAdd={jest.fn()} onOpenAll={jest.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('home-saved-place-5')).toBeTruthy();
  });

  it('the Add chip waits for a successful saved-places read', () => {
    withTheme(<SavedPlaceChips places={[]} loaded={false} onPlace={jest.fn()} onAdd={jest.fn()} onOpenAll={jest.fn()} />);
    expect(screen.queryByTestId('home-saved-place-add')).toBeNull();
    expect(screen.getByTestId('home-saved-places')).toBeTruthy();
  });

  it('first load shows skeleton chips instead of places', () => {
    withTheme(<SavedPlaceChips places={[]} loading onPlace={jest.fn()} onAdd={jest.fn()} onOpenAll={jest.fn()} />);
    expect(screen.getByTestId('home-saved-places-loading')).toBeTruthy();
    expect(screen.queryByTestId('home-saved-place-add')).toBeNull();
    expect(screen.getByTestId('home-saved-places')).toBeTruthy();
  });
});

describe('Home recent rides states', () => {
  const rows = [{ id: '7', from: 'A', to: 'B', date: 'Today', fare: 'Rs 300', status: 'completed' as const }];

  it('skeleton on the first read, "Try again" when it failed, rows when ready', () => {
    const onRetry = jest.fn();
    const { rerender } = withTheme(<HomeRidesSection state="loading" rides={[]} onOpenRide={jest.fn()} onSeeAll={jest.fn()} onRetry={onRetry} />);
    expect(screen.getByTestId('home-recent-rides-loading')).toBeTruthy();
    rerender(
      <ThemeProvider>
        <HomeRidesSection state="failed" rides={[]} onOpenRide={jest.fn()} onSeeAll={jest.fn()} onRetry={onRetry} />
      </ThemeProvider>,
    );
    expect(screen.getByText("Couldn't load your recent rides")).toBeTruthy();
    fireEvent.press(screen.getByTestId('home-recent-rides-error-retry'));
    expect(onRetry).toHaveBeenCalled();
    rerender(
      <ThemeProvider>
        <HomeRidesSection state="ready" rides={rows} onOpenRide={jest.fn()} onSeeAll={jest.fn()} onRetry={onRetry} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('home-recent-ride-7')).toBeTruthy();
  });
});

describe('Home empty line and compact error', () => {
  it('a new account (rides ready, none finished, no recents) gets one quiet line', () => {
    const { rerender } = withTheme(
      <HomeRidesSection state="ready" rides={[]} emptyHint onOpenRide={jest.fn()} onSeeAll={jest.fn()} onRetry={jest.fn()} />,
    );
    expect(screen.getByTestId('home-empty-hint')).toHaveTextContent('Your recent places and rides will appear here.');
    rerender(
      <ThemeProvider>
        <HomeRidesSection state="ready" rides={[]} emptyHint={false} onOpenRide={jest.fn()} onSeeAll={jest.fn()} onRetry={jest.fn()} />
      </ThemeProvider>,
    );
    expect(screen.queryByTestId('home-empty-hint')).toBeNull();
  });

  it('kit ErrorState compact: title only, small secondary "Try again"', () => {
    const onRetry = jest.fn();
    withTheme(<ErrorState size="compact" kind="network" title="Couldn't load your recent rides" body="hidden" onRetry={onRetry} testID="e" />);
    expect(screen.getByText("Couldn't load your recent rides").props.numberOfLines).toBe(2);
    expect(screen.queryByText('hidden')).toBeNull();
    fireEvent.press(screen.getByTestId('e-retry'));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('place search shortcuts', () => {
  const recents = recentDestinations(
    [ride(9, { dropoff_address: 'Emporium Mall, Johar Town, Lahore', dropoff_latitude: 31.46, dropoff_longitude: 74.26 })],
    [],
    5,
  );

  it('saved and recent sections; a row picks its point with the address', () => {
    const onPick = jest.fn();
    withTheme(<PlaceShortcutList places={[place({})]} recents={recents} loading={false} onPick={onPick} />);
    expect(screen.getByText('Saved places')).toBeTruthy();
    expect(screen.getByText('Recent')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Home, House 1, DHA Phase 5, Lahore'));
    expect(onPick).toHaveBeenLastCalledWith({ latitude: 31.46, longitude: 74.4, address: 'House 1, DHA Phase 5, Lahore' });
    fireEvent.press(screen.getByTestId('place-shortcut-recent-0'));
    expect(onPick).toHaveBeenLastCalledWith({ latitude: 31.46, longitude: 74.26, address: 'Emporium Mall, Johar Town, Lahore' });
  });

  it('nothing to list renders nothing; first load shows skeleton rows', () => {
    const { toJSON, rerender } = withTheme(<PlaceShortcutList places={[]} recents={[]} loading={false} onPick={jest.fn()} />);
    expect(toJSON()).toBeNull();
    rerender(
      <ThemeProvider>
        <PlaceShortcutList places={[]} recents={[]} loading onPick={jest.fn()} />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('place-shortcuts-loading')).toBeTruthy();
  });

  it('the planner shows them until the field being filled has typed text; the quick row gives way while typing', () => {
    withTheme(
      <DualLocationPicker
        pickup={{ latitude: 31.5, longitude: 74.3 }}
        destination={null}
        pickupQuery={BOOKING_COPY.currentLocation}
        destQuery=""
        onSelectPickup={jest.fn()}
        onSelectDestination={jest.fn()}
        onUseCurrentLocation={jest.fn()}
        onChooseOnMapChip={jest.fn()}
        onSwap={jest.fn()}
        renderShortcuts={target => <PlaceShortcutList places={[place({ name: target })]} recents={[]} loading={false} onPick={jest.fn()} />}
      />,
    );
    expect(screen.getByTestId('place-shortcuts')).toBeTruthy();
    // The pickup already is the current location: no "Use current location" chip.
    expect(screen.queryByTestId('use-current-location')).toBeNull();
    expect(screen.getByTestId('choose-on-map')).toBeTruthy();
    const dest = screen.getByTestId('location-search-destination');
    fireEvent(dest, 'focus');
    // Focused but empty: the quick row stays.
    expect(screen.getByTestId('swap-locations')).toBeTruthy();
    fireEvent.changeText(dest, 'Lib');
    expect(screen.queryByTestId('place-shortcuts')).toBeNull();
    expect(screen.queryByTestId('choose-on-map')).toBeNull();
    expect(screen.queryByTestId('swap-locations')).toBeNull();
    fireEvent.changeText(dest, '');
    expect(screen.getByTestId('place-shortcuts')).toBeTruthy();
    expect(screen.getByTestId('swap-locations')).toBeTruthy();
  });

  it('a pickup shortcut finishes like a suggestion pick: keyboard closes, field blurs, destination is next', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss');
    const onShortcutPick = jest.fn();
    const onFocusChange = jest.fn();
    const targets: string[] = [];
    withTheme(
      <DualLocationPicker
        pickup={{ latitude: 31.5, longitude: 74.3 }}
        destination={null}
        pickupQuery={BOOKING_COPY.currentLocation}
        destQuery=""
        onSelectPickup={jest.fn()}
        onSelectDestination={jest.fn()}
        onFocusChange={onFocusChange}
        onShortcutPick={onShortcutPick}
        renderShortcuts={(target, onPick) => {
          targets.push(target);
          return <PlaceShortcutList places={[place({})]} recents={[]} loading={false} onPick={onPick} />;
        }}
      />,
    );
    fireEvent(screen.getByTestId('location-search-pickup'), 'focus');
    expect(targets[targets.length - 1]).toBe('pickup');
    fireEvent.press(screen.getByTestId('place-shortcut-saved-1'));
    expect(dismiss).toHaveBeenCalled();
    expect(onFocusChange).toHaveBeenLastCalledWith(false);
    expect(onShortcutPick).toHaveBeenCalledWith('pickup', { latitude: 31.46, longitude: 74.4, address: 'House 1, DHA Phase 5, Lahore' });
    expect(targets[targets.length - 1]).toBe('destination');
    dismiss.mockRestore();
  });

  it('"Use current location" shows once the pickup is somewhere else', () => {
    const onUse = jest.fn();
    withTheme(
      <DualLocationPicker
        pickup={{ latitude: 31.5, longitude: 74.3 }}
        destination={null}
        pickupQuery="Liberty Market, Lahore"
        destQuery=""
        onSelectPickup={jest.fn()}
        onSelectDestination={jest.fn()}
        onUseCurrentLocation={onUse}
      />,
    );
    fireEvent.press(screen.getByTestId('use-current-location'));
    expect(onUse).toHaveBeenCalled();
  });

  it('map pick: kit chip (UI-R9b: it opens the centre-pin picker, see mapPickerUIR9b)', () => {
    const onPress = jest.fn();
    withTheme(<ChooseOnMapButton onPress={onPress} />);
    fireEvent.press(screen.getByTestId('choose-on-map'));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('recent rides cache (no second GET from the place search)', () => {
  let mock: MockAdapter;
  beforeEach(() => {
    clearQueryCache();
    mock = new MockAdapter(apiClient);
    mock.onGet('/rides').reply(200, page([makeRide({ id: 1, status: 'completed' })]));
  });
  afterEach(() => mock.restore());

  function Probe({ reuse }: { reuse: boolean }) {
    useRecentRides(4, true, { reuseCached: reuse });
    return null;
  }

  const flush = () =>
    act(async () => {
      for (let i = 0; i < 6; i += 1) await Promise.resolve();
    });

  it('a reuse reader takes the read Home made a moment ago; Home itself always re-reads', async () => {
    const home = render(<Probe reuse={false} />);
    await flush();
    expect(mock.history.get).toHaveLength(1);
    render(<Probe reuse />);
    await flush();
    expect(mock.history.get).toHaveLength(1);
    home.unmount();
    render(<Probe reuse={false} />);
    await flush();
    expect(mock.history.get).toHaveLength(2);
  });
});
