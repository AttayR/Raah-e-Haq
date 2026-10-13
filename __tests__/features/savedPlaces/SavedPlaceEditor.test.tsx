/**
 * T-516: the add/edit form. The location comes from the places search (mocked here), then the
 * label and, for Other, a name. POST for a new place, PUT for an edit; a 422 (cap / label
 * taken) shows its message; an outside-service-area answer is a warning; success goes back.
 */
import React from 'react';
import MockAdapter from 'axios-mock-adapter';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { apiClient } from '../../../src/services/api';
import { rootReducer } from '../../../src/store/rootReducer';
import { ThemeProvider } from '../../../src/app/providers/ThemeProvider';
import SavedPlaceEditorScreen from '../../../src/features/saved-places/screens/SavedPlaceEditorScreen';
import type { SavedPlaceEditorParams } from '../../../src/features/saved-places/navigation';
import { toast } from '../../../src/core/toast';

const mockGoBack = jest.fn();
let mockParams: SavedPlaceEditorParams | undefined;
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack }),
  useRoute: () => ({ key: 'SavedPlaceEditor-1', name: 'SavedPlaceEditor', params: mockParams }),
}));

// The places search (autocomplete + place details) answers with one fixed suggestion.
jest.mock('../../../src/components/passenger/LocationSearch', () => {
  const { Pressable, Text } = require('react-native');
  const MockSearch = ({ onSelect }: { onSelect: (s: unknown) => void }) => (
    <Pressable
      testID="mock-search-pick"
      onPress={() =>
        onSelect({
          id: 'ChIJliberty',
          title: 'Liberty Market',
          subtitle: 'Gulberg III, Lahore',
          icon: 'place',
          coords: { latitude: 31.51, longitude: 74.34 },
        })
      }
    >
      <Text>search</Text>
    </Pressable>
  );
  return {
    __esModule: true,
    default: MockSearch,
    suggestionAddress: (s: { title: string; subtitle: string }) => `${s.title}, ${s.subtitle}`,
  };
});

const placeBody = (overrides: Record<string, unknown> = {}) => ({
  id: 7,
  label: 'other',
  name: 'Market',
  address: 'Liberty Market, Gulberg III, Lahore',
  lat: 31.51,
  lng: 74.34,
  place_id: 'ChIJliberty',
  sort_order: 1,
  updated_at: null,
  ...overrides,
});

const writeBody = (place: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  success: true,
  data: { place, replaced: false, outside_service_area: false, ...extra },
});

const flush = async () => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};

const renderEditor = async () => {
  render(
    <Provider store={configureStore({ reducer: rootReducer })}>
      <ThemeProvider>
        <SavedPlaceEditorScreen />
      </ThemeProvider>
    </Provider>,
  );
  await flush();
};

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockGoBack.mockClear();
  mockParams = undefined;
});

afterEach(() => {
  mock.restore();
  jest.restoreAllMocks();
});

