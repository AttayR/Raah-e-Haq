/**
 * T-516 (owner bug 2026-10-13) and UI-R16 (passenger-saved-places.md): the Saved places screen
 * lists GET /saved-places (no fake "House 12, Street 7" / "Office 3, Tech Park"), with a skeleton,
 * error + retry and a refresh Banner; Home and Work are slots that always show; a row tap books
 * a ride there and one menu holds Ride here / Set as pickup / Edit / Delete; Delete asks first,
 * removes at once and comes back if the server refuses.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import SavedPlacesScreen from '../../../src/features/saved-places/screens/SavedPlacesScreen';
import { dialog, dialogStore } from '../../../src/core/dialog';
import { toast } from '../../../src/core/toast';
import { iconGlyphs } from '../../../src/components/ui/icons';
import { clearQueryCache } from '../../../src/core/api/queryCache';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useIsFocused: () => true,
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

const home = { id: 1, label: 'home', name: null, address: 'House 1, DHA Phase 5, Lahore', lat: 31.46, lng: 74.4, place_id: 'ChIJhome', sort_order: 0, updated_at: null };
const work = { id: 2, label: 'work', name: null, address: 'MM Alam Road, Gulberg III, Lahore', lat: 31.51, lng: 74.35, place_id: null, sort_order: 0, updated_at: null };
const gym = { id: 3, label: 'other', name: 'Gym', address: 'Main Boulevard, Lahore', lat: 31.52, lng: 74.34, place_id: null, sort_order: 1, updated_at: null };

const listBody = (places: unknown[], maxOther = 10) => ({ success: true, data: { places, max_other: maxOther } });

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderScreen = async () => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>
        <SavedPlacesScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

/** Answers every kit dialog (confirm) with `yes`. */
const answerDialogs = (yes: boolean) =>
  dialogStore.subscribe(() => {
    const current = dialogStore.getCurrent();
    if (current) dialog.answer(current.id, yes);
  });

let mock: MockAdapter;
let unsubscribe: (() => void) | null = null;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

afterEach(() => {
  unsubscribe?.();
  unsubscribe = null;
  dialog.dismissAll();
  mock.restore();
  jest.restoreAllMocks();
});

/** Opens the row menu of place `id` and picks `action` (the sheet runs it after closing). */
const pickFromMenu = async (id: number, action: 'ride' | 'pickup' | 'edit' | 'delete') => {
  fireEvent.press(screen.getByTestId(`saved-place-${id}-more`));
  await flush();
  fireEvent.press(screen.getByTestId(`saved-place-menu-${action}`));
  await flush();
};

