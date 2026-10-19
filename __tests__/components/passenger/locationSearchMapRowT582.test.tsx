/**
 * T-582 (QA 2026-10-19 bug 2; passenger-destination-search block 4): while the passenger types,
 * "Set location on map" is always the last row, under the suggestions too.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { LightTheme } from '../../../src/theme';
import LocationSearch from '../../../src/components/passenger/LocationSearch';
import { fetchAutocomplete } from '../../../src/services/placesService';

jest.mock('../../../src/services/placesService', () => ({
  fetchAutocomplete: jest.fn(),
  fetchPlaceDetails: jest.fn(),
}));
const mockAutocomplete = fetchAutocomplete as jest.Mock;

const mockLightTheme = LightTheme;
jest.mock('../../../src/app/providers/ThemeProvider', () => ({
  useAppTheme: () => ({ theme: mockLightTheme, scheme: 'system', setScheme: jest.fn() }),
}));

const Harness: React.FC<{ onChooseOnMap?: () => void }> = ({ onChooseOnMap }) => {
  const [q, setQ] = React.useState('');
  return <LocationSearch mode="destination" query={q} onChangeQuery={setQ} onSelect={jest.fn()} onChooseOnMap={onChooseOnMap} />;
};

const isRow = (id: unknown): id is string =>
  typeof id === 'string' && (id.startsWith('location-suggestion-') || id === 'location-search-on-map');

describe('[T-582] LocationSearch map row', () => {
  beforeEach(() => mockAutocomplete.mockReset());

  it('is the last row while typing, under the results too', async () => {
    mockAutocomplete.mockResolvedValue([
      { place_id: 'p1', description: 'Liberty Market, Lahore', structured_formatting: { main_text: 'Liberty Market', secondary_text: 'Lahore' } },
      { place_id: 'p2', description: 'Liberty Roundabout, Lahore', structured_formatting: { main_text: 'Liberty Roundabout', secondary_text: 'Lahore' } },
    ]);
    const onChooseOnMap = jest.fn();
    const { getByTestId, findByText, queryByTestId, UNSAFE_root } = render(<Harness onChooseOnMap={onChooseOnMap} />);
    // Nothing typed: the quick row's "Choose on map" covers it, no footer.
    expect(queryByTestId('location-search-on-map')).toBeNull();
    fireEvent.changeText(getByTestId('location-search-destination'), 'L');
    // Shown from the first typed character, before any suggestion arrives.
    expect(getByTestId('location-search-on-map')).toBeTruthy();
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    expect(await findByText('Liberty Roundabout')).toBeTruthy();
    const order = UNSAFE_root.findAll(n => isRow(n.props.testID))
      .map(n => n.props.testID as string)
      .filter((id, i, all) => all.indexOf(id) === i);
    expect(order).toEqual(['location-suggestion-0', 'location-suggestion-1', 'location-search-on-map']);
    fireEvent.press(getByTestId('location-search-on-map'));
    expect(onChooseOnMap).toHaveBeenCalledTimes(1);
    // Cleared: back to the shortcuts, no footer.
    fireEvent.changeText(getByTestId('location-search-destination'), '');
    expect(queryByTestId('location-search-on-map')).toBeNull();
  });

  it('is not drawn without a choose-on-map handler', async () => {
    mockAutocomplete.mockResolvedValue([]);
    const { getByTestId, queryByTestId } = render(<Harness />);
    fireEvent.changeText(getByTestId('location-search-destination'), 'Liberty');
    await act(async () => {});
    expect(queryByTestId('location-search-on-map')).toBeNull();
  });
});
