import { StyleSheet } from 'react-native';
import { layout, radius, space } from '../../theme';

/** Layout of the registration wizard (UI-R7): tokens only, colours come from the theme at render. */
export const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[2],
    paddingBottom: space[6],
  },
  // Page header, then the form body 24 below (spec: progress → title → 24 → fields).
  container: { gap: space[6] },
  formErrors: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    padding: space[4],
    borderRadius: radius.md,
  },
  formErrorList: { flex: 1, minWidth: 0, gap: space[1] },
  footer: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: space[4],
  },
});
