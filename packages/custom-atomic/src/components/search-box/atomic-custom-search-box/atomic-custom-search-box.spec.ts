import { newSpecPage } from '@stencil/core/testing';
import { AtomicCustomSearchBox } from './atomic-custom-search-box';

describe('atomic-custom-search-box', () => {
  it('renders', async () => {
    const { root } = await newSpecPage({
      components: [AtomicCustomSearchBox],
      html: '<atomic-custom-search-box></atomic-custom-search-box>',
    });
    expect(root).toEqualHtml(`
      <atomic-custom-search-box>
        <mock:shadow-root>
          <div>
            tab
          </div>
        </mock:shadow-root>
      </atomic-custom-search-box>
    `);
  });

  it('renders with values', async () => {
    const { root } = await newSpecPage({
      components: [AtomicCustomSearchBox],
      html: `<atomic-custom-search-box first="Stencil" last="'Don't call me a framework' JS"></atomic-custom-search-box>`,
    });
    expect(root).toEqualHtml(`
      <atomic-custom-search-box first="Stencil" last="'Don't call me a framework' JS">
        <mock:shadow-root>
          <div>
            Hello, World! I'm Stencil 'Don't call me a framework' JS
          </div>
        </mock:shadow-root>
      </atomic-custom-search-box>
    `);
  });
});