describe('Saved places screen (UI-R16)', () => {
  it('shows a skeleton, then Home / Work slots and Other places from the API, with MDI glyphs and no demo data', async () => {
    let release!: (value: [number, unknown]) => void;
    mock.onGet('/saved-places').reply(() => new Promise((resolve) => (release = resolve)));
    await renderScreen();
    expect(screen.getByTestId('saved-places-loading')).toBeTruthy();
    // No "+" until the list is in.
    expect(screen.queryByTestId('saved-places-add')).toBeNull();

    await act(async () => release([200, listBody([home, work, gym])]));
    await flush();
    expect(screen.queryByTestId('saved-places-loading')).toBeNull();
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Work')).toBeTruthy();
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(screen.getByText('Other places')).toBeTruthy();
    expect(screen.getByText('MM Alam Road, Gulberg III, Lahore')).toBeTruthy();
    expect(screen.queryByText(/Iqbal Town|Tech Park/)).toBeNull();
    expect(screen.getByTestId('saved-places-count')).toHaveTextContent('1 of 10 other places saved');
    // No buttons under rows, no trash on the list (S-1, S-2): one "more" per row.
    expect(screen.queryByText('Set destination')).toBeNull();
    expect(screen.queryByTestId('saved-place-3-delete')).toBeNull();
    expect(screen.getByTestId('saved-place-3-more')).toBeTruthy();
    const names = screen.UNSAFE_root
      .findAll((node) => node.props.name && typeof node.props.name === 'string' && 'size' in node.props)
      .map((node) => node.props.name as string);
    expect(names).toEqual(expect.arrayContaining([iconGlyphs.home, iconGlyphs.work, iconGlyphs.bookmark, iconGlyphs.more]));
  });

  it('a failed load offers retry; an empty list keeps the Home and Work slots (no full-screen empty state)', async () => {
    mock.onGet('/saved-places').replyOnce(500, { success: false, message: 'Server error' });
    await renderScreen();
    expect(screen.getByTestId('saved-places-error')).toBeTruthy();

    mock.onGet('/saved-places').replyOnce(200, listBody([]));
    fireEvent.press(screen.getByText('Try again'));
    await flush();
    expect(screen.getByTestId('saved-places-slot-home')).toHaveTextContent(/Add home/);
    expect(screen.getByTestId('saved-places-slot-work')).toHaveTextContent(/Add work/);
    expect(screen.getByText('Save places you go often to book them in one tap.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-places-slot-home'));
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', { place: undefined, label: 'home', taken: {}, otherFull: false });
    fireEvent.press(screen.getByTestId('saved-places-empty-add'));
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', { place: undefined, label: 'other', taken: {}, otherFull: false });
  });

  it('a failed refresh keeps the list under a warning Banner with Retry', async () => {
    mock.onGet('/saved-places').replyOnce(200, listBody([home]));
    await renderScreen();
    mock.onGet('/saved-places').replyOnce(500, { success: false, message: 'Server error' });
    const scroll = screen.UNSAFE_root.findAll((node) => node.props.refreshControl !== undefined && typeof node.type !== 'string')[0];
    await act(async () => {
      scroll.props.refreshControl.props.onRefresh();
    });
    await flush();
    expect(screen.getByTestId('saved-places-refresh-error')).toHaveTextContent(/Couldn't refresh. Showing saved places./);
    expect(screen.getByText('Home')).toBeTruthy();
    mock.onGet('/saved-places').replyOnce(200, listBody([home]));
    fireEvent.press(screen.getByTestId('saved-places-refresh-retry'));
    await flush();
    expect(screen.queryByTestId('saved-places-refresh-error')).toBeNull();
  });

  it('a row tap books a ride there; the menu also sets it as pickup', async () => {
    mock.onGet('/saved-places').reply(200, listBody([home, gym]));
    await renderScreen();
    fireEvent.press(screen.getByTestId('saved-place-3-item'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', {
      destination: { latitude: 31.52, longitude: 74.34, address: 'Main Boulevard, Lahore' },
    });
    await pickFromMenu(1, 'pickup');
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', {
      pickup: { latitude: 31.46, longitude: 74.4, address: 'House 1, DHA Phase 5, Lahore' },
    });
    await pickFromMenu(1, 'ride');
    expect(mockNavigate).toHaveBeenLastCalledWith('Booking', {
      destination: { latitude: 31.46, longitude: 74.4, address: 'House 1, DHA Phase 5, Lahore' },
    });
  });

  it('Edit and Add pass the place, the taken Home/Work and the cap; at the cap the "+" is hidden', async () => {
    mock.onGet('/saved-places').reply(200, listBody([home, work, gym], 2));
    await renderScreen();
    fireEvent.press(screen.getByTestId('saved-places-add'));
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', expect.objectContaining({ place: undefined, label: 'other', otherFull: false }));
    await pickFromMenu(3, 'edit');
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', {
      place: expect.objectContaining({ id: 3, label: 'other', name: 'Gym' }),
      label: undefined,
      taken: { home: home.address, work: work.address },
      otherFull: false,
    });
    screen.unmount();

    mock.reset();
    clearQueryCache();
    mock.onGet('/saved-places').reply(200, listBody([home, work, gym], 1));
    await renderScreen();
    expect(screen.getByTestId('saved-places-count')).toHaveTextContent("You've saved 1 other places. Delete one to add another.");
    expect(screen.queryByTestId('saved-places-add')).toBeNull();
    await pickFromMenu(1, 'edit');
    expect(mockNavigate).toHaveBeenLastCalledWith('SavedPlaceEditor', expect.objectContaining({ taken: { work: work.address }, otherFull: true }));
  });

  it('Delete (from the menu) asks first, then removes the row at once (DELETE /saved-places/{id})', async () => {
    mock.onGet('/saved-places').reply(200, listBody([home, gym]));
    let deleted = false;
    mock.onDelete('/saved-places/3').reply(() => {
      deleted = true;
      return [200, { success: true, data: null }];
    });
    const success = jest.spyOn(toast, 'success');
    await renderScreen();

    unsubscribe = answerDialogs(false);
    await pickFromMenu(3, 'delete');
    expect(screen.getByText('Gym')).toBeTruthy();
    expect(deleted).toBe(false);
    unsubscribe();

    unsubscribe = answerDialogs(true);
    await pickFromMenu(3, 'delete');
    expect(screen.queryByText('Gym')).toBeNull();
    expect(deleted).toBe(true);
    expect(success).toHaveBeenCalledWith('Place deleted');
  });

  it('a refused delete puts the row back in place and says why', async () => {
    mock.onGet('/saved-places').reply(200, listBody([home, gym, { ...gym, id: 4, name: 'Office 2' }]));
    let release!: (value: [number, unknown]) => void;
    mock.onDelete('/saved-places/3').reply(() => new Promise((resolve) => (release = resolve)));
    const error = jest.spyOn(toast, 'error');
    await renderScreen();

    unsubscribe = answerDialogs(true);
    await pickFromMenu(3, 'delete');
    // Optimistic: gone before the server answers.
    expect(screen.queryByText('Gym')).toBeNull();

    await act(async () => release([500, { success: false, message: 'Server error' }]));
    await flush();
    expect(screen.getByText('Gym')).toBeTruthy();
    const order = screen.getAllByTestId(/^saved-place-\d+$/).map((node) => node.props.testID);
    expect(order).toEqual(['saved-place-1', 'saved-place-3', 'saved-place-4']);
    expect(error).toHaveBeenCalled();
  });
});
