import { createTheme, type MantineColorsTuple } from '@mantine/core';

/** Tema "tavola tecnica": inchiostro su foglio, angoli vivi, lettering condensato. */

const inchiostro: MantineColorsTuple = ['#eef1f4', '#d9dee4', '#b3bcc6', '#8a97a5', '#667586', '#4a5561', '#36414d', '#26313c', '#16202b', '#0c131a'];
const rosso: MantineColorsTuple = ['#fdeceb', '#f8d0cd', '#f0a39d', '#e6746c', '#dc4d43', '#d2352b', '#c22f25', '#a2261e', '#821e18', '#621612'];
const giallo: MantineColorsTuple = ['#fefbe6', '#fcf3bd', '#f9ea91', '#f6e063', '#f4d84a', '#f2d22e', '#d9ba1f', '#a88f14', '#77650b', '#473c04'];

export const tema = createTheme({
  primaryColor: 'inchiostro',
  primaryShade: 8,
  colors: { inchiostro, rosso, giallo },
  black: '#16202b',
  white: '#fbfcfa',
  fontFamily: 'Barlow, "Segoe UI", system-ui, sans-serif',
  fontFamilyMonospace: '"Barlow Condensed", Barlow, sans-serif',
  headings: { fontFamily: '"Barlow Condensed", Barlow, sans-serif', fontWeight: '600' },
  defaultRadius: 0,
  radius: { xs: '1px', sm: '2px', md: '2px', lg: '3px', xl: '4px' },
  fontSizes: { xs: '0.8125rem', sm: '0.9375rem', md: '1rem', lg: '1.125rem', xl: '1.3125rem' },
  cursorType: 'pointer',
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { radius: 0 } },
    Input: { defaultProps: { radius: 0 } },
    InputWrapper: { defaultProps: { inputWrapperOrder: ['label', 'input', 'description', 'error'] } },
    Drawer: { defaultProps: { radius: 0 } },
    Modal: { defaultProps: { radius: 0, centered: true } },
    Tooltip: { defaultProps: { withArrow: true, color: 'inchiostro.8' } },
  },
});
