import { newSpecPage } from '@stencil/core/testing';
import { AtomicCustomSearchBoxQuerySuggestions } from './atomic-custom-search-box-query-suggestions';

describe('atomic-custom-search-box-query-suggestions', () => {
  it('renders', async () => {
    const { root } = await newSpecPage({
      components: [AtomicCustomSearchBoxQuerySuggestions],
      html: '<atomic-custom-search-box-query-suggestions></atomic-custom-search-box-query-suggestions>',
    });
    expect(root).toEqualHtml(`
      <atomic-custom-search-box-query-suggestions>
        <mock:shadow-root>
          <div>
            tab
          </div>
        </mock:shadow-root>
      </atomic-custom-search-box-query-suggestions>
    `);
  });

  it('renders with values', async () => {
    const { root } = await newSpecPage({
      components: [AtomicCustomSearchBoxQuerySuggestions],
      html: `<atomic-custom-search-box-query-suggestions first="Stencil" last="'Don't call me a framework' JS"></atomic-custom-search-box-query-suggestions>`,
    });
    expect(root).toEqualHtml(`
      <atomic-custom-search-box-query-suggestions first="Stencil" last="'Don't call me a framework' JS">
        <mock:shadow-root>
          <div>
            Hello, World! I'm Stencil 'Don't call me a framework' JS
          </div>
        </mock:shadow-root>
      </atomic-custom-search-box-query-suggestions>
    `);
  });
});