describe('Saved place form', () => {
  it('adds an Other place: search → name → POST with the place id, then back', async () => {
    mockParams = { taken: { home: 'H', work: 'W' } };
    let body: unknown;
    mock.onPost('/saved-places').reply((config) => {
      body = JSON.parse(config.data);
      return [201, writeBody(placeBody())];
    });
    const success = jest.spyOn(toast, 'success');
    await renderEditor();

    // Home and Work are taken, so a new place starts as Other; nothing is saved without a location.
    fireEvent.press(screen.getByTestId('saved-place-save'));
    expect(screen.getByTestId('saved-place-error')).toHaveTextContent('Search for the place first.');

    fireEvent.press(screen.getByTestId('mock-search-pick'));
    expect(screen.getByTestId('saved-place-location')).toBeTruthy();
    fireEvent.press(screen.getByTestId('saved-place-save'));
    expect(screen.getByText('Give this place a name.')).toBeTruthy();

    fireEvent.changeText(screen.getByTestId('saved-place-name'), '  Market ');
    fireEvent.press(screen.getByTestId('saved-place-save'));
    await flush();
    expect(body).toEqual({
      label: 'other',
      name: 'Market',
      address: 'Liberty Market, Gulberg III, Lahore',
      lat: 31.51,
      lng: 74.34,
      place_id: 'ChIJliberty',
    });
    expect(success).toHaveBeenCalledWith('Place saved');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('a new Home says it replaces the saved one and posts label home without a name', async () => {
    mockParams = { label: 'home', taken: { home: 'House 1, DHA' } };
    let body: Record<string, unknown> = {};
    mock.onPost('/saved-places').reply((config) => {
      body = JSON.parse(config.data);
      return [200, writeBody(placeBody({ label: 'home', name: null }), { replaced: true })];
    });
    await renderEditor();
    expect(screen.getByTestId('saved-place-replaces')).toHaveTextContent(/This replaces your saved Home: House 1, DHA/);
    fireEvent.press(screen.getByTestId('mock-search-pick'));
    fireEvent.press(screen.getByTestId('saved-place-save'));
    await flush();
    expect(body.label).toBe('home');
    expect(body).not.toHaveProperty('name');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('a 422 (other places at the cap) stays on the form with the server message', async () => {
    mockParams = { label: 'other' };
    mock.onPost('/saved-places').reply(422, {
      success: false,
      message: 'The given data was invalid.',
      errors: { label: ['You can save up to 10 other places. Delete one first.'] },
    });
    await renderEditor();
    fireEvent.press(screen.getByTestId('mock-search-pick'));
    fireEvent.changeText(screen.getByTestId('saved-place-name'), 'Gym');
    fireEvent.press(screen.getByTestId('saved-place-save'));
    await flush();
    expect(screen.getByTestId('saved-place-error')).toHaveTextContent('You can save up to 10 other places. Delete one first.');
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it('edits an existing place with PUT (label/name only when the location did not move)', async () => {
    mockParams = {
      place: {
        id: 7,
        label: 'other',
        name: 'Market',
        address: 'Liberty Market, Gulberg III, Lahore',
        lat: 31.51,
        lng: 74.34,
        placeId: 'ChIJliberty',
        sortOrder: 1,
        updatedAt: null,
      },
      taken: {},
    };
    let body: unknown;
    mock.onPut('/saved-places/7').reply((config) => {
      body = JSON.parse(config.data);
      return [200, writeBody(placeBody({ label: 'work', name: null }))];
    });
    const success = jest.spyOn(toast, 'success');
    await renderEditor();
    expect(screen.getByText('Edit place')).toBeTruthy();
    expect(screen.getByTestId('saved-place-location')).toBeTruthy();
    fireEvent.press(screen.getByRole('radio', { name: /Work/ }));
    fireEvent.press(screen.getByTestId('saved-place-save'));
    await flush();
    expect(body).toEqual({ label: 'work', name: null });
    expect(success).toHaveBeenCalledWith('Place updated');
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('outside the service area: saved, with a warning instead of the success toast', async () => {
    mockParams = { label: 'work' };
    mock.onPost('/saved-places').reply(201, writeBody(placeBody({ label: 'work', name: null }), { outside_service_area: true }));
    const warning = jest.spyOn(toast, 'warning');
    const success = jest.spyOn(toast, 'success');
    await renderEditor();
    fireEvent.press(screen.getByTestId('mock-search-pick'));
    fireEvent.press(screen.getByTestId('saved-place-save'));
    await flush();
    expect(warning).toHaveBeenCalledWith('Outside our service area', 'We saved it, but rides may not be available there yet.');
    expect(success).not.toHaveBeenCalled();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('with other places at the cap the form does not offer Other', async () => {
    mockParams = { taken: { home: 'H', work: 'W' }, otherFull: true };
    await renderEditor();
    expect(screen.queryByRole('radio', { name: /Other/ })).toBeNull();
    expect(screen.getByRole('radio', { name: /Home/ })).toBeTruthy();
  });
});
