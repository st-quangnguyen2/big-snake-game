// Arena themes. The world is always built from the same procedural models;
// a theme swaps colours: `recolor` maps the default (meadow) material colours
// to the theme's own, plus ground, sky and light colours.

const AUTUMN_LEAVES = {
  '#2f8f4e': '#c8641e', '#37a058': '#d9792a', '#41b062': '#e8913a',
  '#5cb848': '#e07b28', '#4fa83f': '#c96a1f', '#67c454': '#f0a040',
  '#3f9c3a': '#d35b1f', '#4caf50': '#e8862f', '#57b84c': '#f2a33c',
  '#46a43e': '#c94f22', '#53b148': '#e07030', '#3d9536': '#b8461c',
  '#43a047': '#d97a2c', '#5cb85c': '#eba045', '#56b84a': '#e38a35',
  '#4ea83d': '#c9772a', '#5ebd4b': '#dd9033', '#46993a': '#b96a25',
  '#6fae4a': '#c99a3a',
  '#f8a5c2': '#e0592a', '#f78fb3': '#d84a20', '#fbb9d0': '#ef7a3c',
};

const WINTER_LEAVES = {
  '#2f8f4e': '#2f6f55', '#37a058': '#e8f1fa', '#41b062': '#ffffff',
  '#5cb848': '#eef5fc', '#4fa83f': '#dce8f4', '#67c454': '#ffffff',
  '#3f9c3a': '#e6eff8', '#4caf50': '#f4f9ff', '#57b84c': '#ffffff',
  '#46a43e': '#dde9f5', '#53b148': '#eef5fc', '#3d9536': '#d3e2f0',
  '#f8a5c2': '#f4f9ff', '#f78fb3': '#e6eff8', '#fbb9d0': '#ffffff',
  '#43a047': '#2f6f55', '#5cb85c': '#3d7f63', '#56b84a': '#356f59',
  '#4ea83d': '#e3edf7', '#5ebd4b': '#f4f9ff', '#46993a': '#d6e4f1',
  '#6fae4a': '#ffffff',
};

const DESERT_LEAVES = {
  '#2f8f4e': '#6e8f3a', '#37a058': '#7d9c44', '#41b062': '#8fae50',
  '#5cb848': '#9aa84a', '#4fa83f': '#8a9a40', '#67c454': '#a9b75a',
  '#3f9c3a': '#7f9a3c', '#4caf50': '#93a94a', '#57b84c': '#a3b558',
  '#46a43e': '#7a9238', '#53b148': '#8aa245', '#3d9536': '#6d8533',
  '#43a047': '#4f8a4a', '#5cb85c': '#5e9a55', '#56b84a': '#589350',
  '#4ea83d': '#a08a50', '#5ebd4b': '#b39a5c', '#46993a': '#927c48',
  '#6fae4a': '#b9a15e',
  '#f8a5c2': '#9aa84a', '#f78fb3': '#8a9a40', '#fbb9d0': '#a9b75a',
};

const CANDY_LEAVES = {
  '#2f8f4e': '#7fd8c0', '#37a058': '#a6e8d4', '#41b062': '#c9f4e6',
  '#5cb848': '#ffb3d9', '#4fa83f': '#ff9ccc', '#67c454': '#ffc9e4',
  '#3f9c3a': '#c9b6ff', '#4caf50': '#b6a1ff', '#57b84c': '#ddd0ff',
  '#46a43e': '#ffb3d9', '#53b148': '#ffc9e4', '#3d9536': '#ff9ccc',
  '#43a047': '#7fd8c0', '#5cb85c': '#a6e8d4', '#56b84a': '#94e0ca',
  '#4ea83d': '#ffb3d9', '#5ebd4b': '#c9b6ff', '#46993a': '#a6e8d4',
  '#6fae4a': '#ffffff', '#7a5236': '#c98a5c', '#86593a': '#d29a6a',
};

export const THEMES = {
  meadow: {
    name: 'Đồng cỏ', emoji: '🌼',
    ground: ['#86cf5f', '#79c453'], outer: '#68ad4c',
    sky: ['#5fb2f0', '#bfe4fa', '#e9f6ff'], fog: '#cfe9f7', hemi: ['#d9efff', '#4f7a3c'],
    recolor: {},
  },
  autumn: {
    name: 'Mùa thu', emoji: '🍁',
    ground: ['#d6b25c', '#c8a24f'], outer: '#b38a40',
    sky: ['#f2a65a', '#f7d6a2', '#fdf0dc'], fog: '#f3dcb5', hemi: ['#ffe2b8', '#7a5a2a'],
    recolor: {
      ...AUTUMN_LEAVES,
      '#6cc04a': '#d9a83c', '#5aae3c': '#c28d2c', '#7fd056': '#e8bf55',
      '#4c9a3a': '#9a7a2a',
    },
  },
  winter: {
    name: 'Mùa đông', emoji: '❄️',
    ground: ['#f3f7fc', '#e3ecf6'], outer: '#e8eff7',
    sky: ['#8fb8de', '#d3e5f5', '#f4f9fd'], fog: '#e6eef6', hemi: ['#eef6ff', '#9fb2c8'],
    recolor: {
      ...WINTER_LEAVES,
      '#6cc04a': '#c9dbe8', '#5aae3c': '#b6cadb', '#7fd056': '#dbe8f2',
      '#4c9a3a': '#9fb4c6', '#7a5634': '#9fc4e0', '#5c3d22': '#c9e3f5', '#4a2f1a': '#ffffff',
    },
  },
  desert: {
    name: 'Sa mạc', emoji: '🏜️',
    ground: ['#efd69a', '#e4c987'], outer: '#dcbd7a',
    sky: ['#4aa3e8', '#a9d6f5', '#fbeed2'], fog: '#f4e3bd', hemi: ['#fff1d6', '#9c7a3e'],
    recolor: {
      ...DESERT_LEAVES,
      '#6cc04a': '#c4ab62', '#5aae3c': '#b0954e', '#7fd056': '#d6bf72',
      '#4c9a3a': '#8a7a3e', '#7a5634': '#c9955a', '#5c3d22': '#b5814a',
    },
  },
  candy: {
    name: 'Xứ kẹo', emoji: '🍭',
    ground: ['#ffd1e8', '#d4f5ec'], outer: '#f6c6df',
    sky: ['#b39ddb', '#f3d1f4', '#fff0fa'], fog: '#f6defa', hemi: ['#fff0fb', '#c48ab8'],
    recolor: {
      ...CANDY_LEAVES,
      '#6cc04a': '#8fe0c4', '#5aae3c': '#ff9fd0', '#7fd056': '#c8b4ff',
      '#4c9a3a': '#7fcfb5', '#a8744a': '#ffffff', '#8d5f3a': '#ff8fc4',
      '#7a5634': '#8d5a3b', '#5c3d22': '#6b3f27', '#9aa0a6': '#c9b6ff', '#868c93': '#b39dff',
      '#878d94': '#a98bff', '#a9afb5': '#ddd0ff',
    },
  },
};

/** Night lighting, layered on top of any theme in dark mode. */
export const NIGHT = {
  sky: ['#070b24', '#1a1f4f', '#3b3577'],
  fog: '#151a3d',
  hemi: ['#5b6bb5', '#1a2433'],
  hemiIntensity: 0.75,
  sun: '#a9bcff',
  sunIntensity: 1.5,
};
