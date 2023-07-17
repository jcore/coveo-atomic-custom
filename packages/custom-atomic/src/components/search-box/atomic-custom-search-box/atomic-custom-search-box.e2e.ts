import { newE2EPage } from '@stencil/core/testing';

describe('atomic-custom-search-box', () => {
  it('renders', async () => {
    const page = await newE2EPage();

    await page.setContent('<atomic-custom-search-box></atomic-custom-search-box>');
    const element = await page.find('atomic-custom-search-box');
    expect(element).toHaveClass('hydrated');
  });

  it('renders changes to the name data', async () => {
    const page = await newE2EPage();

    await page.setContent('<atomic-custom-search-box></atomic-custom-search-box>');
    const component = await page.find('atomic-custom-search-box');
    const element = await page.find('atomic-custom-search-box >>> div');
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
