import {themes as prismThemes} from 'prism-react-renderer';
import tocIncludeH1 from './src/remark/toc-include-h1.cjs';

const {shiftHeadingsForToc, restoreHeadingsAfterToc} = tocIncludeH1;

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Veredas',
  tagline: 'Sistema Veredas',
  favicon: 'img/favicon.ico',
  future: {v4: true},

  url: 'https://veredas-wiki.netlify.app',
  baseUrl: '/',

  // Notas do Obsidian podem ter links para páginas ainda não escritas.
  onBrokenLinks: 'warn',
  markdown: {
    // .md = Markdown comum (sem MDX): o que o Obsidian escreve não quebra o build.
    format: 'detect',
    hooks: {onBrokenMarkdownLinks: 'warn', onBrokenMarkdownImages: 'warn'},
  },

  i18n: {defaultLocale: 'pt-BR', locales: ['pt-BR']},

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: '/',
          sidebarPath: './sidebars.js',
          breadcrumbs: true,
          beforeDefaultRemarkPlugins: [shiftHeadingsForToc],
          remarkPlugins: [restoreHeadingsAfterToc],
        },
        blog: false,
        theme: {customCss: './src/css/custom.css'},
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: {respectPrefersColorScheme: true},
      tableOfContents: {minHeadingLevel: 2, maxHeadingLevel: 3},
      navbar: {title: 'Veredas', items: []},
      prism: {theme: prismThemes.github, darkTheme: prismThemes.dracula},
    }),
};

export default config;
