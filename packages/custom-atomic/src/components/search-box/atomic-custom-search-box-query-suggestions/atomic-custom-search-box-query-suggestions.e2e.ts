import { newE2EPage } from '@stencil/core/testing';

describe('atomic-custom-search-box-query-suggestions', () => {
  it('renders', async () => {
    const page = await newE2EPage();

    await page.setContent('<atomic-custom-search-box-query-suggestions></atomic-custom-search-box-query-suggestions>');
    const element = await page.find('atomic-custom-search-box-query-suggestions');
    expect(element).toHaveClass('hydrated');
  });

  it('renders changes to the name data', async () => {
    const page = await newE2EPage();

    await page.setContent('<atomic-custom-search-box-query-suggestions></atomic-custom-search-box-query-suggestions>');
    const component = await page.find('atomic-custom-search-box-query-suggestions');
    const element = await page.find('atomic-custom-search-box-query-suggestions >>> div');
    expect(element.textContent).toEqual(`Hello, World! I'm `);

    component.setProperty('first', 'James');
    await page.waitForChanges();
    expect(element.textContent).toEqual(`Hello, World! I'm James`);

    component.setProperty('last', 'Quincy');
    await page.waitForChanges();
    expect(element.textContent).toEqual(`Hello, World! I'm James Quincy`);

    component.setProperty('middle', 'Earl');
    await page.waitForChanges();
    expect(element.textContent).toEqual(`Hello, World! I'm James Earl Quincy`);
  });
});
