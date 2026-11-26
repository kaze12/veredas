function shiftHeadingsForToc() {
  return async (tree) => {
    const {visit} = await import('unist-util-visit');

    let firstH1Found = false;

    visit(tree, 'heading', (node) => {
      /*
       * O primeiro H1 é o título do documento.
       * Mantê-lo como H1 permite que o Docusaurus reconheça
       * que a página já possui título e evita duplicação.
       */
      if (node.depth === 1 && !firstH1Found) {
        firstH1Found = true;
        return;
      }

      /*
       * Demais headings são deslocados temporariamente:
       *
       * H1 -> H2
       * H2 -> H3
       * H3 -> H4
       * H4 -> H5
       * H5 -> H6
       *
       * Isso permite que H1 internos entrem no TOC.
       */
      if (node.depth >= 1 && node.depth <= 5) {
        node.data ??= {};
        node.data.zhangQianOriginalDepth = node.depth;
        node.depth += 1;
      }
    });
  };
}

function restoreHeadingsAfterToc() {
  return async (tree) => {
    const {visit} = await import('unist-util-visit');

    visit(tree, 'heading', (node) => {
      const originalDepth = node.data?.zhangQianOriginalDepth;

      if (originalDepth) {
        node.depth = originalDepth;
        delete node.data.zhangQianOriginalDepth;
      }
    });
  };
}

module.exports = {
  shiftHeadingsForToc,
  restoreHeadingsAfterToc,
};
